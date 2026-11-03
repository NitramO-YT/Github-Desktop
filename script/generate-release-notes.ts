/* eslint-disable no-sync */

// This script stays CommonJS, required rather than imported, types included:
// Node runs it with its own type stripping, and any import statement, even a
// type-only one, makes it treat the file as an ES module. It then fails to
// resolve './release-notes-changelog' without its extension, and with an
// `import type` it does not run the script at all, without an error.
type ReleaseNoteEntry = import('./release-notes-changelog').ReleaseNoteEntry
type ReleaseNotesGroups = import('./release-notes-changelog').ReleaseNotesGroups

const {
  findPreviousLinuxBuild,
  getUpstreamVersion,
  groupUpstreamEntries,
  isInitialTag,
  selectUpstreamVersions,
}: typeof import('./release-notes-changelog') = require('./release-notes-changelog')

const glob = require('glob')
const { basename, dirname, join } = require('path')
const fs = require('fs')

const PACKAGE_EXTENSIONS = ['.deb', '.rpm', '.AppImage']

// The Flatpak is built from the .deb by a job of its own, after these notes are
// written. Its row of the download table is left as this line, which the job
// that creates the release replaces once the Flatpak and its checksum exist.
const FLATPAK_ROW = '<!-- flatpak -->'

const Glob = glob.GlobSync

const args = process.argv.slice(2)
const artifactsDir = args[0]

if (!artifactsDir) {
  console.error(
    `🔴 First parameter with artifacts directory not found. Aborting...`
  )
  process.exit(1)
}

const releaseTagWithoutPrefix = args[1]
if (!releaseTagWithoutPrefix) {
  console.error(`🔴 Second parameter with release tag not found. Aborting...`)
  process.exit(1)
}

console.log(
  `Preparing release notes for release tag ${releaseTagWithoutPrefix}`
)

const files = new Glob(artifactsDir + '/**/*', { nodir: true })

const matches = files.found as Array<string>

// A release ships one checksum file per package, whatever the number of
// architectures and formats a given release is built for.
const packages = matches.filter(f =>
  PACKAGE_EXTENSIONS.some(extension => f.endsWith(extension))
)

if (packages.length === 0) {
  console.error(
    `🔴 Artifacts folder has no package at all, looked for ${PACKAGE_EXTENSIONS.join(
      ', '
    )}. Please check the GH Actions artifacts. Aborting...`
  )
  process.exit(1)
}

const packagesWithoutChecksum = packages.filter(
  f => !matches.includes(`${f}.sha256`)
)

if (packagesWithoutChecksum.length > 0) {
  console.error(
    `🔴 These packages have no checksum file next to them: ${packagesWithoutChecksum.join(
      ', '
    )}. Aborting...`
  )
  process.exit(1)
}

console.log(
  `Found ${packages.length} packages, each with its checksum, in artifacts directory`
)

const rootDir = dirname(__dirname)

const linuxReleases = readLinuxChangelog()
const linuxChanges = linuxReleases[releaseTagWithoutPrefix] ?? []

// Every published build has its entry in linux-changelog.json, which is also
// how the notes of the next build find the build their users had before it.
if (linuxChanges.length === 0) {
  console.error(
    `🔴 No entry for ${releaseTagWithoutPrefix} in linux-changelog.json, which every published build needs. Aborting...`
  )
  process.exit(1)
}

const upstreamChanges = readUpstreamChanges(
  releaseTagWithoutPrefix,
  Object.keys(linuxReleases)
)

const draftReleaseNotes = generateDraftReleaseNotes(
  upstreamChanges,
  linuxChanges,
  releaseTagWithoutPrefix,
  packages
)
const releaseNotesPath = join(__dirname, 'release_notes.txt')

fs.writeFileSync(releaseNotesPath, draftReleaseNotes, { encoding: 'utf8' })

console.log(
  `✅ All done! The release notes have been written to ${releaseNotesPath}`
)

function readLinuxChangelog(): Record<string, Array<string>> {
  const changelogPath = join(rootDir, 'linux-changelog.json')

  if (!fs.existsSync(changelogPath)) {
    console.error(`🔴 linux-changelog.json not found. Aborting...`)
    process.exit(1)
  }

  return JSON.parse(fs.readFileSync(changelogPath, 'utf8'))['releases']
}

type UpstreamChanges = {
  groups: ReleaseNotesGroups
  // The upstream versions whose entries make up the groups, newest first.
  versions: Array<string>
  // The build users had before this one, when versions were skipped since.
  previousBuild: string | null
}

/**
 * Gathers what upstream changed for users of this build. Only the first build
 * made from an upstream release carries it, which a later build of the same
 * release would repeat word for word.
 */
function readUpstreamChanges(
  tag: string,
  linuxBuilds: ReadonlyArray<string>
): UpstreamChanges {
  if (!isInitialTag(tag)) {
    return {
      groups: groupUpstreamEntries([], {}, null),
      versions: [],
      previousBuild: null,
    }
  }

  const upstreamVersion = getUpstreamVersion(tag)
  const changelogFile = fs.readFileSync(join(rootDir, 'changelog.json'))
  const releases: Record<string, Array<string>> = JSON.parse(changelogFile)[
    'releases'
  ]

  if (!releases[upstreamVersion]) {
    console.error(
      `🔴 Changelog version ${upstreamVersion} not found in changelog.json, which is required for publishing a release based off an upstream release. Aborting...`
    )
    process.exit(1)
  }

  const previousBuild = findPreviousLinuxBuild(tag, linuxBuilds)
  const previousUpstream =
    previousBuild === null ? null : getUpstreamVersion(previousBuild)
  const versions = selectUpstreamVersions(
    upstreamVersion,
    previousUpstream,
    Object.keys(releases)
  )

  console.log(
    `upstream changes since ${
      previousBuild ?? 'no earlier build'
    }, from ${versions.join(', ')}`
  )

  return {
    groups: groupUpstreamEntries(versions, releases, previousUpstream),
    versions,
    previousBuild,
  }
}

function formatReleaseNote(note: ReleaseNoteEntry): string {
  const idsAsUrls = note.ids
    .map(id => `https://github.com/desktop/desktop/issues/${id}`)
    .join(' ')
  const contributorNote = note.contributor
    ? `. Thanks ${note.contributor}!`
    : ''

  const template = ` - ${note.text} - ${idsAsUrls}${contributorNote}`

  return template.trim()
}

// An upstream release only fills the categories it has something to say about:
// 3.6.6 has two entries under Improved and nothing else, where 3.6.5 had five
// fixes. A category with no entry is therefore the normal case rather than
// something missing, and it is left out instead of being published empty.
function renderSection(name: string, items: Array<ReleaseNoteEntry>): string {
  if (items.length === 0) {
    return ''
  }

  return `## ${name}\n\n${items.map(formatReleaseNote).join('\n')}`
}

/**
 * Opens the release notes on what this build is, since whoever lands here
 * arrives from a search engine as often as from the repository, and nothing
 * else on the page says that these packages are not published by GitHub.
 */
function renderHeader(tag: string, upstream: UpstreamChanges): string {
  const upstreamVersion = getUpstreamVersion(tag)
  const releaseLink = (version: string) =>
    `<https://github.com/desktop/desktop/releases/tag/release-${version}>`

  let upstreamChanges: string
  if (!isInitialTag(tag)) {
    upstreamChanges = `They are not published by GitHub. What the upstream release changed is listed on its own release page: ${releaseLink(
      upstreamVersion
    )}.`
  } else if (upstream.previousBuild !== null && upstream.versions.length > 1) {
    // Users of this channel had the previous build, so they also get every
    // upstream release made since, each of which has its own page.
    const releases = [...upstream.versions]
      .reverse()
      .map(version => `- ${version}: ${releaseLink(version)}`)
      .join('\n')
    upstreamChanges = `They are not published by GitHub, and the sections below list what changed upstream since the previous Linux build, \`${upstream.previousBuild}\`, gathered from these upstream releases:\n\n${releases}`
  } else {
    upstreamChanges = `They are not published by GitHub, and the sections below list what the upstream release changed: ${releaseLink(
      upstreamVersion
    )}.`
  }

  return `GitHub Desktop ${upstreamVersion} for Linux, build \`${tag}\`.

These packages are built from the code of the official ${upstreamVersion} release, with the changes this fork adds for Linux. ${upstreamChanges}

Which package to pick, what each one needs and the problems known to this build are in the README: <https://github.com/NitramO-YT/Github-Desktop#readme>.`
}

/**
 * Renders what this Linux build adds on top of the upstream release, read from
 * linux-changelog.json.
 */
function renderLinuxChanges(entries: ReadonlyArray<string>): string {
  return `## Linux changes in this build\n\n${entries
    .map(entry => `- ${entry}`)
    .join('\n')}`
}

/**
 * Lists the packages with their checksums. The checksum files are attached to
 * the release as well, so this table is what lets someone compare a download
 * against the release page itself rather than against a file downloaded from
 * the same place.
 */
function renderPackages(packagePaths: Array<string>): string {
  const rows = [...packagePaths].sort().map(packagePath => {
    const checksum = fs
      .readFileSync(`${packagePath}.sha256`, 'utf8')
      .trim()
      .split(/\s+/)[0]

    return `| \`${basename(packagePath)}\` | \`${checksum}\` |`
  })

  return `## Downloads

| File | SHA-256 |
| --- | --- |
${rows.join('\n')}
${FLATPAK_ROW}

To check a download, put its \`.sha256\` file next to it and run \`sha256sum -c <file>.sha256\`.`
}

/**
 * Takes the release notes entries and the SHA entries, then merges them into the full draft release notes ✨
 */
function generateDraftReleaseNotes(
  upstream: UpstreamChanges,
  linuxChanges: ReadonlyArray<string>,
  tag: string,
  packagePaths: Array<string>
): string {
  const { groups } = upstream
  const sections = [
    renderHeader(tag, upstream),
    renderPackages(packagePaths),
    renderLinuxChanges(linuxChanges),
    renderSection('New', groups.new),
    renderSection('Added', groups.added),
    renderSection('Fixed', groups.fixed),
    renderSection('Improved', groups.improved),
    renderSection('Removed', groups.removed),
  ]

  return `${sections.filter(section => section !== '').join('\n\n')}\n`
}

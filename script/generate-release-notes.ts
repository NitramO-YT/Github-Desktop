/* eslint-disable no-sync */

const glob = require('glob')
const { basename, dirname, join } = require('path')
const fs = require('fs')

type ReleaseNotesGroupType = 'new' | 'added' | 'fixed' | 'improved' | 'removed'

type ReleaseNotesGroups = Record<ReleaseNotesGroupType, Array<ReleaseNoteEntry>>

type ReleaseNoteEntry = {
  text: string
  ids: Array<number>
  contributor?: string
}

const PACKAGE_EXTENSIONS = ['.deb', '.rpm', '.AppImage']

// A tag reads X.Y.Z-linuxN: the version of the upstream release this build
// comes from, then the revision of the Linux build made from it. Declared up
// here because the body of this script runs before the functions below it.
const LINUX_REVISION = /-(linux|test)\d+$/

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

const releaseNotesByGroup = getReleaseGroups(releaseTagWithoutPrefix)

const draftReleaseNotes = generateDraftReleaseNotes(
  releaseNotesByGroup,
  releaseTagWithoutPrefix,
  packages
)
const releaseNotesPath = join(__dirname, 'release_notes.txt')

fs.writeFileSync(releaseNotesPath, draftReleaseNotes, { encoding: 'utf8' })

console.log(
  `✅ All done! The release notes have been written to ${releaseNotesPath}`
)

function extractIds(str: string): Array<number> {
  const idRegex = /#(\d+)/g

  const idArray = new Array<number>()
  let match

  while ((match = idRegex.exec(str))) {
    const textValue = match[1].trim()
    const numValue = parseInt(textValue, 10)
    if (!isNaN(numValue)) {
      idArray.push(numValue)
    }
  }

  return idArray
}

function parseCategory(str: string): ReleaseNotesGroupType | null {
  const input = str.toLocaleLowerCase()
  switch (input) {
    case 'added':
    case 'fixed':
    case 'improved':
    case 'new':
    case 'removed':
      return input
    default:
      return null
  }
}

function isInitialTag(tag: string): boolean {
  return tag.endsWith('-linux1') || tag.endsWith('-test1')
}

function getVersionWithoutSuffix(tag: string): string {
  return tag.replace(LINUX_REVISION, '')
}

function getReleaseGroups(version: string): ReleaseNotesGroups {
  if (!isInitialTag(version)) {
    return {
      new: [],
      added: [],
      fixed: [],
      improved: [],
      removed: [],
    }
  }

  const upstreamVersion = getVersionWithoutSuffix(version)
  const rootDir = dirname(__dirname)
  const changelogFile = fs.readFileSync(join(rootDir, 'changelog.json'))
  const changelogJson = JSON.parse(changelogFile)
  const releases = changelogJson['releases']
  const changelogForVersion: Array<string> | undefined =
    releases[upstreamVersion]

  if (!changelogForVersion) {
    console.error(
      `🔴 Changelog version ${upstreamVersion} not found in changelog.json, which is required for publishing a release based off an upstream releease. Aborting...`
    )
    process.exit(1)
  }

  console.log(`found release notes`, changelogForVersion)

  const releaseNotesByGroup: ReleaseNotesGroups = {
    new: [],
    added: [],
    fixed: [],
    improved: [],
    removed: [],
  }

  const releaseEntryExternalContributor = /\[(.*)\](.*)- (.*)\. Thanks (.*)!/
  const releaseEntryRegex = /\[(.*)\](.*)- (.*)/

  for (const entry of changelogForVersion) {
    const externalMatch = releaseEntryExternalContributor.exec(entry)
    if (externalMatch) {
      const category = parseCategory(externalMatch[1])
      const text = externalMatch[2].trim()
      const ids = extractIds(externalMatch[3])
      const contributor = externalMatch[4]

      if (!category) {
        console.warn(`unable to identify category for '${entry}'`)
      } else {
        releaseNotesByGroup[category].push({
          text,
          ids,
          contributor,
        })
      }
    } else {
      const match = releaseEntryRegex.exec(entry)
      if (match) {
        const category = parseCategory(match[1])
        const text = match[2].trim()
        const ids = extractIds(match[3])
        if (!category) {
          console.warn(`unable to identify category for '${entry}'`)
        } else {
          releaseNotesByGroup[category].push({
            text,
            ids,
          })
        }
      } else {
        console.warn(`release entry does not match any format: '${entry}'`)
      }
    }
  }

  return releaseNotesByGroup
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
function renderHeader(tag: string): string {
  const upstreamVersion = getVersionWithoutSuffix(tag)

  return `GitHub Desktop ${upstreamVersion} for Linux, build \`${tag}\`.

These packages are built from the code of the official ${upstreamVersion} release, with the changes this fork adds for Linux. They are not published by GitHub, and the sections below list what the upstream release changed: <https://github.com/desktop/desktop/releases/tag/release-${upstreamVersion}>.

Which package to pick, what each one needs and the problems known to this build are in the README: <https://github.com/NitramO-YT/Github-Desktop#readme>.`
}

/**
 * Renders what this Linux build adds on top of the upstream release, read from
 * linux-changelog.json. A version absent from that file simply has no such
 * section, which is what happens when a build carries nothing of its own.
 */
function renderLinuxChanges(tag: string): string {
  const changelogPath = join(dirname(__dirname), 'linux-changelog.json')

  if (!fs.existsSync(changelogPath)) {
    return ''
  }

  const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'))
  const entries: Array<string> = changelog['releases'][tag] ?? []

  if (entries.length === 0) {
    console.warn(
      `no Linux changelog entry for ${tag}, the release notes will only carry the upstream changelog`
    )
    return ''
  }

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

To check a download, put its \`.sha256\` file next to it and run \`sha256sum -c <file>.sha256\`.`
}

/**
 * Takes the release notes entries and the SHA entries, then merges them into the full draft release notes ✨
 */
function generateDraftReleaseNotes(
  releaseNotesGroups: ReleaseNotesGroups,
  tag: string,
  packagePaths: Array<string>
): string {
  const sections = [
    renderHeader(tag),
    renderPackages(packagePaths),
    renderLinuxChanges(tag),
    renderSection('New', releaseNotesGroups.new),
    renderSection('Added', releaseNotesGroups.added),
    renderSection('Fixed', releaseNotesGroups.fixed),
    renderSection('Improved', releaseNotesGroups.improved),
    renderSection('Removed', releaseNotesGroups.removed),
  ]

  return `${sections.filter(section => section !== '').join('\n\n')}\n`
}

import * as semver from 'semver'

export type ReleaseNotesGroupType =
  | 'new'
  | 'added'
  | 'fixed'
  | 'improved'
  | 'removed'

export type ReleaseNoteEntry = {
  text: string
  ids: Array<number>
  contributor?: string
}

export type ReleaseNotesGroups = Record<
  ReleaseNotesGroupType,
  Array<ReleaseNoteEntry>
>

// A tag reads X.Y.Z-linuxN: the version of the upstream release this build
// comes from, then the revision of the Linux build made from it. The -testN
// form names trial builds, which are never published.
const LINUX_REVISION = /-(linux|test)\d+$/

const PUBLISHED_LINUX_BUILD = /-linux\d+$/

export function getUpstreamVersion(tag: string): string {
  return tag.replace(LINUX_REVISION, '')
}

export function isInitialTag(tag: string): boolean {
  return tag.endsWith('-linux1') || tag.endsWith('-test1')
}

function isPrerelease(version: string): boolean {
  return semver.prerelease(version) !== null
}

/**
 * Finds the Linux build that users of the same channel had before this one,
 * among the builds listed in linux-changelog.json: the newest one made from an
 * older upstream release, beta for a beta and final for a final, since the
 * stable and latest channels never serve a beta. Returns null for the first
 * build of its kind.
 */
export function findPreviousLinuxBuild(
  tag: string,
  linuxBuilds: ReadonlyArray<string>
): string | null {
  const current = getUpstreamVersion(tag)
  let previous: string | null = null

  for (const build of linuxBuilds) {
    if (!PUBLISHED_LINUX_BUILD.test(build)) {
      continue
    }

    const upstream = getUpstreamVersion(build)
    if (
      semver.valid(upstream) === null ||
      isPrerelease(upstream) !== isPrerelease(current) ||
      !semver.lt(upstream, current)
    ) {
      continue
    }

    if (
      previous === null ||
      semver.gt(upstream, getUpstreamVersion(previous))
    ) {
      previous = build
    }
  }

  return previous
}

/**
 * Picks the upstream changelog entries that tell users of this build what
 * changed since the build they had, newest first.
 *
 * A final build takes, for every upstream release made since that build, its
 * own entry, or the entries of its betas when changelog.json has none for the
 * final: upstream 3.6.10 descends from 3.6.9-beta1 but not from the commit
 * that numbered 3.6.9, so its changelog.json lists 3.6.9-beta1 and no 3.6.9.
 *
 * A beta build takes every upstream version since that build, betas and
 * finals alike, as beta users get them all.
 */
export function selectUpstreamVersions(
  currentUpstream: string,
  previousUpstream: string | null,
  changelogVersions: ReadonlyArray<string>
): Array<string> {
  if (previousUpstream === null) {
    return [currentUpstream]
  }

  const since = changelogVersions.filter(
    version =>
      semver.valid(version) !== null &&
      semver.gt(version, previousUpstream) &&
      semver.lte(version, currentUpstream)
  )

  const selected = isPrerelease(currentUpstream)
    ? since
    : since.filter(version => {
        if (!isPrerelease(version)) {
          return true
        }
        const final = `${semver.major(version)}.${semver.minor(
          version
        )}.${semver.patch(version)}`
        return !since.includes(final)
      })

  return selected.sort(semver.rcompare)
}

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

type ParsedEntry = {
  category: ReleaseNotesGroupType
  note: ReleaseNoteEntry
}

/**
 * Reads an upstream changelog entry: its category, its text, then usually the
 * pull requests it comes from ("- #23075") and a contributor to thank. Some
 * entries name no pull request at all ("[Improved] Update Git to 2.56.1", the
 * only entry of 3.6.11), and some have a dash of their own with no number
 * after it ("- CVE-2025-23040, …"): both keep their whole text, since a dash
 * only ends the text when pull request numbers follow it.
 */
function parseEntry(entry: string): ParsedEntry | null {
  const releaseEntryExternalContributor =
    /\[(.*)\](.*)- (.*#\d.*)\. Thanks (.*)!/
  const releaseEntryRegex = /\[(.*)\](.*)- (.*#\d.*)/
  const releaseEntryWithoutReference = /\[(.*)\](.*)()/

  const externalMatch = releaseEntryExternalContributor.exec(entry)
  const match =
    externalMatch ??
    releaseEntryRegex.exec(entry) ??
    releaseEntryWithoutReference.exec(entry)

  if (!match) {
    console.warn(`release entry does not match any format: '${entry}'`)
    return null
  }

  const category = parseCategory(match[1])
  if (!category) {
    console.warn(`unable to identify category for '${entry}'`)
    return null
  }

  const note: ReleaseNoteEntry = {
    text: match[2].trim(),
    ids: extractIds(match[3]),
  }
  if (externalMatch) {
    note.contributor = externalMatch[4]
  }

  return { category, note }
}

/** One line of a release notes section, linking the pull requests if any. */
export function formatReleaseNote(note: ReleaseNoteEntry): string {
  const idsAsUrls = note.ids
    .map(id => `https://github.com/desktop/desktop/issues/${id}`)
    .join(' ')
  const references = idsAsUrls === '' ? '' : ` - ${idsAsUrls}`
  const contributorNote = note.contributor
    ? `. Thanks ${note.contributor}!`
    : ''

  return `- ${note.text}${references}${contributorNote}`
}

/**
 * Identifies a change across the changelog entries of different versions.
 * Upstream rewords an entry between a beta and its final release, and sometimes
 * repeats its number ("#22924 - #22924"), so the pull request numbers are what
 * stays the same; an entry without any falls back to its text. Within a single
 * version two entries may share a number, as the two changes of #22872 do in
 * 3.6.6, so this only compares entries of different versions.
 */
function keyOf(note: ReleaseNoteEntry): string {
  return note.ids.length > 0
    ? [...new Set(note.ids)].sort((a, b) => a - b).join(',')
    : note.text
}

/**
 * Sorts the entries of the given upstream versions into their categories,
 * listing each change once. The changes users of the previous build had are
 * left out: upstream lists the changes of its betas again in the final release
 * that follows them.
 *
 * What they had depends on their channel, read from the previous build since
 * a channel only follows builds of its own kind. A beta user had every upstream
 * version up to that build, betas included. A user of a final build only had
 * the finals: a beta change may be held back from the final that follows, as
 * the removal of macOS 12 support was, announced in 3.6.6-beta1, left out of
 * 3.6.6 and only shipped in 3.6.8.
 */
export function groupUpstreamEntries(
  versions: ReadonlyArray<string>,
  releases: Readonly<Record<string, ReadonlyArray<string>>>,
  previousUpstream: string | null
): ReleaseNotesGroups {
  const groups: ReleaseNotesGroups = {
    new: [],
    added: [],
    fixed: [],
    improved: [],
    removed: [],
  }

  const seen = new Set<string>()

  if (previousUpstream !== null) {
    const betaChannel = isPrerelease(previousUpstream)
    for (const [version, entries] of Object.entries(releases)) {
      if (
        semver.valid(version) === null ||
        semver.gt(version, previousUpstream) ||
        (!betaChannel && isPrerelease(version))
      ) {
        continue
      }
      for (const entry of entries) {
        const parsed = parseEntry(entry)
        if (parsed) {
          seen.add(keyOf(parsed.note))
        }
      }
    }
  }

  for (const version of versions) {
    const listedHere = new Set<string>()
    for (const entry of releases[version] ?? []) {
      const parsed = parseEntry(entry)
      if (!parsed) {
        continue
      }
      const key = keyOf(parsed.note)
      if (seen.has(key)) {
        continue
      }
      listedHere.add(key)
      groups[parsed.category].push(parsed.note)
    }
    listedHere.forEach(key => seen.add(key))
  }

  return groups
}

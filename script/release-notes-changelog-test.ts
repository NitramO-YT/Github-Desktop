import assert from 'node:assert'
import { describe, it } from 'node:test'
import {
  findPreviousLinuxBuild,
  formatReleaseNote,
  groupUpstreamEntries,
  selectUpstreamVersions,
} from './release-notes-changelog'

const linuxBuilds = [
  '3.6.11-beta1-linux1',
  '3.6.10-linux1',
  '3.6.8-beta4-linux1',
  '3.6.7-linux1',
  '3.6.7-beta3-linux1',
  '3.6.7-beta2-linux3',
  '3.6.6-linux3',
  '3.6.6-linux1',
]

// Shaped like upstream changelog.json as merged with 3.6.10: no entry for
// 3.6.9, whose numbering commit 3.6.10 does not descend from.
const releases: Record<string, Array<string>> = {
  '3.6.11-beta1': ['[New] Work with several accounts side by side - #23020'],
  '3.6.10': ['[Fixed] Update Git for Windows - #23075'],
  '3.6.10-beta1': ['[Fixed] Update Git for Windows - #23075'],
  '3.6.9-beta1': ['[Fixed] Do not crash when Copilot stops - #23066'],
  '3.6.8': [
    '[New] Use short-lived tokens - #22943',
    '[Added] Highlight Svelte files - #22969. Thanks @Klaynight-dev!',
    '[Fixed] Keep focus visible in the dropdowns - #23019',
    '[Removed] Remove support for macOS 12 - #22799',
  ],
  '3.6.8-beta4': ['[Fixed] Keep focus visible in the dropdowns - #23019'],
  '3.6.8-beta1': ['[New] Use short-lived tokens for new users - #22943'],
  '3.6.7': ['[Fixed] Open repositories in Finder - #22924'],
  '3.6.7-beta3': ['[Fixed] Open repositories in Finder - #22924 - #22924'],
  // Announced in this beta, held back from 3.6.6, shipped in 3.6.8.
  '3.6.6-beta1': ['[Removed] Remove support for macOS 12 - #22799'],
}

describe('findPreviousLinuxBuild', () => {
  it('finds the newest older final build for a final build', () => {
    assert.equal(
      findPreviousLinuxBuild('3.6.10-linux1', linuxBuilds),
      '3.6.7-linux1'
    )
  })

  it('finds the newest older beta build for a beta build', () => {
    assert.equal(
      findPreviousLinuxBuild('3.6.11-beta1-linux1', linuxBuilds),
      '3.6.8-beta4-linux1'
    )
  })

  it('skips the later revisions of the same upstream release', () => {
    assert.equal(findPreviousLinuxBuild('3.6.6-linux3', linuxBuilds), null)
  })

  it('ignores trial builds, which are never published', () => {
    assert.equal(
      findPreviousLinuxBuild('3.6.10-linux1', ['3.6.9-test1', '3.6.7-linux1']),
      '3.6.7-linux1'
    )
  })

  it('returns null for the first build of its kind', () => {
    assert.equal(
      findPreviousLinuxBuild('3.6.7-beta2-linux3', linuxBuilds),
      null
    )
  })
})

describe('selectUpstreamVersions', () => {
  const versions = Object.keys(releases)

  it('keeps the release alone when there is no earlier build', () => {
    assert.deepEqual(selectUpstreamVersions('3.6.10', null, versions), [
      '3.6.10',
    ])
  })

  it('keeps the release alone when no upstream release was skipped', () => {
    assert.deepEqual(selectUpstreamVersions('3.6.8', '3.6.7', ['3.6.8']), [
      '3.6.8',
    ])
  })

  it('takes the skipped finals, or their betas when the final has no entry', () => {
    assert.deepEqual(selectUpstreamVersions('3.6.10', '3.6.7', versions), [
      '3.6.10',
      '3.6.9-beta1',
      '3.6.8',
    ])
  })

  it('takes every version since the previous beta for a beta', () => {
    assert.deepEqual(
      selectUpstreamVersions('3.6.11-beta1', '3.6.8-beta4', versions),
      ['3.6.11-beta1', '3.6.10', '3.6.10-beta1', '3.6.9-beta1', '3.6.8']
    )
  })
})

describe('groupUpstreamEntries', () => {
  it('lists every entry of a single release', () => {
    const groups = groupUpstreamEntries(['3.6.8'], releases, null)
    assert.deepEqual(
      groups.new.map(n => n.text),
      ['Use short-lived tokens']
    )
    assert.deepEqual(groups.added, [
      {
        text: 'Highlight Svelte files',
        ids: [22969],
        contributor: '@Klaynight-dev',
      },
    ])
    assert.deepEqual(
      groups.fixed.map(n => n.ids),
      [[23019]]
    )
  })

  it('lists a change once when several releases mention it', () => {
    const groups = groupUpstreamEntries(
      ['3.6.11-beta1', '3.6.10', '3.6.10-beta1', '3.6.9-beta1', '3.6.8'],
      releases,
      '3.6.8-beta4'
    )
    assert.deepEqual(
      groups.fixed.map(n => n.ids),
      [[23075], [23066]]
    )
  })

  it('leaves out what users of the previous build already had', () => {
    const groups = groupUpstreamEntries(
      ['3.6.11-beta1', '3.6.10', '3.6.10-beta1', '3.6.9-beta1', '3.6.8'],
      releases,
      '3.6.8-beta4'
    )
    // The tokens (beta1) and the focus fix (beta4) shipped up to 3.6.8-beta4,
    // reworded in 3.6.8; Svelte highlighting arrived with the final only.
    assert.deepEqual(
      groups.new.map(n => n.ids),
      [[23020]]
    )
    assert.deepEqual(
      groups.added.map(n => n.ids),
      [[22969]]
    )
  })

  it('gathers the skipped releases of a final build', () => {
    const groups = groupUpstreamEntries(
      ['3.6.10', '3.6.9-beta1', '3.6.8'],
      releases,
      '3.6.7'
    )
    assert.deepEqual(
      groups.fixed.map(n => n.ids),
      [[23075], [23066], [23019]]
    )
    assert.deepEqual(
      groups.new.map(n => n.ids),
      [[22943]]
    )
  })

  it('keeps for a final build a change only an earlier beta announced', () => {
    const groups = groupUpstreamEntries(
      ['3.6.10', '3.6.9-beta1', '3.6.8'],
      releases,
      '3.6.7'
    )
    assert.deepEqual(
      groups.removed.map(n => n.ids),
      [[22799]]
    )
  })

  it('leaves out for a beta build a change an earlier beta announced', () => {
    const groups = groupUpstreamEntries(
      ['3.6.11-beta1', '3.6.10', '3.6.10-beta1', '3.6.9-beta1', '3.6.8'],
      releases,
      '3.6.8-beta4'
    )
    assert.deepEqual(groups.removed, [])
  })

  it('keeps two changes of one version that share a pull request', () => {
    const groups = groupUpstreamEntries(
      ['3.6.6'],
      {
        '3.6.6': [
          '[Improved] Ask before revealing certain folders - #22872',
          '[Improved] Improve how .gitignore files are handled - #22872',
        ],
      },
      null
    )
    assert.equal(groups.improved.length, 2)
  })

  it('treats a repeated pull request number as one', () => {
    const groups = groupUpstreamEntries(['3.6.7'], releases, '3.6.7-beta3')
    assert.deepEqual(groups.fixed, [])
  })

  it('keeps an entry that names no pull request', () => {
    const groups = groupUpstreamEntries(
      ['3.6.11'],
      { '3.6.11': ['[Improved] Update Git to 2.56.1'] },
      null
    )
    assert.deepEqual(groups.improved, [
      { text: 'Update Git to 2.56.1', ids: [] },
    ])
  })

  it('keeps the whole text when a dash is followed by no number', () => {
    const entry =
      "[Fixed] Mitigates vulnerabilities in Git's credential helper - CVE-2025-23040, CVE-2024-50349"
    const groups = groupUpstreamEntries(['3.5.1'], { '3.5.1': [entry] }, null)
    assert.deepEqual(groups.fixed, [
      {
        text: "Mitigates vulnerabilities in Git's credential helper - CVE-2025-23040, CVE-2024-50349",
        ids: [],
      },
    ])
  })
})

describe('formatReleaseNote', () => {
  it('links the pull requests and thanks the contributor', () => {
    assert.equal(
      formatReleaseNote({
        text: 'Highlight Svelte files',
        ids: [22969],
        contributor: '@Klaynight-dev',
      }),
      '- Highlight Svelte files - https://github.com/desktop/desktop/issues/22969. Thanks @Klaynight-dev!'
    )
  })

  it('leaves no trailing dash when no pull request is named', () => {
    assert.equal(
      formatReleaseNote({ text: 'Update Git to 2.56.1', ids: [] }),
      '- Update Git to 2.56.1'
    )
  })
})

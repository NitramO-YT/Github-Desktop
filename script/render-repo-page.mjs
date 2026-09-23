// Fills the download table of the repository landing page.
//
// The page names versions, so it cannot be a fixed file copied as-is: it is
// rendered from the tree that has just been built, which is the only place
// that knows what each channel ended up serving.
//
// Usage: node render-repo-page.mjs <template> <repo-dir> <state.json> <out>

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

const [template, repoDir, statePath, out] = process.argv.slice(2)

const RELEASES = 'https://github.com/NitramO-YT/Github-Desktop/releases/tag'
const MARKER = '<!-- downloads -->'

const CHANNELS = [
  { key: 'stable', label: 'Stable' },
  { key: 'latest', label: 'Latest' },
  { key: 'beta', label: 'Beta' },
]

/** Human-readable size, the way a download page states one. */
function readableSize(bytes) {
  const mb = bytes / (1024 * 1024)
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

/** Finds the package of a version inside a directory, by name. */
function findPackage(dir, version, extension) {
  if (!existsSync(dir)) return null
  const name = readdirSync(dir).find(
    f => f.endsWith(extension) && f.includes(version)
  )
  if (!name) return null
  return { name, size: statSync(join(dir, name)).size }
}

const state = JSON.parse(readFileSync(statePath, 'utf8'))
const rows = []

for (const { key, label } of CHANNELS) {
  // Only the version a channel currently serves is listed. Older ones stay
  // downloadable for a rollback, but a page offering three versions per
  // channel asks the reader to choose where there is nothing to choose.
  const version = (state[key] ?? [])[0]
  if (!version) continue

  const deb = findPackage(
    join(repoDir, 'deb', 'pool', key, 'main', 'g', 'github-desktop'),
    version,
    '.deb'
  )
  const rpm = findPackage(join(repoDir, 'rpm', key), version, '.rpm')

  const cell = (pkg, href) =>
    pkg
      ? `<a href="${href}">${escapeHtml(basename(pkg.name))}</a><br /><span class="size">${readableSize(pkg.size)}</span>`
      : '&mdash;'

  rows.push(`        <tr>
          <td><code>${key}</code><br /><span class="size">${label}</span></td>
          <td>${escapeHtml(version)}</td>
          <td>${cell(deb, `/deb/pool/${key}/main/g/github-desktop/${deb?.name}`)}</td>
          <td>${cell(rpm, `/rpm/${key}/${rpm?.name}`)}</td>
          <td><a href="${RELEASES}/release-${encodeURIComponent(version)}">AppImage and checksums</a></td>
        </tr>`)
}

const section = rows.length
  ? `    <h2>Download a file directly</h2>
    <p>
      For a distribution this repository does not cover, or to install without
      subscribing to it. The AppImage and the checksum files live with the
      release they belong to.
    </p>
    <table>
      <thead>
        <tr>
          <th>Channel</th>
          <th>Version</th>
          <th>Debian package</th>
          <th>RPM package</th>
          <th>Everything else</th>
        </tr>
      </thead>
      <tbody>
${rows.join('\n')}
      </tbody>
    </table>
    <p class="note">
      Installing a file by hand does not subscribe the machine to updates. Add
      the repository above for that.
    </p>
`
  : ''

const page = readFileSync(template, 'utf8')
if (!page.includes(MARKER)) {
  console.error(`The template has no ${MARKER} placeholder.`)
  process.exit(1)
}

writeFileSync(out, page.replace(MARKER, section.trimEnd()))
console.log(`Landing page rendered with ${rows.length} channel(s) listed.`)

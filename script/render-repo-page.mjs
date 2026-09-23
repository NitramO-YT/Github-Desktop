// Fills the download section of the repository landing page.
//
// The page names versions, so it cannot be a fixed file copied as-is: it is
// rendered from the staging directory the repository was just built from,
// which is the only place that knows what each channel ended up serving.
//
// Besides the packages of each channel, the staging directory holds:
//
//   state.json               what each channel serves, newest first
//   checksums/<file>.sha256  the checksum files published with each release
//   assets/<version>.json    the name and size of every file of a release
//
// Every text is written in English and in French, each in an element carrying
// its lang attribute; the page shows one language and hides the other.
//
// Usage: node render-repo-page.mjs <template> <staging-dir> <out>

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const [template, stagingDir, out] = process.argv.slice(2)

const BASE_URL = 'https://packages-github-desktop.nitramo.fr'
const RELEASES = 'https://github.com/NitramO-YT/Github-Desktop/releases'
const MARKER = '<!-- downloads -->'

const CHANNELS = [
  { key: 'stable', en: 'Stable', fr: 'Stable' },
  { key: 'latest', en: 'Latest', fr: 'Dernière version' },
  { key: 'beta', en: 'Beta', fr: 'Bêta' },
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

/** Both languages of an inline text, already escaped. */
function bilingual(en, fr) {
  return `<span lang="en">${en}</span><span lang="fr">${fr}</span>`
}

/** Lists channel names the way a sentence would, in either language. */
function joinNames(names, and) {
  return names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`
}

/** Finds the package of a version among the files staged for a channel. */
function findPackage(dir, version, extension) {
  if (!existsSync(dir)) return null
  const name = readdirSync(dir).find(
    f => f.endsWith(extension) && f.includes(version)
  )
  if (!name) return null
  return { name, size: statSync(join(dir, name)).size }
}

/** The AppImage is only published on GitHub, so its size comes from there. */
function findAppImage(version) {
  const path = join(stagingDir, 'assets', `${version}.json`)
  const assets = JSON.parse(readFileSync(path, 'utf8'))
  const asset = assets.find(a => a.name.endsWith('.AppImage'))
  if (!asset) throw new Error(`release-${version} has no AppImage`)
  return { name: asset.name, size: asset.size }
}

/** Where the checksum of a file is listed, for the table to link to. */
function checksumId(fileName) {
  return escapeHtml(`sha256-${fileName}`)
}

/**
 * Reads the checksum published with a file. A missing or malformed one stops
 * the page from being rendered, rather than listing a file nobody can check.
 */
function readChecksum(fileName) {
  const path = join(stagingDir, 'checksums', `${fileName}.sha256`)
  const [hash, name] = readFileSync(path, 'utf8').trim().split(/\s+/)
  if (!/^[0-9a-f]{64}$/.test(hash) || name !== fileName) {
    throw new Error(`${path} does not hold the checksum of ${fileName}`)
  }
  return hash
}

const state = JSON.parse(readFileSync(join(stagingDir, 'state.json'), 'utf8'))
const rows = []
// Stable and latest usually serve the same version: its checksums are listed
// once, naming every channel that serves it.
const versions = new Map()

for (const channel of CHANNELS) {
  const { key } = channel
  // Only the version a channel currently serves is listed. Older ones stay
  // downloadable for a rollback, but a page offering three versions per
  // channel asks the reader to choose where there is nothing to choose.
  const version = (state[key] ?? [])[0]
  if (!version) continue

  const deb = findPackage(join(stagingDir, 'deb', key), version, '.deb')
  const rpm = findPackage(join(stagingDir, 'rpm', key), version, '.rpm')
  const appImage = findAppImage(version)
  const release = `release-${encodeURIComponent(version)}`

  const cell = (file, href) =>
    file
      ? `<a href="${href}">${escapeHtml(file.name)}</a><br /><span class="size">${readableSize(file.size)} &middot; <a href="#${checksumId(file.name)}">SHA-256</a></span>`
      : '&mdash;'

  rows.push(`        <tr>
          <td><code>${key}</code><br /><span class="size">${bilingual(channel.en, channel.fr)}</span></td>
          <td class="version"><a href="${RELEASES}/tag/${release}">${escapeHtml(version)}</a></td>
          <td>${cell(deb, `${BASE_URL}/deb/pool/${key}/main/g/github-desktop/${encodeURIComponent(deb?.name)}`)}</td>
          <td>${cell(rpm, `${BASE_URL}/rpm/${key}/${encodeURIComponent(rpm?.name)}`)}</td>
          <td>${cell(appImage, `${RELEASES}/download/${release}/${encodeURIComponent(appImage.name)}`)}</td>
        </tr>`)

  if (!versions.has(version)) {
    const files = [deb, rpm, appImage].filter(Boolean).map(f => f.name)
    versions.set(version, { channels: [], files })
  }
  versions.get(version).channels.push(key)
}

// Each version lists the checksum of every file on its own, to compare or copy
// one at a time, then gives them again as a command: pasted into a terminal
// opened in the download folder, it checks whichever of these files is there
// and ignores the others, which is what --ignore-missing is for.
const checksums = [...versions].map(([version, { channels, files }]) => {
  const sums = files.map(file => ({ file, hash: readChecksum(file) }))
  const list = sums
    .map(
      ({ file, hash }) => `      <dt id="${checksumId(file)}">${escapeHtml(file)}</dt>
      <dd><code class="hash">${hash}</code></dd>`
    )
    .join('\n')
  // The file name is kept whole, so that a line too wide for the page breaks
  // between the checksum and the name rather than inside the name.
  const lines = sums.map(
    ({ file, hash }) => `${hash}  <span class="file">${escapeHtml(file)}</span>`
  )
  return `    <p class="checksum-for">
      <strong>${escapeHtml(version)}</strong>
      ${bilingual(`(${joinNames(channels, 'and')})`, `(${joinNames(channels, 'et')})`)}
    </p>
    <dl class="sums">
${list}
    </dl>
    <p class="sums-command">
      ${bilingual(
        'To check them all at once, run this in the folder you downloaded to:',
        "Pour tout vérifier d'un coup, lancez ceci dans le dossier de téléchargement&nbsp;:"
      )}
    </p>
    <pre class="checksums"><code>sha256sum -c --ignore-missing &lt;&lt;'EOF'
${lines.join('\n')}
EOF</code></pre>`
})

const section = rows.length
  ? `    <h2>${bilingual('Download a file directly', 'Télécharger un fichier directement')}</h2>
    <p lang="en">
      For a distribution this repository does not cover, or to install without
      subscribing to it. Each version links to its release notes, and the
      checksums of every file follow the table.
    </p>
    <p lang="fr">
      Pour une distribution que ce dépôt ne couvre pas, ou pour installer sans
      vous y abonner. Chaque version renvoie à ses notes de version, et les
      empreintes de chaque fichier suivent le tableau.
    </p>
    <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>${bilingual('Channel', 'Canal')}</th>
          <th>Version</th>
          <th>${bilingual('Debian package', 'Paquet Debian')}</th>
          <th>${bilingual('RPM package', 'Paquet RPM')}</th>
          <th>AppImage</th>
        </tr>
      </thead>
      <tbody>
${rows.join('\n')}
      </tbody>
    </table>
    </div>
    <p class="note" lang="en">
      Installing a file by hand does not subscribe the machine to updates. Add
      the repository above for that.
    </p>
    <p class="note" lang="fr">
      Installer un fichier à la main n'abonne pas la machine aux mises à jour.
      Ajoutez le dépôt ci-dessus pour cela.
    </p>

    <h3>${bilingual('Checksums', 'Empreintes')}</h3>
    <p lang="en">
      The SHA-256 checksum of each file, as published with its release. The
      command under each list checks the files you downloaded: run it in their
      folder, and it says for each one whether it is the file that was
      released, <code>OK</code> or <code>FAILED</code> on a system in English,
      in the language of your system otherwise.
    </p>
    <p lang="fr">
      L'empreinte SHA-256 de chaque fichier, telle que publiée avec sa version.
      La commande sous chaque liste vérifie les fichiers téléchargés&nbsp;:
      lancez-la dans leur dossier, et elle indique pour chacun s'il s'agit bien
      du fichier publié, «&nbsp;Réussi&nbsp;» ou «&nbsp;Échec&nbsp;» sur un
      système en français, <code>OK</code> ou <code>FAILED</code> en anglais.
    </p>
${checksums.join('\n')}
`
  : ''

const page = readFileSync(template, 'utf8')
if (!page.includes(MARKER)) {
  console.error(`The template has no ${MARKER} placeholder.`)
  process.exit(1)
}

writeFileSync(out, page.replace(MARKER, section.trimEnd()))
console.log(
  `Landing page rendered with ${rows.length} channel(s) and ${versions.size} version(s) listed.`
)

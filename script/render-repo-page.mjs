// Renders the landing page of the package repository.
//
// The template holds the layout of the page and none of its words. Those live
// in locales/, next to the template, one file per language named after its
// tag (en.json, fr.json...), and each text is written into the page in every
// language, in an element marked with data-variant: the page shows the ones
// of its own language. Adding a language therefore means adding a file there
// and nothing else, since the switch, the detection of the reader's language
// and the formatting of sizes and lists all follow the files present.
//
// In the template, a key between double braces stands for its text, and a key
// followed by a | and some content gives that text a content of its own, for
// when no language has it. These comments are replaced as well:
//
//   <!-- language-data -->   the languages, for the scripts of the page
//   <!-- language-rules -->  the rules that show one language at a time
//   <!-- flatpak -->         the Flatpak section, described below
//   <!-- downloads -->       the download section, described below
//
// A text is taken from the first of: the language of the page, English, the
// content the template gives it, the key itself. Each step past the first is
// reported as a warning, so that a missing translation shows in the build log
// rather than only on the page. A translation may only hold the tags of its
// English text, with the same attributes, and the same {placeholders}: one
// that does not is set aside with a warning, as if it were missing, so that
// no translation can add markup of its own to the page.
//
// The download and Flatpak sections name versions and channels, so they are
// rendered from the staging directory the repository was just built from,
// which is the only place that knows what each channel ended up serving.
// Besides the packages of each channel, it holds:
//
//   state.json               what each channel serves, newest first
//   checksums/<file>.sha256  the checksum files published with each release
//   assets/<version>.json    the name and size of every file of a release
//
// Without a staging directory, the page is rendered without those sections,
// which is enough to check a translation of everything else.
//
// Usage: node render-repo-page.mjs <template> <out> [<staging-dir>]

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  statSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'

const [template, out, stagingDir] = process.argv.slice(2)
if (!template || !out) {
  console.error(
    'Usage: node render-repo-page.mjs <template> <out> [<staging-dir>]'
  )
  process.exit(1)
}

const BASE_URL = 'https://packages-github-desktop.nitramo.fr'
const RELEASES = 'https://github.com/NitramO-YT/Github-Desktop/releases'
const CHANNELS = ['stable', 'latest', 'beta']
const LOCALES = join(dirname(template), 'locales')
// The language every other one is checked against and falls back to, and the
// one a browser without JavaScript shows.
const DEFAULT = 'en'
const LANGUAGE_TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*(?:\|([\s\S]*?))?\}\}/g
// The texts the scripts of the page use, under ui. in the language files.
const UI_KEYS = ['language', 'copy', 'copied', 'pressCtrlC', 'selectAll']

/** Reported in the build log, and as an annotation of the run on Actions. */
function warn(message) {
  console.log(
    process.env.GITHUB_ACTIONS === 'true'
      ? `::warning::${message}`
      : `warning: ${message}`
  )
}

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

/** What an HTML text reads as, for the places that take no markup. */
function plainText(html) {
  const named = { nbsp: '\xa0', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, name) => {
      if (name.startsWith('#')) {
        const hex = name[1] === 'x' || name[1] === 'X'
        return String.fromCodePoint(parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10))
      }
      return named[name.toLowerCase()] ?? entity
    })
}

/**
 * Reads the language files. One that cannot be used is left out with a
 * warning, unless it is the default language, which every other one relies
 * on.
 */
function loadCatalogs() {
  const catalogs = new Map()
  const files = readdirSync(LOCALES).filter(f => f.endsWith('.json')).sort()
  for (const file of files) {
    const code = basename(file, '.json')
    try {
      if (!LANGUAGE_TAG.test(code)) {
        throw new Error('its name is not a language tag')
      }
      const catalog = JSON.parse(readFileSync(join(LOCALES, file), 'utf8'))
      const { dir = 'ltr', flag, name, strings } = catalog
      if (dir !== 'ltr' && dir !== 'rtl') {
        throw new Error('its dir is neither ltr nor rtl')
      }
      if (typeof strings !== 'object' || strings === null) {
        throw new Error('it has no strings')
      }
      catalogs.set(code, {
        dir,
        flag: typeof flag === 'string' ? flag : '',
        name: typeof name === 'string' ? name : undefined,
        strings,
      })
    } catch (error) {
      if (code === DEFAULT) throw new Error(`locales/${file}: ${error.message}`)
      warn(`locales/${file} is left out: ${error.message}`)
    }
  }
  if (!catalogs.has(DEFAULT)) {
    throw new Error(`locales/${DEFAULT}.json is missing`)
  }
  return catalogs
}

const catalogs = loadCatalogs()
const ORDER = [DEFAULT, ...[...catalogs.keys()].filter(c => c !== DEFAULT)]
const dirOf = lang => catalogs.get(lang).dir

/**
 * What a translation must keep of its English text: the tags, with their
 * attributes, and the {placeholders}, in any order.
 */
function shape(text) {
  const tags = text.match(/<[^>]*>/g) ?? []
  const placeholders = text.match(/\{\w+\}/g) ?? []
  return JSON.stringify([tags.sort(), placeholders.sort()])
}

/** The texts of each language that may go on the page. */
function usableTexts() {
  const usable = new Map()
  for (const code of ORDER) {
    // Undefined while the default language itself is read.
    const english = usable.get(DEFAULT)
    const { strings } = catalogs.get(code)
    const texts = new Map()
    for (const [key, text] of Object.entries(strings)) {
      if (typeof text !== 'string') {
        warn(`${code}: "${key}" is not a text, and is left out`)
      } else if (english === undefined) {
        texts.set(key, text)
      } else if (!english.has(key)) {
        warn(`${code}: "${key}" is not a key of ${DEFAULT}.json, and is left out`)
      } else if (shape(text) !== shape(english.get(key))) {
        warn(
          `${code}: "${key}" does not keep the tags and placeholders of ` +
            `its English text, which stands in for it`
        )
      } else {
        texts.set(key, text)
      }
    }
    // A translation in progress lacks many texts: they are reported together,
    // so that they make one line of the log rather than one each.
    const missing =
      english === undefined
        ? []
        : [...english.keys()].filter(key => !Object.hasOwn(strings, key))
    if (missing.length > 0) {
      warn(
        `${code}: ${missing.length} text(s) not translated, their English ` +
          `text stands in: ${missing.join(', ')}`
      )
    }
    usable.set(code, texts)
  }
  return usable
}

const usable = usableTexts()
const reported = new Set()

/**
 * The text of a key in a language, with the language it is actually written
 * in, following the order given at the top of this file.
 */
function resolve(key, page, content) {
  for (const lang of [page, DEFAULT]) {
    const text = usable.get(lang).get(key)
    if (text !== undefined) return { text, lang }
  }
  if (!reported.has(key)) {
    reported.add(key)
    warn(
      content !== undefined
        ? `"${key}" is in no language: the content the template gives it stands in`
        : `"${key}" is in no language and has no content in the template: the key itself shows`
    )
  }
  return { text: content ?? escapeHtml(key), lang: DEFAULT }
}

/**
 * One language's version of a text, marked with the language of the page it
 * belongs to and with the language it is written in, which differ where a
 * translation is missing.
 */
function variant(page, { text, lang }) {
  const dir = dirOf(lang) === dirOf(page) ? '' : ` dir="${dirOf(lang)}"`
  return `<span data-variant="${page}" lang="${lang}"${dir}>${text}</span>`
}

function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(values, name) ? values[name] : placeholder
  )
}

/**
 * A text in every language of the page. Values fill its {placeholders}, each
 * formatted for the language the text is written in.
 */
function t(key, { content, values } = {}) {
  return ORDER.map(page => {
    const { text, lang } = resolve(key, page, content)
    const filled = values ? fill(text, values(lang)) : text
    return variant(page, { text: filled, lang })
  }).join('')
}

/** Content that each language formats its own way, such as a size. */
function formatted(render) {
  return ORDER.map(page => variant(page, { text: render(page), lang: page })).join('')
}

/** A size the way a download page states one, in the units of a language. */
function readableSize(bytes, lang) {
  const mb = bytes / (1024 * 1024)
  const [value, unit, digits] =
    mb >= 1000 ? [mb / 1024, 'gigabyte', 1] : [mb, 'megabyte', 0]
  const format = new Intl.NumberFormat(lang, {
    style: 'unit',
    unit,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return escapeHtml(format.format(value))
}

/** Channel names listed the way a sentence of that language would. */
function channelList(channels, lang) {
  const format = new Intl.ListFormat(lang, { type: 'conjunction' })
  return escapeHtml(format.format(channels))
}

/** A language name as a label starts, with a capital. */
function capitalised(name, lang) {
  return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1)
}

/** The name of a language in that language, unless its file gives one. */
function ownName(code) {
  const name =
    catalogs.get(code).name ??
    new Intl.DisplayNames([code], { type: 'language', fallback: 'none' }).of(code) ??
    code
  return capitalised(name, code)
}

/** The name of a language in another one, or its own when that is unknown. */
function nameIn(code, lang) {
  const name = new Intl.DisplayNames([lang], {
    type: 'language',
    fallback: 'none',
  }).of(code)
  return name === undefined ? ownName(code) : capitalised(name, lang)
}

/** A text for the scripts of the page: plain, with its language. */
function scriptText(key, page) {
  const { text, lang } = resolve(key, page)
  return { text: plainText(text), lang, dir: dirOf(lang) }
}

/**
 * What the scripts of the page need to choose a language and to build the
 * switch and the buttons, in every language. The < are escaped so that no
 * text can close the script element holding it.
 */
function languageData() {
  const languages = {}
  for (const code of ORDER) {
    const { dir, flag } = catalogs.get(code)
    const others = ORDER.filter(other => other !== code)
    languages[code] = {
      dir,
      flag,
      title: plainText(resolve('page.title', code).text),
      name: { text: ownName(code), lang: code, dir },
      names: Object.fromEntries(
        others.map(other => [other, { text: nameIn(other, code), lang: code, dir }])
      ),
      ui: Object.fromEntries(UI_KEYS.map(key => [key, scriptText(`ui.${key}`, code)])),
    }
  }
  const data = { default: DEFAULT, order: ORDER, languages }
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<script type="application/json" id="page-languages">${json}</script>`
}

/**
 * Shows the texts of the page's language only, and those of the default
 * language as long as no script has chosen one.
 */
function languageRules() {
  const selectors = [
    `html:not([data-lang]) [data-variant]:not([data-variant='${DEFAULT}'])`,
    ...ORDER.map(
      code => `html[data-lang='${code}'] [data-variant]:not([data-variant='${code}'])`
    ),
  ]
  return `<style>
      ${selectors.join(',\n      ')} {
        display: none !important;
      }
    </style>`
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

/**
 * A file that is only published on GitHub, where its size comes from, or null
 * when the release of that version has none.
 */
function findReleaseFile(version, extension) {
  const path = join(stagingDir, 'assets', `${version}.json`)
  const assets = JSON.parse(readFileSync(path, 'utf8'))
  const asset = assets.find(a => a.name.endsWith(extension))
  return asset ? { name: asset.name, size: asset.size } : null
}

/** Every release has an AppImage. */
function findAppImage(version) {
  const appImage = findReleaseFile(version, '.AppImage')
  if (!appImage) throw new Error(`release-${version} has no AppImage`)
  return appImage
}

/** The versions released before this fork built a Flatpak have none. */
function findFlatpak(version) {
  return findReleaseFile(version, '.flatpak')
}

/** What each channel serves, newest first, or null without a staging directory. */
function readState() {
  const statePath = stagingDir && join(stagingDir, 'state.json')
  if (!statePath || !existsSync(statePath)) return null
  return JSON.parse(readFileSync(statePath, 'utf8'))
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

/**
 * The files each channel serves, with their size and checksum. File names,
 * versions and checksums read left to right and are never translated,
 * whatever the language of the page.
 */
function downloadSection() {
  const state = readState()
  if (!state) return { html: '', channels: 0, versions: 0 }
  const rows = []
  // Stable and latest usually serve the same version: its checksums are
  // listed once, naming every channel that serves it.
  const versions = new Map()

  for (const key of CHANNELS) {
    // Only the version a channel currently serves is listed. Older ones stay
    // downloadable for a rollback, but a page offering three versions per
    // channel asks the reader to choose where there is nothing to choose.
    const version = (state[key] ?? [])[0]
    if (!version) continue

    const deb = findPackage(join(stagingDir, 'deb', key), version, '.deb')
    const rpm = findPackage(join(stagingDir, 'rpm', key), version, '.rpm')
    const appImage = findAppImage(version)
    const flatpak = findFlatpak(version)
    const release = `release-${encodeURIComponent(version)}`

    const cell = (file, href) =>
      file
        ? `<a href="${href}" dir="ltr" translate="no">${escapeHtml(file.name)}</a><br /><span class="size">${formatted(lang => readableSize(file.size, lang))} &middot; <a href="#${checksumId(file.name)}">SHA-256</a></span>`
        : '&mdash;'

    // The Flatpak of a version subscribes whoever installs it to latest, or to
    // beta for a beta: a version always comes out on latest before stable. The
    // stable row therefore offers the file that installs from the stable
    // branch of the repository instead.
    const flatpakCell =
      key === 'stable' && flatpak
        ? `<a href="${BASE_URL}/flatpak/github-desktop-stable.flatpakref" dir="ltr" translate="no">github-desktop-stable.flatpakref</a>`
        : cell(flatpak, `${RELEASES}/download/${release}/${encodeURIComponent(flatpak?.name)}`)

    rows.push(`        <tr>
          <td><code>${key}</code><br /><span class="size">${t(`channels.${key}.name`)}</span></td>
          <td class="version"><a href="${RELEASES}/tag/${release}" dir="ltr" translate="no">${escapeHtml(version)}</a></td>
          <td>${cell(deb, `${BASE_URL}/deb/pool/${key}/main/g/github-desktop/${encodeURIComponent(deb?.name)}`)}</td>
          <td>${cell(rpm, `${BASE_URL}/rpm/${key}/${encodeURIComponent(rpm?.name)}`)}</td>
          <td>${cell(appImage, `${RELEASES}/download/${release}/${encodeURIComponent(appImage.name)}`)}</td>
          <td>${flatpakCell}</td>
        </tr>`)

    if (!versions.has(version)) {
      const files = [deb, rpm, appImage, flatpak].filter(Boolean).map(f => f.name)
      versions.set(version, { channels: [], files })
    }
    versions.get(version).channels.push(key)
  }

  if (rows.length === 0) return { html: '', channels: 0, versions: 0 }

  // Each version lists the checksum of every file on its own, to compare or
  // copy one at a time, then gives them again as a command: pasted into a
  // terminal opened in the download folder, it checks whichever of these
  // files is there and ignores the others, which is what --ignore-missing is
  // for.
  const checksums = [...versions].map(([version, { channels, files }]) => {
    const sums = files.map(file => ({ file, hash: readChecksum(file) }))
    const list = sums
      .map(
        ({ file, hash }) => `      <dt id="${checksumId(file)}"><span dir="ltr" translate="no">${escapeHtml(file)}</span></dt>
      <dd><code class="hash" translate="no">${hash}</code></dd>`
      )
      .join('\n')
    // The file name is kept whole, so that a line too wide for the page breaks
    // between the checksum and the name rather than inside the name.
    const lines = sums.map(
      ({ file, hash }) => `${hash}  <span class="file">${escapeHtml(file)}</span>`
    )
    const servedBy = t('checksums.servedBy', {
      values: lang => ({ channels: channelList(channels, lang) }),
    })
    return `    <p class="checksum-for">
      <strong dir="ltr" translate="no">${escapeHtml(version)}</strong>
      ${servedBy}
    </p>
    <dl class="sums">
${list}
    </dl>
    <p class="sums-command">${t('checksums.command')}</p>
    <pre class="checksums" translate="no"><code>sha256sum -c --ignore-missing &lt;&lt;'EOF'
${lines.join('\n')}
EOF</code></pre>`
  })

  const html = `    <h2>${t('downloads.heading')}</h2>
    <p>${t('downloads.intro')}</p>
    <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>${t('column.channel')}</th>
          <th>${t('column.version')}</th>
          <th>${t('column.deb')}</th>
          <th>${t('column.rpm')}</th>
          <th>${t('column.appImage')}</th>
          <th>${t('column.flatpak')}</th>
        </tr>
      </thead>
      <tbody>
${rows.join('\n')}
      </tbody>
    </table>
    </div>
    <p class="note">${t('downloads.note')}</p>

    <h3>${t('checksums.heading')}</h3>
    <p>${t('checksums.intro')}</p>
${checksums.join('\n')}`

  return { html, channels: rows.length, versions: versions.size }
}

/**
 * The command that installs the Flatpak of each channel. The repository holds
 * a branch only for a channel whose version was built with a Flatpak, so the
 * other channels are named as not having one yet, and the section is left out
 * while no channel has one.
 */
function flatpakSection() {
  const state = readState()
  if (!state) return ''

  const available = []
  const missing = []
  for (const key of CHANNELS) {
    const version = (state[key] ?? [])[0]
    if (!version) continue
    ;(findFlatpak(version) ? available : missing).push(key)
  }
  if (available.length === 0) return ''

  const commands = available.map(
    key => `    <h3>${t('flatpak.channel', { values: () => ({ channel: `<code>${key}</code>` }) })}</h3>
    <pre translate="no"><code>flatpak install --user ${BASE_URL}/flatpak/github-desktop-${key}.flatpakref</code></pre>`
  )
  const notYet =
    missing.length === 0
      ? ''
      : `
    <p class="note">${t('flatpak.notYet', {
      values: lang => ({ channels: channelList(missing, lang) }),
    })}</p>`

  return `    <h2>Flatpak</h2>
    <p>${t('flatpak.intro')}</p>

${commands.join('\n\n')}
${notYet}
    <p class="note">${t('flatpak.changing')}</p>`
}

/** Replaces a comment of the template with what the renderer generates. */
function insert(page, marker, content) {
  if (!page.includes(marker)) {
    throw new Error(`The template has no ${marker} placeholder.`)
  }
  // A function, so that a $ in the content is never read as a pattern.
  return page.replace(marker, () => content)
}

let page = readFileSync(template, 'utf8')

page = page.replace(
  /<html\b[^>]*>/,
  () => `<html lang="${DEFAULT}" dir="${dirOf(DEFAULT)}">`
)
// The title takes no markup, so it holds the default language only; the
// script of the page sets the title of the language it shows.
page = page.replace(/<title>([\s\S]*?)<\/title>/, (element, inner) => {
  const text = inner.replace(
    PLACEHOLDER,
    (placeholder, key, content) => resolve(key, DEFAULT, content).text
  )
  return `<title>${escapeHtml(plainText(text))}</title>`
})
page = page.replace(PLACEHOLDER, (placeholder, key, content) =>
  t(key, { content })
)
if (page.includes('{{')) {
  warn('The template holds a {{ that is not a key between double braces.')
}

const downloads = downloadSection()
page = insert(page, '<!-- language-data -->', languageData())
page = insert(page, '<!-- language-rules -->', languageRules())
page = insert(page, '<!-- flatpak -->', flatpakSection())
page = insert(page, '<!-- downloads -->', downloads.html)

writeFileSync(out, page)
console.log(
  `Landing page rendered in ${ORDER.join(', ')}, with ` +
    `${downloads.channels} channel(s) and ${downloads.versions} version(s) listed.`
)

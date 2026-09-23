# Translations of the repository page

The page of the package repository, <https://packages-github-desktop.nitramo.fr/>,
is built from [`../index.html`](../index.html), which holds its layout, and from
the files of this folder, which hold its texts: one file per language, named
after its language tag, such as `en.json` or `pt-BR.json`.

English is the reference: every other file translates the keys of `en.json`.

## Adding a language

1. Copy `en.json` to a file named after the language tag, for instance
   `de.json`.
2. Translate the values under `strings`. Keep the keys as they are, the tags
   such as `<code>` or `<a href="...">` with the same attributes, and the
   placeholders such as `{channels}`, in whatever order the language needs.
3. Set `dir` to `rtl` for a language written right to left. `flag` is the emoji
   shown next to the name of the language in the switch: remove it to show the
   name alone. A `name` entry can give the name of the language in itself, when
   the one browsers know does not suit.
4. Render the page to check it. Without a staging directory, the page leaves
   out its download section, which needs the files of a real release:

   ```sh
   node script/render-repo-page.mjs script/resources/repo/index.html /tmp/page.html
   ```

   Then open `/tmp/page.html` in a browser, and pick the language in the
   switch at the top of the page.

Nothing else needs to change: the switch, the choice of the reader's language
and the formatting of sizes and lists follow the files of this folder.

## What the build does with a translation

A text is taken from the first of: the language of the page, English, the
content the template gives it, the key itself. A translation can therefore be
added before it is complete. What it lacks shows in English, and the build
lists it as a warning.

A value that adds a tag, changes an attribute or loses a placeholder is set
aside with a warning, and English stands in for it, so that no translation can
add markup to the page. A file that cannot be read is left out with a warning,
and the page is published without that language.

# Pitfalls and guardrails

## html2text is not a browser

`html2text` converts HTML it is given. It does not:

- Run JavaScript.
- Wait for client-rendered content.
- Fetch images, CSS, or scripts.
- Compute browser layout.
- Click buttons or expand hidden content.

If the target content appears only after JavaScript runs, use a browser or crawler first, save the resulting HTML, then convert that HTML.

## html2text is not main-article extraction

A full webpage often contains navigation, cookie banners, ads, sidebars, footers, and unrelated links. `html2text` will convert those too if they are in the input HTML.

When the desired output is an article or documentation section, first extract the relevant HTML fragment. Then run `html2text`.

Bad workflow:

```bash
curl -L https://example.com/article | html2text --body-width=0 > article.md
```

Better workflow:

```bash
curl -L https://example.com/article -o full-page.html
python3 extract-relevant-fragment.py full-page.html > article-fragment.html
html2text --body-width=0 article-fragment.html > article.md
```

## Use no wrapping for generated Markdown

The default output wraps lines. This is pleasant for plain text but often bad for generated Markdown in code repositories.

Prefer:

```bash
html2text --body-width=0 input.html > output.md
```

Use a fixed width only when the user explicitly asks for wrapped prose.

## `--single-line-break` requires no wrapping

Use:

```bash
html2text --body-width=0 --single-line-break input.html > output.md
```

Do not combine `--single-line-break` with a nonzero body width.

## Raw HTML can appear in Markdown

These options may intentionally emit raw HTML:

- `--bypass-tables`
- `--images-as-html`
- `--images-with-size`
- `--include-sup-sub`

This is fine for many Markdown renderers, but do not describe the result as sanitized Markdown.

## Do not treat conversion as sanitization

`html2text` is a converter, not a security sanitizer. If the input is untrusted and the output will be rendered in a sensitive environment, sanitize using a dedicated sanitizer appropriate for that environment.

## Complex tables may not become good Markdown tables

Markdown tables cannot faithfully represent all HTML table features. If the table uses colspan, rowspan, nested content, or layout tricks, prefer:

```bash
html2text --body-width=0 --bypass-tables input.html > output.md
```

If the table is simple but ugly, try:

```bash
html2text --body-width=0 --pad-tables input.html > output.md
```

## Images need a policy

Before converting image-heavy HTML, choose what the user actually wants:

- Keep Markdown images: default.
- Drop images: `--ignore-images`.
- Keep only alt text: `--images-to-alt`.
- Preserve dimensions: `--images-with-size`.
- Preserve image tags as HTML: `--images-as-html`.

Do not assume image Markdown is always desirable in text extraction tasks.

## Broken encodings should be explicit

If conversion fails with a decode error, first identify the actual encoding. If that is not practical and best-effort output is acceptable, use:

```bash
html2text --body-width=0 --decode-errors=replace input.html utf-8 > output.md
```

Use `ignore` only when silently dropping invalid bytes is acceptable.

## CLI base URL limitation

The CLI can convert local files and stdin, but it does not provide a base URL flag for resolving relative links. If relative links must become absolute, use the Python API with `baseurl` or preprocess the HTML.

```python
import html2text

converter = html2text.HTML2Text(baseurl="https://example.com/docs/")
converter.body_width = 0
markdown = converter.handle(html)
```

## External dependency and license boundary

This skill should not vendor `html2text`. Install `html2text` as an external Python dependency.

The skill instructions and wrapper can use a permissive license, but the upstream `html2text` project is GPL-3.0-or-later. Be mindful of that if redistributing packages that bundle upstream code.

## Troubleshooting checklist

When output looks wrong, check in this order:

1. Is the input HTML already clean and relevant?
2. Does the page require JavaScript rendering before conversion?
3. Is the file decoded with the correct encoding?
4. Should wrapping be disabled with `--body-width=0`?
5. Should links be inline, reference-style, ignored, or protected?
6. Should images be kept, dropped, converted to alt text, or emitted as raw HTML?
7. Are tables too complex for Markdown?
8. Is Google Docs export mode needed?

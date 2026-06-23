# HTML to Markdown recipes

These recipes assume `html2text` is installed:

```bash
python3 -m pip install html2text
```

Prefer `--body-width=0` for agent workflows unless the user explicitly wants wrapped prose.

## Convert one local file

```bash
html2text --body-width=0 page.html > page.md
```

With the helper wrapper:

```bash
./scripts/html2md page.html -o page.md
```

## Convert stdin

```bash
cat page.html | html2text --body-width=0 - utf-8 > page.md
```

With the helper wrapper:

```bash
cat page.html | ./scripts/html2md - > page.md
```

## Convert an HTML snippet from a shell command

```bash
printf '<h1>Hello</h1><p><strong>World</strong></p>' \
  | html2text --body-width=0 - utf-8
```

## Convert with an explicit input encoding

```bash
html2text --body-width=0 legacy-page.html windows-1252 > legacy-page.md
```

With the helper wrapper:

```bash
./scripts/html2md legacy-page.html --encoding windows-1252 -o legacy-page.md
```

## Continue despite broken bytes

```bash
html2text --body-width=0 --decode-errors=replace broken.html utf-8 > broken.md
```

Use `replace` when you want the conversion to complete and visibly mark bad characters. Use `ignore` only when dropping undecodable bytes is acceptable.

## Convert a saved webpage

```bash
curl -L 'https://example.com/page.html' -o page.html
html2text --body-width=0 page.html > page.md
```

Important: `html2text` converts the HTML it receives. It does not execute JavaScript, wait for dynamic content, or fetch page assets.

## Convert a cleaned HTML fragment

If the source page is noisy, extract the relevant fragment first:

```bash
python3 extract-main-fragment.py full-page.html > article-fragment.html
html2text --body-width=0 article-fragment.html > article.md
```

Do not expect `html2text` to remove nav bars, cookie banners, sidebars, or unrelated page chrome by itself.

## Use reference-style links

```bash
html2text --body-width=0 --reference-links page.html > page.md
```

This is useful when inline links make the Markdown hard to scan.

## Drop link URLs but keep link text

```bash
html2text --body-width=0 --ignore-links page.html > page.md
```

Use this for plain-text summaries or content where URLs are not wanted.

## Drop `mailto:` link targets

```bash
html2text --body-width=0 --ignore-mailto-links page.html > page.md
```

## Keep only image alt text

```bash
html2text --body-width=0 --images-to-alt page.html > page.md
```

Use this for semantic text extraction when images are not needed but their alt text is useful.

## Drop all images

```bash
html2text --body-width=0 --ignore-images page.html > page.md
```

## Preserve image dimensions as raw HTML

```bash
html2text --body-width=0 --images-with-size page.html > page.md
```

Use this when image dimensions matter. The output may contain raw HTML.

## Preserve all images as raw HTML

```bash
html2text --body-width=0 --images-as-html page.html > page.md
```

Use this when Markdown image syntax loses too much information. The output may contain raw HTML.

## Convert tables as Markdown

```bash
html2text --body-width=0 page-with-table.html > page-with-table.md
```

## Make Markdown tables easier to read

```bash
html2text --body-width=0 --pad-tables page-with-table.html > page-with-table.md
```

## Preserve tables as raw HTML

```bash
html2text --body-width=0 --bypass-tables page-with-complex-table.html > page-with-complex-table.md
```

Use this when Markdown table conversion loses colspan-like structure or important formatting.

## Ignore table structure but keep row text

```bash
html2text --body-width=0 --ignore-tables page-with-layout-table.html > page.md
```

Useful when tables are used only for layout.

## Convert code blocks with fenced Markdown

```bash
html2text --body-width=0 --backquote-code-style code.html > code.md
```

Prefer this for modern Markdown renderers.

## Convert code blocks with `[code]` markers

```bash
html2text --body-width=0 --mark-code code.html > code.md
```

Use only when a downstream system expects `[code]...[/code]` markers.

## Convert Google Docs exported HTML

```bash
html2text -g -d -b 0 -s exported-google-doc.html > exported-google-doc.md
```

This combination means:

- `-g`: Google Docs export mode.
- `-d`: dash bullets.
- `-b 0`: no wrapping.
- `-s`: hide strikethrough text.

With the helper wrapper:

```bash
./scripts/html2md exported-google-doc.html \
  --google-doc \
  --dash-unordered-list \
  --hide-strikethrough \
  -o exported-google-doc.md
```

## Preserve `<sub>` and `<sup>` tags

```bash
html2text --body-width=0 --include-sup-sub formula.html > formula.md
```

Use this for math, chemistry, footnote-like text, or documents where subscript/superscript semantics matter.

## Use the Python API in a script

```python
from pathlib import Path
import html2text

html = Path("input.html").read_text(encoding="utf-8")
converter = html2text.HTML2Text()
converter.body_width = 0
converter.backquote_code_style = True
markdown = converter.handle(html)
Path("output.md").write_text(markdown, encoding="utf-8")
```

## Batch convert a directory

```bash
mkdir -p md
for file in html/*.html; do
  base="$(basename "$file" .html)"
  html2text --body-width=0 "$file" > "md/${base}.md"
done
```

With the helper wrapper:

```bash
mkdir -p md
for file in html/*.html; do
  base="$(basename "$file" .html)"
  ./scripts/html2md "$file" -o "md/${base}.md"
done
```

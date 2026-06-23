# html2text library behavior

`html2text` is a Python package and terminal command that converts existing HTML into Markdown-structured text.

It is best understood as a converter, not as a browser, scraper, sanitizer, or readability extractor.

## Core APIs

### Simple function

```python
import html2text

markdown = html2text.html2text(html)
```

Optional parameters:

```python
markdown = html2text.html2text(
    html,
    baseurl="https://example.com/docs/",
    bodywidth=0,
)
```

Use this for simple conversions.

### Configurable class

```python
import html2text

converter = html2text.HTML2Text()
converter.body_width = 0
converter.ignore_links = False
converter.inline_links = True
converter.backquote_code_style = True

markdown = converter.handle(html)
```

Use the class when you need conversion options.

### Terminal command

```bash
html2text --body-width=0 input.html > output.md
```

Also supported:

```bash
python3 -m html2text --body-width=0 input.html > output.md
```

## Input model

The CLI reads bytes from a file or stdin and decodes them using the provided encoding argument. If no encoding is provided, use UTF-8 unless the file requires another encoding.

```bash
html2text input.html utf-8 > output.md
cat input.html | html2text - utf-8 > output.md
```

The converter receives already-available HTML. It does not fetch URLs, execute JavaScript, load stylesheets, or wait for dynamic content.

## Conversion model

`HTML2Text` is built on Python's standard-library HTML parser. It walks HTML tags and emits Markdown-like plain text.

Important supported structures include:

- Headings: `<h1>` to `<h9>` become Markdown `#` headings.
- Paragraphs and divisions: `<p>` and `<div>` create block breaks.
- Line breaks: `<br>` becomes a Markdown hard line break.
- Horizontal rules: `<hr>` becomes `* * *`.
- Blockquotes: `<blockquote>` becomes Markdown quote syntax.
- Emphasis: `<em>`, `<i>`, `<u>`, `<strong>`, and `<b>` become Markdown emphasis unless disabled.
- Strikethrough: `<del>`, `<strike>`, and `<s>` become `~~text~~`.
- Inline code: `<kbd>`, `<code>`, and `<tt>` become backtick code spans when outside `<pre>`.
- Code blocks: `<pre>` becomes indented code by default, fenced code with `--backquote-code-style`, or `[code]` blocks with `--mark-code`.
- Links: `<a href="...">text</a>` becomes inline links by default, reference links with `--reference-links`, or plain text with `--ignore-links`.
- Images: `<img>` becomes Markdown image syntax by default, alt text only with `--images-to-alt`, raw HTML with image HTML options, or nothing with `--ignore-images`.
- Lists: `<ul>`, `<ol>`, and `<li>` become Markdown lists.
- Tables: table tags become pipe-table-like Markdown unless bypassed or ignored.
- Abbreviations: `<abbr title="...">ABC</abbr>` can emit Markdown abbreviation definitions.
- Quotes: `<q>` becomes configurable opening/closing quote characters.
- Subscript and superscript: `<sub>` and `<sup>` are preserved only with `--include-sup-sub`.

## Links and base URLs

Relative links can be resolved by setting `baseurl` in Python:

```python
converter = html2text.HTML2Text(baseurl="https://example.com/docs/")
markdown = converter.handle(html)
```

The simple function also accepts `baseurl`:

```python
markdown = html2text.html2text(html, baseurl="https://example.com/docs/")
```

The CLI does not expose a `baseurl` flag. If base URL resolution matters, use the Python API or pre-normalize URLs before conversion.

## Repeated conversions

A single `HTML2Text()` instance can be used for repeated `.handle()` calls. The library clears its output buffer after finishing a conversion. Still, create a fresh instance when changing policies between conversions, because options and parser state are attributes on the instance.

Recommended pattern for batch conversion:

```python
from pathlib import Path
import html2text

for source in Path("html").glob("*.html"):
    converter = html2text.HTML2Text()
    converter.body_width = 0
    markdown = converter.handle(source.read_text(encoding="utf-8"))
    source.with_suffix(".md").write_text(markdown, encoding="utf-8")
```

## Google Docs behavior

Google Docs exported HTML often encodes structure through inline CSS. The `--google-doc` mode uses style information to infer lists, emphasis, fixed-width text, and layout details. Pair it with:

```bash
html2text -g -d -b 0 -s exported.html > exported.md
```

Use `--google-list-indent` only when nested list indentation is wrong.

## Tables

Default table conversion is Markdown-like pipe-table output. For simple tables, use the default plus `--pad-tables` when humans will read the Markdown.

For complex tables, prefer:

```bash
html2text --body-width=0 --bypass-tables input.html > output.md
```

This preserves tables as raw HTML and avoids pretending that complex layout has a clean Markdown equivalent.

## Code blocks

Default `<pre>` output is indented code. For modern Markdown, prefer:

```bash
html2text --body-width=0 --backquote-code-style input.html > output.md
```

Avoid combining `--mark-code` and `--backquote-code-style` unless a downstream system explicitly expects both styles.

## Character entities

By default, many named entities are converted to ASCII-like equivalents. Use `--unicode-snob` when preserving Unicode characters is preferred.

Use `--escape-all` when generated Markdown must avoid accidental formatting from punctuation-heavy text.

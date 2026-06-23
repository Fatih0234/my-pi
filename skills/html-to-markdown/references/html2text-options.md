# html2text options

Use this file when selecting `html2text` flags or Python `HTML2Text` attributes.

The recommended default for coding-agent workflows is:

```bash
html2text --body-width=0 input.html > output.md
```

`html2text` defaults to wrapping output at 78 characters. For generated Markdown that will be diffed, post-processed, or committed, unwrapped output is usually safer.

## Core CLI shape

```bash
html2text [options] [filename [encoding]]
cat input.html | html2text [options] - utf-8 > output.md
python3 -m html2text [options] [filename [encoding]]
```

The installed console command is normally `html2text`. `python3 -m html2text` is useful when the command is not on `PATH` but the Python package is installed.

## Common option matrix

| Goal | CLI flag | Python attribute | Default | Notes |
|---|---|---:|---:|---|
| Disable wrapping | `--body-width=0` or `-b 0` | `body_width = 0` | `78` | Recommended default for agent workflows. |
| Set wrap width | `--body-width=N` or `-b N` | `body_width = N` | `78` | Use only when user wants wrapped prose. |
| Single line break after blocks | `--single-line-break` | `single_line_break = True` | `False` | Requires body width `0`. |
| Use Unicode | `--unicode-snob` | `unicode_snob = True` | `False` | Keeps Unicode instead of ASCII approximations. |
| Escape all Markdown specials | `--escape-all` | `escape_snob = True` | `False` | Less readable, safer for corner cases. |
| Ignore emphasis | `--ignore-emphasis` | `ignore_emphasis = True` | `False` | Drops `em`, `strong`, and similar formatting. |
| Asterisk emphasis style | `-e`, `--asterisk-emphasis` | `emphasis_mark = "*"`, `strong_mark = "__"` | `_`, `**` | Changes emphasis markers. |
| Use dash bullets | `-d`, `--dash-unordered-list` | `ul_item_mark = "-"` | `*` | Good for project Markdown style guides. |
| Reference links | `--reference-links` | `inline_links = False` | `True` | Moves links to reference definitions. |
| Ignore links | `--ignore-links` | `ignore_links = True` | `False` | Keeps anchor text but not URLs. |
| Ignore mailto links | `--ignore-mailto-links` | `ignore_mailto_links = True` | `False` | Drops `mailto:` link targets. |
| Protect links | `--protect-links` | `protect_links = True` | `False` | Surrounds links with angle brackets to avoid line-break damage. |
| Disable automatic links | `--no-automatic-links` | `use_automatic_links = False` | `True` | Prevents `<https://example.com>` shorthand. |
| Keep internal links | `--no-skip-internal-links` | `skip_internal_links = False` | `True` | By default, `href="#anchor"` links are skipped. |
| Put reference links after each paragraph | `--links-after-para` | `links_each_paragraph = True` | `False` | Useful for long documents with reference links. |
| Ignore images | `--ignore-images` | `ignore_images = True` | `False` | Drops image Markdown. |
| Keep only image alt text | `--images-to-alt` | `images_to_alt = True` | `False` | Good for text-only extraction. |
| Emit images as raw HTML | `--images-as-html` | `images_as_html = True` | `False` | Preserves `height`, `width`, and `alt` where possible. |
| Emit sized images as raw HTML | `--images-with-size` | `images_with_size = True` | `False` | Raw HTML only for images with dimensions. |
| Default missing image alt | `--default-image-alt TEXT` | `default_image_alt = TEXT` | empty string | Useful for accessibility placeholders. |
| Format tables as raw HTML | `--bypass-tables` | `bypass_tables = True` | `False` | Preserves table structure as HTML. |
| Ignore table tags | `--ignore-tables` | `ignore_tables = True` | `False` | Keeps row text but not Markdown table structure. |
| Pad Markdown tables | `--pad-tables` | `pad_tables = True` | `False` | Makes pipe tables easier to read. |
| Allow table wrapping | `--wrap-tables` | `wrap_tables = True` | `False` | Default avoids wrapping table-looking lines. |
| Wrap list items | `--wrap-list-items` | `wrap_list_items = True` | `False` | Default avoids wrapping list items. |
| Do not wrap links | `--no-wrap-links` | `wrap_links = False` | `True` | Also causes inline links to become reference links during wrapping. |
| Google Docs export mode | `-g`, `--google-doc` | `google_doc = True` | `False` | For HTML exported from Google Docs. |
| Google list indent | `-i N`, `--google-list-indent=N` | `google_list_indent = N` | `36` | Number of pixels per nested list level in Google Docs HTML. |
| Hide strikethrough | `-s`, `--hide-strikethrough` | `hide_strikethrough = True` | `False` | Mostly useful with `--google-doc`. |
| Mark code blocks | `--mark-code` | `mark_code = True` | `False` | Emits `[code]...[/code]` around `<pre>`. |
| Use fenced code blocks | `--backquote-code-style` | `backquote_code_style = True` | `False` | Prefer for modern Markdown. |
| Decode error policy | `--decode-errors=HANDLER` | CLI only | `strict` | Handler is usually `strict`, `replace`, or `ignore`. |
| Opening quote for `<q>` | `--open-quote=TEXT` | `open_quote = TEXT` | `"` | Customize quote conversion. |
| Closing quote for `<q>` | `--close-quote=TEXT` | `close_quote = TEXT` | `"` | Customize quote conversion. |
| Preserve sub/sup tags | `--include-sup-sub` | `include_sup_sub = True` | `False` | Keeps `<sub>` and `<sup>` tags in output. |

## Python API equivalents

Use the simple function for default conversion:

```python
import html2text

markdown = html2text.html2text(html)
```

Use `HTML2Text()` when options are needed:

```python
import html2text

converter = html2text.HTML2Text()
converter.body_width = 0
converter.ignore_links = False
converter.inline_links = True
converter.backquote_code_style = True

markdown = converter.handle(html)
```

For relative URLs, pass a base URL with the simple function or the class constructor:

```python
markdown = html2text.html2text(html, baseurl="https://example.com/docs/")

converter = html2text.HTML2Text(baseurl="https://example.com/docs/")
markdown = converter.handle(html)
```

## Option selection guidance

Use these defaults unless the task says otherwise:

```bash
html2text --body-width=0 --backquote-code-style input.html > output.md
```

Use `--reference-links` when inline links make paragraphs hard to read.

Use `--images-to-alt` for semantic text extraction.

Use `--bypass-tables` when Markdown tables would lose too much structure.

Use `--pad-tables` when the resulting Markdown table should be readable by humans.

Use `--decode-errors=replace` when conversion fails because the file contains broken bytes and preserving the rest of the content is more important than failing strictly.

---
name: html-to-markdown
description: Convert existing HTML files, stdin HTML, saved webpages, exported Google Docs HTML, and generated HTML snippets into Markdown using Python html2text. Use when a task asks for terminal commands, scripts, or workflows that turn HTML into Markdown. Do not use for Markdown-to-HTML, JavaScript-rendered pages, browser layout extraction, sanitization, or main-article extraction.
license: MIT for this skill; html2text itself is GPL-3.0-or-later and must be installed as an external dependency.
compatibility: Requires Python 3.9+ and the html2text Python package.
---

# HTML to Markdown

Use this skill to convert existing HTML into Markdown with the Python `html2text` package.

This skill is intentionally thin: it teaches the agent the right workflow and defaults, but does not vendor or reimplement `html2text`.

## When to use

Use this skill when the user wants to convert:

- A local `.html` or `.htm` file into Markdown.
- HTML from stdin or a shell pipeline into Markdown.
- A saved webpage into Markdown.
- A generated HTML snippet or fixture into Markdown.
- HTML exported from Google Docs into Markdown.
- HTML output from a script, test fixture, crawler, or API into Markdown.

## When not to use

Do not use this skill as the whole solution when the task requires:

- Executing JavaScript or rendering a browser page.
- Extracting the main article from a noisy webpage.
- Cleaning cookie banners, navigation, sidebars, or ads from a full webpage.
- Sanitizing untrusted HTML.
- Converting Markdown back to HTML.
- Preserving pixel-perfect layout.

For those cases, first use the appropriate browser, scraper, sanitizer, or extraction workflow. Then pass the resulting HTML fragment to this skill.

## First check

Before conversion, verify that `html2text` is installed:

```bash
python3 -c "import html2text; print(html2text.__version__)"
```

If it is missing, install it in the active Python environment:

```bash
python3 -m pip install html2text
```

If the project uses a virtual environment, install inside that environment.

## Default conversion policy

For coding-agent workflows, prefer deterministic, unwrapped Markdown:

```bash
html2text --body-width=0 input.html > output.md
```

Use `--body-width=0` unless the user explicitly wants prose wrapped to a fixed width. This avoids accidental reflow and produces cleaner diffs.

## Use the helper wrapper when available

This skill includes a small wrapper with safe defaults:

```bash
./scripts/html2md input.html -o output.md
cat input.html | ./scripts/html2md - > output.md
```

The wrapper defaults to `--body-width=0`, checks for `html2text`, and passes through the most useful conversion options. Use raw `html2text` directly when the user asks for exact CLI flags or an option the wrapper does not expose.

## Common recipes

Read `references/recipes.md` for copy-paste commands.

## Option matrix

Read `references/html2text-options.md` when you need to select flags for links, images, tables, code blocks, Unicode, Google Docs exports, or decoding behavior.

## Behavior and limits

Read `references/library-behavior.md` for the Python API and conversion model.

Read `references/pitfalls.md` before using this skill on noisy webpages, broken encodings, tables, images, or security-sensitive input.

## Output review checklist

After converting, quickly inspect the Markdown for:

1. Unexpected wrapping or reflow.
2. Broken links or unwanted reference-link sections.
3. Raw HTML emitted by table or image options.
4. Noisy content that should have been removed before conversion.
5. Encoding replacement characters, especially `�`.

If the Markdown is noisy because the HTML was noisy, do not keep tuning `html2text` blindly. Extract or clean the relevant HTML first, then convert again.

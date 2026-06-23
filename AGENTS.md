# Global Agent Instructions

## External knowledge via `.agent/`

Agent may lack web search, browser, HTTP fetch, internet tools. Do not assume live web access.

When task depends on external docs, source, library, framework, SDK, API, examples, package internals -> prefer local `.agent/` index before plan/implementation.

User may create indexes manually. Agent may also run available indexing tools without asking when need clear.

Use `.agent/` as local substitute for web search / external browsing.

## Indexed docs/repos

Docs nav lives at:

- `.agent/docs/<name>/INDEX.md`

Repo nav lives at:

- `.agent/repos/<name>/INDEX.md`

Before answering or implementing against indexed source -> read relevant `INDEX.md` first. Then follow nav layer -> inspect only relevant docs/source needed for task.

## Implementation mindset

Prefer indexing before implementation for unfamiliar or version-sensitive external systems.

Do not guess from memory when local `.agent/` index can provide docs/source.

Use `.agent/` to ground decisions about:

- framework conventions
- API usage
- integration patterns
- package internals
- examples
- version-specific behavior
- project architecture

## Goal mode policy

Use `pi-codex-goal` only when I explicitly ask to start, create, pursue, or run a goal. Do not infer goal mode from ordinary coding, debugging, review, planning, or explanation requests.

When I ask for goal mode, prefer `/create-goal <task>` over raw `/goal <objective>`.

Before creating the goal, make sure the goal description includes:

* one durable objective,
* a verifiable stopping condition,
* success criteria,
* verification evidence,
* constraints and boundaries,
* an iteration policy,
* a blocked stop condition.

Do not call `create_goal` unless I explicitly authorize goal mode. Do not call `update_goal` until every explicit requirement has been mapped to fresh evidence. If evidence is missing, blocked, or uncertain, do not mark complete; report what is missing and what would unlock progress.

## HTML to Markdown conversion

When a task involves converting existing HTML files, stdin HTML, saved webpages, exported Google Docs HTML, or generated HTML snippets into Markdown, prefer the `html-to-markdown` skill.

Use Python `html2text` as the default converter. For coding-agent workflows, prefer stable unwrapped Markdown:

```bash
html2text --body-width=0 input.html > output.md
```

Do not use this workflow by itself for JavaScript-rendered pages, browser layout extraction, sanitization, or main-article extraction. If the input is a noisy webpage, first extract or clean the relevant HTML, then convert it.

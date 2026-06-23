---
description: "Discover and explain an indexed repository fast: product, architecture, users, flows, risks, and next steps"
argument-hint: "[repo-name or focus]"
---

You are a senior software/product discovery analyst helping me understand a repository as fast as possible.

Context / focus from the user: ${ARGUMENTS:-current indexed repository}

## Mission

Produce a fast but evidence-grounded discovery brief that explains:

- What this repository does.
- Why it exists and what problem it solves.
- Who would use it and in what situation.
- What kind of software/product it is.
- The most important capability in the repository.
- How the implementation works at a practical level.
- Which files, modules, commands, tests, and docs matter most.
- What is unclear, risky, missing, or worth inspecting next.

## Repository discovery rules

1. First read `AGENTS.md` if present.
2. If this project contains indexed external sources, read the matching `.agent/repos/<name>/INDEX.md` before inspecting source.
3. Then read `.agent/repos/<name>/MAP.md`, `.agent/repos/<name>/TASKS.md`, and `.agent/repos/<name>/inventory.json` when available.
4. Treat indexed external source paths as read-only unless I explicitly ask for modifications.
5. Do not run install, build, test, deploy, database, network, container, or destructive commands unless I explicitly authorize them.
6. Prefer this order: README/docs/examples → manifests/public entrypoints → implementation → tests.
7. If docs and implementation disagree, report the mismatch and point to both locations.
8. Ground important claims in evidence: file paths, exported symbols, functions/classes, tests, manifests, config, or docs.
9. Separate confirmed facts from inferences.
10. Do not dump long file lists. Interpret why each file or area matters.

## Discovery workflow

Use this sequence unless the repository layout requires a better path:

1. **Navigation layer first**
   - Use `INDEX.md` for summary, source path, edit policy, trust level, and recommended starting points.
   - Use `MAP.md` for ecosystem, package/workspace layout, source zones, docs, examples, tests, and public API clues.
   - Use `TASKS.md` for safe commands, search strategy, and build/test/run hints.
   - Use `inventory.json` for top-level files, largest files, manifests, detected ecosystem, commands, tests, and known gaps.

2. **Human-facing documentation**
   - Read README, docs, examples, changelog, package manifests, and usage snippets.
   - Explain what the project claims to do before relying on implementation details.

3. **Implementation inspection**
   - Inspect public entrypoints, CLI/bin files, app/server startup files, exported APIs, main modules, integrations, configuration, storage, network/API calls, and tests that reveal behavior.
   - Follow user-facing flows inward from entrypoints to core modules.

4. **Product understanding**
   - Identify product category: library, CLI, server, app, SDK, agent tool, plugin, infra component, etc.
   - Identify primary users: developer, end user, AI agent, maintainer, admin, internal team, etc.
   - State the main job-to-be-done: “A user uses this when they need to…”
   - Explain the value proposition and what makes the repository important.

5. **Technical understanding**
   - Identify runtime, language, package manager, manifests, entrypoints, dependencies, important modules, data/control flows, external APIs, configuration, persistence/storage, auth/security/network behavior, and tests.

## Output format

# Repository Discovery Brief: <repo name>

## 1. One-paragraph answer

Explain in plain English what this repository is, what it does, who it is for, and why it matters.

## 2. TL;DR

- What it does:
- How it does it:
- Most important capability:
- Primary user:
- Product/software type:
- Main technologies:
- Confidence level:
- Biggest uncertainty:

## 3. Product understanding

Explain:

- The problem this project solves.
- The main user personas.
- The main use cases.
- The job-to-be-done.
- Whether this is a product, library, tool, framework, service, app, or infrastructure component.

## 4. Technical architecture

Include:

- Runtime/ecosystem.
- Package manager and manifests.
- Main entrypoints.
- Important directories and files.
- Key modules and responsibilities.
- External dependencies/services.
- Data flow or request flow.
- Storage/config/auth/network behavior, if relevant.

## 5. Most important thing this repo does

Identify the single most important capability. Explain why it is central and point to the files, functions, docs, or tests that prove it.

## 6. How it works

Walk through the top 2–4 core flows. For each flow, include:

- Trigger/input.
- Main files/functions involved.
- Processing steps.
- Output/result.
- Evidence.

## 7. How to use / run / test

Summarize only what is supported by docs, manifests, or generated task files:

- Installation/setup:
- Usage examples:
- Build:
- Test:
- Dev/run:
- Required environment variables/config:

Do not guess. Mark unknowns clearly.

## 8. File map for future work

Create a compact table:

| Area | Files/directories | Why it matters |
|---|---|---|

## 9. Risks, gaps, and questions

List:

- Missing or weak docs.
- Unclear entrypoints.
- Risky commands.
- Large or complex files.
- Untested areas.
- Security/privacy/network concerns.
- Places where docs and implementation disagree.

## 10. Next investigation checklist

Give a prioritized checklist depending on my goal:

- If I want to use it.
- If I want to modify it.
- If I want to debug it.
- If I want to evaluate whether it is worth adopting.
- If I want to explain it to someone else.

## 11. Mental model

End with a 2–3 sentence mental model of the repository.

## Style requirements

- Be concise but not shallow.
- Prefer clear explanations over exhaustive listings.
- Cite concrete files/symbols/tests for major claims.
- Use “Confirmed” vs “Inference” when confidence differs.
- Say “I could not determine this from the available files” when something is unclear.
- If the first pass becomes long, give the core discovery brief first and then ask which area to drill into.

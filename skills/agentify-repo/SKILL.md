---
name: agentify-repo
description: "Clone or index a GitHub repository and generate an agent-friendly navigation layer. Use when the user asks to make a repo agent-friendly, vendor a library for inspection, map an unfamiliar codebase, create a source-code navigation layer, or prepare a repository so an agent can retrieve relevant implementation details for future tasks."
---

# Agentify GitHub Repository

Create a thin, evidence-based navigation layer for a GitHub repository so future agents can quickly find relevant docs, examples, public APIs, implementation files, and safe task commands without repeatedly rediscovering the codebase.

This skill is intentionally conservative: it may clone and inspect source, but it must not install dependencies, run repo-defined scripts, modify vendored source, deploy, publish, migrate databases, or run destructive commands unless the user explicitly asks.

## When to use

Use this skill when the user asks to:

- make a GitHub repo agent-friendly
- clone/vendor a library and understand it
- create a map of an unfamiliar codebase
- prepare source code so an agent can retrieve relevant information for future tasks
- "agentify", "map this repo", "index this repo", or "make this discoverable"

Do not use this skill for ordinary coding inside an already-understood project unless the user specifically asks for repository navigation/indexing.

## Inputs

| Input | Default | Notes |
|---|---:|---|
| GitHub repo URL | required unless `--local-repo` is used | e.g. `https://github.com/owner/repo` |
| Local name | inferred from URL | Used for `third_party/<name>` and `.agent/repos/<name>` |
| Clone method | shallow clone | Use submodule only when user asks to track upstream as a submodule |
| Ref | default branch | Accepts branch/tag/sha when user supplies it |
| Edit policy | `read-only` | Do not modify upstream source unless explicitly asked |
| Trust level | `unknown` | Use `trusted`, `unknown`, or `hostile` |

## Outputs

Creates:

```text
.agent/repos/<name>/
  INDEX.md          # entrypoint, provenance, start-here routing, safety rules
  MAP.md            # source zones, public API clues, docs/examples/tests, generated areas to skip
  TASKS.md          # common workflows, command evidence, command risk classification
  inventory.json    # structured source of truth used to render the markdown
```

May create:

```text
.agent/repos/<name>/packages/<package-name>.md
```

Updates or creates root `AGENTS.md` with an idempotent pointer to the generated navigation layer.

## Preferred one-command workflow

From the project root, run the deterministic orchestrator from this skill directory:

```bash
python3 scripts/agentify_repo.py <github-url>
```

Useful options:

```bash
python3 scripts/agentify_repo.py <github-url> --name <name>
python3 scripts/agentify_repo.py <github-url> --ref <branch-or-tag-or-sha>
python3 scripts/agentify_repo.py <github-url> --trust-level unknown --edit-policy read-only
python3 scripts/agentify_repo.py --local-repo third_party/<name> --name <name>
python3 scripts/agentify_repo.py <github-url> --no-agents-update
python3 scripts/agentify_repo.py <github-url> --inventory-only
```

If Python is unavailable, the legacy inventory wrapper can still be used:

```bash
bash scripts/inventory.sh third_party/<name>
```

## Manual fallback procedure

Use this only if the orchestrator cannot run.

### Phase 1: Acquire and pin

Clone into `third_party/<name>/`:

```bash
mkdir -p third_party
git clone --depth=1 <url> third_party/<name>
git -C third_party/<name> rev-parse HEAD
mkdir -p .agent/repos/<name>
```

If the user explicitly requested a submodule:

```bash
git submodule add <url> third_party/<name>
```

Record:

- upstream URL
- requested ref, if any
- resolved commit SHA
- clone mode
- scan timestamp
- edit policy
- trust level

### Phase 2: Inventory

Run:

```bash
python3 scripts/inventory_repo.py third_party/<name> --name <name> --url <url> --output .agent/repos/<name>/inventory.json
```

The inventory must capture:

- top-level files/directories
- tracked-file counts and largest files
- language/ecosystem signals
- nested manifests and workspace/package boundaries
- package manager and build system signals
- README/docs/examples/tests/CI/agent-instruction files
- public API clues such as exports and entrypoints
- generated or low-value areas to skip
- candidate commands with evidence and risk classification
- provenance and git metadata

### Phase 3: Generate docs

Run:

```bash
python3 scripts/render_docs.py .agent/repos/<name>/inventory.json --output-dir .agent/repos/<name>
```

Generated docs must be repo-specific. Never leave template placeholders, never invent paths, and never claim a command exists without evidence.

### Phase 4: Register with root AGENTS.md

Run:

```bash
python3 scripts/update_agents_md.py --name <name> --source third_party/<name> --index .agent/repos/<name>/INDEX.md --description "<one-line description>"
```

The root `AGENTS.md` entry should be a pointer only; full details live in the generated index.

### Phase 5: Validate

Run:

```bash
python3 scripts/validate_output.py .agent/repos/<name> --repo third_party/<name>
```

Validation must fail if:

- required files are missing
- placeholders remain
- referenced paths do not exist without being marked as missing
- pinned commit is malformed when git metadata exists
- `AGENTS.md` registration is absent when requested
- generated docs exceed the size budget
- command sections omit risk/evidence

## Safety policy

Default trust level is `unknown`. For unknown or hostile repositories:

- Do not run dependency installation.
- Do not run package lifecycle scripts.
- Do not run repo-defined build/test/lint scripts automatically.
- Do not run Docker, cloud CLIs, database migrations, deploy, publish, release, or cleanup commands.
- Do not initialize submodules or Git LFS unless requested.
- Do not modify vendored source unless the user explicitly asks.

Safe-by-default read commands include `git rev-parse`, `git remote get-url`, `git ls-files`, `find`, `rg`, `cat`, and manifest parsing.

See `references/safety.md` for the full command-risk rubric.

## Output quality rules

- `INDEX.md` answers: what is this repo, where is it, what commit is pinned, where to start, and what not to touch.
- `MAP.md` answers: where docs/examples/tests/public APIs/source zones live and what to skip.
- `TASKS.md` answers: how to understand, search, build, test, lint, typecheck, run examples, and compare docs vs implementation.
- Every important claim should have evidence, confidence, or an explicit “not found”.
- Keep the navigation layer small. Route to upstream files instead of copying large upstream documentation.
- For small repos, `INDEX.md` plus `TASKS.md` may be enough; do not over-generate.
- For large monorepos, generate per-package maps only for meaningful packages.

## Staleness and updates

Generated files are valid for the pinned commit only. If the vendored repository changes, rerun:

```bash
python3 scripts/agentify_repo.py --local-repo third_party/<name> --name <name>
```

If the upstream should be refreshed first, do that explicitly and then re-run the skill. Always record the new commit.

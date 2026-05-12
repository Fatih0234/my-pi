# Safety reference for agentified repositories

This skill treats cloned repositories as untrusted unless the user says otherwise. A repository can execute arbitrary code through install hooks, build scripts, tests, Docker files, Makefiles, CI helpers, and generated shell snippets.

## Trust levels

| Level | Meaning | Default behavior |
|---|---|---|
| `trusted` | User owns or explicitly trusts the repo | May run low-risk commands after reviewing them |
| `unknown` | Default for public GitHub repos | Read-only inspection only; ask before running repo-defined commands |
| `hostile` | Suspicious, malware-like, challenge repo, or user says to treat as unsafe | Do not run repo-defined commands; inspect as text only |

## Command risk classes

| Risk | Examples | Policy |
|---|---|---|
| `read-only` | `git rev-parse`, `git ls-files`, `rg`, `find`, parsing manifests | Safe by default |
| `metadata` | `npm pkg get`, `python -m tomllib` on local files | Safe when it does not execute repo code |
| `install` | `npm install`, `pip install -e .`, `cargo fetch`, `bundle install` | Ask first; prefer no lifecycle scripts where supported |
| `build` | `npm run build`, `make`, `cargo build`, `go build` | Ask first for unknown repos |
| `test` | `npm test`, `pytest`, `cargo test`, `go test` | Ask first for unknown repos |
| `network` | package fetches, curl scripts, cloud CLIs | Ask first; explain network access |
| `container` | Docker build/run/compose, devcontainers | Ask first; may execute arbitrary build steps |
| `database` | migrations, seed/reset scripts | Never run without explicit confirmation |
| `deploy` | publish, release, upload, terraform apply | Never run without explicit confirmation |
| `destructive` | `rm -rf`, `git clean -fdx`, prune, reset hard | Never run without explicit confirmation |

## Dependency installation guidance

For unknown repositories, do not install dependencies just to build the navigation layer. If the user later asks to build/test, prefer safer variants when available:

- npm: `npm ci --ignore-scripts`
- pnpm: `pnpm install --ignore-scripts`
- yarn: inspect version first; avoid lifecycle scripts when possible
- Python: avoid executing `setup.py`; prefer reading `pyproject.toml`
- Rust/Go: fetch/build may still run build scripts; treat as build risk

## Generated docs guidance

The generated navigation docs should classify commands and tell future agents when to ask. Do not present a repo-defined command as safe simply because it is named `test` or `build`.

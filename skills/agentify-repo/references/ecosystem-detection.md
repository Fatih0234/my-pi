# Ecosystem detection reference

The scanner uses signals rather than assumptions. A repo may contain more than one ecosystem.

## Common manifest signals

| Ecosystem | Manifests and clues |
|---|---|
| Node/JS/TS | `package.json`, `pnpm-workspace.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`, `tsconfig.json` |
| Python | `pyproject.toml`, `requirements*.txt`, `setup.py`, `setup.cfg`, `Pipfile`, `uv.lock`, `poetry.lock` |
| Rust | `Cargo.toml`, `Cargo.lock`, `crates/` |
| Go | `go.mod`, `go.sum`, `cmd/`, `internal/` |
| Java/Kotlin | `pom.xml`, `build.gradle`, `settings.gradle`, `gradlew` |
| .NET | `*.csproj`, `*.sln`, `Directory.Build.props` |
| Ruby | `Gemfile`, `gemspec`, `Rakefile` |
| PHP | `composer.json`, `composer.lock` |
| Swift | `Package.swift`, `*.xcodeproj`, `*.xcworkspace` |
| C/C++ | `CMakeLists.txt`, `Makefile`, `meson.build`, `configure.ac` |
| Infra | `Dockerfile`, `docker-compose.yml`, `terraform/`, `*.tf`, `charts/`, `helmfile.yaml` |
| Nix | `flake.nix`, `shell.nix`, `default.nix` |
| Bazel | `WORKSPACE`, `MODULE.bazel`, `BUILD`, `BUILD.bazel` |

## Public API clues

Prefer evidence in this order:

1. Package manifest exports/entrypoints.
2. Public documentation/API reference.
3. README examples.
4. Conventional entrypoints such as `src/index.ts`, `lib.rs`, `__init__.py`, `cmd/<name>/main.go`.
5. Tests and examples using the package.

## Monorepo clues

Look for `packages/`, `apps/`, `services/`, `libs/`, `crates/`, `modules/`, `examples/`, workspace config files, and nested manifests. Do not assume `packages/` exists.

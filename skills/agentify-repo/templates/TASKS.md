# Common tasks — {{REPO_NAME}}

## Command safety

Commands below are classified by risk. For `unknown` or `hostile` repositories, do not run install/build/test/container/network/database/deploy/destructive commands unless the user explicitly asks.

## Understand the repository

1. Read `.agent/repos/{{NAME}}/INDEX.md`.
2. Read the primary README if present.
3. Read agent instructions if present.
4. Skim docs and examples.
5. Use `MAP.md` to jump to the relevant package or source zone.

## Search for a feature

{{FEATURE_SEARCH}}

## Commands discovered

{{COMMANDS_TABLE}}

## Build

{{BUILD_SECTION}}

## Test

{{TEST_SECTION}}

## Lint / typecheck

{{LINT_TYPECHECK_SECTION}}

## Run examples

{{EXAMPLES_SECTION}}

## Compare docs vs implementation

1. Find the docs page or README section for the feature.
2. Find an example that uses it.
3. Find the exported symbol or public entrypoint.
4. Inspect implementation and tests.
5. Report mismatches explicitly.

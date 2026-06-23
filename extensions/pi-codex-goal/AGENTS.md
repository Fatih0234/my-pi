# pi-codex-goal — agent notes

Pi extension: Codex-style `/goal` command and `get_goal` / `create_goal` / `update_goal` tools. State lives in pi session custom entries.

## Local pi install policy

On this machine, the canonical active install is the global/user package pointing at this local checkout:

```text
../../Projects/AI/pi-codex-goal
```

Do not leave project-local installs of this package in this repo. In particular, avoid release verification commands such as:

```sh
pi install -l npm:pi-codex-goal
pi install -l https://github.com/fitchmultz/pi-codex-goal@vX.Y.Z
```

Those write duplicate package entries under `.pi/` for the current project, causing `get_goal`, `create_goal`, and `update_goal` tool-registration conflicts with the global local-checkout install. For install-path release verification, use an isolated temp project/config directory or remove the project-local entries immediately after the check. With Pi 0.79+ project trust, pass `--approve` for isolated project-local package install/list/non-interactive smoke commands when those commands must load `.pi/settings.json`. If conflicts appear, inspect `pi list --approve` and `.pi/settings.json`, then remove any project-local `pi-codex-goal` npm/GitHub installs so only the global local-checkout package remains active.

## Verify before finishing

```sh
npm run verify
```

Runs `tsc --noEmit`, the platform-smoke harness checks, and the full Node test suite (`test/*.test.ts`).

For release-sensitive changes, also use the local Crabbox platform gate documented in `docs/platform-smoke.md`:

```sh
npm run check:platform-smoke
npm run smoke:platform:all
```

`smoke:platform:all` runs `smoke:platform:doctor` before any target suite starts.

The required gate runs the full suite plus a real model-backed goal-tool smoke on macOS, Ubuntu Linux, and native Windows. The default smoke model is `zai/glm-5.1`; override with `PLATFORM_SMOKE_MODEL` when needed.

## Layout

| Area | Modules |
|------|---------|
| Wiring | `src/index.ts`, `goal-runtime-controller.ts` |
| User / model API | `commands.ts`, `tools.ts` |
| Runtime events | `goal-runtime-event-handlers.ts`, `goal-runtime-*-handlers.ts` |
| Transitions | `goal-transition.ts`, `goal-transition-effects.ts`, `goal-state-controller.ts` |
| Stale continuations | `stale-queued-work-*.ts` |
| Recovery | `recovery*.ts` |
| Domain | `state.ts`, `types.ts`, `goal-persistence.ts` |

Structural audit: `docs/CODEBASE_AUDIT.md`.

## Success criteria collection before goals

When the user wants to start a `pi-codex-goal` goal from a rough issue, task, bug, feature request, or implementation idea, collect success criteria before activating the goal unless the user already provided a complete `/create-goal` command.

Do not ask whether the task is goal-worthy; assume the user has already decided to use goal mode.

Before drafting the goal, inspect the relevant current repo context: issue text, linked docs, nearby files, existing tests, validation commands, package scripts, repo instructions, implementation patterns, generated-file conventions, and available logs/errors.

Produce a concise Success Criteria Sheet covering intended outcome, functional acceptance criteria, verification evidence, regression constraints, scope and boundaries, ambiguities and required decisions, blocked stop condition, and final completion audit checklist.

Ask only targeted questions whose answers materially change the completion contract. Do not ask questions that can be answered by reading the repo. Make low-risk assumptions explicit.

After collecting criteria, draft a single `/create-goal ...` command. Do not call `create_goal` until the user approves the draft, unless the user explicitly asked for immediate activation.

Do not store secrets in criteria sheets. If criteria should be saved, prefer `docs/specs/` for team-visible specs and `.pi/goal-intake/` for local Pi workflow artifacts.

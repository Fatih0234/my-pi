---
description: Collect success criteria for a pi-codex-goal before creating the goal
argument-hint: "<task / issue / feature / bug / implementation request>"
---

User task / issue / implementation context:
$@

Assume the user has already decided this task should use goal mode. Do not evaluate whether the task is goal-worthy.

Your job is to collect success criteria before a `pi-codex-goal` goal is created.

Do not call `create_goal` yet unless the user explicitly says to activate/start/create the goal immediately after collection. By default, produce a draft `/create-goal ...` command for user approval.

First inspect the relevant current context before asking questions. Depending on the task, inspect the issue/task text, current repository files, docs, AGENTS.md or equivalent repo instructions, package manifests, validation commands, tests, nearby implementation patterns, configs, generated-file rules, linked docs, and any existing errors/logs provided by the user.

Do not ask questions that can be answered by inspecting available context. Ask only targeted questions whose answers materially change the completion contract. If an ambiguity is low-risk, make a safe assumption and label it.

Produce a concise Success Criteria Sheet with these sections:

1. Intended outcome
- State what must be true when complete.
- Separate explicit requirements from inferred requirements.
- Preserve the user's full intent. Do not weaken broad requirements such as "all", "any", "complete", "fully", "no tech debt", "do it right", or "hard acceptance criteria".

2. Functional acceptance criteria
- List user-visible behavior, API behavior, CLI behavior, data behavior, UI behavior, workflow behavior, edge cases, and negative cases that must work.
- Use concrete, testable wording.

3. Verification evidence
- Name the tests, commands, builds, typechecks, lint checks, smoke checks, screenshots, benchmark outputs, logs, generated artifacts, rendered pages, diffs, or manual inspections that would prove completion.
- Prefer existing repo validation commands when available.
- If a validation command is unknown, say where it should be discovered.

4. Regression constraints
- List existing behavior, public APIs, file formats, data contracts, performance expectations, security/privacy expectations, user changes, generated-file rules, and compatibility requirements that must not regress.

5. Scope and boundaries
- List files, directories, modules, docs, tests, configs, data sources, or systems likely in scope.
- List files, generated outputs, credentials, deployment systems, or unrelated areas not to touch unless required.

6. Ambiguities and required decisions
- Ask targeted questions only when the answer materially changes the completion contract.
- Label safe assumptions separately from true blockers.

7. Blocked stop condition
- Define when the goal should stop without marking complete.
- Include missing credentials, unavailable services, failing external systems, unclear product decisions, impossible validation, conflicting requirements, or tool/access limits.

8. Final completion audit checklist
- Map every explicit requirement to the evidence required before `update_goal` may be called.
- State that uncertainty means the goal is not complete.

9. Draft `/create-goal` command
- Produce one pasteable `/create-goal ...` command using the collected criteria.
- The command must include outcome, verification evidence, constraints, scope/boundaries, iteration policy, completion audit, and blocked-stop condition.
- Do not call `update_goal` in the draft. The active goal will call it only after verified completion.

Optional artifact suggestion:
- If the criteria should be team-visible, suggest saving them under `docs/specs/<task-slug>.md`.
- If the criteria are local Pi workflow scaffolding, suggest `.pi/goal-intake/<task-slug>.md`.
- Do not store secrets, raw credentials, tokens, private keys, or private endpoint details in criteria sheets.
- Do not write files unless the user asks.

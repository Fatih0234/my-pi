---
description: Interactively review a working app, script, or MVP and map high-value review points
argument-hint: "<optional review context>"
---

You are running Controlled App Review Discovery.

Do not implement product changes. Do not refactor the main code. Do not “fix as you go.” Your job is to interact with the project, discover hidden UX weirdness, product polish issues, edge cases, flaky behavior, test gaps, and bugs that affect the intended current experience, then write the findings into `.agent/APP_REVIEW_MAP.md` and `.agent/APP_REVIEW_SCENARIOS.md`.

The optional review context is:

$ARGUMENTS

## Core principle

The app/script/MVP already appears to work after manual testing. Your job is not to repeat only the happy path and say “looks good.” Your job is to find the few review points that deserve focused attention before the human trusts the project further.

Focus on the current implied product. Do not invent new features. Missing expected behavior is allowed only when the current product clearly implies it.

A point deserves attention when it is:

* likely to confuse or frustrate a real user
* likely to break outside the obvious happy path
* likely to be flaky, timing-sensitive, state-sensitive, or environment-sensitive
* likely to make the product feel unfinished or weird
* likely to hide a test gap that would let regressions through
* important enough that the human would want to review it separately
* specific enough to investigate or verify in a focused follow-up session

Prefer fewer, sharper points. Do not produce a generic QA checklist.

## Operating boundaries

You may:

* inspect the repository
* infer how to run the project
* run existing tests, lint checks, type checks, and build checks when available
* start the app or script locally
* interact with the app using available browser, CLI, API, or runtime tools
* create or update `.agent/APP_REVIEW_MAP.md`
* create or update `.agent/APP_REVIEW_SCENARIOS.md`
* create temporary scratch files only when needed to prove a point
* write docs related to findings
* suggest code or test changes inside the review files

You must not:

* change the main app logic
* refactor source code
* silently fix issues
* add features
* change production data
* run destructive commands
* modify migrations, schemas, auth, payments, deployment, or external services unless the human explicitly asked
* treat speculative issues as proven
* spawn or simulate subagents
* spend the whole context on exhaustive QA

Temporary files must go under `.agent/tmp/` or another obvious scratch location. Delete them when no longer needed, or document why they remain.

## Step 1 — Inspect project context

Inspect only as much as needed to understand the project and how to run it.

Look for:

* README or project docs
* package manager files
* scripts in `package.json`, `pyproject.toml`, `Makefile`, `justfile`, Docker files, or similar
* existing tests
* existing lint/type/build commands
* app entry points
* route structure or command structure
* existing `.agent/APP_REVIEW_MAP.md`
* existing `.agent/APP_REVIEW_SCENARIOS.md`
* existing `.agent/POINT_MAP.md`
* existing todos, if the `todo` tool is available

Do not expect the human to provide the launch command. Infer it from the repository.

If several launch commands are plausible, choose the safest likely local command and document the choice.

## Step 2 — Identify the object under review

Classify the project as one or more of:

* web app
* mobile app
* desktop app
* CLI/script
* backend/API
* AI workflow
* browser extension
* dashboard/internal tool
* library/package
* mixed project
* unknown

Then briefly state what the project appears to do and what the current user-facing contract seems to be.

The user-facing contract means:

* who the user is
* what the user is trying to accomplish
* what the app/script promises or implies
* what the core happy path is
* what “working” should mean for this project
* what behavior is clearly expected even if not explicitly documented

Mark assumptions clearly.

## Step 3 — Infer the review scope

Assume the human has already manually tested the obvious path and the project seems to work.

Use a middle-depth review pass:

* not superficial
* not exhaustive
* focused on the most likely hidden problems
* enough interaction to produce evidence
* bounded to the most important surfaces

Select 3–7 core flows or surfaces to inspect, depending on project size.

For web/UI projects, consider:

* first-load experience
* main user journey
* empty states
* invalid inputs
* long inputs
* repeated clicks
* fast clicks
* navigation/back/refresh behavior
* loading states
* persistence after refresh
* small viewport or responsive layout
* obvious accessibility friction
* error messages
* console/runtime errors
* network or async timing sensitivity
* state transitions that may become stale

For CLI/script projects, consider:

* no arguments
* invalid arguments
* missing files
* malformed input
* large input
* repeated runs
* output clarity
* exit codes
* environment assumptions
* idempotency
* failure messages
* temporary file behavior

For backend/API projects, consider:

* core endpoint smoke checks
* invalid payloads
* missing parameters
* auth assumptions if present
* error shape consistency
* persistence/state assumptions
* duplicate requests
* basic latency or timeout risks
* contract mismatch between docs and behavior

For AI workflows, consider:

* empty input
* ambiguous input
* long input
* malformed input
* repeated runs
* output format drift
* hallucination-prone assumptions
* tool failure behavior
* recovery from partial context
* user trust issues

Security/privacy is a lightweight lens for MVPs. Only elevate it when the project clearly includes auth, payments, user data, uploads, API keys, public sharing, admin panels, or sensitive workflows.

## Step 4 — Run and interact

Start with existing verification commands when available:

* tests
* lint
* type check
* build
* smoke scripts

Then run the app/script locally.

For web apps:

* start the dev server
* open the app in a browser when tools are available
* interact like a real user
* watch for visible weirdness, console errors, broken flows, confusing states, and timing issues
* refresh and retry key flows
* try at least one narrow viewport if practical
* try at least one invalid or edge input path

For scripts/CLI:

* run the default command
* run the obvious happy path
* run a few edge/error cases
* inspect outputs and exit behavior

For APIs:

* start the service if possible
* hit the most important endpoints
* try valid and invalid requests
* inspect response consistency

If you cannot run or interact because of missing dependencies, environment limits, unavailable tools, or unclear setup, document that clearly and shift to static review. Do not pretend interaction happened.

## Step 5 — Record review scenarios

Create or update `.agent/APP_REVIEW_SCENARIOS.md`.

Use this structure exactly:

# App Review Scenarios

## Review Context

* Project type:
* Inferred purpose:
* Optional human context:
* Launch command discovered:
* Verification commands run:
* Interaction tools used:
* Review depth:
* Important assumptions:
* Review limitations:

## Surface Area Reviewed

List the flows, screens, commands, endpoints, or behaviors reviewed.

## Scenario Catalog

### S1 — [Scenario name]

* Type: happy path / edge case / invalid input / UX polish / flakiness probe / persistence check / responsive check / error handling / test gap / other
* Surface:
* Why this scenario matters:
* Steps performed:
* Expected behavior:
* Observed behavior:
* Evidence:
* Result: pass / concern / fail / blocked / inconclusive
* Related point: unassigned
* Automation candidate: yes/no
* Repeat needed: yes/no

Repeat for S2, S3, etc.

## Not Reviewed

List important things you did not review and why.

## Reproduction Notes

Include commands, URLs, test data, or setup notes needed to reproduce the important observations.

## Step 6 — Generate candidate review points

Generate candidate points from the scenarios and repository inspection.

Use these lenses when relevant:

* UX weirdness
* product polish within the existing product
* edge cases
* flaky or nondeterministic behavior
* timing and async behavior
* state and persistence behavior
* confusing empty/error/loading states
* validation and input handling
* navigation and recovery
* responsive layout basics
* test gaps
* console/runtime errors
* unclear user feedback
* mismatch between implied behavior and actual behavior
* lightweight security/privacy only when relevant

Reject:

* generic “add more tests” points
* speculative bugs without evidence
* feature requests not implied by the current product
* large architecture rewrites
* low-impact polish that does not affect trust or usability
* issues that are better handled immediately in the same context rather than isolated attention

For each candidate, distinguish:

* observed evidence
* inferred risk
* confidence level
* suggested code/test direction
* what should not be changed

## Step 7 — Rank by value of focused attention

Rank points using:

* user impact
* severity
* confidence
* failure cost
* frequency of realistic use
* likelihood of recurrence
* flakiness risk
* leverage over future work
* testability
* context demand
* review-worthiness for the human

Use three groups:

1. High-value isolated attention points — up to 5
2. Medium-value points — up to 5
3. Low-value / do-not-spend-context points — only include if useful

Keep the first version centered on:

* UX weirdness
* product polish problems
* edge cases
* flaky behavior
* test gaps
* bugs affecting the intended current experience
* missing expected behavior clearly implied by the current product

## Step 8 — Write `.agent/APP_REVIEW_MAP.md`

Create or update `.agent/APP_REVIEW_MAP.md`.

Use this structure exactly:

# App Review Map

## Object Under Review

Briefly describe the project, its type, and what the current product appears to promise.

## Review Constraints

* Main code changes allowed: no
* Docs/findings changes allowed: yes
* Temporary experiments allowed: yes
* Implementation during review: no
* Feature invention allowed: no
* Missing expected behavior allowed: yes, only when clearly implied
* Review depth: middle
* Security/privacy depth: lightweight unless clearly relevant

## Product Contract

* Affected user:
* User goal:
* Core happy path:
* Implied expected behavior:
* Product/workflow value:
* Highest failure cost:
* Likely frequency:
* Key constraints:
* Important unknowns:
* Assumptions:

## Interaction Summary

* Launch command used:
* Verification commands run:
* Surfaces interacted with:
* Scenarios created:
* Evidence collected:
* Blockers or limitations:

## High-Value Isolated Attention Points

### P1 — [Point name]

* Status: open
* Todo: uncreated
* Priority: high
* Severity: blocker / high / medium / low
* Confidence: high / medium / low
* Deserves separate session: yes
* Related scenarios:
* Why it matters:
* Evidence:
* User impact:
* Product polish impact:
* Flakiness or edge-case risk:
* Suggested code/test direction:
* What to investigate or decide:
* Evidence required:
* What to ignore:
* Starter prompt:

```text
[Write a focused prompt for this point only. It should tell the agent/session what to inspect, what to reproduce, what evidence to collect, what code or tests may need to change, and what not to touch. It should not ask the agent to redesign unrelated parts of the app.]
```

Repeat for P2, P3, etc.

## Medium-Value Points

Use the same structure, but priority should be medium.

## Low-Value / Do-Not-Spend-Context Points

For each:

* Point:
* Why not now:
* When it becomes worth attention:

## Suggested Test Additions

List concrete tests that would increase confidence without over-testing.

For each:

* Test:
* Type: unit / integration / e2e / CLI / API / manual
* Related point:
* Why it matters:
* Suggested assertion:
* Priority:

## Selected Points For Current Run

* [ ] P1 — [name]
* [ ] P2 — [name]

## Todo Links

Add todo IDs here after creating todos.

| Point | Todo ID   | Status |
| ----- | --------- | ------ |
| P1    | uncreated | open   |

## Notes For Synthesis

Use this section later to merge findings from point-specific sessions.

## Step 9 — Create todos when useful

If the `todo` tool is available, create one todo for each high-value point only.

Each todo should have:

* title: `P1 — [Point name]`
* tags: `["app-review", "point", "attention", "high"]`
* status: `open`
* body: include the point summary, related scenarios, evidence, suggested code/test direction, what to ignore, and the starter prompt

After creating todos, update `.agent/APP_REVIEW_MAP.md` and replace `Todo: uncreated` with the actual TODO ID.

Also update the Todo Links table.

If the `todo` tool is not available, do not fail. Keep `Todo: uncreated` and mention that todos should be created manually.

## Step 10 — Final response

Return a short summary only:

* where the review map was written
* where the scenarios file was written
* what launch/verification commands were used
* how many scenarios were created
* how many high-value points were identified
* which points were converted into todos
* which point you recommend working on first and why

Do not paste the full review map unless asked.
Do not claim the app is fully tested.
Do not claim there are no issues unless the review actually produced strong evidence.

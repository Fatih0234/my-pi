---

description: Discover high-value isolated attention points and write them to .agent/POINT_MAP.md
argument-hint: "<task/context>"
---

You are running Controlled Point Discovery.

Do not solve the task yet. Do not implement. Do not refactor. Do not spawn or simulate subagents. Your job is to discover the few points inside this task that deserve isolated focused attention, write them into `.agent/POINT_MAP.md`, and create matching todo items when useful.

The task/context is:

$ARGUMENTS

## Core principle

Context is scarce. Do not spread one context window across too many perspectives. First decide which points deserve their own focused session.

A point deserves isolated attention when it is:

* high impact for the user or product
* high risk if wrong
* uncertain enough to require investigation
* context-heavy enough that mixing it with other work would reduce quality
* strategically important enough that the human will actually want to review it

Do not maximize the number of points. Prefer fewer, sharper points.

## Step 1 — Inspect context

First inspect the repository and available project context only as much as needed to understand the task.

Look for:

* product purpose
* user story
* current feature or bug scope
* relevant files, docs, tests, issues, or TODOs
* constraints implied by the codebase
* existing `.agent/POINT_MAP.md`, if present
* existing todos, if the `todo` tool is available

Do not perform broad implementation research. This is a mapping step, not a solving step.

## Step 2 — Identify the object under attention

Classify the task as one or more of:

* bug
* feature improvement
* UX flow
* architecture issue
* technical debt
* performance issue
* security/trust issue
* product decision
* triage/classification task
* prompt/workflow improvement
* management/process issue
* research/validation question
* mixed task

Then briefly explain what the task is really about.

## Step 3 — Infer the impact context

Infer and state:

* who is affected
* what the user is trying to accomplish
* what value this part of the app/workflow is supposed to create
* where failure would hurt most
* how often this might matter
* what trust, revenue, retention, speed, or usability depends on
* what is unknown but important
* what constraints matter right now

If the context is thin, make explicit assumptions and mark them as assumptions.

## Step 4 — Generate candidate attention points

Generate candidate points across relevant lenses. Use only lenses that fit the task.

Possible lenses:

* user-value points
* failure points
* edge-case points
* ambiguity points
* technical-risk points
* architectural-dependency points
* UX/confusion points
* trust/safety/security points
* performance/cost points
* maintainability points
* testing/verification points
* product-positioning points
* workflow/process points
* hidden-dependency points

For each candidate, ask:

“Would this be better handled in its own focused context window?”

Reject generic categories that are not genuinely useful for this task.

## Step 5 — Rank by value of isolated attention

Rank points using this scoring logic:

* User impact
* Failure cost
* Frequency of real use
* Uncertainty
* Leverage over downstream work
* Context demand
* Review-worthiness for the human

Use three groups:

1. High-value isolated attention points — up to 5
2. Medium-value points — up to 5
3. Low-value / do-not-spend-context points — only include if useful

Low-value does not mean “bad.” It means “do not spend a separate context window on this right now.”

## Step 6 — Write `.agent/POINT_MAP.md`

Create or update `.agent/POINT_MAP.md`.

Use this structure exactly:

# Point Map

## Object Under Attention

Briefly describe the task and its type.

## Impact Context

* Affected user:
* User goal:
* Product/workflow value:
* Highest failure cost:
* Likely frequency:
* Key constraints:
* Important unknowns:
* Assumptions:

## High-Value Isolated Attention Points

### P1 — [Point name]

* Status: open
* Todo: uncreated
* Priority: high
* Deserves separate session: yes
* Why it matters:
* Perspective to use:
* What to investigate or decide:
* Evidence required:
* What to ignore:
* Starter prompt:

```text
[Write a focused prompt for this point only. It should tell the agent/session what to inspect, what to decide, what evidence to produce, and what not to touch.]
```

Repeat for P2, P3, etc.

## Medium-Value Points

Use the same structure, but priority should be medium.

## Low-Value / Do-Not-Spend-Context Points

For each:

* Point:
* Why not now:
* When it becomes worth attention:

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

## Step 7 — Create todos when useful

If the `todo` tool is available, create one todo for each high-value point only.

Each todo should have:

* title: `P1 — [Point name]`
* tags: `["point", "attention", "high"]`
* status: `open`
* body: include the point summary, evidence required, what to ignore, and the starter prompt

After creating todos, update `.agent/POINT_MAP.md` and replace `Todo: uncreated` with the actual TODO ID.

Also update the Todo Links table.

If the `todo` tool is not available, do not fail. Keep `Todo: uncreated` and mention that todos should be created manually.

## Step 8 — Final response

Return a short summary only:

* where the point map was written
* how many high-value points were identified
* which points were converted into todos
* which point you recommend working on first and why

Do not paste the full point map unless asked.

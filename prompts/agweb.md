---
description: Create an objective Antigravity web-research brief for the current blocker and run the web-research skill
argument-hint: "[brief-name] [low|medium|high] [focus]"
---

Use the `antigravity-research` skill as a web-grounded research sidecar for the current unresolved coding task.

This template is for situations where the current Pi session is stuck, uncertain, blocked by missing external knowledge, facing a bug/debugging issue, or needs current documentation/source research before making the next implementation decision.

Invocation arguments:
- Brief name: `${1:-current-blocker}`
- Reasoning level: `${2:-high}`
- Extra focus from user: `${@:3}`

## Mission

Do not treat Antigravity as a general second brain. Treat it as a web-search and documentation-research worker.

Your job is to:
1. Objectively describe the current situation.
2. Write a Markdown research brief for Antigravity.
3. Ask Antigravity to perform web-grounded research.
4. Read the resulting report.
5. Use the report to decide Pi's next move.

## When to use this workflow

Proceed when at least one of these is true:
- The answer depends on current external documentation, API behavior, package versions, release notes, GitHub issues, standards, or examples.
- We are stuck after local debugging and need external evidence.
- The issue may be caused by library/framework behavior.
- We need to compare approaches based on current ecosystem practice.
- We need to understand a browser/runtime/platform/tool behavior that may have changed.

If the problem can clearly be solved from local code alone, briefly say that Antigravity web research is not needed and continue locally instead.

## Objectivity rules

When writing the brief, do not steer Antigravity toward your favorite hypothesis.

Separate:
- Observed facts
- User goal
- Expected behavior
- Actual behavior
- Exact errors/logs
- Environment/version details
- Relevant local code snippets
- Things already tried
- Hypotheses, clearly marked as hypotheses
- Questions for web research

Do not write:
- "Find evidence that X is the cause"
- "Prove that we should use Y"
- "Search for why my preferred solution is right"

Prefer:
- "Research likely causes of this error across official docs, changelogs, GitHub issues, and recent examples."
- "Compare documented approaches and identify which one fits these constraints."
- "Check whether this behavior changed recently."

## Brief file to create

Create a filesystem-safe slug from the brief name argument. If `${1:-current-blocker}` is missing or unsafe, use `current-blocker`.

Create this file:

`.pi/antigravity-briefs/<slug>.md`

Use this structure exactly:

```markdown
# Antigravity Web Research Brief

## 1. Task Pi is trying to complete

Describe the user's actual coding/product/debugging task in neutral terms.

## 2. Current blocker or uncertainty

Describe what is not working or what Pi cannot confidently decide.

## 3. Expected behavior

Describe what should happen.

## 4. Actual behavior

Describe what is happening instead. Include exact error messages, logs, stack traces, failing commands, screenshots described in text, or observed symptoms when available.

## 5. Relevant local context

Include only the most relevant local context:
- File paths
- Package/framework/runtime versions
- Minimal code snippets
- Relevant config
- Commands already run and their outputs

Do not include secrets, tokens, private keys, `.env` values, credentials, or unrelated code.

## 6. Things already tried

List attempted fixes, debugging steps, and why they did or did not work.

## 7. Constraints and preferences

Include project constraints, platform constraints, style constraints, dependency constraints, and what should not be changed.

## 8. Neutral web research questions

Write objective research questions for Antigravity, such as:
- What do official docs say about this behavior?
- Are there recent changelog/release-note changes related to this?
- Are there known GitHub issues or bug reports matching this symptom?
- What are the currently recommended approaches?
- What caveats or edge cases should Pi know before changing code?

## 9. Required Antigravity output

Ask Antigravity to produce a source-backed report with:
- Web searches performed
- Sources consulted, with URLs and one-line relevance notes
- Key findings
- Recommended next move for Pi
- Implementation notes
- Risks and caveats
- Evidence gaps / uncertainty
- Confidence level

Tell Antigravity explicitly:
- Use web search / documentation / source lookup.
- Do not answer only from model memory.
- If web access fails, say so clearly.
- Do not edit the project repository.
- Produce a report for Pi to read.
```

## Run Antigravity

After writing the brief, run the Antigravity web-research skill with the selected reasoning level.

Use one of:
- `low` for quick documentation lookups or simple error searches.
- `medium` for normal bugs, library behavior, and implementation choices.
- `high` for hard blockers, ambiguous failures, architecture-impacting decisions, or when the local Pi model is stuck.

If the provided reasoning argument is not one of `low`, `medium`, or `high`, use `high`.

Run:

```bash
AGY_REASONING="<low|medium|high>" ~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh --file ".pi/antigravity-briefs/<slug>.md"
```

## After Antigravity returns

Read the generated `report.md`.

Validate the report:
- It must include web searches performed or external sources consulted.
- It must include source URLs.
- It must distinguish evidence from uncertainty.
- It must give a practical next move for Pi.

If the report has no sources or appears to answer only from model memory, treat the run as failed. Either retry once with a stricter brief or tell the user that Antigravity did not produce a web-grounded report.

## Final response to the user

Summarize:
1. The brief file created.
2. The Antigravity report path.
3. The most important source-backed findings.
4. The recommended next Pi action.
5. Any uncertainty or caveats.

Do not blindly implement Antigravity's recommendation. Use it as evidence for Pi's next decision.

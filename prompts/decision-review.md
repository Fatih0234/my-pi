---
description: Evaluate whether a proposed decision or implementation is worth doing
argument-hint: "[decision, feature, fix, refactor, design choice, or extra instructions...]"
---

We are considering a decision or implementation. Before doing any work, evaluate whether it actually makes sense for this project.

Use the current repo, existing code, docs, product behavior, tests, architecture, and prior context available to you. Do not implement anything yet unless explicitly asked. Your job is to investigate, reason, compare options, and give an objective decision memo.

Decision / proposal to evaluate:

$ARGUMENTS

## What to analyze

First, restate the decision in clear terms:
- What exactly are we considering doing?
- What problem, user need, bug, risk, or opportunity is it meant to address?
- Who is affected: end users, maintainers, developers, operators, future contributors, or only me?
- Is this a feature, bug fix, refactor, test hardening, UX change, architecture/design choice, cleanup, performance/security/reliability change, or something else?

Then inspect the relevant project context:
- Read the relevant files, docs, tests, existing patterns, and similar implementations.
- Identify current behavior and constraints.
- Note any assumptions you are making.
- Distinguish evidence from speculation.

## Options to compare

Do not evaluate only the proposed path. Compare realistic decision paths, including:

1. Do nothing / leave it as-is.
2. Minimal fix or smallest useful change.
3. The proposed implementation.
4. A more robust or long-term version.
5. A different approach, if one is clearly better.
6. Defer and gather more evidence, if the right decision is not yet knowable.

For each option, analyze:
- User value: what does the user gain or lose?
- UX impact: does it make the product simpler, clearer, faster, safer, more predictable, or more confusing?
- Product fit: does it support what this app/service is actually trying to do?
- Engineering cost: complexity, touched files, migration work, test burden, maintenance burden.
- Risk: bugs, regressions, security/privacy issues, data loss, performance issues, accessibility issues, operational risk.
- Reversibility: how easy is it to undo or change later?
- Opportunity cost: what are we not doing if we spend time on this?
- Consistency: does it match existing architecture, patterns, naming, UX, and test style?
- Long-term effect: will this simplify the codebase or create another special case?
- Cost of not doing it: what realistically breaks, degrades, or remains annoying if we skip it?

## Required output format

Return a decision memo with these sections:

### 1. Decision summary

A concise explanation of the decision being evaluated and the current recommendation.

Use one of these labels:
- Strong yes
- Lean yes
- Neutral / depends
- Lean no
- Strong no
- Defer / investigate first

Include a confidence level: High, Medium, or Low.

### 2. Context found

Summarize the relevant code, docs, tests, product behavior, and constraints you inspected.

Include file paths or concrete references when possible.

### 3. User and product impact

Explain who benefits, who may be harmed or confused, and whether this improves the actual user experience.

Be specific. Avoid generic claims like “better UX” unless you can explain why.

### 4. Options considered

Compare the realistic paths:
- Do nothing
- Minimal approach
- Proposed approach
- More robust approach
- Alternative approach, if relevant

For each option, include:
- What it means
- Pros
- Cons
- Risks
- Estimated implementation complexity: Low / Medium / High
- When this option would be the right choice

### 5. Tradeoff table

Create a compact table comparing the options across:
- User value
- UX clarity
- Engineering complexity
- Maintenance cost
- Risk
- Reversibility
- Test burden
- Long-term fit

### 6. Risks and edge cases

List the main risks, edge cases, regressions, security/privacy concerns, data concerns, accessibility concerns, performance concerns, and operational concerns.

If a category is not relevant, say so briefly.

### 7. What we miss if we do not do this

Explain the realistic downside of skipping this decision now.

Separate:
- Immediate downside
- Future downside
- User-visible downside
- Developer/maintenance downside

### 8. What we gain if we do this

Explain the realistic upside of implementing it.

Separate:
- User-facing gain
- Product gain
- Engineering gain
- Reliability/testing/maintainability gain

### 9. Recommendation

Give your best objective recommendation.

Include:
- Recommended path
- Why this path is better than the alternatives
- What should be explicitly out of scope
- The smallest safe first step
- What tests or validation would be needed
- What would make you change your recommendation

### 10. Implementation guardrails, if we proceed

If the recommendation is to proceed, provide guardrails:
- Keep scope limited to...
- Avoid changing...
- Preserve existing behavior for...
- Add or update tests for...
- Watch out for...
- Rollback plan or escape hatch, if relevant

## Important behavior rules

Do not be agreeable for the sake of agreement. Challenge the proposal if it is weak.

Do not reject the proposal just to appear critical. If it is worth doing, say so clearly.

Do not bias toward implementation. “Do nothing” or “defer” may be the right answer.

Do not give a shallow answer. Ground the analysis in the project context.

Do not invent certainty. If evidence is missing, say what is unknown and how important that uncertainty is.

Do not implement code in this step. This is a decision-review step only.

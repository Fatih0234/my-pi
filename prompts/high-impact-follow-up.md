---
description: Find one high-impact follow-up improvement
argument-hint: "[extra instructions...]"
---

Now that the current work is in place, use the available context to look for one follow-up improvement that would materially improve the result.

Use whatever context is available: the current task, conversation, files, code, workspace, project conventions, user goals, or surrounding implementation. Do not assume that Git, commits, diffs, tests, a repository, a specific framework, or any particular project structure exists. If some context or tool is unavailable, ignore it and work from what you can actually observe.

This is not a request for broad cleanup, speculative refactoring, or doing more work just because more work is possible. Only proceed if you find a clearly valuable opportunity that is supported by the current context and has a strong impact-to-risk ratio.

Look for improvements such as:
- an important edge case that is not handled
- a real correctness, reliability, or safety issue
- unnecessary complexity that can be removed
- a missing validation, fallback, or error path
- behavior that is inconsistent with the surrounding implementation
- a small usability, API, or developer-experience improvement
- a maintainability improvement that clearly reduces future risk
- documentation or comments only when they clarify something important and non-obvious

Avoid cosmetic-only changes, style churn, unnecessary renaming, broad reorganizations, new abstractions without clear benefit, or changes that expand the scope beyond the current goal.

If you find multiple possible improvements, choose the one with the best impact-to-risk ratio. If nothing is worth doing, say so clearly and stop.

Before making any change, briefly state:
1. the opportunity you found
2. why it matters
3. why it is appropriately scoped
4. what assumptions, if any, you are making

Then implement the improvement using the existing style and patterns visible in the available context.

Run any relevant checks that are available and appropriate. Do not assume a test command exists. If no relevant check is available, say what you would have run and why.

If the change exposes a real bug, fix it if it remains within scope. If a failure is unrelated, report it clearly and do not broaden the scope.

Summarize what changed, why it was worth doing, and any remaining uncertainty.

$ARGUMENTS

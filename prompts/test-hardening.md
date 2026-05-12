---
description: Add meaningful tests for the implemented change
argument-hint: "[extra instructions...]"
---

Now that the implementation is done, add meaningful tests for this change.

Use the same context from the implementation. Focus on the behavior that was added or fixed, important edge cases, and regressions that could realistically break. Prefer tests that would have failed before this change and pass now.

Do not write shallow tests that only assert mocks, implementation details, or snapshots unless that is already the established pattern. Follow the existing test style in this repo.

Run the relevant test command. If a test fails because it exposes a real bug, fix the bug and rerun the test. If a failure is unrelated, report it clearly and do not broaden the scope.

$ARGUMENTS

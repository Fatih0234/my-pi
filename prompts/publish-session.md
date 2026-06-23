---
description: Commit and push only the current session's intended changes
argument-hint: "[context, issue, branch, or files]"
---

Finish this session by publishing only the changes that belong to the work just completed.

Context from user:
$ARGUMENTS

First, read and follow the `commit` skill. Use the `github` skill only for GitHub-specific checks.

Rules:
- Inspect status, diffs, staged changes, branch, upstream, and remotes before acting.
- Do not use `git add .`, `git commit -a`, force push, or broad staging.
- Stage only files or hunks clearly related to this session.
- Leave unrelated, pre-existing, ambiguous, secret, local config, generated, or risky files uncommitted unless clearly required.
- If related and unrelated changes are mixed in one file, use patch staging.
- If you cannot confidently decide what belongs in the commit, stop and ask.
- Create focused Conventional Commits-style commits.
- Push only after commit succeeds, only the current branch, only to a clear GitHub upstream or a single clear GitHub remote.
- Do not force-push.
- If upstream/remote/branch is unclear, do not push; report the safe next step.

Report back:
- files committed
- files left uncommitted and why
- commit hash and message
- branch and push target
- whether push succeeded
- any ambiguity or risk

---
name: antigravity-research
description: Web-grounded research sidecar for Pi CodingAgent. Use only when Pi explicitly needs current web search, documentation lookup, release notes, GitHub issues, external examples, or source-backed investigation to solve a coding task or blocker. Not for generic model knowledge, local-only edits, or simple questions Pi can answer from the repo.
compatibility: Requires authenticated Google Antigravity CLI `agy` on PATH. Uses Gemini 3.5 Flash Low, Medium, or High selected with AGY_REASONING.
---

# Antigravity Web Research Sidecar for Pi CodingAgent

This skill lets Pi delegate **web-grounded research** to Google Antigravity CLI without adding a dedicated web-search provider to Pi.

The intended relationship is:

```text
Pi CodingAgent = primary delegator, planner, code editor, and verifier
Antigravity CLI = external web-research sidecar
```

## Core clarification

This skill is **not** for asking Antigravity to answer from its own model knowledge.

The main purpose is to make Antigravity use its web-capable agent harness to:

- search the web,
- read official documentation,
- inspect release notes / changelogs,
- look up GitHub issues or source repositories,
- compare current implementation patterns,
- synthesize a source-backed answer for Pi.

If Antigravity produces a report without external sources, Pi should treat that run as incomplete or invalid.

## Core principle

Antigravity searches the web and synthesizes. Pi decides. Pi edits. Pi verifies.

Do not let Antigravity directly take over the project repo. Antigravity should help Pi solve the current task or blocker using current external information.

## When Pi should use this skill

Use this skill only when one or more of these are true:

- The user explicitly asks Pi to use Antigravity for web search or research.
- Pi needs current docs, APIs, package behavior, release notes, GitHub issues, changelogs, standards, examples, or external implementation patterns.
- Pi is stuck because the local model cannot resolve a task and the missing information may exist on the web.
- Pi needs a source-backed comparison before choosing an implementation path.
- Pi needs to investigate an error message, dependency issue, framework behavior, or recently changed tool.

Do **not** use this skill for:

- generic brainstorming from model memory,
- simple local code edits,
- obvious refactors,
- formatting changes,
- local-only debugging where no external information is needed,
- private code review without a web-research need.

## Web-search requirement

Every Antigravity run through this skill must satisfy this contract:

1. Perform web/documentation/source research before writing the final report.
2. Prefer official documentation, source repositories, changelogs, release notes, GitHub issues, standards, or reputable technical sources.
3. Include the actual sources consulted with URLs.
4. Separate facts found from sources, recommendations, and uncertainty.
5. Say clearly if web search was unavailable, failed, or produced weak evidence.

Pi should reject or retry a report if:

- the `Sources` section is empty,
- the report does not say what was researched,
- the report appears to answer only from model memory,
- sources are irrelevant to the task,
- sources are too generic or low quality for an implementation decision.

## Best interface: Markdown task brief

Prefer giving Antigravity a Markdown task brief instead of a short shell argument.

A short terminal question is okay for quick lookups, but this skill is most useful when Pi writes a rich task file such as:

```text
.pi/antigravity-briefs/20260610-current-blocker.md
```

Then runs:

```bash
AGY_REASONING=high ~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh --file .pi/antigravity-briefs/20260610-current-blocker.md
```

The terminal command stays small, while the Markdown file contains the real problem context.

## Model / reasoning policy

Only use Gemini 3.5 Flash variants for this skill unless the user explicitly changes the policy.

Pi must choose the reasoning level based on the task.

| Reasoning level | Antigravity model name | Use when |
|---|---|---|
| `low` | `Gemini 3.5 Flash (Low)` | Quick web lookup, single-doc check, simple package/API clarification. |
| `medium` | `Gemini 3.5 Flash (Medium)` | Normal web research, library comparison, docs synthesis, error investigation with moderate ambiguity. |
| `high` | `Gemini 3.5 Flash (High)` | Default for stuck coding tasks, ambiguous blockers, conflicting sources, architectural implications, or implementation-affecting decisions. |

Recommended default:

```bash
AGY_REASONING=high
```

The helper script maps reasoning levels to exact Antigravity model names:

```text
low    -> Gemini 3.5 Flash (Low)
medium -> Gemini 3.5 Flash (Medium)
high   -> Gemini 3.5 Flash (High)
```

Before first serious use, verify available model names locally:

```bash
agy models
```

## Permission model

This skill uses Antigravity's unattended mode:

```bash
--dangerously-skip-permissions
```

That is intentional, because otherwise Pi may need repeated approvals for Antigravity's web/search/file actions.

Since that flag removes the interactive permission boundary, this skill moves the safety boundary outside Antigravity:

- Antigravity runs in a dedicated scratch workspace, not the project root.
- Pi passes only curated context, not the whole repo.
- Antigravity is asked to write only a Markdown report.
- Pi reads the report and decides what to do next.
- Pi performs any actual project edits itself.

Do not pass `--add-dir .` by default. Do not run Antigravity from the project root for this skill.

## Sensitive data rules

Never send secrets to Antigravity.

Do not include:

- `.env` files,
- API keys,
- SSH keys,
- tokens,
- production credentials,
- private customer data,
- proprietary code beyond the minimal snippets needed for the question,
- large unreviewed file dumps.

Pi should summarize local context and include only relevant snippets, stack traces, package versions, constraints, and file paths.

## Required setup

Create the skill folder:

```bash
mkdir -p ~/.pi/agent/skills/antigravity-research/scripts
```

Place this file at:

```text
~/.pi/agent/skills/antigravity-research/SKILL.md
```

Place the companion script at:

```text
~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh
```

Make the script executable:

```bash
chmod +x ~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh
```

Create and trust the dedicated Antigravity sidecar workspace once:

```bash
mkdir -p ~/.pi/antigravity-sidecar-workspace
cd ~/.pi/antigravity-sidecar-workspace
agy
```

When Antigravity asks whether you trust the folder, approve this dedicated sidecar folder. Then exit Antigravity.

## Usage patterns

### 1. Recommended: Markdown task file

Create a task brief:

```bash
mkdir -p .pi/antigravity-briefs
cat > .pi/antigravity-briefs/current-blocker.md <<'EOF'
# Antigravity Web Research Brief

## Task Pi is trying to solve
We are building a Pi CodingAgent skill that delegates web-enabled research to Antigravity CLI.

## Current blocker or uncertainty
We need to know whether the current skill really forces Antigravity to perform web search, rather than merely answering from model knowledge.

## What Pi needs from Antigravity
Use web search and documentation lookup to find the relevant Antigravity CLI and Pi skill behavior. Recommend how the skill prompt and script should be changed.

## Web research requirement
You must perform external web/documentation/source research. Do not answer only from model memory. Include sources and URLs.

## Local context
- Pi is the delegator.
- Antigravity is only a web research sidecar.
- Antigravity should write a report only.
- Do not edit the project repository.
- We are using Gemini 3.5 Flash reasoning levels.

## Things already tried
The current script works mechanically, but the user wants this skill only for web search scenarios.

## Constraints and safety boundaries
- No separate web-search provider.
- Avoid sending secrets.
- Do not edit the repo.
- Report must be source-backed.

## Desired output
A concise source-backed report that tells Pi exactly how to improve the skill.

## Source preferences
Prefer official documentation, source repos, changelogs, release notes, GitHub issues, and reputable technical sources.
EOF
```

Run the brief:

```bash
AGY_REASONING=high ~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh --file .pi/antigravity-briefs/current-blocker.md
```

### 2. Create a reusable web-research brief template

```bash
~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh --new current-blocker
```

This creates:

```text
.pi/antigravity-briefs/current-blocker.md
```

Pi can fill it, then run it with `--file`.

### 3. Piped Markdown

```bash
cat .pi/antigravity-briefs/current-blocker.md | AGY_REASONING=medium ~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh --stdin
```

### 4. Short one-line web question

Use this only for quick web lookups:

```bash
AGY_REASONING=low ~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh "Use web search to find the official docs for Vite env variables and summarize the key rules with source URLs."
```

## Markdown task brief format

Pi should write task briefs using this structure:

```markdown
# Antigravity Web Research Brief

## Task Pi is trying to solve
Describe the actual coding-agent task, not just the search query.

## Current blocker or uncertainty
Explain why Pi is stuck, confused, or unsure.

## What Pi needs from Antigravity
State the exact decision, research question, or synthesis needed.

## Web research requirement
State explicitly that Antigravity must perform web/documentation/source research and must include URLs.

## Local context
Include relevant file paths, snippets, errors, package versions, operating system details, framework versions, and constraints.

## Things already tried
List attempts Pi made and why they failed or were inconclusive.

## Constraints and safety boundaries
Say what Antigravity must not do. Include privacy and repo-edit boundaries.

## Desired output
Describe the report shape Pi needs.

## Source preferences
Prefer official docs, source repos, changelogs, release notes, GitHub issues, standards, or reputable technical sources.
```

## How Pi should decide what context to include

Include:

- The current user goal.
- The concrete implementation task.
- The immediate blocker.
- Relevant stack traces.
- Relevant package/framework versions.
- Small code snippets needed to understand the problem.
- Relevant file paths.
- What Pi already tried.
- The decision Pi needs to make after reading the report.
- Seed URLs or domains to check, if the user already provided them.

Avoid:

- Whole-repo dumps.
- Secret files.
- Large unrelated files.
- Private customer/user data.
- Long logs unless summarized and trimmed.

## Output contract

Antigravity must write a Markdown report to `report.md` with this structure:

```markdown
# Antigravity Web Research Report

## Bottom line

## Web searches performed
List search queries, documentation pages, repositories, or source locations investigated.

## Sources consulted
List URLs and one-line relevance notes.

## Key findings

## Recommended next move for Pi

## Implementation notes

## Risks and caveats

## Evidence gaps / uncertainty

## Confidence level
```

If web search fails or Antigravity cannot access the web, it must write a failure report instead of answering from memory.

After the script runs, Pi should read the generated report path printed by the script.

## Companion script

Save this as `scripts/agy-research.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(pwd)"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RUN_ID="$(date +"%Y%m%d-%H%M%S")"
ARTIFACT_ROOT="${PROJECT_DIR}/.pi/antigravity-runs"
ARTIFACT_DIR="${ARTIFACT_ROOT}/${RUN_ID}"
BRIEF_ROOT="${PROJECT_DIR}/.pi/antigravity-briefs"
mkdir -p "$ARTIFACT_DIR" "$BRIEF_ROOT"

AGY_BIN="${AGY_BIN:-agy}"
AGY_TIMEOUT="${AGY_TIMEOUT:-10m}"
AGY_REASONING="${AGY_REASONING:-high}"
AGY_WORKSPACE_ROOT="${AGY_WORKSPACE_ROOT:-$HOME/.pi/antigravity-sidecar-workspace}"
AGY_USE_SANDBOX="${AGY_USE_SANDBOX:-0}"

usage() {
  cat >&2 <<'USAGE'
Usage:
  agy-research.sh --file <task-brief.md>
  agy-research.sh --stdin < task-brief.md
  agy-research.sh --new <brief-name>
  agy-research.sh "short web research question"

Environment:
  AGY_REASONING=low|medium|high   Default: high
  AGY_TIMEOUT=10m                 Default: 10m
  AGY_WORKSPACE_ROOT=...          Default: ~/.pi/antigravity-sidecar-workspace
  AGY_USE_SANDBOX=0|1             Default: 0
USAGE
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

make_template() {
  local raw_name="${1:-antigravity-web-research}"
  local name
  name="$(slugify "$raw_name")"
  if [[ -z "$name" ]]; then
    name="antigravity-web-research"
  fi

  local out="${BRIEF_ROOT}/${name}.md"
  if [[ -e "$out" ]]; then
    echo "Refusing to overwrite existing brief: $out" >&2
    exit 1
  fi

  cat > "$out" <<'EOF'
# Antigravity Web Research Brief

## Task Pi is trying to solve


## Current blocker or uncertainty


## What Pi needs from Antigravity


## Web research requirement
- Use external web search, documentation lookup, source repositories, changelogs, release notes, GitHub issues, or standards.
- Do not answer only from model memory.
- Include URLs and one-line relevance notes for all important sources.
- If web search is unavailable or fails, say so clearly and do not pretend the answer is source-backed.

## Local context


## Things already tried


## Constraints and safety boundaries
- Pi is the delegator.
- Antigravity should perform web research and write a report only.
- Do not edit the project repository.
- Do not inspect or request secrets, credentials, tokens, or private environment files.

## Desired output
Write a concise Markdown report that helps Pi choose the next implementation step.

## Source preferences
Prefer official documentation, source repositories, changelogs, release notes, GitHub issues, standards, and reputable technical sources.
EOF

  echo "$out"
}

case "$AGY_REASONING" in
  low)
    AGY_MODEL="Gemini 3.5 Flash (Low)"
    ;;
  medium)
    AGY_MODEL="Gemini 3.5 Flash (Medium)"
    ;;
  high)
    AGY_MODEL="Gemini 3.5 Flash (High)"
    ;;
  *)
    echo "Unknown AGY_REASONING: $AGY_REASONING" >&2
    echo "Allowed values: low, medium, high" >&2
    exit 1
    ;;
esac

MODE="question"
QUESTION=""
TASK_FILE=""

if [[ $# -gt 0 ]]; then
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --new|--template|init)
      shift
      make_template "${1:-antigravity-web-research}"
      exit 0
      ;;
    --file|-f)
      MODE="file"
      shift
      TASK_FILE="${1:-}"
      ;;
    --stdin|-)
      MODE="stdin"
      ;;
    *)
      MODE="question"
      QUESTION="$*"
      ;;
  esac
else
  if [[ ! -t 0 ]]; then
    MODE="stdin"
  fi
fi

if [[ "$MODE" == "file" ]]; then
  if [[ -z "$TASK_FILE" ]]; then
    echo "Missing task file after --file" >&2
    usage
    exit 1
  fi
  if [[ ! -f "$TASK_FILE" ]]; then
    echo "Task file not found: $TASK_FILE" >&2
    exit 1
  fi
  if [[ -L "$TASK_FILE" ]]; then
    echo "Refusing symlink task file: $TASK_FILE" >&2
    exit 1
  fi
  QUESTION="$(cat "$TASK_FILE")"
elif [[ "$MODE" == "stdin" ]]; then
  QUESTION="$(cat)"
fi

if [[ -z "$QUESTION" ]]; then
  echo "No task brief or question provided." >&2
  usage
  exit 1
fi

if ! command -v "$AGY_BIN" >/dev/null 2>&1; then
  echo "Error: '$AGY_BIN' not found on PATH." >&2
  echo "Install and authenticate Google Antigravity CLI first." >&2
  exit 1
fi

mkdir -p "$AGY_WORKSPACE_ROOT/runs/$RUN_ID"

INPUT_FILE="$AGY_WORKSPACE_ROOT/runs/$RUN_ID/input.md"
REPORT_FILE="$AGY_WORKSPACE_ROOT/runs/$RUN_ID/report.md"
STDOUT_LOG="$AGY_WORKSPACE_ROOT/runs/$RUN_ID/stdout.log"
STDERR_LOG="$AGY_WORKSPACE_ROOT/runs/$RUN_ID/stderr.log"
ARTIFACT_REPORT="$ARTIFACT_DIR/report.md"
ARTIFACT_INPUT="$ARTIFACT_DIR/input.md"
ARTIFACT_META="$ARTIFACT_DIR/meta.txt"

SANDBOX_ARGS=()
if [[ "$AGY_USE_SANDBOX" == "1" ]]; then
  SANDBOX_ARGS=(--sandbox)
fi

cat > "$INPUT_FILE" <<EOF
You are Antigravity CLI being used as a WEB-RESEARCH sidecar for Pi CodingAgent.

You are not the primary coding agent. Pi is the delegator and will decide what to do with your output.

Your mission:
Help Pi make progress on the concrete task/problem below by performing web search, documentation lookup, source discovery, and careful source-backed synthesis.

This is not a request for your internal model knowledge. You must use external sources before answering.

Current project directory on the user's machine:
$PROJECT_DIR

Dedicated Antigravity scratch directory:
$AGY_WORKSPACE_ROOT/runs/$RUN_ID

Rules:
- Do not modify the actual project repository.
- Do not create, edit, delete, move, or rename files outside the dedicated Antigravity scratch directory.
- Do not inspect secrets, credentials, tokens, .env files, SSH keys, private keys, or production config.
- Do not ask for approval; this is a non-interactive research run.
- Use web search, documentation lookup, source repositories, changelogs, release notes, GitHub issues, standards, or reputable technical sources.
- Do not answer only from model memory.
- Include the URLs you used and a one-line relevance note for each important source.
- If web search or source access is unavailable, write a failure report and say that the run was not source-grounded.
- You may write exactly one final artifact: ./report.md
- Do not write implementation files.
- Do not run destructive commands.
- Prefer official docs, source repos, changelogs, release notes, GitHub issues, standards, and primary sources.
- Separate established facts, recommendations, and uncertainty.
- Your output should be useful to Pi as the delegator, not just a generic answer to the user.

Reasoning level selected by Pi:
$AGY_REASONING

Model selected by skill:
$AGY_MODEL

Task brief from Pi:

$QUESTION

Write your final answer to ./report.md in Markdown with this structure:

# Antigravity Web Research Report

## Bottom line

## Web searches performed
List search queries, documentation pages, repositories, or source locations investigated.

## Sources consulted
List URLs and one-line relevance notes. If empty, treat the run as failed.

## Key findings

## Recommended next move for Pi

## Implementation notes

## Risks and caveats

## Evidence gaps / uncertainty

## Confidence level

After writing ./report.md, print only:

DONE: report.md
EOF

cp "$INPUT_FILE" "$ARTIFACT_INPUT"
cat > "$ARTIFACT_META" <<EOF
run_id=$RUN_ID
project_dir=$PROJECT_DIR
agy_workspace=$AGY_WORKSPACE_ROOT/runs/$RUN_ID
agy_reasoning=$AGY_REASONING
agy_model=$AGY_MODEL
mode=$MODE
task_file=$TASK_FILE
purpose=web-research-only
EOF

(
  cd "$AGY_WORKSPACE_ROOT/runs/$RUN_ID"

  set +e
  if [[ ${#SANDBOX_ARGS[@]} -gt 0 ]]; then
    "$AGY_BIN" \
      "${SANDBOX_ARGS[@]}" \
      --model "$AGY_MODEL" \
      --dangerously-skip-permissions \
      --print-timeout "$AGY_TIMEOUT" \
      --print "$(cat "$INPUT_FILE")" \
      > "$STDOUT_LOG" 2> "$STDERR_LOG"
  else
    "$AGY_BIN" \
      --model "$AGY_MODEL" \
      --dangerously-skip-permissions \
      --print-timeout "$AGY_TIMEOUT" \
      --print "$(cat "$INPUT_FILE")" \
      > "$STDOUT_LOG" 2> "$STDERR_LOG"
  fi
  STATUS=$?
  set -e

  if [[ ! -s "$REPORT_FILE" ]]; then
    {
      echo "# Antigravity Web Research Failed Or Produced No Report"
      echo
      echo "Exit status: $STATUS"
      echo
      echo "Expected report file:"
      echo
      echo "\`$REPORT_FILE\`"
      echo
      echo "Stdout log:"
      echo
      echo "\`\`\`text"
      cat "$STDOUT_LOG" || true
      echo "\`\`\`"
      echo
      echo "Stderr log:"
      echo
      echo "\`\`\`text"
      cat "$STDERR_LOG" || true
      echo "\`\`\`"
    } > "$REPORT_FILE"
  fi

  cp "$REPORT_FILE" "$ARTIFACT_REPORT"
  exit "$STATUS"
)

printf '%s\n' "$ARTIFACT_REPORT"
```

## Pi post-run validation

After every run, Pi should read `report.md` and check:

- Does it contain `Web searches performed`?
- Does it contain `Sources consulted`?
- Are the sources relevant and current enough?
- Did Antigravity say web access failed?
- Does the recommendation actually help Pi choose the next implementation step?

If the report has no sources, Pi should say the Antigravity run did not satisfy the skill contract and either retry with a clearer web-research brief or continue without using the report.

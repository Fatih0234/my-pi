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
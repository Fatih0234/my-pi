#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v html2text >/dev/null 2>&1 && ! python3 -c 'import html2text' >/dev/null 2>&1; then
  cat >&2 <<'ERR'
html2text is not installed.
Install it with:
  python3 -m pip install html2text
ERR
  exit 127
fi

actual="$({ printf '<h1>Hello</h1><p><strong>World</strong></p>'; } | ./scripts/html2md -)"

case "$actual" in
  *"# Hello"*"**World**"*)
    echo "html-to-markdown skill smoke test passed"
    ;;
  *)
    echo "Unexpected conversion output:" >&2
    printf '%s\n' "$actual" >&2
    exit 1
    ;;
esac

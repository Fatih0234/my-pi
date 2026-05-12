#!/usr/bin/env python3
"""Validate generated agentify-repo navigation docs."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import List

PLACEHOLDER_RE = re.compile(r"(\{[A-Z0-9_ -]+\}|\{[a-z0-9_ -]+\}|\{\{[^}]+\}\})")
REQUIRED = ["INDEX.md", "MAP.md", "TASKS.md", "inventory.json"]
MAX_DOC_BYTES = 180_000


def fail(errors: List[str], msg: str) -> None:
    errors.append(msg)


def check_file(path: Path, errors: List[str]) -> None:
    if not path.exists():
        fail(errors, f"Missing required file: {path.name}")
        return
    text = path.read_text(encoding="utf-8", errors="replace")
    if len(text.encode("utf-8")) > MAX_DOC_BYTES:
        fail(errors, f"{path.name} exceeds size budget of {MAX_DOC_BYTES} bytes")
    bad = PLACEHOLDER_RE.findall(text)
    bad = [b for b in bad if b not in {"{name}"}]
    if bad:
        fail(errors, f"{path.name} contains unresolved placeholders: {', '.join(sorted(set(bad))[:10])}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate generated agent navigation layer.")
    parser.add_argument("agent_repo_dir", help=".agent/repos/<name> directory")
    parser.add_argument("--repo", default="", help="Vendored repo path to sanity-check")
    parser.add_argument("--agents-file", default="", help="Root AGENTS.md to check for registration")
    args = parser.parse_args()

    root = Path(args.agent_repo_dir)
    errors: List[str] = []
    if not root.is_dir():
        fail(errors, f"Not a directory: {root}")
    for name in REQUIRED:
        check_file(root / name, errors)

    inv_path = root / "inventory.json"
    inv = {}
    if inv_path.exists():
        try:
            inv = json.loads(inv_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            fail(errors, f"inventory.json is not valid JSON: {exc}")
    if inv:
        for key in ["name", "local_path", "indexed_at", "provenance", "commands"]:
            if key not in inv:
                fail(errors, f"inventory.json missing key: {key}")
        commit = (inv.get("provenance") or {}).get("pinned_commit", "")
        if commit and commit != "not available" and not re.match(r"^[0-9a-f]{40}$", commit):
            fail(errors, f"Pinned commit is not a 40-char SHA: {commit}")
        if not isinstance(inv.get("commands", []), list):
            fail(errors, "inventory.json commands must be a list")

    if args.repo and not Path(args.repo).is_dir():
        fail(errors, f"Vendored repo path does not exist: {args.repo}")

    if args.agents_file:
        ag = Path(args.agents_file)
        if not ag.exists():
            fail(errors, f"AGENTS.md registration requested but file does not exist: {ag}")
        elif inv and f".agent/repos/{inv.get('name')}/INDEX.md" not in ag.read_text(encoding="utf-8", errors="replace"):
            fail(errors, f"AGENTS.md does not reference .agent/repos/{inv.get('name')}/INDEX.md")

    if errors:
        print("Validation failed:", file=sys.stderr)
        for err in errors:
            print(f"- {err}", file=sys.stderr)
        return 1
    print("Validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

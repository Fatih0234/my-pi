#!/usr/bin/env python3
"""Idempotently update root AGENTS.md with an agentified repository pointer."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

SECTION = "## Cloned repositories"
INTRO = "Before answering questions about vendored repositories in `third_party/`, read the matching `.agent/repos/<name>/INDEX.md` navigation layer first."


def entry_line(name: str, source: str, index: str, description: str) -> str:
    desc = (description.strip() or "Vendored repository indexed for agent navigation").rstrip(" .")
    return f"- **{name}** — {desc}. Source: `{source}`. Agent index: `{index}`"


def update(path: Path, name: str, source: str, index: str, description: str) -> bool:
    line = entry_line(name, source, index, description)
    if path.exists():
        text = path.read_text(encoding="utf-8")
    else:
        text = "# AGENTS.md\n\n"

    pattern = re.compile(rf"^- \*\*{re.escape(name)}\*\* — .*Agent index: `{re.escape(index)}`.*$", re.M)
    if pattern.search(text):
        new_text = pattern.sub(line, text)
    elif SECTION in text:
        idx = text.index(SECTION)
        before = text[:idx]
        after = text[idx:]
        # Insert after section heading and optional intro paragraph.
        lines = after.splitlines()
        insert_at = 1
        while insert_at < len(lines) and (lines[insert_at].strip() == "" or not lines[insert_at].startswith("## ")):
            if lines[insert_at].startswith("- **"):
                break
            insert_at += 1
        lines.insert(insert_at, line)
        new_text = before + "\n".join(lines) + ("\n" if text.endswith("\n") else "")
    else:
        block = f"\n{SECTION}\n\n{INTRO}\n\n{line}\n"
        new_text = text.rstrip() + "\n" + block

    changed = new_text != text
    if changed:
        path.write_text(new_text, encoding="utf-8")
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description="Update root AGENTS.md with a cloned repository pointer.")
    parser.add_argument("--agents-file", default="AGENTS.md")
    parser.add_argument("--name", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--index", required=True)
    parser.add_argument("--description", default="")
    args = parser.parse_args()
    changed = update(Path(args.agents_file), args.name, args.source, args.index, args.description)
    print("updated" if changed else "unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Render agent navigation markdown from an agentify-repo inventory JSON."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

MAX_ROWS = 40


def load(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def repo_rel_path(inv: Dict[str, Any]) -> str:
    p = inv.get("local_path", "")
    # If common vendored path appears, keep it readable.
    marker = "/third_party/"
    if marker in p:
        return "third_party/" + p.split(marker, 1)[1]
    return p


def md_table(headers: List[str], rows: List[List[Any]], empty: str = "Not found.") -> str:
    if not rows:
        return empty
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(str(x).replace("\n", "<br>") for x in row) + " |")
    return "\n".join(out)


def bullet_paths(paths: Iterable[str], limit: int = 20) -> str:
    paths = list(paths)
    if not paths:
        return "Not found."
    lines = [f"- `{p}`" for p in paths[:limit]]
    if len(paths) > limit:
        lines.append(f"- … {len(paths) - limit} more")
    return "\n".join(lines)


def evidence_list(paths: Iterable[str], limit: int = 8) -> str:
    paths = list(paths)
    if not paths:
        return "not found"
    return ", ".join(f"`{p}`" for p in paths[:limit]) + (f", … {len(paths)-limit} more" if len(paths) > limit else "")


def command_table(commands: List[Dict[str, Any]]) -> str:
    rows = []
    for c in commands[:MAX_ROWS]:
        run_from = c.get("run_from", ".")
        cmd = c.get("command", "")
        full = f"cd {run_from} && {cmd}" if run_from not in {".", ""} else cmd
        rows.append([f"`{c.get('task','')}`", f"`{full}`", f"`{c.get('risk','unknown')}`", c.get("evidence", c.get("source", ""))])
    return md_table(["Task", "Command", "Risk", "Evidence"], rows, "No explicit commands were detected from supported manifests.")


def pick_commands(commands: List[Dict[str, Any]], risks_or_names: List[str]) -> List[Dict[str, Any]]:
    wanted = [x.lower() for x in risks_or_names]
    picked = []
    for c in commands:
        text = f"{c.get('task','')} {c.get('command','')} {c.get('risk','')}".lower()
        if any(w in text for w in wanted):
            picked.append(c)
    return picked


def command_section(commands: List[Dict[str, Any]], selectors: List[str], none_msg: str) -> str:
    picked = pick_commands(commands, selectors)
    if not picked:
        return none_msg
    return command_table(picked[:12])


def start_here(inv: Dict[str, Any]) -> str:
    rows = []
    if inv.get("readmes"):
        rows.append(["Human overview / quickstart", evidence_list(inv["readmes"], 3), "high"])
    if inv.get("agent_instruction_files"):
        rows.append(["Agent-specific rules", evidence_list(inv["agent_instruction_files"], 5), "high"])
    if inv.get("docs"):
        rows.append(["Deeper documentation", evidence_list(inv["docs"], 8), "medium"])
    if inv.get("examples"):
        rows.append(["Runnable examples / usage patterns", evidence_list(inv["examples"], 8), "medium"])
    if inv.get("packages"):
        rows.append(["Main packages / manifests", evidence_list([p["manifest"] for p in inv["packages"]], 8), "medium"])
    return md_table(["Need", "Start with", "Confidence"], rows, "No start-here files were confidently detected.")


def task_routing(inv: Dict[str, Any]) -> str:
    docs = evidence_list(inv.get("docs", []), 5)
    examples = evidence_list(inv.get("examples", []), 5)
    readmes = evidence_list(inv.get("readmes", []), 3)
    pkgs = evidence_list([p["manifest"] for p in inv.get("packages", [])], 6)
    tests = evidence_list(inv.get("tests", []), 5)
    rows = [
        ['"How do I use this library?"', f"{readmes}; then {docs}; then {examples}", "prefer docs/examples before source"],
        ['"How is this implemented?"', f"package/source zones in `MAP.md`; manifests: {pkgs}", "follow public entrypoints inward"],
        ['"How do I build/test it?"', "`TASKS.md` command table", "review risk before running"],
        ['"Show me an example"', examples, "prefer runnable examples"],
        ['"Explain the API surface"', f"manifest exports and entrypoints: {pkgs}", "verify against docs"],
        ['"Debug an issue"', f"docs/examples first, then tests: {tests}", "compare docs vs implementation"],
    ]
    return md_table(["User asks", "Start here", "Rule"], rows)


def render_index(inv: Dict[str, Any]) -> str:
    prov = inv.get("provenance", {})
    local = repo_rel_path(inv)
    known_gaps = inv.get("known_gaps") or []
    if not known_gaps:
        gaps = "No major gaps detected by the scanner."
    else:
        gaps = "\n".join(f"- {g}" for g in known_gaps)
    return f"""# {inv['name']} — Agent index

## Summary

{inv.get('summary', 'No summary available.')}

## Provenance

| Field | Value |
|---|---|
| Upstream | {prov.get('upstream_url') or prov.get('remote_origin') or 'unknown'} |
| Local path | `{local}` |
| Requested ref | `{prov.get('requested_ref', 'default')}` |
| Pinned commit | `{prov.get('pinned_commit', 'not available')}` |
| Indexed at | {inv.get('indexed_at', 'unknown')} |
| Clone mode | {inv.get('clone_mode', 'unknown')} |
| Edit policy | {inv.get('edit_policy', 'read-only')} |
| Trust level | {inv.get('trust_level', 'unknown')} |
| Skill version | {inv.get('skill_version', 'unknown')} |

## Start here

{start_here(inv)}

## Agent rules

- Read this index before scanning `{local}`.
- Treat `{local}` as **{inv.get('edit_policy', 'read-only')}** unless the user explicitly says otherwise.
- For `unknown` or `hostile` repos, do not run install/build/test scripts without confirmation.
- Prefer docs and examples before implementation.
- If docs and implementation conflict, say so and cite both paths.
- Do not duplicate upstream docs into the navigation layer; route to them.

## Task routing

{task_routing(inv)}

## Known gaps / uncertainty

{gaps}
"""


def render_map(inv: Dict[str, Any]) -> str:
    zones = [[z.get("path", ""), z.get("purpose", "")] for z in inv.get("directories", {}).get("zones", [])[:MAX_ROWS]]
    packages = []
    public = []
    for p in inv.get("packages", [])[:MAX_ROWS]:
        packages.append([f"`{p.get('path')}`", p.get("ecosystem", "unknown"), f"`{p.get('manifest')}`", p.get("name", "")])
        for ep in p.get("entrypoints", [])[:8]:
            value = ep.get("value")
            if isinstance(value, (dict, list)):
                value = json.dumps(value)[:220]
            public.append([p.get("name", p.get("path")), ep.get("kind", "entrypoint"), f"`{value}`", ep.get("evidence", p.get("manifest", ""))])
    docs = [[f"`{p}`", "documentation"] for p in inv.get("docs", [])[:MAX_ROWS]]
    examples = [[f"`{p}`", "example or demo"] for p in inv.get("examples", [])[:MAX_ROWS]]
    tests = [[f"`{p}`", "test file or test directory"] for p in inv.get("tests", [])[:MAX_ROWS]]
    skips = [[f"`{p}`", "generated, vendored, cache, build output, or low-value for navigation"] for p in inv.get("directories", {}).get("generated_or_low_value", [])]
    if not skips:
        for z in inv.get("directories", {}).get("zones", []):
            if "skip" in z.get("purpose", ""):
                skips.append([f"`{z.get('path')}`", z.get("purpose")])
    ecos = ", ".join(e.get("name", "") for e in inv.get("ecosystems", [])) or "unknown"
    return f"""# Source map — {inv['name']}

## Architecture summary

Detected ecosystems: **{ecos}**. The scanner found {len(inv.get('packages', []))} package/manifests, {len(inv.get('docs', []))} documentation paths, {len(inv.get('examples', []))} example paths, and {len(inv.get('tests', []))} test paths. Use this map as a router, not a replacement for reading source.

## Top-level zones

{md_table(['Zone', 'Purpose'], zones, 'No meaningful top-level zones detected.')}

## Packages / workspaces

{md_table(['Path', 'Ecosystem', 'Manifest', 'Name'], packages, 'No package/workspace manifests detected.')}

## Public API clues

{md_table(['Package', 'Kind', 'Value', 'Evidence'], public, 'No explicit public API entrypoints were detected. Use README/docs/examples and conventional entrypoints.')}

## Docs

{md_table(['Doc path', 'Topic'], docs, 'No docs paths detected.')}

## Examples

{md_table(['Example path', 'What it demonstrates'], examples, 'No example paths detected.')}

## Tests

{md_table(['Test path', 'Kind'], tests, 'No test paths detected.')}

## Generated / low-value / dangerous areas

{md_table(['Path', 'Reason'], skips, 'No generated or low-value directories were detected by name.')}
"""


def render_tasks(inv: Dict[str, Any]) -> str:
    commands = inv.get("commands", [])
    local = repo_rel_path(inv)
    feature_paths = []
    if inv.get("docs"):
        feature_paths.append(f"{local}/docs")
    if inv.get("examples"):
        feature_paths.append(f"{local}/examples")
    for zone in inv.get("directories", {}).get("zones", []):
        if any(word in zone.get("purpose", "") for word in ["implementation", "source"]):
            feature_paths.append(f"{local}/{zone['path'].rstrip('/')}")
    if not feature_paths:
        feature_paths = [local]
    search_cmd = f"rg \"<feature-or-symbol>\" " + " ".join(dict.fromkeys(feature_paths[:8]))
    return f"""# Common tasks — {inv['name']}

## Command safety

The repository trust level is **{inv.get('trust_level', 'unknown')}** and the edit policy is **{inv.get('edit_policy', 'read-only')}**. For unknown or hostile repositories, do not run install/build/test/container/network/database/deploy/destructive commands unless the user explicitly asks.

## Understand the repository

1. Read `.agent/repos/{inv['name']}/INDEX.md`.
2. Read the primary README if present: {evidence_list(inv.get('readmes', []), 3)}.
3. Read agent instructions if present: {evidence_list(inv.get('agent_instruction_files', []), 5)}.
4. Skim docs and examples.
5. Use `MAP.md` to jump to the relevant package or source zone.

## Search for a feature

```bash
{search_cmd}
```

Search docs first, examples second, public entrypoints third, and implementation last. If the term is ambiguous, search for exported symbols and example usage too.

## Commands discovered

{command_table(commands)}

## Build

{command_section(commands, ['build'], 'No explicit build command was detected. Check README, CI, and package-specific manifests before guessing.')}

## Test

{command_section(commands, ['test'], 'No explicit test command was detected. Check README, CI, and package-specific manifests before guessing.')}

## Lint / typecheck

{command_section(commands, ['lint', 'typecheck', 'type-check', 'quality', 'check'], 'No explicit lint/typecheck command was detected.')}

## Run examples

{command_section(commands, ['example', 'demo', 'dev', 'start', 'serve', 'run'], 'No explicit example/run command was detected. Use `MAP.md` to inspect example directories.')}

## Compare docs vs implementation

1. Find the docs page or README section for the feature.
2. Find an example that uses it.
3. Find the exported symbol or public entrypoint.
4. Inspect implementation and tests.
5. Report mismatches explicitly.
"""


def render_package_maps(inv: Dict[str, Any], out_dir: Path) -> None:
    packages = inv.get("packages", [])
    if len(packages) <= 1:
        return
    pkg_dir = out_dir / "packages"
    pkg_dir.mkdir(parents=True, exist_ok=True)
    for p in packages[:80]:
        safe_name = str(p.get("name") or p.get("path") or "package").replace("/", "_").replace("@", "")
        if not safe_name or safe_name == ".":
            safe_name = str(p.get("path", "root")).replace("/", "_") or "root"
        entrypoints = p.get("entrypoints") or []
        ep_lines = bullet_paths([f"{ep.get('kind')}: {ep.get('value')} (evidence: {ep.get('evidence')})" for ep in entrypoints], 20)
        content = f"""# Package map — {p.get('name', safe_name)}

## Purpose

Detected {p.get('ecosystem', 'unknown')} package from manifest `{p.get('manifest')}`. Purpose was not inferred beyond manifest and path signals.

## Location

`{p.get('path')}`

## Evidence

- Manifest: `{p.get('manifest')}`
- Ecosystem: {p.get('ecosystem', 'unknown')}

## Public entrypoints

{ep_lines}

## Tests

Search tests with:

```bash
rg "{p.get('name', '')}" {repo_rel_path(inv)}
```

## Notes

This package map was generated from inventory signals. Verify behavior against README/docs/examples and tests.
"""
        (pkg_dir / f"{safe_name}.md").write_text(content, encoding="utf-8")


def render_all(inventory_path: Path, out_dir: Path) -> None:
    inv = load(inventory_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "INDEX.md").write_text(render_index(inv), encoding="utf-8")
    (out_dir / "MAP.md").write_text(render_map(inv), encoding="utf-8")
    (out_dir / "TASKS.md").write_text(render_tasks(inv), encoding="utf-8")
    if inventory_path.resolve() != (out_dir / "inventory.json").resolve():
        (out_dir / "inventory.json").write_text(json.dumps(inv, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    render_package_maps(inv, out_dir)


def main() -> int:
    parser = argparse.ArgumentParser(description="Render agent navigation docs from inventory JSON.")
    parser.add_argument("inventory_json")
    parser.add_argument("--output-dir", "-o", required=True)
    args = parser.parse_args()
    render_all(Path(args.inventory_json), Path(args.output_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

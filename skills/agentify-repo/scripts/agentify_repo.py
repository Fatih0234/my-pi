#!/usr/bin/env python3
"""Main orchestrator for the agentify-repo skill."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent


def run(cmd: List[str], cwd: Optional[Path] = None, check: bool = True) -> Tuple[int, str, str]:
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None, text=True, capture_output=True, check=False)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}")
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def infer_name(url: str, local_repo: str = "") -> str:
    if local_repo:
        return Path(local_repo).resolve().name
    cleaned = url.rstrip("/")
    cleaned = cleaned[:-4] if cleaned.endswith(".git") else cleaned
    return cleaned.split("/")[-1] or "repo"


def clone_repo(url: str, dest: Path, ref: str = "", submodule: bool = False, force: bool = False) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        if force:
            shutil.rmtree(dest)
        else:
            return "existing"
    if submodule:
        cmd = ["git", "submodule", "add"]
        if ref:
            cmd += ["-b", ref]
        cmd += [url, str(dest)]
        run(cmd)
        return "submodule"
    cmd = ["git", "clone", "--depth=1"]
    if ref:
        cmd += ["--branch", ref]
    cmd += [url, str(dest)]
    run(cmd)
    return "shallow-clone"


def one_line_description(inventory_json: Path) -> str:
    try:
        inv = json.loads(inventory_json.read_text(encoding="utf-8"))
    except Exception:
        return "Vendored repository indexed for agent navigation"
    summary = inv.get("summary", "").strip()
    summary = re.sub(r"\s+", " ", summary)
    if not summary:
        return "Vendored repository indexed for agent navigation"
    summary = re.sub(r"\s*\(from `[^`]+`; confidence: [^)]+\)\.??$", "", summary)
    return summary[:180]


def main() -> int:
    parser = argparse.ArgumentParser(description="Clone/index a repository and generate an agent-friendly navigation layer.")
    parser.add_argument("repo_url", nargs="?", help="GitHub repository URL")
    parser.add_argument("--local-repo", default="", help="Index an existing local repository instead of cloning")
    parser.add_argument("--name", default="", help="Local/index name; inferred by default")
    parser.add_argument("--ref", default="", help="Branch, tag, or sha to clone/index")
    parser.add_argument("--dest-root", default="third_party", help="Where cloned repos are stored")
    parser.add_argument("--agent-root", default=".agent/repos", help="Where navigation layer is stored")
    parser.add_argument("--edit-policy", default="read-only")
    parser.add_argument("--trust-level", choices=["trusted", "unknown", "hostile"], default="unknown")
    parser.add_argument("--submodule", action="store_true", help="Use git submodule add instead of git clone")
    parser.add_argument("--force", action="store_true", help="Remove and reclone destination if it exists")
    parser.add_argument("--no-agents-update", action="store_true", help="Do not update root AGENTS.md")
    parser.add_argument("--inventory-only", action="store_true", help="Only create inventory.json")
    args = parser.parse_args()

    if not args.repo_url and not args.local_repo:
        parser.error("provide a repo_url or --local-repo")

    name = args.name or infer_name(args.repo_url or "", args.local_repo)
    repo_path = Path(args.local_repo).resolve() if args.local_repo else Path(args.dest_root) / name
    agent_dir = Path(args.agent_root) / name
    agent_dir.mkdir(parents=True, exist_ok=True)

    if args.local_repo:
        if not repo_path.is_dir():
            raise SystemExit(f"ERROR: local repo does not exist: {repo_path}")
        clone_mode = "existing-local"
    else:
        clone_mode = clone_repo(args.repo_url, repo_path, ref=args.ref, submodule=args.submodule, force=args.force)

    inventory_path = agent_dir / "inventory.json"
    inv_cmd = [
        sys.executable, str(SCRIPT_DIR / "inventory_repo.py"), str(repo_path),
        "--name", name,
        "--url", args.repo_url or "",
        "--requested-ref", args.ref,
        "--edit-policy", args.edit_policy,
        "--trust-level", args.trust_level,
        "--clone-mode", clone_mode,
        "--output", str(inventory_path),
    ]
    run(inv_cmd)

    if not args.inventory_only:
        run([sys.executable, str(SCRIPT_DIR / "render_docs.py"), str(inventory_path), "--output-dir", str(agent_dir)])

    if not args.no_agents_update:
        desc = one_line_description(inventory_path)
        run([
            sys.executable, str(SCRIPT_DIR / "update_agents_md.py"),
            "--name", name,
            "--source", str(Path(args.dest_root) / name if not args.local_repo else repo_path),
            "--index", str(agent_dir / "INDEX.md"),
            "--description", desc,
        ])

    if not args.inventory_only:
        validate_cmd = [sys.executable, str(SCRIPT_DIR / "validate_output.py"), str(agent_dir), "--repo", str(repo_path)]
        if not args.no_agents_update:
            validate_cmd += ["--agents-file", "AGENTS.md"]
        run(validate_cmd)

    print(f"Agentified repo: {name}")
    print(f"Source: {repo_path}")
    print(f"Navigation: {agent_dir}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)

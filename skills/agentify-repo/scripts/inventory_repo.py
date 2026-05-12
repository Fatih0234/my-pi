#!/usr/bin/env python3
"""Structured repository inventory for agentify-repo.

The scanner is intentionally read-only. It avoids importing repository code and
uses filesystem/git/manifest parsing only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

SKILL_VERSION = "1.0.0"
MAX_LIST_ITEMS = 80
MAX_TRACKED_FILES = 25000

SKIP_DIR_NAMES = {
    ".git", "node_modules", "dist", "build", ".next", ".nuxt", "out", "output",
    "coverage", ".cache", "vendor", "target", ".venv", "venv", "__pycache__",
    ".pytest_cache", ".mypy_cache", ".turbo", ".parcel-cache", "compiled", "tmp",
}

GENERATED_DIR_NAMES = {
    "dist", "build", ".next", ".nuxt", "out", "output", "coverage", ".cache",
    "node_modules", "vendor", "target", "compiled", "generated", "gen", "__generated__",
}

DOC_NAMES = {"docs", "doc", "documentation", "guides", "guide", "wiki", "book", "manual"}
EXAMPLE_NAMES = {"examples", "example", "demo", "demos", "samples", "sample", "playground"}
TEST_NAMES = {"tests", "test", "__tests__", "spec", "specs", "e2e", "integration"}
AGENT_FILES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".cursor/rules", ".github/copilot-instructions.md"]
README_RE = re.compile(r"^readme(\..*)?$", re.I)
LICENSE_RE = re.compile(r"^(license|licence|copying)(\..*)?$", re.I)

MANIFEST_PATTERNS = {
    "Node/JavaScript/TypeScript": ["package.json", "pnpm-workspace.yaml", "tsconfig.json", "yarn.lock", "package-lock.json", "bun.lockb"],
    "Python": ["pyproject.toml", "requirements.txt", "setup.py", "setup.cfg", "Pipfile", "uv.lock", "poetry.lock"],
    "Rust": ["Cargo.toml", "Cargo.lock"],
    "Go": ["go.mod", "go.sum"],
    "Java/Kotlin": ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts", "gradlew"],
    ".NET": ["*.csproj", "*.sln", "Directory.Build.props"],
    "Ruby": ["Gemfile", "*.gemspec", "Rakefile"],
    "PHP": ["composer.json", "composer.lock"],
    "Swift": ["Package.swift", "*.xcodeproj", "*.xcworkspace"],
    "C/C++": ["CMakeLists.txt", "Makefile", "meson.build", "configure.ac"],
    "Infra/Containers": ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "*.tf", "Chart.yaml", "helmfile.yaml"],
    "Nix": ["flake.nix", "shell.nix", "default.nix"],
    "Bazel": ["WORKSPACE", "MODULE.bazel", "BUILD", "BUILD.bazel"],
}

COMMAND_RISK_KEYWORDS = [
    ("deploy", "deploy"), ("publish", "deploy"), ("release", "deploy"), ("upload", "deploy"),
    ("terraform apply", "deploy"), ("kubectl", "deploy"), ("helm", "deploy"),
    ("migrate", "database"), ("migration", "database"), ("seed", "database"), ("db:reset", "database"),
    ("docker", "container"), ("compose", "container"),
    ("curl ", "network"), ("wget ", "network"),
    ("rm -rf", "destructive"), ("git clean", "destructive"), ("reset --hard", "destructive"),
]


def run(cmd: List[str], cwd: Optional[Path] = None) -> Tuple[int, str, str]:
    try:
        proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None, text=True, capture_output=True, check=False, timeout=20)
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except Exception as exc:  # noqa: BLE001
        return 1, "", str(exc)


def rel(path: Path, root: Path) -> str:
    try:
        s = path.relative_to(root).as_posix()
        return s or "."
    except ValueError:
        return path.as_posix()


def safe_walk(root: Path, max_depth: int = 4) -> Iterable[Path]:
    root = root.resolve()
    for current, dirs, files in os.walk(root):
        cur = Path(current)
        depth = len(cur.relative_to(root).parts)
        dirs[:] = [d for d in dirs if d not in SKIP_DIR_NAMES and not d.startswith(".")]
        if depth > max_depth:
            dirs[:] = []
            continue
        for name in files:
            yield cur / name


def top_level(root: Path) -> Dict[str, List[str]]:
    files, dirs = [], []
    for item in sorted(root.iterdir(), key=lambda p: p.name.lower()):
        if item.name in SKIP_DIR_NAMES:
            continue
        if item.is_dir():
            dirs.append(item.name + "/")
        else:
            files.append(item.name)
    return {"files": files[:MAX_LIST_ITEMS], "directories": dirs[:MAX_LIST_ITEMS]}


def git_metadata(root: Path, url: str = "", requested_ref: str = "") -> Dict[str, Any]:
    meta: Dict[str, Any] = {"upstream_url": url or "unknown", "requested_ref": requested_ref or "default", "is_git_repo": False}
    code, out, _ = run(["git", "rev-parse", "--is-inside-work-tree"], root)
    if code != 0 or out.strip() != "true":
        return meta
    meta["is_git_repo"] = True
    for key, cmd in {
        "pinned_commit": ["git", "rev-parse", "HEAD"],
        "default_branch_guess": ["git", "branch", "--show-current"],
        "remote_origin": ["git", "remote", "get-url", "origin"],
    }.items():
        code, out, _ = run(cmd, root)
        if code == 0 and out:
            meta[key] = out.splitlines()[0]
    code, out, _ = run(["git", "rev-parse", "--is-shallow-repository"], root)
    if code == 0:
        meta["is_shallow"] = out.strip()
    code, out, _ = run(["git", "submodule", "status", "--recursive"], root)
    meta["submodules_detected"] = bool(out.strip())
    return meta


def tracked_files(root: Path) -> List[str]:
    code, out, _ = run(["git", "ls-files"], root)
    if code == 0 and out:
        return out.splitlines()[:MAX_TRACKED_FILES]
    paths = []
    for path in safe_walk(root, max_depth=6):
        if len(paths) >= MAX_TRACKED_FILES:
            break
        paths.append(rel(path, root))
    return paths


def find_by_name(files: List[str], predicate) -> List[str]:
    return [f for f in files if predicate(Path(f).name, f)]


def detect_ecosystems(root: Path, files: List[str]) -> List[Dict[str, Any]]:
    result = []
    by_name = defaultdict(list)
    for f in files:
        by_name[Path(f).name].append(f)
    for ecosystem, patterns in MANIFEST_PATTERNS.items():
        signals = []
        for pattern in patterns:
            if "*" in pattern:
                regex = re.compile("^" + re.escape(pattern).replace("\\*", ".*") + "$")
                signals.extend([f for f in files if regex.match(Path(f).name)])
            else:
                signals.extend(by_name.get(pattern, []))
        if signals:
            result.append({"name": ecosystem, "signals": sorted(set(signals))[:30], "confidence": "high" if len(signals) > 1 else "medium"})
    return result


def classify_command(name: str, command: str, source: str) -> str:
    text = f"{name} {command}".lower()
    for needle, risk in COMMAND_RISK_KEYWORDS:
        if needle in text:
            return risk
    if any(k in text for k in ["install", "bootstrap", "setup"]):
        return "install"
    if any(k in text for k in ["build", "compile", "bundle"]):
        return "build"
    if any(k in text for k in ["test", "pytest", "vitest", "jest", "cargo test", "go test"]):
        return "test"
    if any(k in text for k in ["lint", "typecheck", "type-check", "check", "fmt", "format"]):
        return "quality"
    if any(k in text for k in ["dev", "serve", "start"]):
        return "run"
    return "unknown"


def load_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def extract_commands(root: Path, files: List[str]) -> List[Dict[str, str]]:
    commands: List[Dict[str, str]] = []
    for f in files:
        p = root / f
        name = Path(f).name
        if name == "package.json":
            data = load_json(p)
            if isinstance(data, dict):
                for script_name, cmd in sorted((data.get("scripts") or {}).items()):
                    if isinstance(cmd, str):
                        commands.append({
                            "task": script_name,
                            "command": cmd,
                            "run_from": str(Path(f).parent) if str(Path(f).parent) != "." else ".",
                            "source": f,
                            "risk": classify_command(script_name, cmd, f),
                            "evidence": f"{f}: scripts.{script_name}",
                        })
        elif name in {"Makefile", "makefile"}:
            try:
                text = p.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            for line in text.splitlines()[:400]:
                m = re.match(r"^([A-Za-z0-9_.-]+):(?:\s|$)", line)
                if m and not m.group(1).startswith("."):
                    target = m.group(1)
                    cmd = f"make {target}"
                    commands.append({"task": target, "command": cmd, "run_from": str(Path(f).parent), "source": f, "risk": classify_command(target, cmd, f), "evidence": f"{f}: make target {target}"})
        elif name in {"Justfile", "justfile"}:
            try:
                text = p.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            for line in text.splitlines()[:400]:
                m = re.match(r"^([A-Za-z0-9_.-]+):(?:\s|$)", line)
                if m:
                    target = m.group(1)
                    cmd = f"just {target}"
                    commands.append({"task": target, "command": cmd, "run_from": str(Path(f).parent), "source": f, "risk": classify_command(target, cmd, f), "evidence": f"{f}: just recipe {target}"})
    # de-duplicate
    seen = set()
    unique = []
    for c in commands:
        key = (c["run_from"], c["task"], c["command"])
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique[:200]


def detect_packages(root: Path, files: List[str]) -> List[Dict[str, Any]]:
    package_files = [f for f in files if Path(f).name in {"package.json", "pyproject.toml", "Cargo.toml", "go.mod", "composer.json"} or Path(f).name.endswith(".csproj")]
    packages = []
    for f in package_files:
        parent = Path(f).parent.as_posix()
        if parent == ".":
            parent = "."
        pkg = {"path": parent, "manifest": f, "name": Path(parent).name if parent != "." else root.name, "ecosystem": "unknown", "entrypoints": []}
        n = Path(f).name
        if n == "package.json":
            pkg["ecosystem"] = "Node/JavaScript/TypeScript"
            data = load_json(root / f)
            if isinstance(data, dict):
                pkg["name"] = data.get("name") or pkg["name"]
                for key in ["main", "module", "types", "bin"]:
                    if key in data:
                        pkg["entrypoints"].append({"kind": key, "value": data[key], "evidence": f})
                exports = data.get("exports")
                if exports:
                    pkg["entrypoints"].append({"kind": "exports", "value": exports, "evidence": f})
        elif n == "pyproject.toml":
            pkg["ecosystem"] = "Python"
        elif n == "Cargo.toml":
            pkg["ecosystem"] = "Rust"
        elif n == "go.mod":
            pkg["ecosystem"] = "Go"
        elif n == "composer.json":
            pkg["ecosystem"] = "PHP"
        elif n.endswith(".csproj"):
            pkg["ecosystem"] = ".NET"
        packages.append(pkg)
    return packages[:200]


def summarize_readme(root: Path, readmes: List[str]) -> str:
    if not readmes:
        return "No README was found. Summary confidence: low."
    p = root / readmes[0]
    try:
        text = p.read_text(encoding="utf-8", errors="replace")[:5000]
    except Exception:
        return f"README found at `{readmes[0]}`, but it could not be read. Summary confidence: low."
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    title = ""
    for ln in lines:
        if ln.startswith("#"):
            title = ln.lstrip("#").strip()
            break
    desc = ""
    for ln in lines:
        if ln.startswith("#") or ln.startswith("!") or ln.startswith("[") or len(ln) < 20:
            continue
        desc = re.sub(r"\s+", " ", ln).strip()
        break
    if title and desc:
        return f"{title}: {desc} (from `{readmes[0]}`; confidence: medium)."
    if title:
        return f"{title}. README exists at `{readmes[0]}`; summary confidence: low."
    return f"README exists at `{readmes[0]}` but no concise description was detected; summary confidence: low."


def directory_zones(root: Path, files: List[str]) -> List[Dict[str, str]]:
    top_dirs = sorted({Path(f).parts[0] for f in files if len(Path(f).parts) > 1})
    zones = []
    for d in top_dirs[:80]:
        purpose = "source or project area"
        dl = d.lower()
        if dl in DOC_NAMES or "doc" in dl:
            purpose = "documentation"
        elif dl in EXAMPLE_NAMES or "example" in dl or "demo" in dl:
            purpose = "examples / demos"
        elif dl in TEST_NAMES or "test" in dl or "spec" in dl:
            purpose = "tests"
        elif dl in GENERATED_DIR_NAMES:
            purpose = "generated or low-value area; usually skip"
        elif dl in {"src", "lib", "packages", "crates", "apps", "services", "cmd", "internal"}:
            purpose = "likely implementation/source zone"
        elif dl in {".github", ".gitlab", ".circleci"}:
            purpose = "CI / automation configuration"
        zones.append({"path": d + "/", "purpose": purpose})
    return zones


def largest_files(root: Path, files: List[str]) -> List[Dict[str, Any]]:
    rows = []
    for f in files[:MAX_TRACKED_FILES]:
        p = root / f
        try:
            size = p.stat().st_size
        except Exception:
            continue
        rows.append({"path": f, "bytes": size})
    return sorted(rows, key=lambda r: r["bytes"], reverse=True)[:20]


def inventory(root: Path, name: str = "", url: str = "", requested_ref: str = "", edit_policy: str = "read-only", trust_level: str = "unknown", clone_mode: str = "existing") -> Dict[str, Any]:
    root = root.resolve()
    files = tracked_files(root)
    top = top_level(root)
    readmes = sorted(find_by_name(files, lambda n, f: bool(README_RE.match(n))), key=lambda x: (x.count("/"), x.lower()))[:30]
    licenses = sorted(find_by_name(files, lambda n, f: bool(LICENSE_RE.match(n))), key=lambda x: (x.count("/"), x.lower()))[:10]
    agent_files = [f for f in files if f in AGENT_FILES or f.endswith("/AGENTS.md") or f.endswith("/CLAUDE.md")]
    docs = [f for f in files if any(part.lower() in DOC_NAMES for part in Path(f).parts[:-1]) or Path(f).name.lower() in {"mkdocs.yml", "docusaurus.config.js", "vitepress.config.ts"}][:100]
    examples = [f for f in files if any(part.lower() in EXAMPLE_NAMES for part in Path(f).parts[:-1])][:100]
    tests = [f for f in files if any(part.lower() in TEST_NAMES for part in Path(f).parts[:-1]) or re.search(r"(test|spec)\.(js|ts|py|go|rs|java|kt)$", f, re.I)][:100]
    ci = [f for f in files if f.startswith(".github/workflows/") or f in {".gitlab-ci.yml", ".circleci/config.yml", "Jenkinsfile", "azure-pipelines.yml"}]
    generated = sorted({p.parts[0] + "/" for f in files for p in [Path(f)] if p.parts and p.parts[0] in GENERATED_DIR_NAMES})
    packages = detect_packages(root, files)
    ecosystems = detect_ecosystems(root, files)
    commands = extract_commands(root, files)
    extensions = Counter(Path(f).suffix.lower() or "[no extension]" for f in files)
    inv = {
        "schema_version": "1.0",
        "skill_version": SKILL_VERSION,
        "name": name or root.name,
        "local_path": str(root),
        "relative_local_path": root.as_posix(),
        "indexed_at": datetime.now(timezone.utc).isoformat(),
        "summary": summarize_readme(root, readmes),
        "provenance": git_metadata(root, url=url, requested_ref=requested_ref),
        "edit_policy": edit_policy,
        "trust_level": trust_level,
        "clone_mode": clone_mode,
        "files": {
            "tracked_count": len(files),
            "top_level_files": top["files"],
            "largest": largest_files(root, files),
            "extensions": extensions.most_common(30),
        },
        "directories": {
            "top_level": top["directories"],
            "zones": directory_zones(root, files),
            "generated_or_low_value": generated,
        },
        "readmes": readmes,
        "licenses": licenses,
        "agent_instruction_files": agent_files[:50],
        "docs": docs,
        "examples": examples,
        "tests": tests,
        "ci": ci[:80],
        "ecosystems": ecosystems,
        "packages": packages,
        "commands": commands,
        "known_gaps": [],
    }
    if len(files) >= MAX_TRACKED_FILES:
        inv["known_gaps"].append(f"File listing truncated at {MAX_TRACKED_FILES} entries.")
    if not readmes:
        inv["known_gaps"].append("No README found.")
    if not commands:
        inv["known_gaps"].append("No build/test/lint commands were detected from supported manifests.")
    if not packages:
        inv["known_gaps"].append("No package manifests were detected by the scanner.")
    return inv


def to_markdown(inv: Dict[str, Any]) -> str:
    lines = [f"# Inventory: {inv['name']}", "", f"Indexed at: {inv['indexed_at']}", "", "## Summary", inv.get("summary", ""), ""]
    lines += ["## Provenance"]
    for k, v in inv.get("provenance", {}).items():
        lines.append(f"- {k}: `{v}`")
    lines.append("")
    lines += ["## Top-level files", *[f"- `{x}`" for x in inv["files"].get("top_level_files", [])], ""]
    lines += ["## Top-level directories", *[f"- `{x}`" for x in inv["directories"].get("top_level", [])], ""]
    lines += ["## Ecosystems"]
    for eco in inv.get("ecosystems", []):
        lines.append(f"- {eco['name']} ({eco['confidence']}): " + ", ".join(f"`{s}`" for s in eco.get("signals", [])[:8]))
    lines.append("")
    lines += ["## Packages"]
    for pkg in inv.get("packages", [])[:50]:
        lines.append(f"- `{pkg['path']}` — {pkg['ecosystem']} — `{pkg['manifest']}`")
    lines.append("")
    lines += ["## Commands"]
    for cmd in inv.get("commands", [])[:80]:
        lines.append(f"- `{cmd['command']}` from `{cmd['run_from']}` — risk: `{cmd['risk']}` — evidence: {cmd['evidence']}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a structured, read-only inventory of a repository.")
    parser.add_argument("repo", help="Path to repository")
    parser.add_argument("--name", default="", help="Display name")
    parser.add_argument("--url", default="", help="Upstream URL")
    parser.add_argument("--requested-ref", default="", help="Requested branch/tag/sha")
    parser.add_argument("--edit-policy", default="read-only")
    parser.add_argument("--trust-level", default="unknown", choices=["trusted", "unknown", "hostile"])
    parser.add_argument("--clone-mode", default="existing")
    parser.add_argument("--output", "-o", default="", help="Output path for JSON")
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    args = parser.parse_args()

    root = Path(args.repo)
    if not root.is_dir():
        print(f"ERROR: {root} is not a directory", file=sys.stderr)
        return 2

    inv = inventory(root, name=args.name, url=args.url, requested_ref=args.requested_ref, edit_policy=args.edit_policy, trust_level=args.trust_level, clone_mode=args.clone_mode)
    output = json.dumps(inv, indent=2, sort_keys=True) + "\n" if args.format == "json" else to_markdown(inv)
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(output, encoding="utf-8")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

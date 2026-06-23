# Antigravity Web Research Skill for Pi

This package installs a Pi CodingAgent skill that delegates **web-grounded research only** to Google Antigravity CLI.

## Install

```bash
mkdir -p ~/.pi/agent/skills/antigravity-research/scripts
cp SKILL.md ~/.pi/agent/skills/antigravity-research/SKILL.md
cp scripts/agy-research.sh ~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh
chmod +x ~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh
```

## Trust sidecar workspace once

```bash
mkdir -p ~/.pi/antigravity-sidecar-workspace
cd ~/.pi/antigravity-sidecar-workspace
agy
```

## Recommended usage

```bash
~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh --new current-blocker
AGY_REASONING=high ~/.pi/agent/skills/antigravity-research/scripts/agy-research.sh --file .pi/antigravity-briefs/current-blocker.md
```

## Purpose

Use this skill only when Pi needs Antigravity's web-search/documentation/source lookup capability. Reports without sources should be treated as failed or incomplete.

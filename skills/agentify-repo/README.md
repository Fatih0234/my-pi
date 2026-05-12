# agentify-repo skill bundle

This skill clones or indexes a GitHub repository and creates an agent-friendly navigation layer under `.agent/repos/<name>/`.

## What is included

```text
agentify-repo/
  SKILL.md
  scripts/
    agentify_repo.py       # main orchestrator
    inventory_repo.py      # structured repo scanner, JSON output
    render_docs.py         # renders INDEX/MAP/TASKS from inventory JSON
    update_agents_md.py    # idempotent root AGENTS.md updater
    validate_output.py     # validation gate for generated docs
    inventory.sh           # compatibility wrapper
  templates/
    INDEX.md
    MAP.md
    TASKS.md
    PACKAGE_MAP.md
  references/
    safety.md
    ecosystem-detection.md
  examples/
    small-node-output/
    python-package-output/
  schemas/
    repo_inventory.schema.json
```

## Basic use

From the root of the project where you want to vendor/index a repository:

```bash
python3 path/to/agentify-repo/scripts/agentify_repo.py https://github.com/owner/repo
```

For an already-cloned local repository:

```bash
python3 path/to/agentify-repo/scripts/agentify_repo.py --local-repo third_party/repo --name repo
```

The generated navigation layer is intentionally small. It should route agents to docs, examples, public entrypoints, tests, and safe commands without duplicating the upstream repository.

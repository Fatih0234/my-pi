# 🎭 my-pi

> My personal [pi coding agent](https://pi.ai) configuration — a curated collection of extensions, skills, themes, prompts, and tools that supercharge the pi agent experience.

This repo documents and shares the setup I use daily. Everything here lives in `~/.pi/agent/` on my machine, replicated here so you can fork, learn from, or directly use what I've built.

---

## 📦 Featured Extensions

These are the extensions I built from scratch or significantly refactored. Each one solves a real workflow problem.

### 🗂️ todo.ts — Todo Management

A full-featured file-based todo system. Todos are stored as markdown files in `.pi/todos/`, with JSON frontmatter for structured metadata (id, title, tags, status, timestamps).

**What it does:**
- Create, update, list, and close todos via natural language or the `/todos` TUI
- Tags for categorization (automatic GitHub label mapping)
- Session-based assignment system prevents conflicts
- Garbage collection — auto-deletes old closed todos
- Convert any todo to a GitHub issue with `todo github_issue`
- Lock files prevent concurrent editing

**Commands:** `/todos`, `todo` (tool)

### 🧠 btw.ts — BTW Mode (Cache-Friendly Side Questions)

"By The Way" mode — the most technically interesting extension in this repo. It lets you ask a side question without disrupting the main conversation, while **maximizing provider prompt-cache reuse**.

**How it works:**
- Preserves the exact LLM message prefix from the main session
- Spawns a shadow `Agent` with `sessionId` matching the main session for cache affinity
- Uses `user-only` system prompt strategy — keeps the main prompt exactly, puts safety instructions in the side-question user message
- Aborts on any toolcall event (one-answer-only mode)
- Configurable model/reasoning strategy via `btw-settings.json`

**Commands:** `/btw`, `/btw-settings`

### 🎓 coach.ts — Coach Mode

Toggle between coaching and implementation modes. When coach mode is active, the agent guides you to write code yourself — explaining concepts, suggesting approaches, but never writing code for you.

**What it does:**
- `/coach on` — agent becomes a tutor that teaches through guidance
- `/coach off` — back to normal implementation mode
- Status indicator in footer when active
- State persists across session forks

**Commands:** `/coach`, `Ctrl+Alt+L` shortcut

### 🔍 context-mode.ts — Context Building Mode

Toggle between context-building and implementation modes. When enabled, the agent focuses entirely on gathering context, asking questions, exploring code, and documenting — without implementing anything.

**What it does:**
- `/ctx on` — agent stops implementing. It only explores, asks, and documents
- `/ctx off` — back to normal mode
- Eliminates the need to constantly say "we are still in context building stage"
- Status indicator in footer when active
- State persists across session forks

**Commands:** `/ctx`, `Ctrl+Alt+C` shortcut

### ↔️ split-fork.ts — Split Fork

Fork the current pi session into a **split terminal pane** (Ghostty). Creates a new pi session running in a side-by-side terminal split.

**What it does:**
- `/split-fork` — forks current session into a right or down split pane
- `/split-fork right` — explicit direction
- `/split-fork down` — vertical split
- Copies session context so the fork picks up where you left off
- Uses Ghostty's `split` AppleScript API

### 📑 tab-fork.ts — Tab Fork

Fork the current pi session into a **new terminal tab** (Ghostty). Like split-fork but in a separate tab.

**What it does:**
- `/tab-fork` — opens current session in a new Ghostty tab
- Keeps the fork independent — perfect for exploring branches or testing ideas
- Uses Ghostty's `new tab` AppleScript API

### 🌿 worktree-fork.ts — Worktree Fork

Fork the current pi session into a **git worktree on a new branch**. The ultimate tool for safe experimentation: forks isolate changes in a separate worktree so your main checkout stays clean.

**What it does:**
- `/worktree-fork feature-name` — creates a git branch + worktree, starts pi there
- Automatically generates branch names from your description
- Works with any git repo
- Integrates with Ghostty (opens a new window/tab with the worktree session)
- Cleans up worktrees when done

---

## 🧩 All Extensions

| Extension | Description | Commands |
|---|---|---|
| **answer.ts** | Extracts questions from assistant responses and presents an interactive TUI for answering them. Perfect for Q&A workflows. | `/answer` |
| **btw.ts** | [Featured ↑](#-btwts--btw-mode-cache-friendly-side-questions) Cache-friendly side-question extension. Asks follow-ups without disrupting the main context. | `/btw`, `/btw-settings` |
| **coach.ts** | [Featured ↑](#-coachts--coach-mode) Toggle coach/implementation modes. Agent guides rather than writes code. | `/coach` |
| **context-mode.ts** | [Featured ↑](#-context-modets--context-building-mode) Toggle context-building/implementation modes. Agent explores without implementing. | `/ctx` |
| **context.ts** | TUI showing what's loaded: extensions, skills, project context files, token usage, and session cost. | `/context` |
| **control.ts** | Inter-session communication via Unix domain sockets. Send messages, get summaries, clear sessions, coordinate between running pi instances. | `--session-control` flag |
| **files.ts** | File explorer listing files in the current git tree. Quick actions: reveal, open, edit, diff. | `/files`, `/diff` |
| **lightpanda.ts** | Integrates [Lightpanda](https://lightpanda.io) — a headless browser in Zig. 10x faster than Chrome for web scraping and automation. | `lightpanda_fetch`, `lightpanda_cdp` tools |
| **lightpanda-puppeteer.ts** | Advanced browser automation via Lightpanda CDP + Puppeteer. Click, fill forms, take screenshots, run JS. | `browser_automate` tool |
| **loop.ts** | Start a follow-up loop with a breakout condition. Keeps prompting until the agent signals completion. | `/loop` |
| **multi-edit.ts** | Enhanced edit tool supporting batched edits, multi-file changes, and patch-mode (Codex-style `apply_patch`). Replaces the built-in edit tool. | `edit` tool (enhanced) |
| **notify.ts** | Sends native desktop notifications when the agent finishes and is waiting for input. Uses OSC 777 escape sequences — no dependencies. | Automatic |
| **prompt-editor.ts** | Advanced mode/configuration editor. Create and manage named modes with custom providers, models, and thinking levels. Mode files stored in `~/.pi/modes/`. | `/prompt` |
| **review.ts** | Code review extension inspired by Codex. Review PRs (by number or URL), branches, commits, uncommitted changes, or specific folders. | `/review` |
| **session-breakdown.ts** | Interactive analytics TUI showing session activity, token usage, and cost breakdowns per day and per model. GitHub-contributions-style calendar heatmap. | `/session-breakdown` |
| **split-fork.ts** | [Featured ↑](#-split-forkts--split-fork) Fork session into a Ghostty split pane. | `/split-fork` |
| **supacode/index.ts** | Reports agent lifecycle hooks back to Supacode via Unix domain socket. Integrates pi with Supacode's terminal management. | Automatic |
| **tab-fork.ts** | [Featured ↑](#-tab-forkts--tab-fork) Fork session into a new Ghostty tab. | `/tab-fork` |
| **todo.ts** | [Featured ↑](#-todots--todo-management) File-based todo management with TUI, tags, GitHub issues, and session-safe locking. | `/todos` |
| **uv.ts** | Redirects python/pip/poetry commands to use `uv` instead. Intercepts bash commands and replaces them with equivalent `uv` commands. | Automatic |
| **whimsical.ts** | Replaces the boring "Thinking..." spinner with fun random messages. Adds personality to the waiting experience. | Automatic |
| **worktree-fork.ts** | [Featured ↑](#-worktree-forkts--worktree-fork) Fork session into a git worktree on a new branch. | `/worktree-fork` |

---

## 📚 Skills

Skills are the agent's instruction manual for specific tasks. They tell pi how to handle particular domains.

| Skill | Description |
|---|---|
| **agent-browser-core** | Core usage guide for browser automation. Covers snapshot-and-ref workflow, navigation, clicking, forms, screenshots, tabs, auth, and troubleshooting. |
| **agentify-repo** | Clone/index a GitHub repo and generate an agent-friendly navigation layer. For mapping unfamiliar codebases. |
| **commit** | Guidelines for making structured git commits. |
| **doc-to-markdown** | Convert PDF, DOCX, HTML files (local or URL) to Markdown using `uvx markitdown`, with optional summarization. |
| **frontend-design** | Design and implement distinctive, production-ready frontend interfaces with strong aesthetic direction. |
| **github** | Interact with GitHub via the `gh` CLI. Issues, PRs, CI runs, and advanced queries. |
| **native-web-search** | Trigger native web search for quick internet research with concise summaries and full source URLs. |
| **supacode-cli** | Control Supacode from the terminal. Manage worktrees, tabs, and surfaces programmatically. |
| **tmux** | Remote control tmux sessions for interactive CLIs (python, gdb, etc.) by sending keystrokes and scraping pane output. |
| **update-changelog** | Guidelines for maintaining structured changelogs. |
| **uv** | Use `uv` instead of pip/python/venv for Python tooling. Inline script metadata, `uv run`, `uv add`. |
| **web-browser** | Legacy browser skill. Controls Chrome/Chromium via CDP for clicking, filling forms, and navigating links. |

---

## 🎨 Themes

Visual themes for the pi TUI. Each is a JSON file with color tokens.

| Theme | Description |
|---|---|
| **catppuccin-frappe** | Catppuccin Frappe — warm, muted variant |
| **catppuccin-latte** | Catppuccin Latte — light variant |
| **catppuccin-macchiato** | Catppuccin Macchiato — medium variant |
| **catppuccin-mocha** | Catppuccin Mocha — dark variant (most popular) |
| **nightowl** | Night Owl — dark blue-based theme |
| **rosepine** | Rosé Pine — pine variant, earthy tones |
| **rosepine-pop** | Rosé Pine Pop — pop variant, vibrant accents (my default) |

Set your theme in `settings.json`:
```json
{ "theme": "rosepine-pop" }
```

---

## 📝 Prompts

Prompt templates that extend pi's default system prompt for specific tasks.

| Prompt | Description |
|---|---|
| **init.md** | Scaffold or refactor an `AGENTS.md` file with project guidelines. Generates complete scaffold with project overview, dev environment setup, code style guidelines. |
| **minify.md** | Review a codebase for structural simplicity. Suggests consolidations, deeper modules, elimination of shallow abstractions. Applies the simplification mandate principles. |
| **test-hardening.md** | After implementation, adds meaningful tests for the change. Focuses on behavior, edge cases, and regressions. Follows existing test style. |

---

## 🐳 pi-docker-sbx — Docker Sandbox Extension

[pi-docker-sbx](https://github.com/Fatih0234/pi-docker-sbx) is a standalone pi extension that runs pi safely inside a [Docker Sandbox](https://docker.com). Every file read, write, shell command, and search runs in an isolated Docker microVM — your local machine is never touched.

A persistent bash worker eliminates per-call `sbx exec` overhead, dropping typical tool latency from **~8s to ~10ms** after the first connection.

### Quick Start

```bash
# Install the Docker Sandbox CLI
brew install docker/sandbox/sbx

# Install the extension
pi install npm:pi-docker-sbx

# Create a fresh sandbox
pi --sandbox

# Branch/worktree mode — changes land in an isolated git worktree
pi --sandbox my-project --sandbox-branch auto
```

### Why sandbox?

When pi edits files or runs bash commands, it operates directly on your machine. A sandbox moves all of that into a secure, disposable Docker environment. If the AI does something unexpected, your real filesystem stays safe.

---

## ⚙️ Configuration

### settings.json

```json
{
  "defaultProvider": "opencode",
  "defaultModel": "deepseek-v4-flash-free",
  "defaultThinkingLevel": "xhigh",
  "theme": "rosepine-pop",
  "extensions": ["-extensions/multi-edit.ts", "-extensions/uv.ts"]
}
```

### btw-settings.json

```json
{
  "modelStrategy": "custom",
  "customProvider": "opencode-go",
  "customModelId": "deepseek-v4-flash",
  "reasoning": "minimal",
  "maxTokens": 2000,
  "cacheRetention": "short"
}
```

---

## 🚀 Getting Started

To use this setup yourself:

```bash
# Clone this repo
git clone https://github.com/Fatih0234/my-pi.git

# Install extensions
cd my-pi/extensions && npm install

# Link to your pi agent directory
ln -s "$(pwd)/AGENTS.md" ~/.pi/agent/AGENTS.md
ln -s "$(pwd)/extensions" ~/.pi/agent/extensions
ln -s "$(pwd)/skills" ~/.pi/agent/skills
ln -s "$(pwd)/prompts" ~/.pi/agent/prompts
ln -s "$(pwd)/themes" ~/.pi/agent/themes
ln -s "$(pwd)/settings.json" ~/.pi/agent/settings.json
ln -s "$(pwd)/btw-settings.json" ~/.pi/agent/btw-settings.json

# For pi-docker-sbx (optional)
cd pi-docker-sbx && npm install
pi install npm:pi-docker-sbx
```

> ⚠️ **Note:** You will need to create your own `~/.pi/agent/auth.json` and `~/.pi/agent/models.json` with your API keys. The `models.json` in this repo is excluded because it contains credentials.

---

## 📁 Repo Structure

```
my-pi/
├── AGENTS.md              # Simplification mandate (project rules for agents)
├── settings.json          # Global pi configuration
├── btw-settings.json      # BTW mode model settings
├── extensions/            # Custom pi extensions (.ts files)
│   ├── lib/               # Shared utility modules
│   ├── supacode/          # Supacode lifecycle integration
│   └── package.json       # Extension dependencies
├── skills/                # Agent skill definitions
├── prompts/               # System prompt templates
├── themes/                # TUI color themes (JSON)
├── pi-docker-sbx/         # Docker sandbox extension (subtree)
├── README.md              # This file
└── .gitignore
```

---

## 📄 License

MIT — feel free to use, adapt, and share.

---

*Built with [pi coding agent](https://pi.ai)*

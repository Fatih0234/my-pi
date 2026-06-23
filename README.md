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
| **answer.ts** | Extracts questions from assistant responses and presents an interactive TUI for answering them. | `/answer` |
| **brainstorming-mode.ts** | Toggle creative, critical brainstorming partner mode using the `brainstorming.md` prompt. | `/brainstorm` |
| **btw.ts** | [Featured ↑](#-btwts--btw-mode-cache-friendly-side-questions) Cache-friendly side-question extension. | `/btw`, `/btw-settings` |
| **caveman.ts** | Ultra-compressed response modes, including terse caveman and Wenyan-style variants. | `/caveman` |
| **cmux-session.ts** | Bridges Pi session lifecycle events into cmux's restorable session store. | Automatic |
| **coach.ts** | [Featured ↑](#-coachts--coach-mode) Toggle coach/implementation modes. | `/coach` |
| **collab.ts** | Collaborative pacing mode for slower, interruptible, user-led coding sessions. | `/collab` |
| **context-mode.ts** | [Featured ↑](#-context-modets--context-building-mode) Context-building mode that explores without committing to implementation. | `/ctx` |
| **context.ts** | TUI showing loaded extensions, skills, context files, token usage, and session cost. | `/context` |
| **control.ts** | Inter-session communication via Unix domain sockets for coordinating running pi instances. | `--session-control` flag |
| **copy-all.ts** | Copies previous user and assistant messages in the current thread to the clipboard. | `/copy-all` |
| **copy-compaction.ts** | Automatically copies compaction summaries to the clipboard. | Automatic |
| **copy-context.ts** | Builds ChatGPT-ready Markdown bundles from selected files/folders and copies or writes them. | `/copy-context` |
| **diff.ts** | Tracks files changed by the last agent run and opens selected files in Zed. | `/diff` |
| **files.ts** | File explorer listing files in the current git tree with quick reveal/open/edit/diff actions. | `/files`, `/diff` |
| **go-usage/index.ts** | Tracks and reports local OpenCode Go usage estimates and baselines. | `/go-usage` |
| **handoff/index.ts** | Generates a concise handoff document so another agent can continue a session. | `/handoff` |
| **lightpanda.ts** | Integrates Lightpanda for fast headless browser fetching and CDP access. | `lightpanda_fetch`, `lightpanda_cdp` tools |
| **lightpanda-puppeteer.ts** | Browser automation via Lightpanda CDP and Puppeteer. | `browser_automate` tool |
| **loop.ts** | Starts a follow-up loop with a breakout condition. | `/loop` |
| **multi-edit.ts** | Enhanced edit tool supporting batched edits, multi-file changes, and patch-mode. | `edit` tool (enhanced) |
| **notify.ts** | Native desktop notifications when the agent finishes and waits for input. | Automatic |
| **pi-codex-goal/** | Codex-style long-running goal tracking with model-callable goal tools. | `/goal`, `/create-goal`, `get_goal`, `create_goal`, `update_goal` |
| **pi-diff-review/** | Native diff review window with git diff, last commit, and all-files scopes. | `/diff-review` |
| **project-zero-review.ts** | Reviews implementation against Project Zero contract files. | `/pz-review` |
| **prompt-editor.ts** | Advanced mode/configuration editor for named modes, providers, models, and thinking levels. | `/prompt` |
| **review.ts** | Code review extension for PRs, branches, commits, uncommitted changes, or folders. | `/review` |
| **session-breakdown.ts** | Interactive analytics TUI for session activity, token usage, and cost breakdowns. | `/session-breakdown` |
| **split-fork.ts** | [Featured ↑](#-split-forkts--split-fork) Fork session into a Ghostty split pane. | `/split-fork` |
| **supacode/index.ts** | Reports agent lifecycle hooks back to Supacode via Unix domain socket. | Automatic |
| **tab-fork.ts** | [Featured ↑](#-tab-forkts--tab-fork) Fork session into a new Ghostty tab. | `/tab-fork` |
| **todo.ts** | [Featured ↑](#-todots--todo-management) File-based todo management with TUI, tags, GitHub issues, and locks. | `/todos`, `todo` tool |
| **uv.ts** | Redirects Python/pip/poetry commands toward `uv` workflows. | Automatic |
| **whimsical.ts** | Fun random waiting messages instead of the boring thinking spinner. | Automatic |
| **worktree-fork.ts** | [Featured ↑](#-worktree-forkts--worktree-fork) Fork session into a git worktree on a new branch. | `/worktree-fork` |

---

## 📚 Skills

| Skill | Description |
|---|---|
| **agent-browser-core** | Core browser automation guide for snapshot/ref workflows, navigation, forms, auth, screenshots, tabs, and troubleshooting. |
| **agentify-repo** | Clone or index a GitHub repository and generate an agent-friendly navigation layer. |
| **antigravity-web-research** | Web-grounded research sidecar for current docs, release notes, GitHub issues, and source-backed investigation. |
| **commit** | Guidelines for making structured git commits. |
| **doc-to-markdown** | Convert PDF, DOCX, HTML files or URLs to Markdown using `uvx markitdown`. |
| **frontend-design** | Design and implement distinctive production-ready frontend interfaces. |
| **github** | Interact with GitHub via `gh` for issues, PRs, CI runs, and API queries. |
| **html-to-markdown** | Convert existing HTML files/snippets to Markdown with Python `html2text`. |
| **native-web-search** | Trigger native web search for concise internet research with source URLs. |
| **playwright-cli** | Automate browser interactions and work with Playwright tests from the CLI. |
| **supacode-cli** | Control Supacode from the terminal: worktrees, tabs, and surfaces. |
| **tmux** | Remote control tmux sessions by sending keystrokes and scraping pane output. |
| **update-changelog** | Guidelines for maintaining structured changelogs. |
| **uv** | Use `uv` instead of pip/python/venv for Python tooling. |
| **web-browser** | Legacy Chrome/Chromium CDP browser-control skill. |

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

| Prompt | Description |
|---|---|
| **agweb.md** | Create an objective Antigravity web-research brief and run the web-research skill. |
| **brainstorming.md** | Brainstorming partner mode prompt for grounded ideation, critique, and next steps. |
| **collect-success-criteria.md** | Collect success criteria before creating a pi-codex goal. |
| **controlled-app-review-discovery.md** | Interactively review a working app, script, or MVP and map high-value review points. |
| **create-goal.md** | Convert a plain task into a strict evidence-based pi-codex goal. |
| **decision-review.md** | Evaluate whether a proposed decision or implementation is worth doing. |
| **high-impact-follow-up.md** | Find one high-impact follow-up improvement. |
| **init.md** | Scaffold or refactor an `AGENTS.md` file with project guidelines. |
| **minify.md** | Review a codebase for structural simplicity and consolidation opportunities. |
| **points.md** | Discover high-value isolated attention points and write them to `.agent/POINT_MAP.md`. |
| **publish-session.md** | Commit and push only the current session's intended changes. |
| **repo-discovery.md** | Discover and explain an indexed repository quickly: product, architecture, flows, risks, and next steps. |
| **test-hardening.md** | Add meaningful tests for an implemented change. |

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

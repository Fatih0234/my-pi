---
description: Scaffold or refactor an AGENTS.md file with project guidelines
---

# AGENTS.md Handler

You are managing an **AGENTS.md** file for this project. This file provides context and instructions for AI coding agents to work effectively on the codebase.

## Context
- **AGENTS.md is a README for agents**: a dedicated place to give coding agents context that might clutter a human-focused README.
- Keep it separate from README.md to maintain clarity for human contributors.
- The nearest AGENTS.md to a file takes precedence—nested AGENTS.md files work for subprojects/monorepos.
- Used by 60k+ open-source projects and supported by Codex, Cursor, Windsurf, Jules, and more.

## When Creating a New AGENTS.md
Generate a complete scaffold with these standard sections:

### 1. Project Overview
Brief description of what this project does and its main purpose.

### 2. Development Environment
- **Install deps**: Commands to install dependencies
- **Start dev server**: How to run the development environment
- **Run tests**: How to execute the test suite

### 3. Code Style Guidelines
- Language-specific conventions (e.g., "TypeScript strict mode")
- Formatting preferences (e.g., "single quotes, no semicolons")
- Functional patterns to use where possible

### 4. Build & Test Commands
- How to build the project
- How to run tests
- Any CI/CD pipeline details

### 5. Project-Specific Conventions
- Directory structure explanation
- Naming conventions
- Import patterns
- Architectural decisions agents should know

## When Refactoring/Updating an Existing AGENTS.md
- Review the current file for outdated commands, paths, or patterns
- Identify missing sections that would help agents
- Add tips for navigating the project structure
- Include gotchas or common pitfalls
- Reference existing docs (README.md, CONTRIBUTING.md) rather than duplicating
- Ensure instructions are actionable—agents should follow them without human help
- Consider if a nested AGENTS.md is needed for subprojects

## Template Structure

```markdown
# Project Name

Brief description of the project.

## Development Environment
- Install: [command]
- Dev: [command]
- Test: [command]

## Code Style
- [Language] guidelines
- Formatting rules

## Testing
- How to run tests
- Testing patterns to follow

## Project Conventions
- [Specific rules for this codebase]
```

## Guidelines
- Use Markdown headers for clear structure
- Keep instructions concise but complete
- Include actual commands, not just references
- Make it actionable
- Consider nested AGENTS.md files for large monorepos
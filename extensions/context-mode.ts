/**
 * Context Building Mode Extension
 *
 * Toggle between context-building and implementation modes.
 * 
 * When enabled, the agent focuses on gathering context, asking questions,
 * exploring code, and documenting - without implementing anything.
 * This eliminates the need to constantly say "do not build anything" or 
 * "we are still in context building stage" at the end of every prompt.
 *
 * Usage:
 *   /ctx           - Toggle context building mode
 *   /ctx on        - Enable context building
 *   /ctx off       - Disable context building
 *   Ctrl+Alt+C     - Toggle via shortcut
 *
 * Features:
 * - Status indicator in footer when active
 * - Different system prompt behavior per mode
 * - Persists state across session forks
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

// Context building stage prompt
const CONTEXT_BUILDING_PROMPT = `[CONTEXT BUILDING STAGE]

You are in the context-building phase. Your goal is to gather information, understand the problem space, and prepare for implementation - NOT to implement anything.

During this stage:
- Gather context: read files, explore the codebase, understand existing patterns
- Ask clarifying questions: use the questionnaire tool to understand requirements better  
- Document findings: you CAN write spec files, design docs, PRDs if helpful
- Research: use search, browse the web, read documentation
- Analyze: understand the current state, identify patterns, spot issues
- Plan: outline what needs to be done (without doing it)
- Explore: go places, check docs, understand how things work

DO NOT:
- Write production code
- Modify existing files with implementation changes
- Refactor or restructure existing code
- Create new source files with implementation code
- Apply any changes to the codebase

Focus on understanding and documenting the landscape. Ask questions, gather requirements, explore related codebases, read documentation, and create specs if they help communication.

When you feel you have enough context, suggest switching to implementation mode ("/ctx off" or just let the user know you're ready).`;

// Implementation mode reminder (subtle)
const IMPLEMENTATION_MODE_REMINDER = `[IMPLEMENTATION MODE]

You are now in implementation mode. You may now write code, modify files, and apply changes to the codebase.

This mode was toggled via /ctx off. If the user later wants to return to context-building mode, they can use /ctx on.`;

export default function contextBuildingExtension(pi: ExtensionAPI): void {
	let contextModeEnabled = false;

	function updateStatus(ctx: ExtensionContext): void {
		if (contextModeEnabled) {
			ctx.ui.setStatus("ctx-mode", ctx.ui.theme.fg("accent", "📋 context"));
		} else {
			ctx.ui.setStatus("ctx-mode", undefined);
		}
	}

	function toggleContextMode(ctx: ExtensionContext): void {
		contextModeEnabled = !contextModeEnabled;
		
		if (contextModeEnabled) {
			ctx.ui.notify("Context Building Mode: ON", "info");
			ctx.ui.notify("Focus on gathering context, asking questions, and exploring. Don't implement.", "info");
		} else {
			ctx.ui.notify("Context Building Mode: OFF", "info");
			ctx.ui.notify("You may now implement changes.", "info");
		}
		
		updateStatus(ctx);
		persistState();
	}

	function enableContextMode(ctx: ExtensionContext): void {
		if (!contextModeEnabled) {
			contextModeEnabled = true;
			ctx.ui.notify("Context Building Mode: ON", "info");
			updateStatus(ctx);
			persistState();
		} else {
			ctx.ui.notify("Already in context building mode", "info");
		}
	}

	function disableContextMode(ctx: ExtensionContext): void {
		if (contextModeEnabled) {
			contextModeEnabled = false;
			ctx.ui.notify("Context Building Mode: OFF", "info");
			updateStatus(ctx);
			persistState();
		} else {
			ctx.ui.notify("Already in implementation mode", "info");
		}
	}

	function persistState(): void {
		pi.appendEntry("context-building-mode", {
			enabled: contextModeEnabled,
		});
	}

	// Register commands
	pi.registerCommand("ctx", {
		description: "Toggle context building mode (gather context without implementing)",
		getArgumentCompletions: (prefix: string) => {
			const options = ["on", "off", "toggle"];
			const items = options.map((o) => ({ value: o, label: o }));
			return items.filter((i) => i.value.startsWith(prefix.toLowerCase()));
		},
		handler: async (args, ctx) => {
			if (!args) {
				// No args = toggle
				toggleContextMode(ctx);
			} else {
				const cmd = args.toLowerCase();
				if (cmd === "on") {
					enableContextMode(ctx);
				} else if (cmd === "off") {
					disableContextMode(ctx);
				} else if (cmd === "toggle") {
					toggleContextMode(ctx);
				} else {
					ctx.ui.notify(`Unknown option: ${args}. Use: on, off, or no args to toggle`, "error");
				}
			}
		},
	});

	// Register shortcut Ctrl+Alt+C
	pi.registerShortcut(Key.ctrlAlt("c"), {
		description: "Toggle context building mode",
		handler: async (ctx) => toggleContextMode(ctx),
	});

	// Inject context prompt before agent starts
	pi.on("before_agent_start", async () => {
		if (contextModeEnabled) {
			return {
				systemPrompt: CONTEXT_BUILDING_PROMPT,
			};
		}
		// Optional: could inject a reminder when in implementation mode after being in context mode
		// But that might be annoying. Let's keep it simple.
	});

	// Restore state on session start
	pi.on("session_start", async (_event, ctx) => {
		const entries = ctx.sessionManager.getEntries();

		// Restore persisted state
		const ctxEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "context-building-mode")
			.pop() as { data?: { enabled: boolean } } | undefined;

		if (ctxEntry?.data) {
			contextModeEnabled = ctxEntry.data.enabled ?? contextModeEnabled;
		}

		updateStatus(ctx);
	});
}
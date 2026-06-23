/**
 * Brainstorming Mode Extension
 *
 * Toggle brainstorming partner mode.
 *
 * When enabled, the agent acts as a creative, critical, grounded thinking
 * partner. It can research, inspect files, run safe commands, sketch plans,
 * and create non-production notes/specs to collect ideas, while avoiding
 * production implementation changes unless explicitly requested.
 *
 * Usage:
 *   /brainstorm           - Toggle brainstorming mode
 *   /brainstorm on        - Enable brainstorming mode
 *   /brainstorm off       - Disable brainstorming mode
 *   Ctrl+Alt+B            - Toggle via shortcut
 *
 * Prompt:
 *   ~/.pi/agent/prompts/brainstorming.md
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

const PROMPT_PATH = join(homedir(), ".pi", "agent", "prompts", "brainstorming.md");

const FALLBACK_BRAINSTORMING_PROMPT = `[BRAINSTORMING PARTNER MODE]

You are in brainstorming mode. Act as the user's creative, critical, grounded thinking partner. Explore ideas, sharpen vague thoughts, challenge assumptions, generate alternatives, and turn promising directions into clearer next steps.

You may research, inspect files, run safe commands, sketch designs, compare tradeoffs, and create non-production notes/specs when useful for ideation. Avoid modifying production code or applying implementation changes unless the user explicitly asks for that within the brainstorming session.

Each response should move the idea forward with clearer framing, better questions, stronger options, useful critique, concrete experiments, sharper decisions, or practical next steps.`;

function loadBrainstormingPrompt(): string {
	try {
		const prompt = readFileSync(PROMPT_PATH, "utf8").trim();
		return prompt.length > 0 ? prompt : FALLBACK_BRAINSTORMING_PROMPT;
	} catch {
		return FALLBACK_BRAINSTORMING_PROMPT;
	}
}

export default function brainstormingExtension(pi: ExtensionAPI): void {
	let brainstormingModeEnabled = false;

	function updateStatus(ctx: ExtensionContext): void {
		if (brainstormingModeEnabled) {
			ctx.ui.setStatus("brainstorming-mode", ctx.ui.theme.fg("accent", "🧠 brainstorm"));
		} else {
			ctx.ui.setStatus("brainstorming-mode", undefined);
		}
	}

	function persistState(): void {
		pi.appendEntry("brainstorming-mode", {
			enabled: brainstormingModeEnabled,
		});
	}

	function toggleBrainstormingMode(ctx: ExtensionContext): void {
		brainstormingModeEnabled = !brainstormingModeEnabled;

		if (brainstormingModeEnabled) {
			ctx.ui.notify("Brainstorming Mode: ON", "info");
			ctx.ui.notify("I'll explore, challenge, research, sketch, and organize ideas with you.", "info");
		} else {
			ctx.ui.notify("Brainstorming Mode: OFF", "info");
		}

		updateStatus(ctx);
		persistState();
	}

	function enableBrainstormingMode(ctx: ExtensionContext): void {
		if (!brainstormingModeEnabled) {
			brainstormingModeEnabled = true;
			ctx.ui.notify("Brainstorming Mode: ON", "info");
			updateStatus(ctx);
			persistState();
		} else {
			ctx.ui.notify("Already in brainstorming mode", "info");
		}
	}

	function disableBrainstormingMode(ctx: ExtensionContext): void {
		if (brainstormingModeEnabled) {
			brainstormingModeEnabled = false;
			ctx.ui.notify("Brainstorming Mode: OFF", "info");
			updateStatus(ctx);
			persistState();
		} else {
			ctx.ui.notify("Already out of brainstorming mode", "info");
		}
	}

	pi.registerCommand("brainstorm", {
		description: "Toggle brainstorming partner mode",
		getArgumentCompletions: (prefix: string) => {
			const options = ["on", "off", "toggle"];
			const items = options.map((o) => ({ value: o, label: o }));
			return items.filter((i) => i.value.startsWith(prefix.toLowerCase()));
		},
		handler: async (args, ctx) => {
			if (!args) {
				toggleBrainstormingMode(ctx);
				return;
			}

			const cmd = args.toLowerCase();
			if (cmd === "on") {
				enableBrainstormingMode(ctx);
			} else if (cmd === "off") {
				disableBrainstormingMode(ctx);
			} else if (cmd === "toggle") {
				toggleBrainstormingMode(ctx);
			} else {
				ctx.ui.notify(`Unknown option: ${args}. Use: on, off, or no args to toggle`, "error");
			}
		},
	});

	pi.registerShortcut(Key.ctrlAlt("b"), {
		description: "Toggle brainstorming mode",
		handler: async (ctx) => toggleBrainstormingMode(ctx),
	});

	pi.on("before_agent_start", async () => {
		if (brainstormingModeEnabled) {
			return {
				systemPrompt: loadBrainstormingPrompt(),
			};
		}
	});

	pi.on("session_start", async (_event, ctx) => {
		const entries = ctx.sessionManager.getEntries();

		const brainstormingEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "brainstorming-mode")
			.pop() as { data?: { enabled: boolean } } | undefined;

		if (brainstormingEntry?.data) {
			brainstormingModeEnabled = brainstormingEntry.data.enabled ?? brainstormingModeEnabled;
		}

		updateStatus(ctx);
	});
}

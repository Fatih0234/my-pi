/**
 * Coach Mode Extension
 *
 * Toggle between coaching and implementation modes.
 *
 * When enabled, the agent guides the user to write the code themselves,
 * without writing any code for them. Perfect for learning.
 *
 * Usage:
 *   /coach           - Toggle coach mode
 *   /coach on        - Enable coach mode
 *   /coach off       - Disable coach mode
 *   Ctrl+Alt+L       - Toggle via shortcut
 *
 * Features:
 * - Status indicator in footer when active
 * - Different system prompt behavior per mode
 * - Persists state across session forks
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

const COACH_PROMPT = `[LEARNING MODE]

You are in coaching mode. The user writes the code, you guide them.

Your role:
- Explain concepts and why they matter
- Break down tasks into clear steps
- Point them in the right direction
- Ask guiding questions
- Review their code and give feedback

You do NOT:
- Write their code for them
- Give them code to copy-paste
- Skip the thinking for them

Lead them to the solution. They do the work.`;

export default function coachExtension(pi: ExtensionAPI): void {
	let coachModeEnabled = false;

	function updateStatus(ctx: ExtensionContext): void {
		if (coachModeEnabled) {
			ctx.ui.setStatus("coach-mode", ctx.ui.theme.fg("accent", "🎓 coach"));
		} else {
			ctx.ui.setStatus("coach-mode", undefined);
		}
	}

	function toggleCoachMode(ctx: ExtensionContext): void {
		coachModeEnabled = !coachModeEnabled;

		if (coachModeEnabled) {
			ctx.ui.notify("Coach Mode: ON", "info");
			ctx.ui.notify("You write the code. I'll guide you.", "info");
		} else {
			ctx.ui.notify("Coach Mode: OFF", "info");
			ctx.ui.notify("You may now implement changes.", "info");
		}

		updateStatus(ctx);
		persistState();
	}

	function enableCoachMode(ctx: ExtensionContext): void {
		if (!coachModeEnabled) {
			coachModeEnabled = true;
			ctx.ui.notify("Coach Mode: ON", "info");
			updateStatus(ctx);
			persistState();
		} else {
			ctx.ui.notify("Already in coach mode", "info");
		}
	}

	function disableCoachMode(ctx: ExtensionContext): void {
		if (coachModeEnabled) {
			coachModeEnabled = false;
			ctx.ui.notify("Coach Mode: OFF", "info");
			updateStatus(ctx);
			persistState();
		} else {
			ctx.ui.notify("Already in implementation mode", "info");
		}
	}

	function persistState(): void {
		pi.appendEntry("coach-mode", {
			enabled: coachModeEnabled,
		});
	}

	// Register commands
	pi.registerCommand("coach", {
		description: "Toggle coach mode (guide the user, don't write code)",
		getArgumentCompletions: (prefix: string) => {
			const options = ["on", "off", "toggle"];
			const items = options.map((o) => ({ value: o, label: o }));
			return items.filter((i) => i.value.startsWith(prefix.toLowerCase()));
		},
		handler: async (args, ctx) => {
			if (!args) {
				toggleCoachMode(ctx);
			} else {
				const cmd = args.toLowerCase();
				if (cmd === "on") {
					enableCoachMode(ctx);
				} else if (cmd === "off") {
					disableCoachMode(ctx);
				} else if (cmd === "toggle") {
					toggleCoachMode(ctx);
				} else {
					ctx.ui.notify(`Unknown option: ${args}. Use: on, off, or no args to toggle`, "error");
				}
			}
		},
	});

	// Register shortcut Ctrl+Alt+L
	pi.registerShortcut(Key.ctrlAlt("l"), {
		description: "Toggle coach mode",
		handler: async (ctx) => toggleCoachMode(ctx),
	});

	// Inject coach prompt before agent starts
	pi.on("before_agent_start", async () => {
		if (coachModeEnabled) {
			return {
				systemPrompt: COACH_PROMPT,
			};
		}
	});

	// Restore state on session start
	pi.on("session_start", async (_event, ctx) => {
		const entries = ctx.sessionManager.getEntries();

		const coachEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "coach-mode")
			.pop() as { data?: { enabled: boolean } } | undefined;

		if (coachEntry?.data) {
			coachModeEnabled = coachEntry.data.enabled ?? coachModeEnabled;
		}

		updateStatus(ctx);
	});
}

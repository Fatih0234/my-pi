/**
 * Caveman Extension for Pi
 *
 * Makes the agent respond in ultra-compressed caveman prose.
 * Cuts ~65-75% of output tokens while keeping full technical accuracy.
 *
 * Usage:
 *   /caveman              - Toggle caveman mode (default: full)
 *   /caveman lite         - Lite intensity (no filler, keep grammar)
 *   /caveman full         - Full intensity (default caveman)
 *   /caveman ultra        - Ultra intensity (max compression)
 *   /caveman wenyan-lite  - Semi-classical Chinese
 *   /caveman wenyan-full  - Classical Chinese
 *   /caveman wenyan-ultra - Extreme classical compression
 *   /caveman off          - Disable caveman mode
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type CavemanMode =
	| "lite"
	| "full"
	| "ultra"
	| "wenyan-lite"
	| "wenyan-full"
	| "wenyan-ultra"
	| null;

const VALID_MODES: CavemanMode[] = [
	"lite",
	"full",
	"ultra",
	"wenyan-lite",
	"wenyan-full",
	"wenyan-ultra",
];

// Short labels for the picker (keep it TUI-friendly)
const MODE_LABEL: Record<string, string> = {
	ultra: "ultra (max compression)",
	full: "full (default)",
	lite: "lite (light compression)",
	"wenyan-ultra": "wenyan-ultra (extreme classical)",
	"wenyan-full": "wenyan-full (classical)",
	"wenyan-lite": "wenyan-lite (light classical)",
};

// Per-mode one-line descriptions (shown in the injected prompt)
const MODE_DESC: Record<string, string> = {
	ultra: "Abbreviate prose words, strip conjunctions, arrows for causality. Code symbols never abbreviate.",
	full: "Drop articles, fragments OK, short synonyms. Classic caveman.",
	lite: "No filler/hedging. Keep articles + full sentences. Professional but tight.",
	"wenyan-ultra": "Extreme abbreviation while keeping classical Chinese feel.",
	"wenyan-full": "Maximum classical terseness. Fully 文言文.",
	"wenyan-lite": "Semi-classical. Drop filler/hedging but keep grammar structure, classical register.",
};

// Core rules shared across all intensity levels
const CAVEMAN_BASE_RULES = `Respond terse like smart caveman. All technical substance stay. Only fluff die.

## Persistence
ACTIVE EVERY RESPONSE. No revert after many turns. No filler drift. Still active if unsure. Off only: "stop caveman" / "normal mode".

## Rules
Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Technical terms exact. Code blocks unchanged. Errors quoted exact.

Pattern: [thing] [action] [reason]. [next step].

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use \`<\` not \`<=\`. Fix:"

## Auto-Clarity
Drop caveman when:
- Security warnings
- Irreversible action confirmations
- Multi-step sequences where fragment order or omitted conjunctions risk misread
- Compression itself creates technical ambiguity
- User asks to clarify or repeats question

Resume caveman after clear part done.

## Boundaries
Code/commits/PRs: write normal. "stop caveman" or "normal mode": revert. Level persist until changed or session end.`;

function buildPrompt(mode: CavemanMode): string {
	if (!mode) return "";
	const desc = MODE_DESC[mode] || "";
	return `CAVEMAN MODE ACTIVE — level: ${mode}

${desc}

${CAVEMAN_BASE_RULES}`;
}

export default function cavemanExtension(pi: ExtensionAPI): void {
	let activeMode: CavemanMode = null;

	function updateStatus(ctx: ExtensionContext): void {
		if (activeMode) {
			ctx.ui.setStatus("caveman", `🪨 caveman:${activeMode}`);
		} else {
			ctx.ui.setStatus("caveman", undefined);
		}
	}

	function setMode(mode: CavemanMode, ctx: ExtensionContext): void {
		activeMode = mode;
		updateStatus(ctx);
		persistState();
	}

	function persistState(): void {
		pi.appendEntry("caveman-mode", {
			mode: activeMode,
		});
	}

	// /caveman command
	pi.registerCommand("caveman", {
		description: "Toggle caveman compressed communication mode",
		getArgumentCompletions: (prefix: string) => {
			const options = [
				"lite",
				"full",
				"ultra",
				"wenyan-lite",
				"wenyan-full",
				"wenyan-ultra",
				"off",
			];
			const items = options.map((o) => ({ value: o, label: o }));
			return items.filter((i) => i.value.startsWith(prefix.toLowerCase()));
		},
		handler: async (args, ctx) => {
			if (!args) {
				// No args = show picker, ordered highest compression → lowest
				const order = [
					"ultra",
					"full",
					"lite",
					"wenyan-ultra",
					"wenyan-full",
					"wenyan-lite",
				];
				const options = order.map((m) => ({
					value: m,
					label: MODE_LABEL[m],
				}));

				// If already active, add "off" at the bottom
				if (activeMode) {
					options.push({ value: "off", label: "off" });
				}

				const choice = await ctx.ui.select("Caveman intensity:", options.map((o) => o.label));
				if (!choice) return; // user cancelled

				// Map selected label back to value
				const selected = options.find((o) => o.label === choice)?.value;
				if (!selected) return;

				if (selected === "off") {
					setMode(null, ctx);
					ctx.ui.notify("Caveman mode OFF", "info");
				} else {
					setMode(selected as CavemanMode, ctx);
					ctx.ui.notify(`Caveman mode: ${selected}`, "info");
				}
				return;
			}

			const cmd = args.toLowerCase().trim();

			if (cmd === "off" || cmd === "stop" || cmd === "disable") {
				setMode(null, ctx);
				ctx.ui.notify("Caveman mode OFF", "info");
				return;
			}

			if (VALID_MODES.includes(cmd as CavemanMode)) {
				setMode(cmd as CavemanMode, ctx);
				ctx.ui.notify(`Caveman mode: ${cmd}`, "info");
				return;
			}

			ctx.ui.notify(
				`Unknown mode: ${args}. Valid: lite, full, ultra, wenyan-lite, wenyan-full, wenyan-ultra, off`,
				"error",
			);
		},
	});

	// Inject caveman rules into system prompt every turn
	pi.on("before_agent_start", async (event) => {
		if (!activeMode) return;
		return {
			systemPrompt: event.systemPrompt + "\n\n" + buildPrompt(activeMode),
		};
	});

	// Restore mode from session entries on startup / resume / fork
	pi.on("session_start", async (_event, ctx) => {
		const entries = ctx.sessionManager.getEntries();

		const modeEntry = entries
			.filter(
				(e) =>
					e.type === "custom" &&
					(e as { customType?: string }).customType === "caveman-mode",
			)
			.pop() as { data?: { mode: CavemanMode } } | undefined;

		if (modeEntry?.data) {
			activeMode = modeEntry.data.mode ?? activeMode;
		}

		updateStatus(ctx);
	});
}

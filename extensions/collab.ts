/**
 * Collab Extension for Pi
 *
 * Keeps the agent slower, more interruptible, and user-led during coding sessions.
 *
 * Usage:
 *   /collab          - Toggle collaborative pacing mode (default: steady)
 *   /collab soft     - Light preference: keep things digestible, but do not force pauses
 *   /collab steady   - Default: small steps, progress updates, natural pause points
 *   /collab strict   - Stronger: avoid large one-shot repo analysis; pause after each slice
 *   /collab off      - Disable collaborative pacing mode
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type CollabMode = "soft" | "steady" | "strict" | null;

const VALID_MODES: CollabMode[] = ["soft", "steady", "strict"];

const MODE_LABEL: Record<string, string> = {
	soft: "soft (light preference)",
	steady: "steady (default)",
	strict: "strict (small-slice walkthrough)",
};

const MODE_DESC: Record<string, string> = {
	soft: "Treat this as a gentle collaboration preference. Keep output digestible, but do not over-control the workflow.",
	steady: "Use small steps, brief progress updates, and natural pause points so the user stays in the loop.",
	strict: "Avoid large one-shot analysis. Work one small slice at a time and pause before expanding scope.",
};

const COLLAB_BASE_RULES = `## Collaboration Preference

The user prefers a slower, more collaborative style during coding, debugging, repo exploration, and learning-oriented work.

This is not a rigid teaching script. Do not force quizzes, repeated summaries, or a fixed response template. The user remains in the captain seat.

### Core behavior

- Do not try to understand, modify, or explain the whole project in one large pass unless the user explicitly asks for a full overview.
- Start from the user's requested task and inspect a small, relevant slice first.
- Use the actual files, code, errors, commands, or runtime behavior in front of you.
- Explain only what is useful for the current step.
- Prefer one concept, one path through the code, or one decision at a time.
- Keep final answers digestible. If there is more to say, offer the next useful direction instead of dumping everything.
- Ask questions only when they help the user steer, clarify intent, choose between reasonable paths, or avoid wasted work.
- Share brief progress updates when you discover something useful, when your understanding changes, or when there are multiple possible next steps.
- If the user gives a direct implementation request, do the implementation. Do not turn it into a lesson unless they ask.
- If the user asks to learn or explore, trace concrete paths through the system rather than summarizing the entire architecture.

### Repo exploration bias

When exploring an unfamiliar codebase, prefer "trace one path through the code" over "summarize everything."

Examples:
- Frontend: route/view -> component -> state/data -> styling
- Backend: request -> handler/controller -> service -> database/external API
- CLI: command -> parser -> handler -> output
- Library: public API -> core function -> helper/type -> tests

Adapt to the repository. Do not assume a framework-specific folder structure unless the files show it.

### Compatibility

This preference should compose with other active modes such as terse/compressed response modes. If another mode asks for brevity, remain brief while still keeping the user in the loop.`;

function buildPrompt(mode: CollabMode): string {
	if (!mode) return "";
	const desc = MODE_DESC[mode] || "";

	return `COLLAB MODE ACTIVE — level: ${mode}

${desc}

${COLLAB_BASE_RULES}`;
}

export default function collabExtension(pi: ExtensionAPI): void {
	let activeMode: CollabMode = null;

	function updateStatus(ctx: ExtensionContext): void {
		if (activeMode) {
			ctx.ui.setStatus("collab", `🤝 collab:${activeMode}`);
		} else {
			ctx.ui.setStatus("collab", undefined);
		}
	}

	function persistState(): void {
		pi.appendEntry("collab-mode", {
			mode: activeMode,
		});
	}

	function setMode(mode: CollabMode, ctx: ExtensionContext): void {
		activeMode = mode;
		updateStatus(ctx);
		persistState();
	}

	pi.registerCommand("collab", {
		description: "Toggle collaborative pacing mode",
		getArgumentCompletions: (prefix: string) => {
			const options = ["soft", "steady", "strict", "off"];
			const items = options.map((o) => ({ value: o, label: o }));
			return items.filter((i) => i.value.startsWith(prefix.toLowerCase()));
		},
		handler: async (args, ctx) => {
			if (!args) {
				// No args = show picker, ordered strongest preference → lightest
				const order: CollabMode[] = ["strict", "steady", "soft"];
				const options = order.map((m) => ({
					value: m,
					label: MODE_LABEL[m],
				}));

				// If already active, add "off" at the bottom
				if (activeMode) {
					options.push({ value: "off", label: "off" });
				}

				const choice = await ctx.ui.select("Collab intensity:", options.map((o) => o.label));
				if (!choice) return; // user cancelled

				// Map selected label back to value
				const selected = options.find((o) => o.label === choice)?.value;
				if (!selected) return;

				if (selected === "off") {
					setMode(null, ctx);
					ctx.ui.notify("Collab mode OFF", "info");
				} else {
					setMode(selected as CollabMode, ctx);
					ctx.ui.notify(`Collab mode: ${selected}`, "info");
				}
				return;
			}

			const cmd = args.toLowerCase().trim();

			if (cmd === "off" || cmd === "stop" || cmd === "disable") {
				setMode(null, ctx);
				ctx.ui.notify("Collab mode OFF", "info");
				return;
			}

			if (VALID_MODES.includes(cmd as CollabMode)) {
				setMode(cmd as CollabMode, ctx);
				ctx.ui.notify(`Collab mode: ${cmd}`, "info");
				return;
			}

			ctx.ui.notify("Unknown mode. Valid: soft, steady, strict, off", "error");
		},
	});

	pi.on("before_agent_start", async (event) => {
		if (!activeMode) return;

		return {
			systemPrompt: event.systemPrompt + "\n\n" + buildPrompt(activeMode),
		};
	});

	pi.on("session_start", async (_event, ctx) => {
		const entries = ctx.sessionManager.getEntries();

		const modeEntry = entries
			.filter(
				(e) =>
					e.type === "custom" &&
					(e as { customType?: string }).customType === "collab-mode",
			)
			.pop() as { data?: { mode: CollabMode } } | undefined;

		if (modeEntry?.data) {
			activeMode = modeEntry.data.mode ?? activeMode;
		}

		updateStatus(ctx);
	});
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import { buildPiStartupInput, createForkedSession } from "./lib/fork-utils";

function buildGhosttySplitScript(direction: "right" | "down"): string {
	return `on run argv
	set targetCwd to item 1 of argv
	set startupInput to item 2 of argv
	tell application "Ghostty"
		set cfg to new surface configuration
		set initial working directory of cfg to targetCwd
		set initial input of cfg to startupInput
		if (count of windows) > 0 then
			try
				set frontWindow to front window
				set targetTerminal to focused terminal of selected tab of frontWindow
				split targetTerminal direction ${direction} with configuration cfg
			on error errMsg number errNum
				log "Ghostty split error (" & errNum & "): " & errMsg
				new window with configuration cfg
			end try
		else
			new window with configuration cfg
		end if
		activate
	end tell
end run`;
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand("split-fork", {
		description: "Fork this session into a new pi process in a terminal split. Usage: /split-fork [right|down] [optional prompt]",
		getArgumentCompletions: (prefix: string) => {
			const dirs = ["right", "down"];
			const filtered = dirs.filter((d) => d.startsWith(prefix));
			return filtered.length > 0 ? filtered.map((d) => ({ value: d, label: d })) : null;
		},
		handler: async (args, ctx) => {
			const wasBusy = !ctx.isIdle();
			const trimmed = args.trim();

			// Parse optional direction prefix (right/down) from the prompt
			let direction: "right" | "down";
			let prompt: string;
			const firstWord = trimmed.split(/\s+/)[0];
			if (firstWord === "right" || firstWord === "down") {
				direction = firstWord;
				prompt = trimmed.slice(firstWord.length).trim();
			} else if (trimmed.length === 0 && ctx.hasUI) {
				// No args — show interactive choice
				const choice = await ctx.ui.select("Split direction:", [
					"right — side-by-side (pane to the right)",
					"down  — stacked (pane below)",
				]);
				if (!choice) {
					ctx.ui.notify("Split cancelled.", "info");
					return;
				}
				direction = choice.startsWith("right") ? "right" : "down";
				prompt = "";
			} else {
				direction = "right";
				prompt = trimmed;
			}

			const forkedSessionFile = await createForkedSession(ctx);
			const startupInput = buildPiStartupInput(forkedSessionFile, prompt);

			// Detect environment: Supacode if env var is set, else Ghostty on macOS
			const isSupacode = !!process.env["SUPACODE_SOCKET_PATH"];
			const isGhostty = process.platform === "darwin";

			if (!isSupacode && !isGhostty) {
				ctx.ui.notify("/split-fork requires Supacode terminal or macOS (Ghostty AppleScript).", "error");
				return;
			}

			// Supacode maps right→-d h, down→-d v (h/v are swapped relative to Ghostty)
			const supacodeDir = direction === "right" ? "h" : "v";

			if (isSupacode) {
				const tabId = process.env["SUPACODE_TAB_ID"];
				const surfaceId = process.env["SUPACODE_SURFACE_ID"];
				if (!tabId || !surfaceId) {
					ctx.ui.notify("Supacode TAB_ID and SURFACE_ID not found in environment.", "error");
					return;
				}

				const result = await pi.exec("supacode", [
					"surface", "split",
					"-t", tabId,
					"-s", surfaceId,
					"-d", supacodeDir,
					"-i", startupInput,
				]);

				if (result.code !== 0) {
					const reason = result.stderr?.trim() || result.stdout?.trim() || "unknown error";
					ctx.ui.notify(`Failed to fork via Supacode: ${reason}`, "error");
					if (forkedSessionFile) {
						ctx.ui.notify(`Forked session was created: ${forkedSessionFile}`, "info");
					}
					return;
				}
			} else {
				const ghosttyScript = buildGhosttySplitScript(direction);
				const result = await pi.exec("osascript", ["-e", ghosttyScript, "--", ctx.cwd, startupInput]);
				if (result.code !== 0) {
					const reason = result.stderr?.trim() || result.stdout?.trim() || "unknown osascript error";
					ctx.ui.notify(`Failed to launch Ghostty split: ${reason}`, "error");
					if (forkedSessionFile) {
						ctx.ui.notify(`Forked session was created: ${forkedSessionFile}`, "info");
					}
					return;
				}
			}

			if (forkedSessionFile) {
				const fileName = path.basename(forkedSessionFile);
				const suffix = prompt ? " and sent prompt" : "";
				const backend = isSupacode ? "Supacode" : "Ghostty";
				ctx.ui.notify(`Forked to ${fileName} in a new ${direction} ${backend} split${suffix}.`, "info");
				if (wasBusy) {
					ctx.ui.notify("Forked from current committed state (in-flight turn continues in original session).", "info");
				}
			} else {
				const backend = isSupacode ? "Supacode" : "Ghostty";
				ctx.ui.notify(`Opened a new ${backend} split (no persisted session to fork).`, "warning");
			}
		},
	});
}

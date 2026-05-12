import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import { buildPiStartupInput, createForkedSession } from "./lib/fork-utils";

function buildGhosttyTabScript(): string {
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
				set newTab to new tab in frontWindow with configuration cfg
			on error errMsg number errNum
				log "Ghostty tab error (" & errNum & "): " & errMsg
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
	pi.registerCommand("tab-fork", {
		description: "Fork this session into a new pi process in a new tab. Usage: /tab-fork [optional prompt]",
		handler: async (args, ctx) => {
			const wasBusy = !ctx.isIdle();
			const prompt = args.trim();

			const forkedSessionFile = await createForkedSession(ctx);
			const startupInput = buildPiStartupInput(forkedSessionFile, prompt);

			// Detect environment: Supacode if env var is set, else Ghostty on macOS
			const isSupacode = !!process.env["SUPACODE_SOCKET_PATH"];
			const isGhostty = process.platform === "darwin";

			if (!isSupacode && !isGhostty) {
				ctx.ui.notify("/tab-fork requires Supacode terminal or macOS (Ghostty AppleScript).", "error");
				return;
			}

			if (isSupacode) {
				const result = await pi.exec("supacode", [
					"tab", "new",
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
				const ghosttyScript = buildGhosttyTabScript();
				const result = await pi.exec("osascript", ["-e", ghosttyScript, "--", ctx.cwd, startupInput]);
				if (result.code !== 0) {
					const reason = result.stderr?.trim() || result.stdout?.trim() || "unknown osascript error";
					ctx.ui.notify(`Failed to launch Ghostty tab: ${reason}`, "error");
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
				ctx.ui.notify(`Forked to ${fileName} in a new ${backend} tab${suffix}.`, "info");
				if (wasBusy) {
					ctx.ui.notify("Forked from current committed state (in-flight turn continues in original session).", "info");
				}
			} else {
				const backend = isSupacode ? "Supacode" : "Ghostty";
				ctx.ui.notify(`Opened a new ${backend} tab (no persisted session to fork).`, "warning");
			}
		},
	});
}

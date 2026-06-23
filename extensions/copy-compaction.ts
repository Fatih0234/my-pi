import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface CompactionDetails {
	readFiles?: string[];
	modifiedFiles?: string[];
}

function copyToClipboard(text: string) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn("pbcopy");
		let stderr = "";

		child.stderr.on("data", (chunk) => {
			stderr += String(chunk);
		});

		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(stderr.trim() || `pbcopy exited with code ${code}`));
			}
		});

		child.stdin.end(text);
	});
}

function formatTimestamp(value: unknown): string {
	if (typeof value === "number" && Number.isFinite(value)) {
		return new Date(value).toISOString();
	}
	if (typeof value === "string" && value) {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
	}
	return "unknown";
}

export default function (pi: ExtensionAPI) {
	pi.on("session_compact", async (event, ctx) => {
		const { summary, timestamp, details } = event.compactionEntry;
		const detail = (details ?? {}) as CompactionDetails;
		const readFiles = detail.readFiles ?? [];
		const modifiedFiles = detail.modifiedFiles ?? [];

		const headerLines = [
			"## Compaction Summary",
			`- Date: ${formatTimestamp(timestamp)}`,
			readFiles.length ? `- Files read:\n${readFiles.map((f) => `  - ${f}`).join("\n")}` : null,
			modifiedFiles.length
				? `- Files modified:\n${modifiedFiles.map((f) => `  - ${f}`).join("\n")}`
				: null,
		].filter((line): line is string => line !== null);

		const text = `${headerLines.join("\n")}\n\n${summary}`;

		try {
			await copyToClipboard(text);
			ctx.ui.notify("Compaction summary copied to clipboard", "info");
		} catch (error) {
			ctx.ui.notify(
				`Failed to copy compaction: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
		}
	});
}

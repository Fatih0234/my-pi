/**
 * Lightpanda Browser Extension for pi
 *
 * Integrates Lightpanda (https://lightpanda.io) - a headless browser built
 * from scratch in Zig for AI agents and automation.
 *
 * Features:
 * - Fetch URLs and get content as HTML or Markdown
 * - Start/stop CDP server for browser automation
 * - Execute JavaScript on pages
 * - Low memory footprint, 10x faster than Chrome headless
 *
 * Installation:
 * 1. Install Lightpanda: curl -fsSL https://pkg.lightpanda.io/install.sh | bash
 * 2. This extension will be auto-discovered from ~/.pi/agent/extensions/
 *
 * Usage:
 * - Ask the agent to "fetch https://example.com" or "scrape this URL"
 * - For automation: "start browser automation" then use CDP commands
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text, Container, Spacer } from "@earendil-works/pi-tui";
import { spawn, type ChildProcess } from "node:child_process";
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize } from "@earendil-works/pi-coding-agent";

// Global state for CDP server process
let cdpProcess: ChildProcess | null = null;
let cdpPort = 9222;

interface FetchDetails {
	url: string;
	format: "html" | "markdown";
	success: boolean;
	truncated?: boolean;
	fullOutputPath?: string;
	contentLength?: number;
	error?: string;
}

interface CDPDetails {
	action: "start" | "stop" | "status";
	port: number;
	running: boolean;
	processPid?: number;
	error?: string;
}

/**
 * Check if lightpanda binary is available
 */
async function checkLightpanda(): Promise<{ available: boolean; path?: string; error?: string }> {
	return new Promise((resolve) => {
		const proc = spawn("which", ["lightpanda"], { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		proc.on("close", (code) => {
			if (code === 0 && stdout.trim()) {
				resolve({ available: true, path: stdout.trim() });
			} else {
				resolve({
					available: false,
					error:
						"Lightpanda not found. Install with: curl -fsSL https://pkg.lightpanda.io/install.sh | bash",
				});
			}
		});

		proc.on("error", () => {
			resolve({
				available: false,
				error: "Failed to check for lightpanda binary",
			});
		});
	});
}

/**
 * Fetch a URL using lightpanda
 */
async function fetchUrl(
	url: string,
	format: "html" | "markdown",
	signal?: AbortSignal,
): Promise<{ content: string; details: FetchDetails }> {
	const check = await checkLightpanda();
	if (!check.available) {
		return {
			content: `Error: ${check.error}`,
			details: { url, format, success: false, error: check.error },
		};
	}

	const args = [
		"fetch",
		"--obey-robots",
		"--dump",
		format,
		"--log-format",
		"pretty",
		"--log-level",
		"warn",
		url,
	];

	return new Promise((resolve) => {
		const proc = spawn("lightpanda", args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		const cleanup = () => {
			if (!proc.killed) {
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (!proc.killed) proc.kill("SIGKILL");
				}, 5000);
			}
		};

		if (signal) {
			if (signal.aborted) {
				cleanup();
			} else {
				signal.addEventListener("abort", cleanup, { once: true });
			}
		}

		proc.on("close", async (code) => {
			if (code !== 0) {
				resolve({
					content: `Error fetching ${url}: ${stderr || `exit code ${code}`}`,
					details: {
						url,
						format,
						success: false,
						error: stderr || `Process exited with code ${code}`,
					},
				});
				return;
			}

			// Apply truncation
			const truncation = truncateHead(stdout, {
				maxLines: DEFAULT_MAX_LINES,
				maxBytes: DEFAULT_MAX_BYTES,
			});

			let content = truncation.content;
			let fullOutputPath: string | undefined;

			if (truncation.truncated) {
				// Write full output to temp file
				const tmpFile = `/tmp/lightpanda-${Date.now()}.${format === "markdown" ? "md" : "html"}`;
				const fs = await import("node:fs/promises");
				await fs.writeFile(tmpFile, stdout, "utf8");
				fullOutputPath = tmpFile;

				content += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
				content += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
				content += ` Full output saved to: ${tmpFile}]`;
			}

			resolve({
				content,
				details: {
					url,
					format,
					success: true,
					truncated: truncation.truncated,
					fullOutputPath,
					contentLength: stdout.length,
				},
			});
		});

		proc.on("error", (err) => {
			resolve({
				content: `Failed to spawn lightpanda: ${err.message}`,
				details: { url, format, success: false, error: err.message },
			});
		});
	});
}

/**
 * Start CDP server
 */
async function startCDP(port: number): Promise<CDPDetails> {
	const check = await checkLightpanda();
	if (!check.available) {
		return { action: "start", port, running: false, error: check.error };
	}

	if (cdpProcess && !cdpProcess.killed) {
		return { action: "start", port: cdpPort, running: true, processPid: cdpProcess.pid };
	}

	return new Promise((resolve) => {
		const args = [
			"serve",
			"--obey-robots",
			"--log-format",
			"pretty",
			"--log-level",
			"info",
			"--host",
			"127.0.0.1",
			"--port",
			port.toString(),
		];

		const proc = spawn("lightpanda", args, {
			stdio: ["ignore", "pipe", "pipe"],
			detached: false,
		});

		cdpProcess = proc;
		cdpPort = port;

		let stderr = "";
		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		// Give it a moment to start
		setTimeout(() => {
			if (proc.killed) {
				resolve({
					action: "start",
					port,
					running: false,
					error: `Server failed to start: ${stderr || "process exited early"}`,
				});
			} else {
				resolve({
					action: "start",
					port,
					running: true,
					processPid: proc.pid,
				});
			}
		}, 1000);

		proc.on("close", (code) => {
			if (code !== 0 && code !== null) {
				console.error(`Lightpanda CDP server exited with code ${code}: ${stderr}`);
			}
			cdpProcess = null;
		});

		proc.on("error", (err) => {
			cdpProcess = null;
			resolve({ action: "start", port, running: false, error: err.message });
		});
	});
}

/**
 * Stop CDP server
 */
async function stopCDP(): Promise<CDPDetails> {
	if (!cdpProcess || cdpProcess.killed) {
		return { action: "stop", port: cdpPort, running: false };
	}

	const pid = cdpProcess.pid;
	cdpProcess.kill("SIGTERM");

	// Give it 5 seconds to terminate gracefully
	setTimeout(() => {
		if (cdpProcess && !cdpProcess.killed) {
			cdpProcess.kill("SIGKILL");
		}
	}, 5000);

	return { action: "stop", port: cdpPort, running: false, processPid: pid };
}

/**
 * Get CDP server status
 */
async function getCDPStatus(): Promise<CDPDetails> {
	const running = cdpProcess !== null && !cdpProcess.killed;
	return {
		action: "status",
		port: cdpPort,
		running,
		processPid: running ? cdpProcess!.pid : undefined,
	};
}

export default function (pi: ExtensionAPI) {
	// Cleanup on shutdown
	pi.on("session_shutdown", async () => {
		if (cdpProcess && !cdpProcess.killed) {
			cdpProcess.kill("SIGTERM");
			setTimeout(() => {
				if (cdpProcess && !cdpProcess.killed) {
					cdpProcess.kill("SIGKILL");
				}
			}, 2000);
		}
	});

	// Register lightpanda_fetch tool
	pi.registerTool({
		name: "lightpanda_fetch",
		label: "Lightpanda Fetch",
		description: [
			"Fetch a URL and return the page content using Lightpanda browser.",
			"Returns content as HTML or Markdown. Respects robots.txt by default.",
			"Use this for web scraping, getting page content, or extracting text from websites.",
			"10x faster and 10x less memory than Chrome headless.",
		].join(" "),
		promptSnippet: "Fetch and extract content from a URL",
		promptGuidelines: [
			"Use lightpanda_fetch when you need to scrape web pages or extract content from URLs.",
			"Prefer 'markdown' format for readable text extraction, 'html' for raw content.",
			"The tool respects robots.txt automatically.",
		],
		parameters: Type.Object({
			url: Type.String({
				description: "URL to fetch (must include http:// or https://)",
			}),
			format: StringEnum(["html", "markdown"] as const, {
				description: "Output format: 'html' for raw HTML, 'markdown' for cleaned text",
				default: "markdown",
			}),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
			const result = await fetchUrl(params.url, params.format ?? "markdown", signal);
			return {
				content: [{ type: "text", text: result.content }],
				details: result.details,
			};
		},

		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("lightpanda_fetch "));
			text += theme.fg("accent", args.url);
			if (args.format) {
				text += ` ${theme.fg("muted", `(${args.format})`)}`;
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			const details = result.details as FetchDetails | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (!details.success) {
				return new Text(theme.fg("error", `✗ ${details.error || "Fetch failed"}`), 0, 0);
			}

			let text = theme.fg("success", "✓ Fetched ") + theme.fg("accent", details.url);
			if (details.format) {
				text += theme.fg("muted", ` (${details.format})`);
			}
			if (details.contentLength) {
				text += theme.fg("dim", ` - ${formatSize(details.contentLength)}`);
			}
			if (details.truncated) {
				text += theme.fg("warning", " [truncated]");
			}
			if (expanded && details.fullOutputPath) {
				text += `\n${theme.fg("dim", `Full output: ${details.fullOutputPath}`)}`;
			}
			return new Text(text, 0, 0);
		},
	});

	// Register lightpanda_cdp tool
	pi.registerTool({
		name: "lightpanda_cdp",
		label: "Lightpanda CDP",
		description: [
			"Control the Lightpanda CDP (Chrome DevTools Protocol) server.",
			"Actions: start (begins server on a port), stop (shuts down server), status (check if running).",
			"Once running, use Puppeteer/Playwright to connect to ws://127.0.0.1:PORT.",
			"CDP server enables advanced browser automation: clicking, form filling, screenshots, etc.",
		].join(" "),
		promptSnippet: "Start or stop the Lightpanda CDP server for browser automation",
		promptGuidelines: [
			"Use lightpanda_cdp with action 'start' before browser automation tasks.",
			"Default port is 9222. Connect Puppeteer/Playwright to ws://127.0.0.1:9222.",
			"Stop the server when done to free resources.",
		],
		parameters: Type.Object({
			action: StringEnum(["start", "stop", "status"] as const, {
				description: "Action to perform on the CDP server",
			}),
			port: Type.Optional(
				Type.Number({
					description: "Port for CDP server (default: 9222)",
					default: 9222,
				}),
			),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const port = params.port ?? 9222;

			switch (params.action) {
				case "start": {
					const details = await startCDP(port);
					return {
						content: [
							{
								type: "text",
								text: details.running
									? `CDP server started on ws://127.0.0.1:${details.port}`
									: `Failed to start CDP server: ${details.error}`,
							},
						],
						details,
						isError: !details.running,
					};
				}

				case "stop": {
					const details = await stopCDP();
					return {
						content: [
							{
								type: "text",
								text: details.processPid
									? `CDP server stopped (PID ${details.processPid})`
									: "CDP server was not running",
							},
						],
						details,
					};
				}

				case "status": {
					const details = await getCDPStatus();
					return {
						content: [
							{
								type: "text",
								text: details.running
									? `CDP server running on ws://127.0.0.1:${details.port} (PID ${details.processPid})`
									: "CDP server is not running",
							},
						],
						details,
					};
				}

				default:
					return {
						content: [{ type: "text", text: `Unknown action: ${params.action}` }],
						details: { action: params.action, port, running: false, error: "unknown action" },
						isError: true,
					};
			}
		},

		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("lightpanda_cdp "));
			text += theme.fg("accent", args.action);
			if (args.port && args.port !== 9222) {
				text += ` ${theme.fg("muted", `port ${args.port}`)}`;
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as CDPDetails | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `✗ ${details.error}`), 0, 0);
			}

			const icon = details.running ? theme.fg("success", "●") : theme.fg("dim", "○");
			let text = `${icon} ${theme.fg("toolTitle", theme.bold("CDP "))}`;
			text += details.running
				? theme.fg("success", `running on port ${details.port}`)
				: theme.fg("muted", "stopped");
			if (details.processPid) {
				text += theme.fg("dim", ` (PID ${details.processPid})`);
			}
			return new Text(text, 0, 0);
		},
	});

	// Register a command to check Lightpanda status
	pi.registerCommand("lightpanda", {
		description: "Check Lightpanda browser installation status",
		handler: async (_args, ctx) => {
			const check = await checkLightpanda();
			if (check.available) {
				ctx.ui.notify(`Lightpanda found at: ${check.path}`, "success");
			} else {
				ctx.ui.notify(check.error || "Lightpanda not found", "error");
			}
		},
	});

	// Check installation on startup and notify
	pi.on("session_start", async (_event, ctx) => {
		const check = await checkLightpanda();
		if (!check.available && ctx.hasUI) {
			ctx.ui.notify("Lightpanda not installed. Run: curl -fsSL https://pkg.lightpanda.io/install.sh | bash", "warning");
		}
	});
}

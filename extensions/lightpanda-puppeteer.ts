/**
 * Lightpanda + Puppeteer Advanced Integration for pi
 *
 * This extension provides high-level browser automation tools using
 * Lightpanda's CDP server with Puppeteer.
 *
 * Prerequisites:
 * 1. Install Lightpanda: curl -fsSL https://pkg.lightpanda.io/install.sh | bash
 * 2. Install Puppeteer: npm install puppeteer-core
 *
 * This extension requires a package.json with puppeteer-core dependency.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

// Dynamic import of puppeteer (only when needed)
let puppeteer: any = null;

async function getPuppeteer() {
	if (!puppeteer) {
		try {
			puppeteer = await import("puppeteer-core");
		} catch {
			throw new Error(
				"puppeteer-core not found. Install with: npm install puppeteer-core"
			);
		}
	}
	return puppeteer;
}

// Browser instance cache
let browserInstance: any = null;
let browserWSEndpoint: string = "ws://127.0.0.1:9222";

interface BrowserDetails {
	action: string;
	url?: string;
	selector?: string;
	result?: any;
	success: boolean;
	error?: string;
}

export default function (pi: ExtensionAPI) {
	// Register browser automation tool
	pi.registerTool({
		name: "browser_automate",
		label: "Browser Automate",
		description: [
			"Advanced browser automation using Lightpanda + Puppeteer.",
			"Actions: navigate (goto URL), click (click element), type (input text),",
			"extract (get text/content), screenshot (save image), evaluate (run JS).",
			"Requires Lightpanda CDP server to be running (use lightpanda_cdp to start).",
		].join(" "),
		parameters: Type.Object({
			action: StringEnum(
				["navigate", "click", "type", "extract", "screenshot", "evaluate"] as const,
				{ description: "Automation action to perform" }
			),
			url: Type.Optional(Type.String({ description: "URL for navigate action" })),
			selector: Type.Optional(Type.String({ description: "CSS selector for click/type/extract" })),
			text: Type.Optional(Type.String({ description: "Text to type for type action" })),
			script: Type.Optional(Type.String({ description: "JavaScript code for evaluate action" })),
			wsEndpoint: Type.Optional(
				Type.String({
					description: "WebSocket endpoint for CDP server (default: ws://127.0.0.1:9222)",
					default: "ws://127.0.0.1:9222",
				})
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate, _ctx) {
			const endpoint = params.wsEndpoint || "ws://127.0.0.1:9222";

			try {
				const pptr = await getPuppeteer();

				// Connect or reuse browser
				if (!browserInstance || browserWSEndpoint !== endpoint) {
					onUpdate?.({ content: [{ type: "text", text: "Connecting to Lightpanda..." }] });
					browserInstance = await pptr.connect({ browserWSEndpoint: endpoint });
					browserWSEndpoint = endpoint;
				}

				const context = await browserInstance.createBrowserContext();
				const page = await context.newPage();

				onUpdate?.({ content: [{ type: "text", text: `Performing ${params.action}...` }] });

				let result: any = null;

				switch (params.action) {
					case "navigate": {
						if (!params.url) throw new Error("URL required for navigate");
						await page.goto(params.url, { waitUntil: "networkidle0" });
						result = { url: params.url, title: await page.title() };
						break;
					}

					case "click": {
						if (!params.selector) throw new Error("Selector required for click");
						await page.click(params.selector);
						result = { clicked: params.selector };
						break;
					}

					case "type": {
						if (!params.selector) throw new Error("Selector required for type");
						if (!params.text) throw new Error("Text required for type");
						await page.type(params.selector, params.text);
						result = { typed: params.text, into: params.selector };
						break;
					}

					case "extract": {
						if (!params.selector) throw new Error("Selector required for extract");
						const text = await page.evaluate((sel: string) => {
							const el = document.querySelector(sel);
							return el ? el.textContent : null;
						}, params.selector);
						result = { selector: params.selector, text };
						break;
					}

					case "screenshot": {
						const path = `/tmp/lightpanda-screenshot-${Date.now()}.png`;
						await page.screenshot({ path });
						result = { path };
						break;
					}

					case "evaluate": {
						if (!params.script) throw new Error("Script required for evaluate");
						const evalResult = await page.evaluate(params.script);
						result = { script: params.script, result: evalResult };
						break;
					}

					default:
						throw new Error(`Unknown action: ${params.action}`);
				}

				await page.close();
				await context.close();

				const resultText = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);

				return {
					content: [{ type: "text", text: resultText }],
					details: { action: params.action, result, success: true } as BrowserDetails,
				};
			} catch (err: any) {
				return {
					content: [{ type: "text", text: `Browser automation failed: ${err.message}` }],
					details: {
						action: params.action,
						success: false,
						error: err.message,
					} as BrowserDetails,
					isError: true,
				};
			}
		},

		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("browser_automate "));
			text += theme.fg("accent", args.action);
			if (args.url) text += ` ${theme.fg("muted", args.url)}`;
			if (args.selector) text += ` ${theme.fg("dim", args.selector)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as BrowserDetails | undefined;
			if (!details?.success) {
				return new Text(theme.fg("error", `✗ ${details?.error || "Automation failed"}`), 0, 0);
			}
			return new Text(theme.fg("success", "✓ Completed ") + theme.fg("muted", details.action), 0, 0);
		},
	});

	// Cleanup on shutdown
	pi.on("session_shutdown", async () => {
		if (browserInstance) {
			await browserInstance.disconnect();
			browserInstance = null;
		}
	});
}

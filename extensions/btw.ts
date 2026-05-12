/**
 * BTW Mode A — Cache-friendly exact replay side-question extension for Pi Coding Agent.
 *
 * Mode A preserves the main agent's exact LLM message prefix for maximum provider
 * prompt-cache reuse. Instead of sanitizing messages into a plain transcript, it
 * passes the unchanged provider messages to a shadow Agent and appends only the
 * side-question user message. The system prompt is kept identical to the main
 * agent's (user-only strategy) so the cache prefix is maximally shared.
 *
 * Spec: /Volumes/T7/learning/pi-try-error/pi-btw-spec.md
 *
 * ── Design decisions ────────────────────────────────────────────────────────
 * - Uses `Agent` from @earendil-works/pi-agent-core (full agent path per user req)
 * - `cacheRetention: "short"` for speed/cost balance (NOT "none" like old impl)
 * - `sessionId` matches main session for cache affinity
 * - `tools: []` / abort on any toolcall event (one-answer-only)
 * - System prompt strategy: `user-only` — keeps exact main prompt, puts all
 *   safety instructions in the final side-question user message (max cache reuse)
 * - Model strategy: configurable via /btw-settings (`same-as-main` or custom)
 * - Reasoning: configurable via /btw-settings (`off` default for speed/cost)
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildSessionContext, convertToLlm, getAgentDir, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { streamSimple, type Api, type Message, type Model, type UserMessage } from "@earendil-works/pi-ai";
import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import {
	Container,
	Input,
	Key,
	Markdown,
	matchesKey,
	SelectList,
	SettingsList,
	Spacer,
	Text,
	truncateToWidth,
	wrapTextWithAnsi,
	fuzzyFilter,
} from "@earendil-works/pi-tui";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { Component, MarkdownTheme, SelectItem, SelectListTheme, SettingItem, SettingsListTheme, TUI } from "@earendil-works/pi-tui";

// ── Settings ────────────────────────────────────────────────────────────────

export interface BtwSettings {
	/** Model selection strategy. */
	modelStrategy: "same-as-main" | "custom";
	/** Provider name when using custom model. */
	customProvider?: string;
	/** Model ID when using custom model. */
	customModelId?: string;
	/** Reasoning level for /btw shadow agent. */
	reasoning: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	/** Maximum output tokens. */
	maxTokens: number;
	/** Internal prompt cache retention policy. Kept short for /btw's ephemeral side-question behavior. */
	cacheRetention: "short";
}

const DEFAULT_SETTINGS: BtwSettings = {
	modelStrategy: "same-as-main",
	reasoning: "off",
	maxTokens: 500,
	cacheRetention: "short",
};

const REASONING_LEVELS: BtwSettings["reasoning"][] = ["off", "minimal", "low", "medium", "high", "xhigh"];
const MAX_TOKENS_OPTIONS = [250, 500, 1000, 2000, 4000];

let btwSettings: BtwSettings = { ...DEFAULT_SETTINGS };

function getSettings(): BtwSettings {
	return btwSettings;
}

function setSettings(next: Partial<BtwSettings>): void {
	btwSettings = { ...btwSettings, ...next };
}

function settingsToEntry(): BtwSettings {
	return { ...btwSettings };
}

function settingsFromEntry(data: unknown): BtwSettings {
	if (!data || typeof data !== "object") return { ...DEFAULT_SETTINGS };
	const d = data as Record<string, unknown>;
	return {
		modelStrategy: d.modelStrategy === "custom" ? "custom" : "same-as-main",
		customProvider: typeof d.customProvider === "string" ? d.customProvider : undefined,
		customModelId: typeof d.customModelId === "string" ? d.customModelId : undefined,
		reasoning: REASONING_LEVELS.includes(d.reasoning as any) ? (d.reasoning as BtwSettings["reasoning"]) : "off",
		maxTokens: MAX_TOKENS_OPTIONS.includes(d.maxTokens as any) ? (d.maxTokens as number) : 500,
		cacheRetention: "short",
	};
}

/** User-wide settings file. Session entries still mirror settings for resume/fork history. */
function getGlobalSettingsPath(): string {
	return join(getAgentDir(), "btw-settings.json");
}

function loadGlobalSettings(): BtwSettings {
	try {
		return settingsFromEntry(JSON.parse(readFileSync(getGlobalSettingsPath(), "utf8")));
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

function saveGlobalSettings(settings: BtwSettings): void {
	const file = getGlobalSettingsPath();
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

// ── Configuration constants (non-tunable) ───────────────────────────────────

/**
 * System prompt strategy for maximum cache reuse.
 *
 * - "user-only": keep system prompt identical to main agent; put all /btw safety
 *   instructions in the final side-question user message. Best cache reuse.
 * - "append-system": append /btw instructions to the main system prompt. Safer
 *   but may reduce cache hit rate.
 */
const BTW_SYSTEM_STRATEGY: "user-only" | "append-system" = "user-only";

/** Fallback system prompt if none is available. */
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

// ── Usage telemetry helpers ─────────────────────────────────────────────────

type BtwUsage = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalCost: number;
};

function formatTokens(n: number): string {
	if (n < 1000) return String(n);
	if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
	if (n < 1000000) return `${Math.round(n / 1000)}k`;
	return `${(n / 1000000).toFixed(1)}M`;
}

// ── Side-question user message ──────────────────────────────────────────────

/**
 * Build the final side-question user message.
 * All /btw safety instructions are embedded here (user-only strategy).
 */
function buildSideQuestion(question: string): UserMessage {
	return {
		role: "user",
		timestamp: Date.now(),
		content: `Ephemeral /btw side question. Answer briefly using only the prior conversation context. You have no tools and must not call, request, simulate, or output tool calls. Do not continue the main coding task. If the answer is not in the context, say that briefly.\n\nQuestion: ${question}`,
	};
}

// ── Appended system-prompt instruction (append-system strategy) ─────────────

const BTW_SIDE_PROMPT_APPEND = `

You are currently answering an ephemeral /btw side question.
For this response only:
- Answer only the final side question using the prior conversation context.
- You are not the main coding agent and must not continue the main task.
- You have no tools. Do not call, request, simulate, or output tool calls.
- If the context is insufficient, say so briefly.
- Keep the answer concise unless the user asks for detail.`;

// ── Above-editor widget component ───────────────────────────────────────────

type StreamStatus = "loading" | "streaming" | "done" | "error";

class BtwWidget implements Component {
	private status: StreamStatus = "loading";
	private answerText = "";
	private errorMessage = "";
	private dismissed = false;
	private md: Markdown;
	private animationFrame = 0;
	private animationTimer: ReturnType<typeof setInterval>;
	private usage?: BtwUsage;
	private pendingDelta = "";
	private flushTimer?: ReturnType<typeof setTimeout>;

	constructor(
		private tui: TUI,
		private theme: { fg: (c: string, t: string) => string },
		readonly question: string,
		private mdTheme: MarkdownTheme,
		private modelLabel: string,
		private activeStatus: string,
		private onStatusChange?: (status: string | undefined) => void,
	) {
		this.md = new Markdown("", 2, 0, mdTheme);
		if (this.activeStatus) {
			this.onStatusChange?.(this.activeStatus);
		}
		this.animationTimer = setInterval(() => {
			if (this.dismissed || (this.status !== "loading" && this.status !== "streaming")) return;
			this.animationFrame++;
			this.tui.requestRender();
		}, 180);
	}

	appendText(delta: string): void {
		if (this.dismissed) return;
		if (this.status === "loading") this.status = "streaming";
		this.pendingDelta += delta;
		if (!this.flushTimer) {
			this.flushTimer = setTimeout(() => this.flushPendingText(), 60);
		}
	}

	private flushPendingText(): void {
		this.answerText += this.pendingDelta;
		this.pendingDelta = "";
		this.flushTimer = undefined;
		this.md.setText(this.answerText);
		this.tui.requestRender();
	}

	private cancelPendingFlush(): void {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = undefined;
		}
		this.pendingDelta = "";
	}

	setAnswer(text: string): void {
		if (this.dismissed) return;
		this.cancelPendingFlush();
		this.status = "done";
		this.answerText = text;
		this.md.setText(this.answerText);
		this.onStatusChange?.(undefined);
		this.tui.requestRender();
	}

	setDone(): void {
		if (this.dismissed) return;
		this.flushPendingText();
		if (this.status !== "error") this.status = "done";
		this.md.setText(this.answerText);
		this.onStatusChange?.(undefined);
		this.tui.requestRender();
	}

	setError(msg: string): void {
		if (this.dismissed) return;
		this.cancelPendingFlush();
		this.status = "error";
		this.errorMessage = msg;
		this.onStatusChange?.(undefined);
		this.tui.requestRender();
	}

	setUsage(usage: BtwUsage): void {
		if (this.dismissed) return;
		this.usage = usage;
		this.tui.requestRender();
	}

	dismiss(): void {
		this.dismissed = true;
		clearInterval(this.animationTimer);
		this.cancelPendingFlush();
		this.onStatusChange?.(undefined);
	}

	get isDismissed(): boolean {
		return this.dismissed;
	}

	render(width: number): string[] {
		const T = this.theme;
		const lines: string[] = [];
		const safeWidth = Math.max(20, width);

		if (this.question) {
			lines.push(truncateToWidth(`${T.fg("accent", "/btw")} ${T.fg("dim", this.question)}`, safeWidth, "…"));
		} else {
			lines.push(T.fg("accent", "/btw"));
		}
		lines.push("");

		const isActive = this.status === "loading" || this.status === "streaming";
		if (isActive) {
			lines.push(truncateToWidth(`  ${T.fg("warning", `${this.renderPiPulse()} answering · ${this.modelLabel}`)}`, safeWidth, "…"));
			lines.push("");
		} else if (this.status === "error") {
			lines.push(truncateToWidth(T.fg("error", "✗ Error"), safeWidth, "…"));
			lines.push("");
		}

		if (this.status === "error") {
			const message = this.errorMessage || "Something went wrong";
			const errorLines = message.split("\n").flatMap((line) => wrapTextWithAnsi(line, safeWidth - 4));
			for (let i = 0; i < errorLines.length; i++) {
				const prefix = i === 0 ? "⚠️  " : "    ";
				lines.push(truncateToWidth(prefix + errorLines[i], safeWidth, "…"));
			}
		} else if (!this.answerText) {
			lines.push("");
		} else {
			const mdLines = this.md.render(safeWidth);
			for (const line of mdLines) lines.push(truncateToWidth(line, safeWidth, ""));
		}

		if (this.usage && this.status !== "error") {
			const parts: string[] = [];
			parts.push(`cache R${formatTokens(this.usage.cacheRead)} W${formatTokens(this.usage.cacheWrite)}`);
			if (this.usage.input > 0) parts.push(`in ${formatTokens(this.usage.input)}`);
			if (this.usage.output > 0) parts.push(`out ${formatTokens(this.usage.output)}`);
			if (this.usage.totalCost > 0) parts.push(`$${this.usage.totalCost.toFixed(3)}`);
			lines.push("");
			lines.push(T.fg("dim", truncateToWidth(parts.join(" · "), safeWidth, "…")));
		}

		lines.push("");
		lines.push(T.fg("dim", truncateToWidth("Press Space, Enter, or Escape to dismiss", safeWidth, "…")));

		return lines.map((line) => truncateToWidth(line, safeWidth, ""));
	}

	invalidate(): void {
		this.md = new Markdown(this.answerText, 2, 0, this.mdTheme);
	}

	private renderPiPulse(): string {
		const frames = ["π", "∙π", "∙π∙", " π ", "∙π∙", "∙π"];
		return frames[this.animationFrame % frames.length];
	}

	dispose(): void {
		this.dismiss();
	}
}

// ── Widget mounting / dismissal ─────────────────────────────────────────────

function mountBtwWidget(
	ctx: ExtensionContext,
	question: string,
	mdTheme: MarkdownTheme,
	modelLabel = "",
	activeStatus = "",
	onDismiss?: () => void,
): { widget: BtwWidget } {
	let widget: BtwWidget | undefined;
	let closed = false;
	let unsubscribe: (() => void) | undefined;

	const close = () => {
		if (closed) return;
		closed = true;
		widget?.dismiss();
		onDismiss?.();
		ctx.ui.setWidget("btw", undefined);
		unsubscribe?.();
		btwActive = false;
	};

	ctx.ui.setWidget(
		"btw",
		(tui, theme) => {
			widget = new BtwWidget(
				tui,
				theme as { fg: (c: string, t: string) => string },
				question,
				mdTheme,
				modelLabel,
				activeStatus,
				(status) => ctx.ui.setStatus("btw", status),
			);
			return widget;
		},
		{ placement: "aboveEditor" },
	);

	unsubscribe = ctx.ui.onTerminalInput((data) => {
		if (!btwActive) return undefined;
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
			close();
			return { consume: true };
		}
		return undefined;
	});

	if (!widget) {
		throw new Error("Failed to mount /btw widget");
	}
	return { widget };
}

function showErrorWidget(ctx: ExtensionContext, question: string, message: string, mdTheme: MarkdownTheme): void {
	const { widget } = mountBtwWidget(ctx, question, mdTheme, "", "");
	widget.setError(message);
}

// ── Mode A: Cache-friendly exact replay ─────────────────────────────────────

/**
 * Check whether a message sequence is safe for no-tools exact replay.
 *
 * Rules:
 * 1. Empty context is safe.
 * 2. Last LLM message must not contain toolCall blocks.
 * 3. Every assistant toolCall id must be matched by a later toolResult.
 * 4. A toolResult must not appear without a matching assistant toolCall id.
 */
function isProviderSafeForNoToolsExactReplay(messages: Message[]): boolean {
	const pending = new Set<string>();
	const seenToolCalls = new Set<string>();

	for (const message of messages) {
		if (message.role === "assistant") {
			for (const block of message.content) {
				if (block.type === "toolCall") {
					if (!block.id) return false;
					pending.add(block.id);
					seenToolCalls.add(block.id);
				}
			}
		}

		if (message.role === "toolResult") {
			if (!seenToolCalls.has(message.toolCallId)) return false;
			pending.delete(message.toolCallId);
		}
	}

	const last = messages[messages.length - 1];
	if (last?.role === "assistant" && last.content.some((b) => b.type === "toolCall")) return false;

	return pending.size === 0;
}

/**
 * Build the current session messages from the session manager.
 * Produces LLM-ready Message[] via buildSessionContext + convertToLlm.
 */
function buildCurrentSessionMessages(ctx: ExtensionContext): Message[] {
	try {
		const entries = ctx.sessionManager.getEntries();
		const leafId = ctx.sessionManager.getLeafId();
		const sessionCtx = buildSessionContext(entries, leafId);
		return convertToLlm(sessionCtx.messages);
	} catch {
		return [];
	}
}

/**
 * Pick the best Mode A message candidate.
 *
 * Preference order when idle:
 * 1. Current session branch messages (freshest, fully synced with provider cache)
 * 2. Latest provider messages (from `context` event)
 *
 * Preference order when active:
 * 1. Latest provider messages (last cached provider snapshot — avoids uncached
 *    in-progress state from the live session)
 * 2. Current session branch messages
 *
 * Both must pass the validity check before use.
 */
function chooseModeAMessages(
	sessionMessages: Message[],
	providerMessages: Message[],
	isIdle: boolean,
): { messages: Message[]; source: "session" | "provider" } | null {
	if (isIdle) {
		if (sessionMessages.length > 0 && isProviderSafeForNoToolsExactReplay(sessionMessages)) {
			return { messages: sessionMessages, source: "session" };
		}
		if (providerMessages.length > 0 && isProviderSafeForNoToolsExactReplay(providerMessages)) {
			return { messages: providerMessages, source: "provider" };
		}
	} else {
		if (providerMessages.length > 0 && isProviderSafeForNoToolsExactReplay(providerMessages)) {
			return { messages: providerMessages, source: "provider" };
		}
		if (sessionMessages.length > 0 && isProviderSafeForNoToolsExactReplay(sessionMessages)) {
			return { messages: sessionMessages, source: "session" };
		}
	}

	return null;
}

// ── Fake tool-call guard ────────────────────────────────────────────────────

/**
 * Detect model output that is trying to continue/simulate a tool call
 * despite tools: [] — a textual artifact from the context history.
 */
function looksLikeToolCall(text: string): boolean {
	const sample = text.trimStart().slice(0, 2000).toLowerCase();
	return (
		/<\/?tool[_-]?call\b/.test(sample) ||
		/<｜tool/.test(sample) ||
		/assistant called tool\s+\w+\s+with input/.test(sample) ||
		/^\{\s*"(?:command|tool|tool_name|name|arguments|input)"\s*:/.test(sample) ||
		/^```(?:json)?\s*\{\s*"(?:command|tool|tool_name|name|arguments|input)"\s*:/.test(sample)
	);
}

function toolCallFallbackAnswer(): string {
	return "I can't use or simulate tools from `/btw`. Based on the provided session snapshot, I don't have enough reliable context to answer without doing that.";
}

function formatBtwProviderError(model: Model<Api>, rawError: string | undefined, stopReason: string = "error"): string {
	const modelName = `${model.provider}/${model.id}`;
	const raw = (rawError || (stopReason === "aborted" ? "Request was aborted" : "Unknown provider error")).trim();
	const lower = raw.toLowerCase();

	let summary = `The /btw model ${modelName} failed before returning an answer.`;
	let suggestion = "Try again, or choose another model in /btw-settings.";

	if (stopReason === "aborted") {
		summary = `The /btw request to ${modelName} was aborted.`;
		suggestion = "Run /btw again if you still want the side answer.";
	} else if (/no api key|api key|unauthorized|authentication|auth|401|403|forbidden|invalid.*key/.test(lower)) {
		summary = `The /btw model ${modelName} could not authenticate.`;
		suggestion = `Run /login ${model.provider}, or pick a different model in /btw-settings.`;
	} else if (/rate.?limit|429|quota|billing|insufficient|credits?|too many requests/.test(lower)) {
		summary = `The provider rejected ${modelName} because of rate limit, quota, or billing limits.`;
		suggestion = "Try again later, use Same as main session, or pick another model in /btw-settings.";
	} else if (/overloaded|unavailable|timeout|timed out|fetch failed|network|connection|502|503|504|500/.test(lower)) {
		summary = `The provider for ${modelName} is unavailable or unreachable right now.`;
		suggestion = "Try again later or choose a different /btw model.";
	} else if (/context|token|too long|maximum|overflow/.test(lower)) {
		summary = `The current session context was too large for ${modelName}.`;
		suggestion = "Choose a larger-context model, compact the session, or ask after the main turn finishes.";
	}

	return `${summary}\n${suggestion}\n\nProvider said: ${truncateToWidth(raw.replace(/\s+/g, " "), 220, "…")}`;
}

function getAssistantFailure(message: AgentMessage): { stopReason: "error" | "aborted"; errorMessage?: string } | undefined {
	if (message.role !== "assistant") return undefined;
	const assistant = message as Message & { role: "assistant" };
	if (assistant.stopReason === "error" || assistant.stopReason === "aborted") {
		return { stopReason: assistant.stopReason, errorMessage: assistant.errorMessage };
	}
	return undefined;
}

// ── Model resolution ────────────────────────────────────────────────────────

function resolveBtwModel(ctx: ExtensionContext, settings: BtwSettings = getSettings()): Model<Api> | undefined {
	if (settings.modelStrategy === "same-as-main") {
		return ctx.model;
	}
	if (settings.customProvider && settings.customModelId) {
		return ctx.modelRegistry.find(settings.customProvider, settings.customModelId) ?? ctx.model;
	}
	return ctx.model;
}

// ── Build system prompt ─────────────────────────────────────────────────────

function buildBtwSystemPrompt(mainSystemPrompt: string): string {
	if (BTW_SYSTEM_STRATEGY === "append-system") {
		return `${mainSystemPrompt}${BTW_SIDE_PROMPT_APPEND}`;
	}
	return mainSystemPrompt;
}

// ── Shadow Agent runner ─────────────────────────────────────────────────────

/**
 * Run a one-shot shadow Agent for the /btw question.
 *
 * The shadow agent:
 * - Receives the exact main-provider message prefix (Mode A) for cache reuse
 * - Has `tools: []` — no tool access
 * - Uses configured cacheRetention and sessionId for cache affinity
 * - Streams text into the widget via `agent.subscribe()`
 * - Aborts on any toolcall event (one-answer-only enforcement)
 * - Does NOT persist to session — ephemeral by design
 */
async function runBtwShadowAgent(
	ctx: ExtensionContext,
	model: Model<Api>,
	systemPrompt: string,
	modeMessages: Message[],
	question: string,
	auth: { ok: true; apiKey: string; headers?: Record<string, string> },
	widget: BtwWidget,
	abortController: AbortController,
): Promise<void> {
	const settings = getSettings();
	const reasoning = settings.reasoning !== "off" && model.reasoning ? settings.reasoning : undefined;
	const sideQuestionMessage = buildSideQuestion(question);

	const shadow = new Agent({
		initialState: {
			systemPrompt,
			model,
			tools: [],
			messages: modeMessages as AgentMessage[],
			...(reasoning ? { thinkingLevel: reasoning } : {}),
		},
		convertToLlm: (messages) => messages as Message[],
		streamFn: async (m, context, options) => {
			return streamSimple(m, { ...context, tools: [] }, {
				...options,
				apiKey: auth.apiKey,
				headers: auth.headers,
				cacheRetention: settings.cacheRetention,
				sessionId: ctx.sessionManager.getSessionId(),
				maxTokens: settings.maxTokens,
				...(reasoning ? { reasoning } : {}),
				onPayload(payload) {
					if (payload && typeof payload === "object") {
						delete (payload as Record<string, unknown>).tool_choice;
						delete (payload as Record<string, unknown>).parallel_tool_calls;
					}
					return payload;
				},
			});
		},
		sessionId: ctx.sessionManager.getSessionId(),
	});

	let accumulatedText = "";
	let toolCallDetected = false;
	let agentEnded = false;

	abortController.signal.addEventListener("abort", () => {
		if (!agentEnded) shadow.abort();
	});

	shadow.subscribe((event) => {
		if (widget.isDismissed) return;

		if (event.type === "message_update") {
			const e = event.assistantMessageEvent;

			if (e.type === "text_delta") {
				accumulatedText += e.delta;
				if (!toolCallDetected && looksLikeToolCall(accumulatedText)) {
					toolCallDetected = true;
					shadow.abort();
					widget.setAnswer(toolCallFallbackAnswer());
					return;
				}
				widget.appendText(e.delta);
			}

			if (e.type === "toolcall_start" || e.type === "toolcall_delta" || e.type === "toolcall_end") {
				toolCallDetected = true;
				shadow.abort();
				widget.setAnswer(toolCallFallbackAnswer());
			}
		}

		if (event.type === "message_end") {
			const msg = event.message;
			if (msg.role === "assistant" && !widget.isDismissed) {
				const failure = getAssistantFailure(msg);
				if (failure) {
					widget.setError(formatBtwProviderError(model, failure.errorMessage, failure.stopReason));
					return;
				}
				widget.setUsage({
					input: msg.usage.input,
					output: msg.usage.output,
					cacheRead: msg.usage.cacheRead,
					cacheWrite: msg.usage.cacheWrite,
					totalCost: msg.usage.cost.total,
				});
			}
		}

		if (event.type === "agent_end") {
			agentEnded = true;
			if (!toolCallDetected) {
				const failure = event.messages.map(getAssistantFailure).find(Boolean);
				if (failure) {
					widget.setError(formatBtwProviderError(model, failure.errorMessage, failure.stopReason));
				} else if (looksLikeToolCall(accumulatedText)) {
					widget.setAnswer(toolCallFallbackAnswer());
				} else {
					widget.setDone();
				}
			}
		}
	});

	try {
		if (abortController.signal.aborted || widget.isDismissed) return;
		await shadow.prompt(sideQuestionMessage as AgentMessage);
	} catch (err) {
		if (!widget.isDismissed && !agentEnded && !toolCallDetected) {
			if (looksLikeToolCall(accumulatedText)) {
				widget.setAnswer(toolCallFallbackAnswer());
			} else {
				widget.setError(formatBtwProviderError(model, err instanceof Error ? err.message : String(err)));
			}
		}
	}
}

// ── Main /btw handler ───────────────────────────────────────────────────────

async function startBtwQuestion(
	ctx: ExtensionContext,
	question: string,
	latestProviderMessages: Message[],
	latestMainSystemPrompt: string,
): Promise<void> {
	if (btwActive) {
		ctx.ui.notify("A side question is already active. Dismiss it first.", "info");
		return;
	}

	const mdTheme = getMarkdownTheme();

	if (!question) {
		btwActive = true;
		showErrorWidget(ctx, "", "Usage: /btw <question>", mdTheme);
		return;
	}

	const model = resolveBtwModel(ctx);
	if (!model) {
		btwActive = true;
		showErrorWidget(ctx, question, "No model selected. Set a model first.", mdTheme);
		return;
	}

	const abortController = new AbortController();
	btwActive = true;
	const modelLabel = (model as any).name || (model as any).id || String(model);
	const activeStatus = ctx.ui.theme.fg("accent", "π btw");
	const { widget } = mountBtwWidget(ctx, question, mdTheme, modelLabel, activeStatus, () => {
		abortController.abort();
	});

	let auth;
	try {
		auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	} catch (err) {
		widget.setError(formatBtwProviderError(model, err instanceof Error ? err.message : String(err)));
		return;
	}
	if (!auth.ok) {
		widget.setError(formatBtwProviderError(model, `No API key found for ${model.provider}`));
		return;
	}

	let modeMessages: Message[];
	try {
		const sessionMessages = buildCurrentSessionMessages(ctx);
		const candidate = chooseModeAMessages(sessionMessages, latestProviderMessages, ctx.isIdle());
		if (!candidate) {
			widget.setError(
				"The current context is in the middle of a tool execution. Wait for the main agent to finish the current tool, then try /btw again.",
			);
			return;
		}
		modeMessages = candidate.messages;
	} catch (err) {
		widget.setError(err instanceof Error ? err.message : String(err));
		return;
	}

	const mainSystemPrompt = latestMainSystemPrompt || ctx.getSystemPrompt() || DEFAULT_SYSTEM_PROMPT;
	const systemPrompt = buildBtwSystemPrompt(mainSystemPrompt);

	(async () => {
		try {
			await runBtwShadowAgent(ctx, model, systemPrompt, modeMessages, question, auth, widget, abortController);
		} catch (err) {
			if (!widget.isDismissed) {
				widget.setError(formatBtwProviderError(model, err instanceof Error ? err.message : String(err)));
			}
		}
	})();
}

// ── /btw-settings UI ────────────────────────────────────────────────────────

/**
 * Build a searchable model selector component.
 * Uses Input for search + fuzzyFilter + SelectList for results.
 */
function buildModelSelector(
	tui: TUI,
	theme: { fg: (color: string, text: string) => string },
	models: Model<Api>[],
	currentModel: Model<Api> | undefined,
	onSelect: (model: Model<Api> | null) => void,
	onCancel: () => void,
): Component {
	const container = new Container();
	container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
	container.addChild(new Text(theme.fg("accent", "Select /btw model"), 0, 0));
	container.addChild(new Spacer(1));

	// Search input
	const searchInput = new Input();
	searchInput.onSubmit = () => {
		const selected = selectList.getSelectedItem();
		if (selected) {
			const found = models.find((m) => `${m.provider}/${m.id}` === selected.value);
			onSelect(found ?? null);
		}
	};
	container.addChild(new Text(theme.fg("muted", " Search:"), 0, 0));
	container.addChild(searchInput);
	container.addChild(new Spacer(1));

	// Build select items from models
	const allItems: SelectItem[] = [
		{ value: "same-as-main", label: "Same as main session", description: "Use whichever model the main agent is using" },
		...models.map((m) => ({
			value: `${m.provider}/${m.id}`,
			label: m.id,
			description: `${m.provider}${m.reasoning ? " · reasoning" : ""}`,
		})),
	];

	const selectListTheme: SelectListTheme = {
		selectedPrefix: (text) => theme.fg("accent", text),
		selectedText: (text) => theme.fg("accent", text),
		description: (text) => theme.fg("muted", text),
		scrollInfo: (text) => theme.fg("dim", text),
		noMatch: (text) => theme.fg("warning", text),
	};

	const selectList = new SelectList(allItems, 10, selectListTheme);

	// Pre-select current model or same-as-main
	const currentValue = currentModel ? `${currentModel.provider}/${currentModel.id}` : "same-as-main";
	const currentIndex = allItems.findIndex((i) => i.value === currentValue);
	if (currentIndex >= 0) selectList.setSelectedIndex(currentIndex);

	selectList.onSelect = (item) => {
		if (item.value === "same-as-main") {
			onSelect(null);
		} else {
			const found = models.find((m) => `${m.provider}/${m.id}` === item.value);
			onSelect(found ?? null);
		}
	};
	selectList.onCancel = onCancel;

	container.addChild(selectList);
	container.addChild(new Spacer(1));
	container.addChild(new Text(theme.fg("dim", "↑↓ navigate · Enter select · Esc cancel · Type to filter"), 0, 0));
	container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

	return {
		render(width: number) {
			return container.render(width);
		},
		invalidate() {
			container.invalidate();
		},
		handleInput(data: string) {
			if (matchesKey(data, Key.escape)) {
				onCancel();
				return;
			}
			// Pass arrows/enter directly to select list
			if (matchesKey(data, Key.up) || matchesKey(data, Key.down) || matchesKey(data, Key.enter)) {
				selectList.handleInput(data);
				tui.requestRender();
				return;
			}
			// Pass printable chars to search input
			searchInput.handleInput(data);
			// Filter the list in-place via internal fields (TypeScript-private at compile time only)
			const query = searchInput.getValue().trim();
			const filtered = query
				? fuzzyFilter(allItems, query, (item) => `${item.value} ${item.label} ${item.description ?? ""}`)
				: allItems;
			(selectList as any).filteredItems = filtered;
			(selectList as any).selectedIndex = 0;
			tui.requestRender();
		},
	};
}

function getSettingsListTheme(theme: { fg: (color: string, text: string) => string; bg: (color: string, text: string) => string; bold: (text: string) => string }): SettingsListTheme {
	return {
		label: (text, selected) => (selected ? theme.fg("accent", theme.bold(text)) : text),
		value: (text, selected) => (selected ? theme.fg("accent", text) : theme.fg("muted", text)),
		description: (text) => theme.fg("dim", text),
		cursor: "→ ",
		hint: (text) => theme.fg("dim", text),
	};
}

async function openBtwSettings(ctx: ExtensionContext, pi: ExtensionAPI): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify("UI not available", "error");
		return;
	}

	const settings = getSettings();

	// Refresh models before showing selector
	ctx.modelRegistry.refresh();
	const availableModels = ctx.modelRegistry.getAvailable();

	await ctx.ui.custom<BtwSettings | null>(
		(tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("/btw Settings")), 0, 0));
			container.addChild(new Spacer(1));

			let localSettings: BtwSettings = { ...settings };
			let inSubmenu = false;
			let settingsList: SettingsList;

			const selectedModelSupportsReasoning = () => resolveBtwModel(ctx, localSettings)?.reasoning === true;
			if (!selectedModelSupportsReasoning()) localSettings.reasoning = "off";

			const items: SettingItem[] = [
				{
					id: "model",
					label: "Model",
					description: "Which model to use for /btw side questions",
					currentValue:
						localSettings.modelStrategy === "same-as-main"
							? "same-as-main"
							: `${localSettings.customProvider}/${localSettings.customModelId}`,
					submenu: (_currentValue, doneSubmenu) => {
						inSubmenu = true;
						return buildModelSelector(
							tui,
							theme as { fg: (color: string, text: string) => string },
							availableModels,
							localSettings.modelStrategy === "custom" ? resolveBtwModel(ctx, localSettings) : undefined,
							(selected) => {
								inSubmenu = false;
								if (selected === null) {
									localSettings.modelStrategy = "same-as-main";
									localSettings.customProvider = undefined;
									localSettings.customModelId = undefined;
								} else if (selected) {
									localSettings.modelStrategy = "custom";
									localSettings.customProvider = selected.provider;
									localSettings.customModelId = selected.id;
								}
								doneSubmenu(localSettings.modelStrategy === "same-as-main" ? "same-as-main" : `${localSettings.customProvider}/${localSettings.customModelId}`);
							},
							() => {
								inSubmenu = false;
								doneSubmenu();
							},
						);
					},
				},
				{
					id: "reasoning",
					label: "Reasoning",
					description: selectedModelSupportsReasoning()
						? "Thinking depth for /btw (off = fastest)"
						: "The selected model does not advertise reasoning support; /btw will use off.",
					currentValue: localSettings.reasoning,
					values: selectedModelSupportsReasoning() ? [...REASONING_LEVELS] : ["off"],
				},
				{
					id: "maxTokens",
					label: "Max tokens",
					description: "Maximum output tokens for /btw answers",
					currentValue: String(localSettings.maxTokens),
					values: MAX_TOKENS_OPTIONS.map(String),
				},
			];

			settingsList = new SettingsList(
				items,
				6,
				getSettingsListTheme(theme as { fg: (c: string, t: string) => string; bg: (c: string, t: string) => string; bold: (t: string) => string }),
				(id, newValue) => {
					switch (id) {
						case "model":
							{
								const reasoningItem = items.find((item) => item.id === "reasoning");
								const supportsReasoning = selectedModelSupportsReasoning();
								if (reasoningItem) {
									reasoningItem.description = supportsReasoning
										? "Thinking depth for /btw (off = fastest)"
										: "The selected model does not advertise reasoning support; /btw will use off.";
									reasoningItem.values = supportsReasoning ? [...REASONING_LEVELS] : ["off"];
								}
								if (!supportsReasoning) {
									localSettings.reasoning = "off";
									settingsList.updateValue("reasoning", "off");
								}
							}
							break;
						case "reasoning":
							if (REASONING_LEVELS.includes(newValue as any)) {
								localSettings.reasoning = newValue as BtwSettings["reasoning"];
							}
							break;
						case "maxTokens":
							localSettings.maxTokens = parseInt(newValue, 10) || 500;
							break;
					}
				},
				() => done(null),
			);

			container.addChild(settingsList);
			container.addChild(new Spacer(1));
			container.addChild(new Text(theme.fg("dim", "Enter/Space to change · Esc to save & close"), 0, 0));
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					if (matchesKey(data, Key.escape) && !inSubmenu) {
						done(localSettings);
						return;
					}
					settingsList.handleInput(data);
					tui.requestRender();
				},
			};
		},
		{ overlay: true },
	).then((result) => {
		if (result) {
			setSettings(result);
			const savedSettings = settingsToEntry();
			pi.appendEntry("btw-settings", savedSettings);
			try {
				saveGlobalSettings(savedSettings);
				ctx.ui.notify(`/btw settings saved to ${getGlobalSettingsPath()}`, "info");
			} catch (err) {
				ctx.ui.notify(`Saved for this session, but global save failed: ${err instanceof Error ? err.message : String(err)}`, "warning");
			}
		}
	});
}

// ── External extension ordering note ────────────────────────────────────────

// The "exact replay" / prompt-cache guarantee in this extension is relative
// to what this extension observes at snapshot time — it is NOT a guarantee
// that the final provider payload is exactly the same as what was originally
// sent to the LLM.
//
// If another extension runs after these handlers and mutates the provider
// messages or system prompt, then a subsequent /btw replay will use the
// pre-mutation snapshot, not the final payload.

// ── Extension ───────────────────────────────────────────────────────────────

/** Prevents concurrent /btw widgets across sessions. */
let btwActive = false;

export default function btwSimpleExtension(pi: ExtensionAPI) {
	let latestProviderMessages: Message[] = [];
	let latestMainSystemPrompt = "";

	pi.on("before_agent_start", async (event) => {
		latestMainSystemPrompt = event.systemPrompt;
	});

	pi.on("context", async (event) => {
		latestProviderMessages = convertToLlm(event.messages);
	});

	pi.on("session_start", async (_event, ctx) => {
		latestProviderMessages = [];
		latestMainSystemPrompt = ctx.getSystemPrompt() || "";

		// Start with user-wide settings, then let resumed/forked session history override them.
		btwSettings = loadGlobalSettings();
		const entries = ctx.sessionManager.getEntries();
		for (const entry of entries) {
			if (entry.type === "custom" && entry.customType === "btw-settings" && entry.data) {
				btwSettings = settingsFromEntry(entry.data);
			}
		}
	});

	pi.registerCommand("btw", {
		description: "Ask a side question about the current session (ephemeral, no tools)",
		async handler(args: string, ctx) {
			await startBtwQuestion(ctx, args.trim(), latestProviderMessages, latestMainSystemPrompt);
		},
	});

	pi.registerCommand("btw-settings", {
		description: "Configure /btw model, reasoning, and output settings",
		async handler(_args, ctx) {
			await openBtwSettings(ctx, pi);
		},
	});
}

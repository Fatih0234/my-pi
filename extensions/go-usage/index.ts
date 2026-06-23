import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile, appendFile, rename, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import {
  DEFAULT_CONFIG,
  type GoUsageConfig,
  type UsageLedgerEvent,
  cloneDefaultConfig,
  computeUsageReport,
  formatUsd,
  isActiveProvider,
  isValidUsageEvent,
  makeDedupeKey,
  mergeConfig,
  parseDurationMs,
  parseUsageAmount,
  renderReport,
  renderStatus,
  getWeekBoundsUtc,
  getMonthlyBoundsUtc,
  getCalendarMonthBoundsUtc,
} from "./lib.js";

type Store = {
  dir: string;
  configPath: string;
  ledgerPath: string;
};

function getStore(): Store {
  const dir = process.env.PI_GO_USAGE_DIR || path.join(homedir(), ".pi", "agent", "go-usage");
  return {
    dir,
    configPath: path.join(dir, "config.json"),
    ledgerPath: path.join(dir, "ledger.jsonl"),
  };
}

async function ensureStore(): Promise<Store> {
  const store = getStore();
  await mkdir(store.dir, { recursive: true });
  if (!existsSync(store.configPath)) {
    await writeJsonAtomic(store.configPath, cloneDefaultConfig());
  }
  if (!existsSync(store.ledgerPath)) {
    await writeFile(store.ledgerPath, "", "utf8");
  }
  return store;
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const temp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, filePath);
}

async function loadConfig(): Promise<GoUsageConfig> {
  const store = await ensureStore();
  try {
    const raw = await readFile(store.configPath, "utf8");
    return mergeConfig(JSON.parse(raw));
  } catch {
    const config = cloneDefaultConfig();
    await writeJsonAtomic(store.configPath, config);
    return config;
  }
}

async function saveConfig(config: GoUsageConfig): Promise<void> {
  const store = await ensureStore();
  await writeJsonAtomic(store.configPath, mergeConfig(config));
}

async function readLedger(): Promise<{ events: UsageLedgerEvent[]; invalidLineCount: number }> {
  const store = await ensureStore();
  const raw = await readFile(store.ledgerPath, "utf8").catch(() => "");
  const events: UsageLedgerEvent[] = [];
  let invalidLineCount = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (isValidUsageEvent(parsed)) events.push(parsed);
      else invalidLineCount++;
    } catch {
      invalidLineCount++;
    }
  }

  events.sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime());
  return { events, invalidLineCount };
}

async function appendUsageEventDeduped(event: UsageLedgerEvent): Promise<boolean> {
  const store = await ensureStore();
  const { events } = await readLedger();
  if (events.some((existing) => existing.dedupeKey === event.dedupeKey)) return false;
  await appendFile(store.ledgerPath, `${JSON.stringify(event)}\n`, "utf8");
  return true;
}

function usageEventFromAssistantMessage(message: any, ctx: ExtensionContext): UsageLedgerEvent | undefined {
  const costUsd = Number(message?.usage?.cost?.total ?? 0);
  if (!Number.isFinite(costUsd) || costUsd <= 0) return undefined;

  const timestampMs = Number(message.timestamp);
  const timestampIso = Number.isFinite(timestampMs) && timestampMs > 0
    ? new Date(timestampMs).toISOString()
    : new Date().toISOString();

  const provider = String(message.provider ?? "");
  const model = String(message.model ?? "");
  const usage = message.usage ?? {};
  const responseId = typeof message.responseId === "string" ? message.responseId : undefined;

  const dedupeKey = responseId
    ? makeDedupeKey({ responseId, provider, model })
    : makeDedupeKey({
        provider,
        model,
        timestampIso,
        stopReason: message.stopReason,
        usage: {
          input: usage.input,
          output: usage.output,
          cacheRead: usage.cacheRead,
          cacheWrite: usage.cacheWrite,
          totalTokens: usage.totalTokens,
          cost: usage.cost,
        },
      });

  return {
    version: 1,
    kind: "usage",
    dedupeKey,
    timestampIso,
    provider,
    model,
    api: typeof message.api === "string" ? message.api : undefined,
    costUsd,
    usage,
    sessionFile: ctx.sessionManager.getSessionFile?.(),
    responseId,
    stopReason: typeof message.stopReason === "string" ? message.stopReason : undefined,
  };
}

function sendReport(pi: ExtensionAPI, content: string): void {
  pi.sendMessage({
    customType: "go-usage",
    content,
    display: true,
    details: { generatedAt: new Date().toISOString() },
  });
}

function parseKeyValueArgs(args: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of args.split(/\s+/).filter(Boolean)) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

async function buildReport() {
  const store = await ensureStore();
  const config = await loadConfig();
  const { events, invalidLineCount } = await readLedger();
  const report = computeUsageReport(config, events, new Date(), invalidLineCount);
  return { store, config, events, report };
}

async function handleShow(pi: ExtensionAPI): Promise<void> {
  const { report } = await buildReport();
  sendReport(pi, renderReport(report));
}

async function handleStatus(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  const { store, config, events, report } = await buildReport();
  sendReport(
    pi,
    renderStatus({
      storeDir: store.dir,
      configPath: store.configPath,
      ledgerPath: store.ledgerPath,
      config,
      report,
      currentProvider: ctx.model?.provider,
      currentModel: ctx.model?.id,
      lastEvent: events.at(-1),
    }),
  );
}

async function handleSetAnchor(pi: ExtensionAPI, argText: string): Promise<void> {
  const raw = argText.trim();
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) {
    sendReport(pi, "Usage: /go-usage set-anchor 2026-05-15T14:20:00Z");
    return;
  }
  const config = await loadConfig();
  config.monthlyAnchorIso = date.toISOString();
  await saveConfig(config);
  sendReport(pi, `OpenCode Go monthly anchor set to ${date.toISOString()}.`);
}

function computeBaselineWindowStarts(config: GoUsageConfig, now: Date) {
  const week = getWeekBoundsUtc(now);
  const month = config.monthlyAnchorIso
    ? getMonthlyBoundsUtc(now, new Date(config.monthlyAnchorIso))
    : getCalendarMonthBoundsUtc(now);
  return { weekStartIso: week.start.toISOString(), monthStartIso: month.start.toISOString() };
}

async function handleSetBaseline(pi: ExtensionAPI, argText: string): Promise<void> {
  const args = parseKeyValueArgs(argText);
  const config = await loadConfig();
  const now = new Date();
  const { weekStartIso, monthStartIso } = computeBaselineWindowStarts(config, now);

  const rollingRaw = args.rollingUsedUsd ?? args.rolling;
  const weeklyRaw = args.weeklyUsedUsd ?? args.weekly;
  const monthlyRaw = args.monthlyUsedUsd ?? args.monthly;

  try {
    const rolling = parseUsageAmount(rollingRaw, config.limitsUsd.rolling) ?? 0;
    const weekly = parseUsageAmount(weeklyRaw, config.limitsUsd.weekly) ?? 0;
    const monthly = parseUsageAmount(monthlyRaw, config.limitsUsd.monthly) ?? 0;

    const rollingResetMs = parseDurationMs(args.rollingResetIn ?? args.rollingReset ?? args.resetIn);
    const rollingExpiresAtIso = rollingResetMs
      ? new Date(now.getTime() + rollingResetMs).toISOString()
      : new Date(now.getTime() + config.rollingWindowHours * 60 * 60 * 1000).toISOString();

    config.baseline = {
      timestampIso: now.toISOString(),
      rollingUsedUsd: rolling,
      rollingExpiresAtIso,
      weeklyUsedUsd: weekly,
      weeklyWindowStartIso: weekStartIso,
      monthlyUsedUsd: monthly,
      monthlyWindowStartIso: monthStartIso,
    };

    if (args.monthlyAnchorIso) {
      const anchor = new Date(args.monthlyAnchorIso);
      if (Number.isNaN(anchor.getTime())) throw new Error(`Invalid monthlyAnchorIso: ${args.monthlyAnchorIso}`);
      config.monthlyAnchorIso = anchor.toISOString();
    }

    await saveConfig(config);
    sendReport(
      pi,
      [
        "OpenCode Go baseline saved.",
        "",
        `Rolling baseline: ${formatUsd(rolling)} until ${rollingExpiresAtIso}`,
        `Weekly baseline: ${formatUsd(weekly)} for week starting ${weekStartIso}`,
        `Monthly baseline: ${formatUsd(monthly)} for window starting ${monthStartIso}`,
        `Monthly anchor: ${config.monthlyAnchorIso ?? "not configured"}`,
      ].join("\n"),
    );
  } catch (error) {
    sendReport(pi, `Could not set baseline: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleSync(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  const config = await loadConfig();
  if (!ctx.hasUI) {
    sendReport(
      pi,
      "Interactive UI is not available. Use: /go-usage set-baseline monthly=70% weekly=20% rolling=5% rollingResetIn=2h40m",
    );
    return;
  }

  const rollingRaw = await ctx.ui.input("OpenCode Go rolling 5h usage now", "Example: 5%, $0.60, 0.60, or blank");
  const weeklyRaw = await ctx.ui.input("OpenCode Go weekly usage now", "Example: 20%, $6, 6, or blank");
  const monthlyRaw = await ctx.ui.input("OpenCode Go monthly usage now", "Example: 70%, $42, 42, or blank");
  const rollingResetRaw = await ctx.ui.input("Rolling reset ETA (optional)", "Example: 2h 40m, 45m, or blank");
  const anchorRaw = await ctx.ui.input("Monthly subscription anchor ISO (optional)", "Example: 2026-05-15T14:20:00Z");

  const parts = [
    `rolling=${JSON.stringify(rollingRaw ?? "").slice(1, -1)}`,
    `weekly=${JSON.stringify(weeklyRaw ?? "").slice(1, -1)}`,
    `monthly=${JSON.stringify(monthlyRaw ?? "").slice(1, -1)}`,
  ];

  if (rollingResetRaw?.trim()) {
    parts.push(`rollingResetIn=${rollingResetRaw.trim().replace(/\s+/g, "")}`);
  }
  if (anchorRaw?.trim()) {
    const anchor = new Date(anchorRaw.trim());
    if (!Number.isNaN(anchor.getTime())) {
      config.monthlyAnchorIso = anchor.toISOString();
      await saveConfig(config);
    } else {
      ctx.ui.notify("go-usage: ignored invalid monthly anchor", "warning");
    }
  }

  // Avoid shell-like quoting complexity by setting directly here.
  const now = new Date();
  const { weekStartIso, monthStartIso } = computeBaselineWindowStarts(config, now);
  const rolling = parseUsageAmount(rollingRaw, config.limitsUsd.rolling) ?? 0;
  const weekly = parseUsageAmount(weeklyRaw, config.limitsUsd.weekly) ?? 0;
  const monthly = parseUsageAmount(monthlyRaw, config.limitsUsd.monthly) ?? 0;
  const rollingResetMs = parseDurationMs(rollingResetRaw);
  config.baseline = {
    timestampIso: now.toISOString(),
    rollingUsedUsd: rolling,
    rollingExpiresAtIso: rollingResetMs
      ? new Date(now.getTime() + rollingResetMs).toISOString()
      : new Date(now.getTime() + config.rollingWindowHours * 60 * 60 * 1000).toISOString(),
    weeklyUsedUsd: weekly,
    weeklyWindowStartIso: weekStartIso,
    monthlyUsedUsd: monthly,
    monthlyWindowStartIso: monthStartIso,
  };
  await saveConfig(config);

  sendReport(
    pi,
    [
      "OpenCode Go baseline synced.",
      "",
      `Rolling baseline: ${formatUsd(rolling)}`,
      `Weekly baseline: ${formatUsd(weekly)}`,
      `Monthly baseline: ${formatUsd(monthly)}`,
      `Monthly anchor: ${config.monthlyAnchorIso ?? "not configured"}`,
      "",
      "Run /go-usage to view the estimate.",
    ].join("\n"),
  );
}

async function handleReset(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  if (ctx.hasUI) {
    const ok = await ctx.ui.confirm("Reset OpenCode Go local usage tracker?", "This archives the local ledger and clears the baseline. It does not affect OpenCode.");
    if (!ok) return;
  }

  const store = await ensureStore();
  const archivePath = `${store.ledgerPath}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
  if (existsSync(store.ledgerPath)) {
    await copyFile(store.ledgerPath, archivePath).catch(() => undefined);
  }
  await writeFile(store.ledgerPath, "", "utf8");

  const config = await loadConfig();
  config.baseline = cloneDefaultConfig().baseline;
  await saveConfig(config);

  sendReport(pi, `OpenCode Go local usage tracker reset.\nArchived previous ledger to: ${archivePath}`);
}

export default function goUsageExtension(pi: ExtensionAPI) {
  // Warm-create local store, but do not block extension load if it fails.
  ensureStore().catch(() => undefined);

  pi.on("message_end", async (event, ctx) => {
    try {
      const message = event.message as any;
      if (!message || message.role !== "assistant") return;

      const config = await loadConfig();
      if (!isActiveProvider(message.provider, config)) return;

      const usageEvent = usageEventFromAssistantMessage(message, ctx);
      if (!usageEvent) return;

      await appendUsageEventDeduped(usageEvent);
    } catch (error) {
      ctx.ui.notify(`go-usage: failed to record usage: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  });

  pi.registerCommand("go-usage", {
    description: "Show local OpenCode Go usage estimate, sync baseline, or inspect tracker status",
    getArgumentCompletions: (prefix: string) => {
      const values = ["sync", "status", "reset", "set-baseline", "set-anchor"];
      const items = values.map((value) => ({ value, label: value }));
      const filtered = items.filter((item) => item.value.startsWith(prefix));
      return filtered.length ? filtered : null;
    },
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const trimmed = args.trim();
      const [subcommand, ...rest] = trimmed.split(/\s+/);
      const restText = rest.join(" ");

      try {
        if (!trimmed) return handleShow(pi);
        if (subcommand === "sync") return handleSync(pi, ctx);
        if (subcommand === "status") return handleStatus(pi, ctx);
        if (subcommand === "reset") return handleReset(pi, ctx);
        if (subcommand === "set-baseline") return handleSetBaseline(pi, restText);
        if (subcommand === "set-anchor") return handleSetAnchor(pi, restText);

        sendReport(
          pi,
          [
            "Unknown /go-usage command.",
            "",
            "Usage:",
            "/go-usage",
            "/go-usage sync",
            "/go-usage status",
            "/go-usage reset",
            "/go-usage set-baseline monthly=70% weekly=20% rolling=5%",
            "/go-usage set-anchor 2026-05-15T14:20:00Z",
          ].join("\n"),
        );
      } catch (error) {
        ctx.ui.notify(`go-usage error: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });
}

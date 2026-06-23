import { createHash } from "node:crypto";

export type UsageCost = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
};

export type UsageSnapshot = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  cost?: UsageCost;
};

export type UsageLedgerEvent = {
  version: 1;
  kind: "usage";
  dedupeKey: string;
  timestampIso: string;
  provider: string;
  model: string;
  api?: string;
  costUsd: number;
  usage: UsageSnapshot;
  sessionFile?: string;
  responseId?: string;
  stopReason?: string;
};

export type GoUsageConfig = {
  version: 1;
  providerFilters: string[];
  limitsUsd: {
    rolling: number;
    weekly: number;
    monthly: number;
  };
  rollingWindowHours: number;
  monthlyAnchorIso: string | null;
  baseline: {
    timestampIso: string | null;
    rollingUsedUsd: number;
    rollingExpiresAtIso: string | null;
    weeklyUsedUsd: number;
    weeklyWindowStartIso: string | null;
    monthlyUsedUsd: number;
    monthlyWindowStartIso: string | null;
  };
};

export type WindowUsage = {
  label: string;
  usedUsd: number;
  limitUsd: number;
  observedUsd: number;
  baselineUsd: number;
  percent: number;
  startIso: string;
  endIso: string;
  exact: boolean;
  note?: string;
};

export type UsageReport = {
  nowIso: string;
  rolling: WindowUsage;
  weekly: WindowUsage;
  monthly: WindowUsage;
  totalObservedUsd: number;
  eventCount: number;
  invalidLedgerLineCount: number;
  warnings: string[];
};

export const DEFAULT_CONFIG: GoUsageConfig = {
  version: 1,
  providerFilters: ["opencode-go"],
  limitsUsd: {
    rolling: 12,
    weekly: 30,
    monthly: 60,
  },
  rollingWindowHours: 5,
  monthlyAnchorIso: null,
  baseline: {
    timestampIso: null,
    rollingUsedUsd: 0,
    rollingExpiresAtIso: null,
    weeklyUsedUsd: 0,
    weeklyWindowStartIso: null,
    monthlyUsedUsd: 0,
    monthlyWindowStartIso: null,
  },
};

export function cloneDefaultConfig(): GoUsageConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as GoUsageConfig;
}

export function mergeConfig(input: Partial<GoUsageConfig> | undefined): GoUsageConfig {
  const defaults = cloneDefaultConfig();
  if (!input || typeof input !== "object") return defaults;
  return {
    ...defaults,
    ...input,
    providerFilters: Array.isArray(input.providerFilters) ? input.providerFilters : defaults.providerFilters,
    limitsUsd: { ...defaults.limitsUsd, ...(input.limitsUsd ?? {}) },
    baseline: { ...defaults.baseline, ...(input.baseline ?? {}) },
  };
}

export function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampPercent(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(999, Math.floor((used / limit) * 100)));
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  const s = value.toFixed(4);
  const trimmed = s.replace(/0+$/, "");
  const dotIdx = trimmed.indexOf(".");
  const decimalPlaces = dotIdx === -1 ? 0 : trimmed.length - dotIdx - 1;
  if (decimalPlaces < 2) return `$${value.toFixed(2)}`;
  return `$${trimmed}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toISOString().replace(".000Z", "Z");
}

export function formatRelativeTime(endIso: string, nowIso: string): string {
  const diffMs = new Date(endIso).getTime() - new Date(nowIso).getTime();
  if (diffMs <= 0) return "expired";
  if (diffMs < 60_000) return "less than a minute";

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (days === 0 && minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);

  if (parts.length === 0) return "less than a minute";
  return `in ${parts.join(" ")}`;
}

export function getWeekBoundsUtc(now: Date): { start: Date; end: Date } {
  const offset = (now.getUTCDay() + 6) % 7;
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - offset);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

export function getCalendarMonthBoundsUtc(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

export function getMonthlyBoundsUtc(now: Date, subscribed: Date): { start: Date; end: Date } {
  const day = subscribed.getUTCDate();
  const hh = subscribed.getUTCHours();
  const mm = subscribed.getUTCMinutes();
  const ss = subscribed.getUTCSeconds();
  const ms = subscribed.getUTCMilliseconds();

  function anchor(year: number, month: number): Date {
    const max = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(day, max), hh, mm, ss, ms));
  }

  function shift(year: number, month: number, delta: number): readonly [number, number] {
    const total = year * 12 + month + delta;
    return [Math.floor(total / 12), ((total % 12) + 12) % 12] as const;
  }

  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let start = anchor(y, m);
  if (start > now) {
    [y, m] = shift(y, m, -1);
    start = anchor(y, m);
  }
  const [ny, nm] = shift(y, m, 1);
  const end = anchor(ny, nm);
  return { start, end };
}

export function parseUsageAmount(input: string | undefined | null, limitUsd: number): number | undefined {
  const raw = (input ?? "").trim();
  if (!raw) return undefined;

  const compact = raw.replace(/\s+/g, "");
  if (compact.endsWith("%")) {
    const pct = Number(compact.slice(0, -1));
    if (!Number.isFinite(pct) || pct < 0) throw new Error(`Invalid percentage: ${input}`);
    return (pct / 100) * limitUsd;
  }

  const normalized = compact.replace(/^\$/, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid usage amount: ${input}`);
  return amount;
}

export function parseDurationMs(input: string | undefined | null): number | undefined {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return undefined;

  let total = 0;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)/g;
  for (const match of raw.matchAll(re)) {
    matched = true;
    const value = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid duration: ${input}`);
    if (unit.startsWith("h")) total += value * 60 * 60 * 1000;
    else total += value * 60 * 1000;
  }

  if (!matched) {
    const minutes = Number(raw);
    if (!Number.isFinite(minutes) || minutes < 0) throw new Error(`Invalid duration: ${input}`);
    total = minutes * 60 * 1000;
  }

  return Math.round(total);
}

export function makeDedupeKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function isActiveProvider(provider: unknown, config: GoUsageConfig): boolean {
  if (typeof provider !== "string") return false;
  return config.providerFilters.includes(provider);
}

export function isValidUsageEvent(value: unknown): value is UsageLedgerEvent {
  const e = value as Partial<UsageLedgerEvent>;
  return (
    !!e &&
    e.version === 1 &&
    e.kind === "usage" &&
    typeof e.dedupeKey === "string" &&
    typeof e.timestampIso === "string" &&
    typeof e.provider === "string" &&
    typeof e.model === "string" &&
    typeof e.costUsd === "number" &&
    Number.isFinite(e.costUsd)
  );
}

export function sumEvents(events: UsageLedgerEvent[], start: Date, end: Date): number {
  return events.reduce((sum, event) => {
    const t = new Date(event.timestampIso);
    if (Number.isNaN(t.getTime())) return sum;
    if (t >= start && t < end) return sum + event.costUsd;
    return sum;
  }, 0);
}

export function computeUsageReport(
  config: GoUsageConfig,
  events: UsageLedgerEvent[],
  now = new Date(),
  invalidLedgerLineCount = 0,
): UsageReport {
  const warnings: string[] = [];

  const rollingMs = config.rollingWindowHours * 60 * 60 * 1000;

  // ---- Event-driven rolling window ----
  // The rolling window is anchored to the oldest observed event
  // within the lookback period and lasts rollingWindowHours from that event.
  const lookbackStart = new Date(now.getTime() - rollingMs);

  let rollingStart: Date;
  let rollingEnd: Date;
  let observedRolling = 0;

  // Find the oldest event within the lookback window (events are sorted ascending)
  let oldestEventInWindow: Date | undefined;
  for (const event of events) {
    const t = new Date(event.timestampIso);
    if (t >= lookbackStart && t < now) {
      oldestEventInWindow = t;
      break; // events sorted ascending; first match is the oldest in window
    }
  }

  if (oldestEventInWindow) {
    // Window is anchored to the first observed event
    rollingStart = oldestEventInWindow;
    rollingEnd = new Date(rollingStart.getTime() + rollingMs);
    // Sum events from window start up to now (future events beyond now don't exist)
    observedRolling = sumEvents(events, rollingStart, now);
  } else {
    // No events in the lookback period — empty window
    rollingStart = lookbackStart;
    rollingEnd = now;
  }

  const baselineTimestamp = config.baseline.timestampIso ? new Date(config.baseline.timestampIso) : undefined;
  let rollingBaseline = 0;
  let rollingResetTime: Date | undefined;
  if (config.baseline.rollingUsedUsd > 0) {
    const explicitExpiry = config.baseline.rollingExpiresAtIso
      ? new Date(config.baseline.rollingExpiresAtIso)
      : undefined;
    const derivedExpiry = baselineTimestamp ? new Date(baselineTimestamp.getTime() + rollingMs) : undefined;
    const expiry = explicitExpiry ?? derivedExpiry;
    if (expiry && expiry > now) {
      rollingBaseline = config.baseline.rollingUsedUsd;
      rollingResetTime = expiry;
    }
  }

  // Determine the final rolling end for "Resets in" display:
  // - If a baseline is active and expires later than the event window, use baseline expiry
  // - Otherwise use the event-driven window end
  // - If neither events nor baseline exist, end is now (shows "expired")
  const finalRollingEnd = (rollingResetTime && rollingResetTime > rollingEnd)
    ? rollingResetTime
    : rollingEnd;

  const week = getWeekBoundsUtc(now);
  const observedWeekly = sumEvents(events, week.start, week.end);
  const baselineWeeklyStart = config.baseline.weeklyWindowStartIso
    ? new Date(config.baseline.weeklyWindowStartIso)
    : baselineTimestamp
      ? getWeekBoundsUtc(baselineTimestamp).start
      : undefined;
  const weeklyBaseline =
    baselineWeeklyStart && baselineWeeklyStart.getTime() === week.start.getTime()
      ? config.baseline.weeklyUsedUsd
      : 0;

  const monthlyExact = !!config.monthlyAnchorIso;
  const month = monthlyExact
    ? getMonthlyBoundsUtc(now, new Date(config.monthlyAnchorIso as string))
    : getCalendarMonthBoundsUtc(now);
  if (!monthlyExact) {
    warnings.push("Monthly estimate is approximate because monthlyAnchorIso is not configured.");
  }
  const observedMonthly = sumEvents(events, month.start, month.end);
  const baselineMonthlyStart = config.baseline.monthlyWindowStartIso
    ? new Date(config.baseline.monthlyWindowStartIso)
    : baselineTimestamp
      ? (monthlyExact
          ? getMonthlyBoundsUtc(baselineTimestamp, new Date(config.monthlyAnchorIso as string)).start
          : getCalendarMonthBoundsUtc(baselineTimestamp).start)
      : undefined;
  const monthlyBaseline =
    baselineMonthlyStart && baselineMonthlyStart.getTime() === month.start.getTime()
      ? config.baseline.monthlyUsedUsd
      : 0;

  const totalObservedUsd = events.reduce((sum, event) => sum + event.costUsd, 0);

  function windowUsage(
    label: string,
    usedUsd: number,
    observedUsd: number,
    baselineUsd: number,
    limitUsd: number,
    start: Date,
    end: Date,
    exact: boolean,
    note?: string,
  ): WindowUsage {
    return {
      label,
      usedUsd,
      observedUsd,
      baselineUsd,
      limitUsd,
      percent: clampPercent(usedUsd, limitUsd),
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      exact,
      note,
    };
  }

  return {
    nowIso: now.toISOString(),
    rolling: windowUsage(
      "Rolling 5h",
      observedRolling + rollingBaseline,
      observedRolling,
      rollingBaseline,
      config.limitsUsd.rolling,
      rollingStart,
      finalRollingEnd,
      true,
      rollingBaseline > 0 ? "Rolling baseline is treated as active until its configured expiry." : undefined,
    ),
    weekly: windowUsage(
      "Weekly",
      observedWeekly + weeklyBaseline,
      observedWeekly,
      weeklyBaseline,
      config.limitsUsd.weekly,
      week.start,
      week.end,
      true,
      "Week starts Monday 00:00 UTC.",
    ),
    monthly: windowUsage(
      "Monthly",
      observedMonthly + monthlyBaseline,
      observedMonthly,
      monthlyBaseline,
      config.limitsUsd.monthly,
      month.start,
      month.end,
      monthlyExact,
      monthlyExact ? "Month is anchored to configured subscription date." : "Calendar-month fallback.",
    ),
    totalObservedUsd,
    eventCount: events.length,
    invalidLedgerLineCount,
    warnings,
  };
}

export function renderReport(report: UsageReport): string {
  const lines: string[] = [];

  function line(w: WindowUsage): string {
    const approximate = w.exact ? "" : " approx.";
    return `${w.label.padEnd(12)} ${formatUsd(w.usedUsd)} / ${formatUsd(w.limitUsd)} (${w.percent}%)${approximate} | observed ${formatUsd(w.observedUsd)} + baseline ${formatUsd(w.baselineUsd)} | Resets ${formatRelativeTime(w.endIso, report.nowIso)}`;
  }

  lines.push("OpenCode Go usage — local estimate");
  lines.push("");
  lines.push(line(report.rolling));
  lines.push(line(report.weekly));
  lines.push(line(report.monthly));
  lines.push("");
  lines.push(`Observed total in local ledger: ${formatUsd(report.totalObservedUsd)} across ${report.eventCount} event(s).`);
  if (report.invalidLedgerLineCount > 0) {
    lines.push(`Skipped ${report.invalidLedgerLineCount} malformed ledger line(s).`);
  }
  for (const warning of report.warnings) {
    lines.push(`Warning: ${warning}`);
  }
  lines.push("");
  lines.push("Important: this is a local estimate only. OpenCode console may differ if you used Go from another tool, machine, session, or before setting the baseline.");

  return lines.join("\n");
}

export function renderStatus(args: {
  storeDir: string;
  configPath: string;
  ledgerPath: string;
  config: GoUsageConfig;
  report: UsageReport;
  currentProvider?: string;
  currentModel?: string;
  lastEvent?: UsageLedgerEvent;
}): string {
  const { storeDir, configPath, ledgerPath, config, report, currentProvider, currentModel, lastEvent } = args;
  return [
    "OpenCode Go usage tracker status",
    "",
    `Store directory: ${storeDir}`,
    `Config path: ${configPath}`,
    `Ledger path: ${ledgerPath}`,
    `Provider filters: ${config.providerFilters.join(", ")}`,
    `Current Pi provider/model: ${(currentProvider ?? "unknown")}/${currentModel ?? "unknown"}`,
    `Ledger events: ${report.eventCount}`,
    `Malformed ledger lines skipped: ${report.invalidLedgerLineCount}`,
    `Last event: ${lastEvent ? `${lastEvent.timestampIso} ${lastEvent.provider}/${lastEvent.model} ${formatUsd(lastEvent.costUsd)}` : "none"}`,
    `Monthly anchor: ${config.monthlyAnchorIso ?? "not configured; using calendar month fallback"}`,
    `Limits: rolling ${formatUsd(config.limitsUsd.rolling)}, weekly ${formatUsd(config.limitsUsd.weekly)}, monthly ${formatUsd(config.limitsUsd.monthly)}`,
    "",
    "Important: this tracker stores local usage only and does not send data over the network.",
  ].join("\n");
}

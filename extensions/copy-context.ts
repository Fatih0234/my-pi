import { mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "gpt-tokenizer";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * copy-context.ts
 *
 * Pi Coding Agent extension.
 *
 * Usage:
 *   /copy-context <files-or-folders...>
 *   /copy-context --all
 *   /copy-context src docs README.md
 *   /copy-context src docs --out chatgpt-context.md
 *   /copy-context --all --max-total-kb=5000
 *   /copy-context ~/.pi/agent/extensions/copy-context.ts
 *   /copy-context ~/.pi/agent/extensions --allow-external
 *   /copy-context src ~/.pi/agent/extensions --out context.md --allow-external-output
 *
 * Creates a ChatGPT-ready Markdown context bundle from selected files
 * and folders, then copies it to the clipboard (or writes to --out file).
 */

const DEFAULT_MAX_FILE_BYTES = 512 * 1024; // 512 KB per file
const DEFAULT_MAX_TOTAL_BYTES = 2 * 1024 * 1024; // 2 MB total

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
  "sessions",
  "bin",
]);

const SKIP_FILES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".DS_Store",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "auth.json",
]);

const SENSITIVE_EXACT_NAMES = new Set([
  "auth.json",
  ".npmrc",
  ".pypirc",
  ".netrc",
  "id_rsa",
  "id_ed25519",
  "credentials.json",
]);

const HIGH_CONFIDENCE_SECRET_PATTERNS = [
  /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /xox[baprs]-[a-zA-Z0-9-]{10,}/,
  /sk_(?:live|test)_[a-zA-Z0-9]{20,}/,
  /(?:api[_-]?key|apikey|secret|token|password)\s*[:=]\s*["']?[a-zA-Z0-9_\-+/]{20,}["']?/i,
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+/,
];

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type SourceKind = "project" | "home" | "external";

type FileEntry = {
  absolutePath: string;
  displayPath: string;
  sourceKind: SourceKind;
};

type ParsedArgs = {
  paths: string[];
  options: {
    all: boolean;
    out: string;
    allowExternal: boolean;
    allowSystemPaths: boolean;
    includeSensitive: boolean;
    allowExternalOutput: boolean;
    maxFileBytes: number;
    maxTotalBytes: number;
  };
};

/* ------------------------------------------------------------------ */
/* Argument parsing                                                    */
/* ------------------------------------------------------------------ */

/** Tokenize a shell-like argument string, respecting quoted tokens. */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}

/** Parse command arguments into paths and options. */
function parseArgs(input: string): ParsedArgs {
  const tokens = tokenize(input);
  const paths: string[] = [];
  const options: ParsedArgs["options"] = {
    all: false,
    out: "",
    allowExternal: false,
    allowSystemPaths: false,
    includeSensitive: false,
    allowExternalOutput: false,
    maxFileBytes: DEFAULT_MAX_FILE_BYTES,
    maxTotalBytes: DEFAULT_MAX_TOTAL_BYTES,
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === "--all") {
      options.all = true;
      continue;
    }

    if (token === "--allow-external") {
      options.allowExternal = true;
      continue;
    }

    if (token === "--allow-system-paths") {
      options.allowSystemPaths = true;
      continue;
    }

    if (token === "--include-sensitive") {
      options.includeSensitive = true;
      continue;
    }

    if (token === "--allow-external-output") {
      options.allowExternalOutput = true;
      continue;
    }

    if (token === "--out" || token === "--write") {
      options.out = tokens[++i] ?? "";
      continue;
    }

    if (token.startsWith("--out=")) {
      options.out = token.slice("--out=".length);
      continue;
    }

    if (token.startsWith("--write=")) {
      options.out = token.slice("--write=".length);
      continue;
    }

    if (token === "--max-file-kb") {
      options.maxFileBytes = Number(tokens[++i]) * 1024;
      continue;
    }

    if (token.startsWith("--max-file-kb=")) {
      options.maxFileBytes = Number(token.slice("--max-file-kb=".length)) * 1024;
      continue;
    }

    if (token === "--max-total-kb") {
      options.maxTotalBytes = Number(tokens[++i]) * 1024;
      continue;
    }

    if (token.startsWith("--max-total-kb=")) {
      options.maxTotalBytes = Number(token.slice("--max-total-kb=".length)) * 1024;
      continue;
    }

    // Allow the user to type @src/foo.ts naturally
    paths.push(token.replace(/^@/, ""));
  }

  if (!Number.isFinite(options.maxFileBytes) || options.maxFileBytes <= 0) {
    options.maxFileBytes = DEFAULT_MAX_FILE_BYTES;
  }

  if (!Number.isFinite(options.maxTotalBytes) || options.maxTotalBytes <= 0) {
    options.maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES;
  }

  return { paths, options };
}

/* ------------------------------------------------------------------ */
/* Path utilities                                                      */
/* ------------------------------------------------------------------ */

function normalizeInputPath(input: string, cwd: string, home: string): string {
  let p = input.trim();
  if (p.startsWith("@")) p = p.slice(1);

  if (p.startsWith("file://")) {
    try {
      p = fileURLToPath(p);
    } catch {
      // invalid URL — leave as-is and let it fail later
    }
  }

  if (p === "~") return home;
  if (p.startsWith("~/") || p.startsWith("~\\")) return resolve(home, p.slice(2));
  if (isAbsolute(p)) return resolve(p);
  return resolve(cwd, p);
}

async function canonicalizePath(inputPath: string): Promise<string> {
  try {
    return await realpath(inputPath);
  } catch {
    return resolve(inputPath);
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function classifyPath(absolutePath: string, projectRoot: string, home: string): SourceKind {
  if (isInside(projectRoot, absolutePath)) return "project";
  if (isInside(home, absolutePath)) return "home";
  return "external";
}

function toDisplayPath(projectRoot: string, home: string, absolutePath: string): string {
  if (isInside(projectRoot, absolutePath)) {
    const rel = relative(projectRoot, absolutePath);
    return "./" + rel.split(sep).join("/");
  }
  if (isInside(home, absolutePath)) {
    const rel = relative(home, absolutePath);
    return "~/" + rel.split(sep).join("/");
  }
  return absolutePath.split(sep).join("/");
}

/* ------------------------------------------------------------------ */
/* Policy / security                                                   */
/* ------------------------------------------------------------------ */

function checkPathPolicy(
  absolutePath: string,
  projectRoot: string,
  home: string,
  allowExternal: boolean,
  allowSystemPaths: boolean,
  includeSensitive: boolean,
): { allowed: boolean; reason?: string } {
  if (isInside(projectRoot, absolutePath)) {
    return { allowed: true };
  }

  const display = toDisplayPath(projectRoot, home, absolutePath);

  // Always block auth.json specifically
  if (absolutePath === resolve(home, ".pi", "agent", "auth.json")) {
    return { allowed: false, reason: `Refusing sensitive file: ${display}` };
  }

  // Sensitive home directories
  const sensitiveDirs = [".ssh", ".gnupg", ".aws", ".azure", ".kube"];
  for (const dir of sensitiveDirs) {
    const dirPath = resolve(home, dir);
    if (isInside(dirPath, absolutePath)) {
      if (!includeSensitive) {
        return { allowed: false, reason: `Refusing sensitive directory without --include-sensitive: ${display}` };
      }
    }
  }

  // System paths
  const systemPaths = ["/etc", "/var", "/usr", "/bin", "/sbin", "/lib", "/sys", "/dev", "/proc"];
  for (const sys of systemPaths) {
    const sysPath = resolve(sys);
    if (isInside(sysPath, absolutePath)) {
      if (!allowSystemPaths) {
        return { allowed: false, reason: `Refusing system path without --allow-system-paths: ${display}` };
      }
      return { allowed: true };
    }
  }

  // Root directory
  if (absolutePath === sep || absolutePath === resolve(sep)) {
    if (!allowSystemPaths) {
      return { allowed: false, reason: `Refusing root directory without --allow-system-paths: ${display}` };
    }
    return { allowed: true };
  }

  // Approved Pi agent subdirectories (always allowed)
  const approvedRoots = [
    resolve(home, ".pi", "agent", "extensions"),
    resolve(home, ".pi", "agent", "skills"),
    resolve(home, ".pi", "agent", "prompts"),
    resolve(home, ".pi", "agent", "themes"),
  ];
  for (const root of approvedRoots) {
    if (isInside(root, absolutePath)) return { allowed: true };
  }

  // Broader ~/.pi/agent
  if (isInside(resolve(home, ".pi", "agent"), absolutePath)) {
    if (!allowExternal) {
      return { allowed: false, reason: `Refusing ~/.pi/agent path without --allow-external: ${display}` };
    }
    return { allowed: true };
  }

  // Home root
  const homeResolved = resolve(home);
  if (absolutePath === homeResolved) {
    if (!allowExternal) {
      return { allowed: false, reason: `Refusing broad directory without --allow-external: ${display}` };
    }
    return { allowed: true };
  }

  // Generic external
  if (!allowExternal) {
    return { allowed: false, reason: `Refusing external path without --allow-external: ${display}` };
  }

  return { allowed: true };
}

/* ------------------------------------------------------------------ */
/* Skip / secret rules                                                 */
/* ------------------------------------------------------------------ */

function isSensitivePath(displayPath: string): boolean {
  const lower = displayPath.toLowerCase();
  const name = basename(lower);

  if (name.startsWith(".env")) return true;
  if (SENSITIVE_EXACT_NAMES.has(name)) return true;

  if (lower.includes("/.ssh/")) return true;
  if (lower.includes("/secret") || lower.includes("secrets/")) return true;
  if (lower.includes("/credentials/")) return true;
  if (lower.includes("private_key")) return true;
  if (lower.includes("api_key")) return true;

  if (/token/i.test(name)) {
    if (/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|c|cpp|h|hpp)$/i.test(name)) {
      return false;
    }
    if (/\btokens?\b/i.test(name)) return true;
    if (/^\.tokens?$/i.test(name)) return true;
  }

  return false;
}

function shouldSkipPath(displayPath: string): boolean {
  const normalized = displayPath.replace(/^\.\//, "");
  const parts = normalized.split(/[\/\\]/);
  const fileName = parts[parts.length - 1];

  if (parts.some((part) => SKIP_DIRS.has(part))) return true;
  if (SKIP_FILES.has(fileName)) return true;
  if (isSensitivePath(displayPath)) return true;

  return false;
}

/* ------------------------------------------------------------------ */
/* Content scanner                                                     */
/* ------------------------------------------------------------------ */

function looksLikeSecretContent(content: string): boolean {
  return HIGH_CONFIDENCE_SECRET_PATTERNS.some((p) => p.test(content));
}

/* ------------------------------------------------------------------ */
/* File helpers                                                        */
/* ------------------------------------------------------------------ */

/** Quick heuristic: check if buffer contains null bytes (binary). */
function isProbablyBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return sample.includes(0);
}

/** Map file extension to a Markdown code-fence language tag. */
function languageForPath(path: string): string {
  const ext = extname(path).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "ts",
    ".tsx": "tsx",
    ".js": "js",
    ".jsx": "jsx",
    ".mjs": "js",
    ".cjs": "js",
    ".py": "py",
    ".md": "md",
    ".mdx": "mdx",
    ".json": "json",
    ".txt": "txt",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".css": "css",
    ".scss": "scss",
    ".html": "html",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "zsh",
    ".sql": "sql",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".xml": "xml",
  };
  return map[ext] ?? "";
}

/**
 * Choose a Markdown code fence that does not collide with content.
 * If content has ```, use ````, etc.
 */
function markdownFenceFor(content: string): string {
  const matches = content.match(/`{3,}/g) ?? [];
  const longest = matches.reduce((max, item) => Math.max(max, item.length), 3);
  return "`".repeat(longest + 1);
}

/* ------------------------------------------------------------------ */
/* Shell / clipboard                                                   */
/* ------------------------------------------------------------------ */

/** Run a command and capture output. */
function run(
  command: string,
  args: string[],
  options: { input?: string; cwd?: string; timeout?: number } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: options.cwd });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer =
      options.timeout
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, options.timeout)
        : undefined;

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out: ${command}`));
      } else {
        resolvePromise({ stdout, stderr, code: code ?? 0 });
      }
    });

    if (options.input !== undefined) {
      child.stdin?.end(options.input);
    } else {
      child.stdin?.end();
    }
  });
}

/** Copy text to the system clipboard. */
async function copyToClipboard(text: string): Promise<void> {
  const candidates: Array<[string, string[]]> =
    process.platform === "darwin"
      ? [["pbcopy", []]]
      : process.platform === "win32"
        ? [["clip", []]]
        : [
            ["wl-copy", []],
            ["xclip", ["-selection", "clipboard"]],
            ["xsel", ["--clipboard", "--input"]],
          ];

  const CLIPBOARD_TIMEOUT_MS = 5_000;
  let lastError: unknown;

  for (const [command, args] of candidates) {
    try {
      const result = await run(command, args, {
        input: text,
        timeout: CLIPBOARD_TIMEOUT_MS,
      });
      if (result.code === 0) return;
      lastError = new Error(
        result.stderr.trim() || `${command} exited with code ${result.code}`,
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No clipboard command available");
}

/* ------------------------------------------------------------------ */
/* Git + walk                                                          */
/* ------------------------------------------------------------------ */

/**
 * Use `git ls-files` to get tracked and untracked (non-ignored) files
 * for the requested paths. Returns null if git is unavailable.
 */
async function gitListFiles(
  cwd: string,
  requestedPaths: string[],
): Promise<string[] | null> {
  const args = [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ...requestedPaths,
  ];

  const result = await run("git", args, { cwd });
  if (result.code !== 0) return null;

  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map((p) => resolve(cwd, p));
}

/**
 * Fallback file walker. Recursively walks a directory, applying skip rules.
 */
async function walkDirectory(
  projectRoot: string,
  home: string,
  absolutePath: string,
): Promise<string[]> {
  const metadata = await stat(absolutePath);

  if (metadata.isFile()) return [absolutePath];
  if (!metadata.isDirectory()) return [];

  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const child = resolve(absolutePath, entry.name);

    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;

    const display = toDisplayPath(projectRoot, home, child);
    if (shouldSkipPath(display)) continue;

    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(projectRoot, home, child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }

  return files;
}

/* ------------------------------------------------------------------ */
/* Collection                                                          */
/* ------------------------------------------------------------------ */

async function collectFiles(
  projectRoot: string,
  home: string,
  rawPaths: string[],
  options: { allowExternal: boolean; allowSystemPaths: boolean; includeSensitive: boolean },
): Promise<{ files: FileEntry[]; rejected: string[]; externalSources: string[] }> {
  const files: FileEntry[] = [];
  const rejected: string[] = [];
  const externalSources: string[] = [];
  const seen = new Set<string>();

  for (const rawPath of rawPaths) {
    const normalized = normalizeInputPath(rawPath, projectRoot, home);
    let absPath: string;
    try {
      absPath = await canonicalizePath(normalized);
    } catch {
      rejected.push(`Invalid path: ${rawPath}`);
      continue;
    }

    const stats = await stat(absPath).catch(() => null);
    const isDirectory = stats?.isDirectory() ?? false;

    const policy = checkPathPolicy(
      absPath,
      projectRoot,
      home,
      options.allowExternal,
      options.allowSystemPaths,
      options.includeSensitive,
    );
    if (!policy.allowed) {
      rejected.push(policy.reason!);
      continue;
    }

    if (!isInside(projectRoot, absPath)) {
      externalSources.push(toDisplayPath(projectRoot, home, absPath));
    }

    let sourceFiles: string[];
    if (isDirectory) {
      if (isInside(projectRoot, absPath)) {
        const relPath = relative(projectRoot, absPath);
        const gitFiles = await gitListFiles(projectRoot, [relPath]);
        if (gitFiles) {
          sourceFiles = gitFiles;
        } else {
          sourceFiles = await walkDirectory(projectRoot, home, absPath);
        }
      } else {
        sourceFiles = await walkDirectory(projectRoot, home, absPath);
      }
    } else if (stats?.isFile()) {
      sourceFiles = [absPath];
    } else {
      rejected.push(`Not a file or directory: ${toDisplayPath(projectRoot, home, absPath)}`);
      continue;
    }

    for (const filePath of sourceFiles) {
      if (seen.has(filePath)) continue;
      seen.add(filePath);

      const kind = classifyPath(filePath, projectRoot, home);
      const display = toDisplayPath(projectRoot, home, filePath);

      if (shouldSkipPath(display)) continue;

      files.push({
        absolutePath: filePath,
        displayPath: display,
        sourceKind: kind,
      });
    }
  }

  files.sort((a, b) => a.displayPath.localeCompare(b.displayPath));

  return { files, rejected, externalSources: [...new Set(externalSources)] };
}

/* ------------------------------------------------------------------ */
/* Bundle builder                                                      */
/* ------------------------------------------------------------------ */

async function buildContextBundle(
  projectRoot: string,
  files: FileEntry[],
  externalSources: string[],
  maxFileBytes: number,
  maxTotalBytes: number,
): Promise<{
  text: string;
  included: number;
  skipped: string[];
  totalBytes: number;
  sensitiveCount: number;
}> {
  let totalBytes = 0;
  let included = 0;
  let sensitiveCount = 0;
  const skipped: string[] = [];
  const sections: string[] = [];

  for (const file of files) {
    const metadata = await stat(file.absolutePath);

    if (metadata.size > maxFileBytes) {
      skipped.push(`${file.displayPath} — skipped, file too large (${metadata.size} bytes)`);
      continue;
    }

    const buffer = await readFile(file.absolutePath);

    if (isProbablyBinary(buffer)) {
      skipped.push(`${file.displayPath} — skipped, binary-looking file`);
      continue;
    }

    if (totalBytes + buffer.length > maxTotalBytes) {
      skipped.push(`${file.displayPath} — skipped, total size limit reached`);
      continue;
    }

    const content = buffer.toString("utf8");

    if (looksLikeSecretContent(content)) {
      skipped.push(`${file.displayPath} — skipped, sensitive content detected`);
      sensitiveCount++;
      continue;
    }

    const language = languageForPath(file.displayPath);
    const fence = markdownFenceFor(content);

    sections.push(
      [
        `## File: ${file.displayPath}`,
        "",
        `${fence}${language}`,
        content.trimEnd(),
        fence,
      ].join("\n"),
    );

    totalBytes += buffer.length;
    included++;
  }

  const header = [
    "# Context snapshot",
    "",
    `Project root: ${projectRoot}`,
    `Generated: ${new Date().toISOString()}`,
    `Included files: ${included}`,
    `Approx content bytes: ${totalBytes}`,
  ];

  if (externalSources.length > 0) {
    header.push("");
    header.push("External sources:");
    for (const src of externalSources) {
      header.push(`- ${src}`);
    }
  }

  if (skipped.length > 0) {
    header.push(
      "",
      "## Skipped files",
      "",
      ...skipped.map((item) => `- ${item}`),
    );
  }

  header.push(
    "",
    "Purpose: use this as project context for ChatGPT or another assistant.",
    "Each file section includes the path relative to its source root.",
  );

  return {
    text: [...header, "", ...sections].join("\n"),
    included,
    skipped,
    totalBytes,
    sensitiveCount,
  };
}

/* ------------------------------------------------------------------ */
/* Usage + command                                                     */
/* ------------------------------------------------------------------ */

function usageText(): string {
  return [
    "Usage:",
    "  /copy-context <file-or-folder...>",
    "  /copy-context --all",
    "  /copy-context src docs README.md",
    "  /copy-context src docs --out chatgpt-context.md",
    "  /copy-context --all --max-total-kb=5000",
    "  /copy-context ~/.pi/agent/extensions/copy-context.ts",
    "  /copy-context ~/.pi/agent/extensions --allow-external",
    "  /copy-context src ~/.pi/agent/extensions --out context.md --allow-external-output",
  ].join("\n");
}

async function runCopy(
  projectRoot: string,
  args: unknown,
  ctx: Parameters<Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]>[1],
) {
  await ctx.waitForIdle();

  try {
    const { paths, options } = parseArgs(String(args ?? "").trim());
    const requestedPaths = options.all ? ["."] : paths;

    if (requestedPaths.length === 0) {
      ctx.ui.notify(usageText(), "info");
      return;
    }

    const home = homedir();

    const { files, rejected, externalSources } = await collectFiles(
      projectRoot,
      home,
      requestedPaths,
      {
        allowExternal: options.allowExternal,
        allowSystemPaths: options.allowSystemPaths,
        includeSensitive: options.includeSensitive,
      },
    );

    if (rejected.length > 0) {
      for (const reason of rejected) {
        ctx.ui.notify(reason, "warning");
      }
    }

    if (files.length === 0) {
      ctx.ui.notify("No matching files found", "info");
      return;
    }

    const bundle = await buildContextBundle(
      projectRoot,
      files,
      externalSources,
      options.maxFileBytes,
      options.maxTotalBytes,
    );

    if (bundle.included === 0) {
      ctx.ui.notify(
        "No files copied after size, binary, secret, and ignore filters",
        "info",
      );
      return;
    }

    if (options.out) {
      const outputPath = normalizeInputPath(options.out, projectRoot, home);

      if (!isInside(projectRoot, outputPath)) {
        if (options.allowExternalOutput) {
          // allowed
        } else if (ctx.hasUI) {
          const confirmed = await ctx.ui.confirm(
            "Write outside project root?",
            `Write context bundle to ${toDisplayPath(projectRoot, home, outputPath)}?`,
          );
          if (!confirmed) {
            ctx.ui.notify("Write cancelled", "info");
            return;
          }
        } else {
          throw new Error(
            `Refusing to write outside project root without --allow-external-output: ${toDisplayPath(projectRoot, home, outputPath)}`,
          );
        }
      }

      const parentDir = dirname(outputPath);
      try {
        await mkdir(parentDir, { recursive: true });
      } catch {
        throw new Error(`Failed to create output directory: ${parentDir}`);
      }

      await writeFile(outputPath, bundle.text, "utf8");
      const relativeOut = toDisplayPath(projectRoot, home, outputPath);
      const tokenCount = encode(bundle.text).length;
      const tokenLabel = `${tokenCount.toLocaleString()} tokens`;
      let msg = `Wrote ${bundle.included} files to ${relativeOut} (${tokenLabel})`;
      if (bundle.skipped.length > 0) {
        msg += `, skipped ${bundle.skipped.length}`;
      }
      ctx.ui.notify(msg, "info");
      return;
    }

    await copyToClipboard(bundle.text);

    const tokenCount = encode(bundle.text).length;
    const tokenLabel = `${tokenCount.toLocaleString()} tokens`;
    let msg = `Copied ${bundle.included} files to clipboard (${tokenLabel})`;
    if (bundle.skipped.length > 0) {
      msg += `, skipped ${bundle.skipped.length}`;
    }
    if (bundle.sensitiveCount > 0) {
      msg += ` (${bundle.sensitiveCount} sensitive)`;
    }
    if (externalSources.length > 0) {
      msg += ` [external: ${externalSources.join(", ")}]`;
    }
    ctx.ui.notify(msg, "info");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`copy-context failed: ${message}`, "error");
    throw error;
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("copy-context", {
    description:
      "Copy selected files/folders as a ChatGPT-ready Markdown context bundle",

    handler: async (args, ctx) => {
      const projectRoot = resolve(ctx.cwd ?? process.cwd());
      await runCopy(projectRoot, args, ctx);
    },
  });
}

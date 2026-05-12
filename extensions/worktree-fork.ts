import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as os from "node:os";
import { promises as fs } from "node:fs";
import { createForkedSession, buildPiForkStartupInput } from "./lib/fork-utils";

/**
 * Normalize a filesystem path by removing trailing slashes.
 */
function normalizePath(p: string): string {
	return p.replace(/\/+$/, "");
}

/**
 * Slugify a string for use as a git branch name component.
 * Keeps lowercase alphanumeric and hyphens, max 50 chars.
 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.replace(/-+/g, "-")
		.slice(0, 50);
}

function branchNameFromText(text: string, suffix?: string): string {
	const slug = slugify(text) || "fork";
	return suffix ? `pi/${slug}-${suffix}` : `pi/${slug}`;
}

/**
 * Find the Supacode repo path that matches a given git worktree root.
 */
function findRepoPath(
	gitRoot: string,
	settings: { repositories?: Record<string, unknown> },
): string | undefined {
	const normalizedGitRoot = normalizePath(gitRoot);
	const matches = Object.keys(settings.repositories ?? {}).filter((rp) => {
		const normalizedRepo = normalizePath(rp);
		return (
			normalizedGitRoot === normalizedRepo ||
			normalizedGitRoot.startsWith(normalizedRepo + "/")
		);
	});

	return matches.sort(
		(a, b) => normalizePath(b).length - normalizePath(a).length,
	)[0];
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand("worktree-fork", {
		description:
			"Fork this session into a new isolated Supacode worktree. " +
			"Usage: /worktree-fork <description of what to work on>",
		handler: async (args, ctx) => {
			// ── Helper: run a git predicate check (exit 0 = found) ─────────

			async function gitCheck(
				...cmd: string[]
			): Promise<boolean> {
				const result = await pi.exec("git", cmd);
				return result.code === 0;
			}

			async function validateBranchName(name: string): Promise<boolean> {
				const result = await pi.exec("git", [
					"check-ref-format",
					"--branch",
					name,
				]);
				if (result.code === 0) return true;

				const reason =
					result.stderr?.trim() || result.stdout?.trim() || "invalid format";
				ctx.ui.notify(`Invalid branch name "${name}": ${reason}`, "error");
				ctx.ui.setStatus("worktree-fork", undefined);
				return false;
			}

			// ── Helper: check if a branch exists locally or on remote ──────

			async function checkBranchExists(
				name: string,
			): Promise<"local" | "remote" | false> {
				if (
					await gitCheck("show-ref", "--verify", "--quiet", `refs/heads/${name}`)
				) {
					return "local";
				}
				if (
					await gitCheck(
						"show-ref",
						"--verify",
						"--quiet",
						`refs/remotes/origin/${name}`,
					)
				) {
					return "remote";
				}
				return false;
			}

			// ── Helper: ask user what to do when branch name conflicts ──────

			async function resolveBranchConflict(
				baseName: string,
				where: "local" | "remote",
			): Promise<string | undefined> {
				const location = where === "local" ? "locally" : "on remote origin";
				const choice = await ctx.ui.select(
					`Branch "${baseName}" already exists ${location}. What to do?`,
					[
						"auto — append counter (e.g., my-feature-2)",
						"rename — type a different name",
						"cancel — abort worktree creation",
					],
				);
				if (!choice || choice.startsWith("cancel")) return undefined;

				if (choice.startsWith("rename")) {
					const name = await ctx.ui.input("New branch name:", "");
					if (!name) return undefined;
					return branchNameFromText(name);
				}

				// Auto-append counter: try suffix -2, -3, ... -99
				const bare = baseName.replace(/^pi\//, "");
				for (let i = 2; i <= 99; i++) {
					const candidate = `pi/${bare}-${i}`;
					const exists = await checkBranchExists(candidate);
					if (!exists) return candidate;
				}
				return undefined;
			}

			// ── Helper: read Supacode settings ─────────────────────────────

			const settingsPath = path.join(os.homedir(), ".supacode", "settings.json");

			async function readSupacodeSettings(): Promise<{
				repositories?: Record<string, unknown>;
			}> {
				const raw = await fs.readFile(settingsPath, "utf8");
				return JSON.parse(raw);
			}

			// ── Prerequisites check ──────────────────────────────────────

			if (!process.env["SUPACODE_SOCKET_PATH"]) {
				ctx.ui.notify(
					"/worktree-fork requires a Supacode terminal session.",
					"error",
				);
				return;
			}

			const isBusy = !ctx.isIdle();
			const prompt = args.trim();

			// ── 1. Verify this is a git repo ─────────────────────────────

			ctx.ui.setStatus("worktree-fork", "Checking git repository...");

			const gitRootResult = await pi.exec("git", [
				"rev-parse",
				"--show-toplevel",
			]);
			if (gitRootResult.code !== 0) {
				ctx.ui.notify(
					"Current directory is not inside a git repository. " +
						"Supacode worktrees require git.",
					"error",
				);
				ctx.ui.setStatus("worktree-fork", undefined);
				return;
			}
			const gitRoot = gitRootResult.stdout.trim();

			ctx.ui.setStatus("worktree-fork", "Checking working tree...");
			const statusResult = await pi.exec("git", ["status", "--porcelain"]);
			if (statusResult.code !== 0) {
				const reason =
					statusResult.stderr?.trim() ||
					statusResult.stdout?.trim() ||
					"unknown error";
				ctx.ui.notify(`Could not check working tree status: ${reason}`, "error");
				ctx.ui.setStatus("worktree-fork", undefined);
				return;
			}
			if (statusResult.stdout.trim()) {
				ctx.ui.notify(
					"Working tree has uncommitted or untracked files. Commit or stash them before /worktree-fork so the new worktree contains the code this session references.",
					"error",
				);
				ctx.ui.setStatus("worktree-fork", undefined);
				return;
			}

			// ── 2. Determine the Supacode repo ───────────────────────────

			ctx.ui.setStatus("worktree-fork", "Finding Supacode repo...");

			let settings = await readSupacodeSettings();
			let repoPath = findRepoPath(gitRoot, settings);

			// Auto-register if not found
			if (!repoPath) {
				ctx.ui.setStatus("worktree-fork", "Registering repo with Supacode...");
				const openResult = await pi.exec("supacode", [
					"repo",
					"open",
					gitRoot,
				]);
				if (openResult.code !== 0) {
					ctx.ui.notify(
						"Could not register this repo with Supacode. " +
							"Try adding it in Supacode's settings first.",
						"error",
					);
					ctx.ui.setStatus("worktree-fork", undefined);
					return;
				}
				settings = await readSupacodeSettings();
				repoPath = findRepoPath(gitRoot, settings);
				if (!repoPath) {
					ctx.ui.notify(
						"Repo was registered but path lookup failed. " +
							"This shouldn't happen.",
						"error",
					);
					ctx.ui.setStatus("worktree-fork", undefined);
					return;
				}
			}

			// Repo ID = percent-encoded path (matches `supacode repo list` output)
			const repoId = encodeURIComponent(repoPath);

			// ── 3. Derive branch name ────────────────────────────────────

			let branchName: string;
			if (prompt) {
				const suffix = Date.now().toString(36).slice(-6);
				branchName = branchNameFromText(prompt, suffix);
			} else {
				const input = await ctx.ui.input(
					"Branch name for new worktree:",
					"my-feature",
				);
				if (!input) {
					ctx.ui.notify("Worktree fork cancelled.", "info");
					ctx.ui.setStatus("worktree-fork", undefined);
					return;
				}
				branchName = branchNameFromText(input);
			}

			if (!(await validateBranchName(branchName))) return;

			// ── 4. Check if branch name already exists ───────────────────

			const branchExists = await checkBranchExists(branchName);
			if (branchExists) {
				const resolved = await resolveBranchConflict(
					branchName,
					branchExists,
				);
				if (!resolved) {
					ctx.ui.notify("Worktree fork cancelled.", "info");
					ctx.ui.setStatus("worktree-fork", undefined);
					return;
				}
				if (!(await validateBranchName(resolved))) return;
				const resolvedExists = await checkBranchExists(resolved);
				if (resolvedExists) {
					ctx.ui.notify(
						`Branch "${resolved}" already exists. Worktree fork cancelled.`,
						"error",
					);
					ctx.ui.setStatus("worktree-fork", undefined);
					return;
				}
				branchName = resolved;
			}

			// ── 5. Detect current branch for --base ──────────────────────

			const currentBranchResult = await pi.exec("git", [
				"rev-parse",
				"--abbrev-ref",
				"HEAD",
			]);
			const currentBranch =
				currentBranchResult.code === 0
					? currentBranchResult.stdout.trim()
					: undefined;
			const baseRef =
				currentBranch && currentBranch !== "HEAD"
					? currentBranch
					: undefined;

			// ── 6. Prepare worktree lookup helpers ───────────────────────

			const sleep = (ms: number) =>
				new Promise((resolve) => setTimeout(resolve, ms));

			function stripAnsi(text: string): string {
				return text.replace(/\x1b\[[0-9;]*m/g, "");
			}

			async function listWorktreeIds(): Promise<string[] | undefined> {
				const result = await pi.exec("supacode", ["worktree", "list"]);
				if (result.code !== 0) {
					const reason =
						result.stderr?.trim() || result.stdout?.trim() || "unknown error";
					ctx.ui.notify(`Failed to list Supacode worktrees: ${reason}`, "error");
					ctx.ui.setStatus("worktree-fork", undefined);
					return undefined;
				}
				return stripAnsi(result.stdout)
					.split("\n")
					.map((line) => line.trim())
					.filter(Boolean);
			}

			function worktreeIdMatchesBranch(id: string): boolean {
				const cleanId = id.replace(/^folder:/, "");
				const decoded = decodeURIComponent(cleanId).replace(/\/+$/, "");
				return decoded.endsWith(`/${branchName}`);
			}

			const beforeWorktreeIdsList = await listWorktreeIds();
			if (!beforeWorktreeIdsList) return;
			const beforeWorktreeIds = new Set(beforeWorktreeIdsList);

			// ── 7. Fork the pi session ───────────────────────────────────

			ctx.ui.setStatus("worktree-fork", "Forking session...");
			const forkedSessionFile = await createForkedSession(ctx);

			// ── 8. Create the Supacode worktree ──────────────────────────

			ctx.ui.setStatus("worktree-fork", "Creating worktree...");

			const wtArgs = [
				"repo",
				"worktree-new",
				"-r",
				repoId,
				"--branch",
				branchName,
				"--fetch",
			];
			if (baseRef) wtArgs.push("--base", baseRef);

			const wtResult = await pi.exec("supacode", wtArgs);
			if (wtResult.code !== 0) {
				const reason =
					wtResult.stderr?.trim() ||
					wtResult.stdout?.trim() ||
					"unknown error";
				ctx.ui.notify(`Failed to create worktree: ${reason}`, "error");
				ctx.ui.setStatus("worktree-fork", undefined);
				return;
			}

			// ── 9. Resolve the real Supacode worktree ID ─────────────────

			ctx.ui.setStatus("worktree-fork", "Waiting for worktree...");

			let worktreeId: string | undefined;
			for (let attempt = 1; attempt <= 12; attempt++) {
				const ids = await listWorktreeIds();
				if (!ids) return;
				worktreeId =
					ids.find(
						(id) => !beforeWorktreeIds.has(id) && worktreeIdMatchesBranch(id),
					) ?? ids.find(worktreeIdMatchesBranch);
				if (worktreeId) break;

				ctx.ui.setStatus(
					"worktree-fork",
					`Waiting for worktree to appear... (${attempt}/12)`,
				);
				await sleep(1000);
			}

			if (!worktreeId) {
				ctx.ui.notify(
					`Worktree "${branchName}" was created but Supacode did not expose its ID yet. ` +
						"Try opening pi manually in that worktree.",
					"warning",
				);
				ctx.ui.setStatus("worktree-fork", undefined);
				return;
			}

			// ── 10. Open a tab in the new worktree with pi ───────────────

			ctx.ui.setStatus("worktree-fork", "Opening pi in new worktree...");

			// Run Pi's built-in cross-project fork inside the new worktree.
			// This creates the new session in the worktree's own session dir,
			// sets cwd correctly, and preserves parentSession metadata.
			const startupInput = buildPiForkStartupInput(forkedSessionFile, prompt);

			// Supacode can list a newly-created worktree before its terminal
			// target is ready. If we call `tab new -i` too soon, the tab may
			// open but drop the initial input, leaving an empty terminal.
			ctx.ui.setStatus(
				"worktree-fork",
				"Waiting for Supacode worktree terminal...",
			);
			await sleep(4000);

			let tabResult: Awaited<ReturnType<typeof pi.exec>> | undefined;
			for (let attempt = 1; attempt <= 5; attempt++) {
				tabResult = await pi.exec("supacode", [
					"tab",
					"new",
					"-w",
					worktreeId,
					"-i",
					startupInput,
				]);

				if (tabResult.code === 0) break;

				ctx.ui.setStatus(
					"worktree-fork",
					`Waiting for worktree tab target... (${attempt}/5)`,
				);
				await sleep(attempt * 1500);
			}

			if (!tabResult || tabResult.code !== 0) {
				const reason =
					tabResult?.stderr?.trim() ||
					tabResult?.stdout?.trim() ||
					"unknown error";
				ctx.ui.notify(
					`Worktree created but failed to open pi tab: ${reason}`,
					"warning",
				);
				ctx.ui.setStatus("worktree-fork", undefined);
				return;
			}

			const tabId = tabResult.stdout.trim();

			// ── 11. Focus the new worktree and the pi tab ────────────────

			await pi.exec("supacode", [
				"worktree",
				"focus",
				"-w",
				worktreeId,
			]);

			if (tabId) {
				await pi.exec("supacode", [
					"tab",
					"focus",
					"-w",
					worktreeId,
					"-t",
					tabId,
				]);
			}

			// ── Done ─────────────────────────────────────────────────────

			ctx.ui.setStatus("worktree-fork", undefined);

			const sessionNote = forkedSessionFile
				? "session fork command sent"
				: "no session to fork (ephemeral)";
			ctx.ui.notify(
				`Forked to worktree ${branchName} — ${sessionNote}.`,
				forkedSessionFile ? "success" : "warning",
			);

			if (isBusy) {
				ctx.ui.notify(
					"Original session continues. The fork captures state up to this turn.",
					"info",
				);
			}
		},
	});
}

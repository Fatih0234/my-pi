import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";

type Parsed = {
  outPath: string;
  focus: string;
};

function parseArgs(args: string | undefined): Parsed {
  const result: Parsed = { outPath: "", focus: "" };
  const tokens = args?.split(/\s+/).filter(Boolean) ?? [];
  let flag: string | null = null;
  const flagValues: string[] = [];

  for (const t of tokens) {
    if (t === "--path" || t === "-p" || t === "--focus" || t === "-f") {
      if (flag) {
        if (flag === "--path" || flag === "-p") result.outPath = flagValues.join(" ");
        else result.focus = flagValues.join(" ");
      }
      flag = t;
      flagValues.length = 0;
    } else if (flag) {
      flagValues.push(t);
    }
  }

  if (flag) {
    if (flag === "--path" || flag === "-p") result.outPath = flagValues.join(" ");
    else result.focus = flagValues.join(" ");
  }

  return result;
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("handoff", {
    description: "Hand off the current session to another agent",
    handler: async (args: string | undefined, ctx) => {
      const parsed = parseArgs(args);

      if (!parsed.outPath) {
        const tmp = process.env.TMPDIR ?? process.env.TMP ?? "/tmp";
        const project = path.basename(ctx.cwd);
        const date = new Date().toISOString().slice(0, 10);
        parsed.outPath = `${tmp}/handoff-${project}-${date}.md`;
      }

      let instruction = `Write a handoff document that summarizes this session so a fresh agent can continue the work.\n\n`;
      instruction += `## Output location\nSave the file to \`${parsed.outPath}\`. Create parent directories if needed.\n`;
      instruction += `Then report back that the handoff was saved.\n\n`;
      instruction += `## Document structure\n\n`;
      instruction += `### 1. Session summary\nOne paragraph: what was this session about, what was accomplished.\n\n`;
      instruction += `### 2. Current state\n- What's been implemented or changed\n- What's pending or blocked (with why)\n- Key decisions made and their rationale\n- Open questions or unresolved issues\n\n`;
      instruction += `### 3. Relevant artifacts\nReference existing artifacts by path or URL — do NOT duplicate their content:\n- Files changed (git diff summary or file list)\n- Plans, PRDs, ADRs, design docs\n- Commits, PRs, issues\n- Test results or error logs\n\n`;
      instruction += `### 4. Suggested skills\nList skills the next agent should invoke to continue the work, with a one-line reason for each.\n\n`;
      instruction += `### 5. Risks and gotchas\nThings the next agent should be careful about — known pitfalls, half-finished work, environment requirements.\n\n`;
      instruction += `## Rules\n- Do NOT include sensitive information.\n- Do NOT duplicate content from other artifacts — reference them by path.\n- Keep it concise. A fresh agent should pick up and continue within 2 minutes.\n`;

      if (parsed.focus) {
        instruction += `\n## Focus\nTailor the handoff around this: ${parsed.focus}\n`;
      }

      ctx.ui.notify(`Generating handoff → ${parsed.outPath}`, "info");
      pi.sendUserMessage(instruction);
    },
  });
}

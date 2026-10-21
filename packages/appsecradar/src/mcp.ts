import { existsSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { renderMarkdown } from "./report/markdown.js";
import { rules } from "./rules/index.js";
import { scan } from "./scanner.js";
import { SEVERITY_ORDER } from "./types.js";

const VERSION: string = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const AGENT_GUIDE = `
Workflow for the agent:
1. Fix findings in order (critical first). Each finding's "How to fix" says exactly what to change.
2. After fixing, call \`scan\` again with \`files\` set to the files you changed to confirm the finding is gone.
3. Leaked secrets stay leaked even after removing them from code: tell the user which keys to rotate. Never rotate keys or touch dashboards yourself.
4. Do not silence findings with "appsecradar-ignore" unless the user confirms it is a false positive.`;

export function createServer(): McpServer {
  const server = new McpServer({ name: "appsecradar", version: VERSION });

  server.registerTool(
    "scan",
    {
      title: "Scan project for security issues",
      description:
        "Scan a project folder for the security mistakes AI coding tools make most often: hardcoded or public secrets, " +
        "Supabase tables without RLS, open Firebase rules, unverified Stripe webhooks, API routes without auth, " +
        "SQL injection, permissive CORS and debug mode. Returns each finding with file, line, impact and exact fix instructions. " +
        "Read-only: it never modifies files.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe("Project folder to scan. Absolute, or relative to the server's working directory. Defaults to the working directory."),
        min_severity: z
          .enum(["critical", "high", "medium", "low"])
          .optional()
          .describe("Only report findings at or above this severity. Defaults to low (everything)."),
        files: z
          .array(z.string())
          .optional()
          .describe("Only report findings in these files (paths relative to the project root). Use after a fix to verify it."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ path, min_severity, files }) => {
      const root = resolve(process.cwd(), path ?? ".");
      if (!existsSync(root) || !statSync(root).isDirectory()) {
        return { isError: true, content: [{ type: "text", text: `Not a directory: ${root}` }] };
      }

      const result = scan(root);
      const threshold = SEVERITY_ORDER.indexOf(min_severity ?? "low");
      const wanted = files?.map((f) => normalize(root, f));
      const findings = result.findings.filter(
        (f) => SEVERITY_ORDER.indexOf(f.severity) <= threshold && (!wanted || wanted.includes(f.file)),
      );

      const text = renderMarkdown(result, findings) + (findings.length > 0 ? "\n" + AGENT_GUIDE : "");
      return {
        content: [{ type: "text", text }],
        structuredContent: {
          root: result.root,
          score: result.score,
          stacks: result.stacks,
          filesScanned: result.filesScanned,
          findings,
        },
      };
    },
  );

  server.registerTool(
    "list_rules",
    {
      title: "List appsecradar rules",
      description: "List every security check appsecradar runs, with what it catches and why it matters.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: rules.map((r) => `- **${r.id}**: ${r.title}. ${r.description}`).join("\n"),
        },
      ],
    }),
  );

  server.registerPrompt(
    "secure_my_app",
    {
      title: "Secure my app",
      description: "Scan the project with appsecradar, fix the issues one by one, and verify each fix.",
      argsSchema: {
        path: z.string().optional().describe("Project folder (defaults to the current project)."),
      },
    },
    ({ path }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Run a security pass on my app${path ? ` in ${path}` : ""} using the appsecradar \`scan\` tool.\n\n` +
              `1. Scan and give me a short summary: score, detected stack, and the findings grouped by severity.\n` +
              `2. Fix the critical and high findings one at a time, following each finding's "How to fix" instructions ` +
              `and the conventions already used in my codebase. Explain each change in one sentence.\n` +
              `3. After each fix, re-run \`scan\` with \`files\` set to the changed files to verify it.\n` +
              `4. Finish with: what you fixed, what is left (medium/low), and a checklist of any keys I must rotate ` +
              `in provider dashboards (do not try to rotate them yourself).\n` +
              `Ask me before making changes that alter app behaviour, such as auth requirements on existing endpoints.`,
          },
        },
      ],
    }),
  );

  return server;
}

function normalize(root: string, file: string): string {
  const abs = resolve(root, file);
  return relative(root, abs).split(sep).join("/");
}

export async function startMcpServer(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  // stdout belongs to the protocol; diagnostics go to stderr.
  console.error(`appsecradar MCP server ${VERSION} running on stdio`);
}

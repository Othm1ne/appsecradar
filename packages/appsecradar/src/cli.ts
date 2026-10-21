#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { scan } from "./scanner.js";
import { renderMarkdown } from "./report/markdown.js";
import { renderTerminal } from "./report/terminal.js";
import { SEVERITY_ORDER, type Severity } from "./types.js";

const HELP = `
Usage: appsecradar [path] [options]
       appsecradar mcp        Start the MCP server (for Cursor, Claude Code, Windsurf...)

Scan a project for the security mistakes AI coding tools make most often.

Options:
  --json               Print findings as JSON
  --markdown           Print findings as Markdown
  --fail-on <level>    Exit with code 1 if a finding is at or above this level
                       (critical | high | medium | low | none). Default: high
  --no-color           Disable colors
  -v, --version        Print version
  -h, --help           Show this help
`;

function main(argv: string[]): number {
  let target = ".";
  let json = false;
  let markdown = false;
  let color = process.stdout.isTTY && !process.env.NO_COLOR;
  let failOn: Severity | "none" = "high";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      console.log(HELP);
      return 0;
    } else if (arg === "-v" || arg === "--version") {
      const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
      console.log(pkg.version);
      return 0;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--markdown") {
      markdown = true;
    } else if (arg === "--no-color") {
      color = false;
    } else if (arg === "--fail-on") {
      const level = argv[++i];
      if (level !== "none" && !SEVERITY_ORDER.includes(level as Severity)) {
        console.error(`Invalid --fail-on value: ${level}`);
        return 2;
      }
      failOn = level as Severity | "none";
    } else if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}\n${HELP}`);
      return 2;
    } else {
      target = arg;
    }
  }

  if (!existsSync(target)) {
    console.error(`Path not found: ${target}`);
    return 2;
  }

  const result = scan(target);
  console.log(
    json
      ? JSON.stringify(result, null, 2)
      : markdown
        ? renderMarkdown(result)
        : renderTerminal(result, Boolean(color)),
  );

  if (failOn === "none") return 0;
  const threshold = SEVERITY_ORDER.indexOf(failOn);
  return result.findings.some((f) => SEVERITY_ORDER.indexOf(f.severity) <= threshold) ? 1 : 0;
}

const args = process.argv.slice(2);
if (args[0] === "mcp") {
  // Loaded lazily so plain scans don't pay for the MCP SDK.
  const { startMcpServer } = await import("./mcp.js");
  await startMcpServer();
} else {
  process.exitCode = main(args);
}

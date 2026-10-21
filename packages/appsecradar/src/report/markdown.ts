import { SEVERITY_ORDER, type Finding, type ScanResult } from "../types.js";

const ICON = { critical: "🔴", high: "🟠", medium: "🟡", low: "⚪" } as const;

/** Markdown report, used by the MCP server and `--markdown` (e.g. for PR comments). */
export function renderMarkdown(result: ScanResult, findings: Finding[] = result.findings): string {
  const out: string[] = [];
  out.push(`# appsecradar report`);
  out.push("");
  out.push(`- **Score:** ${result.score}/100`);
  out.push(`- **Files scanned:** ${result.filesScanned}`);
  if (result.stacks.length > 0) out.push(`- **Detected stack:** ${result.stacks.join(", ")}`);

  if (findings.length === 0) {
    out.push("");
    out.push("✅ No issues found by the current rules. This does not prove the app is secure.");
    return out.join("\n");
  }

  const counts = SEVERITY_ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ");
  out.push(`- **Findings:** ${counts}`);
  out.push("");

  findings.forEach((f, i) => {
    out.push(`## ${i + 1}. ${ICON[f.severity]} ${f.severity.toUpperCase()}: ${f.title}`);
    out.push("");
    out.push(`- **Location:** \`${f.file}:${f.line}\``);
    out.push(`- **Rule:** \`${f.ruleId}\``);
    out.push("");
    out.push(f.message);
    out.push("");
    out.push(`**How to fix:** ${f.fixPrompt}`);
    out.push("");
  });
  return out.join("\n");
}

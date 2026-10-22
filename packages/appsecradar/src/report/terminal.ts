import { SEVERITY_ORDER, type ScanResult, type Severity } from "../types.js";

export function renderTerminal(result: ScanResult, useColor: boolean): string {
  const c = colors(useColor);
  const badge: Record<Severity, (s: string) => string> = {
    critical: (s) => c.bgRed(c.bold(` ${s} `)),
    high: (s) => c.red(c.bold(s)),
    medium: (s) => c.yellow(c.bold(s)),
    low: (s) => c.dim(s),
  };

  const out: string[] = [];
  out.push("");
  out.push(c.bold("  appsecradar") + c.dim("  security check for AI-built apps"));
  out.push(c.dim(`  scanned ${result.filesScanned} files in ${result.root}`));
  if (result.stacks.length > 0) out.push(c.dim("  detected: ") + result.stacks.join(", "));
  out.push("");

  if (result.findings.length === 0) {
    out.push(c.green("  ✔ No issues found by the current rules."));
     out.push(c.dim("    This means none of the known AI-code mistakes were detected."));
    return out.join("\n");
  }

  for (const f of result.findings) {
    out.push(`  ${badge[f.severity](f.severity.toUpperCase())}  ${c.bold(f.title)}`);
    out.push(c.cyan(`  ${f.file}:${f.line}`) + c.dim(`  [${f.ruleId}]`));
    out.push(wrap(f.message, 4));
    out.push(c.dim("    Fix prompt (paste into your AI editor):"));
    out.push(c.dim(wrap(f.fixPrompt, 6)));
    out.push("");
  }

  const counts = SEVERITY_ORDER.map((s) => [s, result.findings.filter((f) => f.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => badge[s](`${n} ${s}`))
    .join(c.dim(" · "));

  const scoreColor = result.score >= 80 ? c.green : result.score >= 50 ? c.yellow : c.red;
  out.push(`  ${c.bold("Score:")} ${scoreColor(c.bold(`${result.score}/100`))}   ${counts}`);
  if (result.findings.some((f) => f.severity === "critical")) {
    out.push(c.red(c.bold("  Verdict: do not ship yet. Fix the critical issues first.")));
  }
  out.push("");
  return out.join("\n");
}

function wrap(text: string, indent: number, width = 96): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if ((current + " " + word).trim().length > width - indent) {
      lines.push(pad + current.trim());
      current = word;
    } else {
      current += " " + word;
    }
  }
  if (current.trim()) lines.push(pad + current.trim());
  return lines.join("\n");
}

function colors(enabled: boolean) {
  const wrapCode = (open: number, close: number) => (s: string) =>
    enabled ? `\x1b[${open}m${s}\x1b[${close}m` : s;
  return {
    bold: wrapCode(1, 22),
    dim: wrapCode(2, 22),
    red: wrapCode(31, 39),
    green: wrapCode(32, 39),
    yellow: wrapCode(33, 39),
    cyan: wrapCode(36, 39),
    bgRed: wrapCode(41, 49),
  };
}

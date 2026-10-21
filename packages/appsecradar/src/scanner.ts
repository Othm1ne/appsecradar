import { resolve } from "node:path";
import { loadProject } from "./project.js";
import { rules as defaultRules } from "./rules/index.js";
import { SEVERITY_ORDER, type Finding, type Rule, type ScanResult, type Severity } from "./types.js";

const PENALTY: Record<Severity, number> = { critical: 25, high: 10, medium: 4, low: 1 };

export function scan(root: string, rules: Rule[] = defaultRules): ScanResult {
  const project = loadProject(resolve(root));
  const findings: Finding[] = rules.flatMap((rule) => rule.check(project));

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );

  const score = Math.max(0, 100 - findings.reduce((sum, f) => sum + PENALTY[f.severity], 0));
  return { root: project.root, filesScanned: project.files.length, stacks: project.stacks, findings, score };
}

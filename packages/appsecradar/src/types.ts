export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export interface SourceFile {
  /** Path relative to the scanned root, always with forward slashes. */
  path: string;
  content: string;
  /** Best-effort guess: does this file end up in the browser bundle? */
  isClient: boolean;
}

export interface Project {
  root: string;
  files: SourceFile[];
  /** Frameworks and services detected from manifests, e.g. ["Next.js", "Supabase"]. */
  stacks: string[];
  /** True when a Next.js middleware file exists (may protect API routes). */
  hasMiddleware: boolean;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  title: string;
  file: string;
  line: number;
  /** What is wrong and what an attacker can do with it, in plain language. */
  message: string;
  /** A prompt the user can paste into Cursor / Claude Code / Lovable to fix it. */
  fixPrompt: string;
}

export interface Rule {
  id: string;
  title: string;
  description: string;
  check(project: Project): Finding[];
}

export interface ScanResult {
  root: string;
  filesScanned: number;
  stacks: string[];
  findings: Finding[];
  score: number;
}

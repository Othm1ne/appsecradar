import { isIgnored, lineOf } from "../project.js";
import type { Finding, Rule, Severity } from "../types.js";

interface Check {
  regex: RegExp;
  severity: Severity;
  title: string;
  message: string;
}

// Matches only unconditional `allow x;` or `allow x: if true;` statements.
const OPEN_WRITE: Check = {
  regex: /allow\s+[\w\s,]*\b(write|create|update|delete)\b[\w\s,]*(?::\s*if\s+true\s*)?;/g,
  severity: "critical",
  title: "Anyone can write to your Firebase database",
  message: "This rule lets anyone on the internet create, change or delete data. No login needed.",
};

const OPEN_READ: Check = {
  regex: /allow\s+[\w\s,]*\b(read|get|list)\b[\w\s,]*(?::\s*if\s+true\s*)?;/g,
  severity: "high",
  title: "Anyone can read this Firebase data",
  message: "This rule lets anyone on the internet read this data. Fine for truly public content, dangerous for anything else.",
};

const TEST_MODE: Check = {
  regex: /allow\s+[^;]*if\s+request\.time\s*<\s*timestamp\.date\([^;]*;/g,
  severity: "critical",
  title: "Firebase is still in test mode",
  message:
    "Test-mode rules allow anyone to read and write everything until the date expires, and the app breaks when it does.",
};

const ANY_SIGNED_IN: Check = {
  regex: /match\s+\/\{document=\*\*\}\s*\{[^}]*allow\s+[^;]*if\s+request\.auth\s*!=\s*null\s*;/g,
  severity: "high",
  title: "Any signed-in user can access all data",
  message:
    "This rule only checks that someone is logged in, not who. Anyone can sign up and then read or edit every other user's data.",
};

const RTDB_OPEN = /"\.(read|write)"\s*:\s*(true|"true")/g;

export const firebaseOpenRules: Rule = {
  id: "firebase-open-rules",
  title: "Firebase security rules are open",
  description:
    "Firebase apps talk to the database straight from the browser. Security rules are the only thing stopping strangers from reading or wiping your data.",
  check(project) {
    const findings: Finding[] = [];
    for (const file of project.files) {
      const isRules = /\.rules$/.test(file.path);
      const isRtdb = /(^|\/)database\.rules\.json$/.test(file.path);
      if (!isRules && !isRtdb) continue;

      const add = (index: number, check: Omit<Check, "regex">) => {
        const line = lineOf(file.content, index);
        if (isIgnored(file.content, line)) return;
        if (findings.some((f) => f.file === file.path && f.line === line)) return;
        findings.push({
          ruleId: this.id,
          severity: check.severity,
          title: check.title,
          file: file.path,
          line,
          message: check.message,
          fixPrompt:
            `The Firebase security rules in ${file.path} (line ${line}) are too permissive. ` +
            `Rewrite them so each collection only allows access to signed-in users who own the data ` +
            `(e.g. allow read, write: if request.auth != null && request.auth.uid == userId), ` +
            `keep truly public content read-only, and deny everything else by default. ` +
            `Remove any "if true" or test-mode request.time rules. Explain each rule you write.`,
        });
      };

      if (isRtdb) {
        for (const m of file.content.matchAll(RTDB_OPEN)) {
          add(m.index ?? 0, {
            severity: m[1] === "write" ? "critical" : "high",
            title: `Anyone can ${m[1]} your Realtime Database`,
            message: `".${m[1]}": true opens this path to everyone on the internet, no login needed.`,
          });
        }
        continue;
      }

      // More specific checks first: only one finding is kept per line.
      for (const check of [TEST_MODE, ANY_SIGNED_IN, OPEN_WRITE, OPEN_READ]) {
        for (const m of file.content.matchAll(check.regex)) {
          add((m.index ?? 0) + m[0].lastIndexOf("allow"), check);
        }
      }
    }
    return findings;
  },
};

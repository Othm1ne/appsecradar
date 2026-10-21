import { isIgnored, lineOf } from "../project.js";
import type { Finding, Rule, Severity } from "../types.js";

const CHECKS: { file: RegExp; regex: RegExp; severity: Severity; title: string; message: string }[] = [
  {
    file: /\.py$/,
    regex: /\.run\([^)]*debug\s*=\s*True/g,
    severity: "high",
    title: "Flask runs with debug=True",
    message:
      "The Werkzeug debugger lets anyone who can trigger an error run Python code on your server. Never expose it outside your laptop.",
  },
  {
    file: /(^|\/)settings(\/[\w]+)?\.py$/,
    regex: /^DEBUG\s*=\s*True\b/gm,
    severity: "medium",
    title: "Django DEBUG is hardcoded to True",
    message:
      "With DEBUG on, error pages show your settings, environment, SQL queries and source code to anyone who triggers an error.",
  },
  {
    file: /(^|\/)(config\/app\.php|\.env\.production)$/,
    regex: /APP_DEBUG['"]?\s*(=|=>)\s*(true|'true'|"true")/gi,
    severity: "medium",
    title: "Laravel APP_DEBUG is on",
    message: "Debug pages leak environment variables, including database passwords and API keys.",
  },
];

export const debugModeEnabled: Rule = {
  id: "debug-mode-enabled",
  title: "Debug mode enabled",
  description: "AI-generated starter code usually turns debug mode on and nobody turns it off before deploying.",
  check(project) {
    const findings: Finding[] = [];
    for (const file of project.files) {
      for (const check of CHECKS) {
        if (!check.file.test(file.path)) continue;
        for (const m of file.content.matchAll(check.regex)) {
          const line = lineOf(file.content, m.index ?? 0);
          if (isIgnored(file.content, line)) continue;
          findings.push({
            ruleId: this.id,
            severity: check.severity,
            title: check.title,
            file: file.path,
            line,
            message: check.message,
            fixPrompt:
              `In ${file.path} line ${line}, debug mode is hardcoded on. Make it read from an environment variable ` +
              `that defaults to off (e.g. DEBUG = os.environ.get("DEBUG") == "1"), so production never runs in debug mode.`,
          });
        }
      }
    }
    return findings;
  },
};

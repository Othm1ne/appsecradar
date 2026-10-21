import { isIgnored, lineOf } from "../project.js";
import type { Finding, Rule } from "../types.js";

// Prefixes that frameworks inline into the browser bundle at build time.
const PUBLIC_VAR = /\b(NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|NUXT_PUBLIC_|PUBLIC_)([A-Z0-9_]+)/g;

const SECRET_NAME =
  /(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|PASSWD|OPENAI|ANTHROPIC|GROQ|MISTRAL|REPLICATE|RESEND|SENDGRID|TWILIO_AUTH|DATABASE_URL|DB_URL|POSTGRES_URL|AWS_ACCESS|AWS_SECRET|WEBHOOK_SECRET)/;

const SAFE_NAME = /(PUBLISHABLE|ANON_KEY)/;

export const publicEnvSecret: Rule = {
  id: "public-env-secret",
  title: "Secret exposed through a public env variable",
  description:
    "Variables prefixed with NEXT_PUBLIC_, VITE_, REACT_APP_ etc. are copied into the JavaScript sent to every visitor.",
  check(project) {
    const findings: Finding[] = [];
    const seen = new Set<string>();
    for (const file of project.files) {
      for (const match of file.content.matchAll(PUBLIC_VAR)) {
        const [full, prefix, name] = match;
        if (!SECRET_NAME.test(name) || SAFE_NAME.test(name)) continue;
        const line = lineOf(file.content, match.index ?? 0);
        const key = `${file.path}:${line}:${full}`;
        if (seen.has(key) || isIgnored(file.content, line)) continue;
        seen.add(key);
        findings.push({
          ruleId: this.id,
          severity: "critical",
          title: `${full} is shipped to the browser`,
          file: file.path,
          line,
          message:
            `The ${prefix} prefix makes the bundler embed this value in public JavaScript. ` +
            `Anyone visiting the site can read ${full} and use it with full privileges.`,
          fixPrompt:
            `The env variable ${full} (used in ${file.path} line ${line}) has a public prefix (${prefix}) but holds a secret. ` +
            `Rename it to ${name} without the public prefix in all .env files, code and hosting settings, ` +
            `use it only in server-side code (API routes, server actions, edge functions), ` +
            `and make any frontend code call a server endpoint instead of using the secret directly. Then remind me to rotate the key.`,
        });
      }
    }
    return findings;
  },
};

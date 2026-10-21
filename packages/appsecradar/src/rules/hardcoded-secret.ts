import { isIgnored, lineOf } from "../project.js";
import type { Finding, Rule } from "../types.js";

interface SecretPattern {
  name: string;
  regex: RegExp;
  /** Optional extra check to cut false positives. */
  confirm?: (match: string) => boolean;
}

const PATTERNS: SecretPattern[] = [
  { name: "Anthropic API key", regex: /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{40,}/g },
  { name: "OpenAI API key", regex: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/g },
  { name: "Stripe secret key", regex: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g },
  { name: "AWS access key ID", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: "GitHub token", regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})/g },
  { name: "Supabase secret key", regex: /\bsb_secret_[A-Za-z0-9_-]{20,}/g },
  {
    name: "Supabase service_role key",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    confirm: (jwt) => jwtRole(jwt) === "service_role",
  },
  { name: "Private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { name: "Groq API key", regex: /\bgsk_[A-Za-z0-9]{40,}/g },
  { name: "Hugging Face token", regex: /\bhf_[A-Za-z0-9]{30,}/g },
  { name: "Resend API key", regex: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/g },
  { name: "SendGrid API key", regex: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
  { name: "Slack token", regex: /\bxox[baprs]-[0-9A-Za-z-]{20,}/g },
  { name: "Twilio API key", regex: /\bSK[0-9a-f]{32}\b/g },
  {
    name: "Database URL with password",
    regex: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^\s"'`:/@]+:[^\s"'`@]+@[^\s"'`/]+/g,
    confirm: isRealDatabaseUrl,
  },
];

const PLACEHOLDER_PASSWORD = /^(password|passwd|pass|pwd|secret|changeme|postgres|root|admin|user|username|example|xxx+|\*+|<.*>|\$\{.*\}|\{.*\}|%.*%|\$\w+)$/i;
const LOCAL_HOST = /@(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal|db|database|postgres|mysql|mongo|mongodb|redis|example\.com|host)(:\d+)?$/i;

function isRealDatabaseUrl(url: string): boolean {
  const match = /:\/\/[^:]+:([^@]+)@(.+)$/.exec(url);
  if (!match) return false;
  const [, password, host] = match;
  return !PLACEHOLDER_PASSWORD.test(password) && !LOCAL_HOST.test("@" + host);
}

function jwtRole(jwt: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : undefined;
  } catch {
    return undefined;
  }
}

function mask(secret: string): string {
  return secret.length <= 12 ? "****" : `${secret.slice(0, 10)}…${"*".repeat(6)}`;
}

export const hardcodedSecret: Rule = {
  id: "hardcoded-secret",
  title: "Hardcoded secret in source code",
  description:
    "API keys and credentials written directly in code end up in git history and, for frontend files, in every visitor's browser.",
  check(project) {
    const findings: Finding[] = [];
    for (const file of project.files) {
      // .env files are expected to hold secrets; whether they are public is another rule's job.
      if (/(^|\/)\.env/.test(file.path)) continue;
      for (const pattern of PATTERNS) {
        for (const match of file.content.matchAll(pattern.regex)) {
          if (pattern.confirm && !pattern.confirm(match[0])) continue;
          const line = lineOf(file.content, match.index ?? 0);
          if (isIgnored(file.content, line)) continue;
          const where = file.isClient
            ? "This code ships to users' browsers or devices, so anyone can extract it."
            : "Anyone with access to the repo (or a leaked copy) can use it.";
          findings.push({
            ruleId: this.id,
            severity: file.isClient ? "critical" : "high",
            title: `${pattern.name} hardcoded in ${file.isClient ? "frontend" : "source"} code`,
            file: file.path,
            line,
            message: `Found ${pattern.name} (${mask(match[0])}). ${where} Treat this key as leaked: rotate it now.`,
            fixPrompt:
              `In ${file.path} line ${line} there is a hardcoded ${pattern.name}. ` +
              `Move it to a server-only environment variable (no NEXT_PUBLIC_/VITE_ prefix), read it only in server code ` +
              `(API route, backend handler, server action or edge function), and if the frontend or mobile app needs the result, call that server endpoint instead. ` +
              `Remove the literal key from the code. Remind me to rotate the old key in the provider dashboard.`,
          });
        }
      }
    }
    return findings;
  },
};

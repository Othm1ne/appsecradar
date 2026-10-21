import { isIgnored, lineOf } from "../project.js";
import type { Finding, Rule } from "../types.js";

// Configurations where the server reflects any Origin AND allows cookies/credentials.
// (A literal "*" with credentials is rejected by browsers, so it is not flagged here.)
const PATTERNS: { lang: RegExp; regex: RegExp }[] = [
  // Express/Fastify/Nest cors({ origin: true, credentials: true }) or an origin callback that always says yes
  {
    lang: /\.(ts|js|mjs|cjs)$/,
    regex: /origin\s*:\s*(?:true|\(\s*\w*\s*,\s*(\w+)\s*\)\s*=>\s*\1\(\s*null\s*,\s*true\s*\))[^}]*credentials\s*:\s*true|credentials\s*:\s*true[^}]*origin\s*:\s*(?:true\b|\(\s*\w*\s*,\s*(\w+)\s*\)\s*=>\s*\2\(\s*null\s*,\s*true\s*\))/g,
  },
  // Hand-written header that echoes the request's Origin
  {
    lang: /\.(ts|js|mjs|cjs)$/,
    regex: /Access-Control-Allow-Origin["']\s*,\s*req(?:uest)?\.headers(?:\.origin|\[["']origin["']\]|\.get\(\s*["']origin["']\s*\))/gi,
  },
  // FastAPI / Starlette: allow_origins=["*"] + allow_credentials=True (Starlette then reflects the Origin)
  {
    lang: /\.py$/,
    regex: /CORSMiddleware[^)]*?(?:allow_origins\s*=\s*\[\s*["']\*["']\s*\][^)]*allow_credentials\s*=\s*True|allow_credentials\s*=\s*True[^)]*allow_origins\s*=\s*\[\s*["']\*["']\s*\])/g,
  },
  // Flask-CORS: CORS(app, supports_credentials=True) with no explicit origins
  {
    lang: /\.py$/,
    regex: /CORS\(\s*\w+\s*,(?![^)]*(?:origins|resources)\s*=)[^)]*supports_credentials\s*=\s*True[^)]*\)/g,
  },
];

export const corsAnyOriginCredentials: Rule = {
  id: "cors-any-origin-credentials",
  title: "CORS trusts every website with user credentials",
  description:
    "Reflecting any Origin while allowing credentials lets any website make logged-in requests to your API on behalf of your users.",
  check(project) {
    const findings: Finding[] = [];
    for (const file of project.files) {
      for (const p of PATTERNS) {
        if (!p.lang.test(file.path)) continue;
        for (const m of file.content.matchAll(p.regex)) {
          const line = lineOf(file.content, m.index ?? 0);
          if (isIgnored(file.content, line)) continue;
          findings.push({
            ruleId: this.id,
            severity: "high",
            title: "CORS allows any website to send logged-in requests",
            file: file.path,
            line,
            message:
              `Your API accepts cross-origin requests with cookies from any website. A malicious page your user visits ` +
              `can silently call your API as that user and read the responses (their data, tokens, settings).`,
            fixPrompt:
              `The CORS config in ${file.path} line ${line} reflects any origin while allowing credentials. ` +
              `Replace it with an explicit allowlist of my real frontend origins (read from an env variable like ALLOWED_ORIGINS, ` +
              `e.g. https://myapp.com and http://localhost:3000 in development) and keep credentials enabled only for those.`,
          });
        }
      }
    }
    return findings;
  },
};

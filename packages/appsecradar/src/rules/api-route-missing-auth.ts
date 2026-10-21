import { isIgnored, lineOf } from "../project.js";
import type { Finding, Project, Rule, SourceFile } from "../types.js";

/** A route handler that changes data, found by one of the framework detectors. */
interface Candidate {
  index: number;
  label: string;
  /** Text that must contain an auth check for this handler to count as protected. */
  scope: string;
}

// Routes that are public on purpose or authenticated another way (webhook signatures).
const EXEMPT = /(^|[\/._-])(auth|login|logout|signin|signup|sign-in|sign-up|register|webhooks?|health|healthz|og|cron|callback|oauth|password-reset|forgot-password|contact|newsletter|subscribe)([\/._\-[]|$)/i;

const JS_AUTH =
  /getServerSession|getSession|auth\(\)|currentUser|getAuth\(|auth\.getUser|getUser\(|getClaims\(|verifyToken|verifyIdToken|jwt\.verify|jwtVerify|requireAuth|requireUser|requireLogin|isAuthenticated|ensureAuth|withAuth|withApiAuthRequired|getKindeServerSession|validateRequest|getToken\(|passport\.authenticate|clerkMiddleware|requireAuth|@UseGuards|locals\.(user|session)|event\.locals\.|context\.locals\.(user|session)|authorization|unauthorized|status\(\s*401|status:\s*401|\b401\b/i;

const PY_AUTH =
  /login_required|jwt_required|auth_required|token_required|requires_auth|permission_required|Depends\(\s*\w*(auth|user|token|current|verify|session)\w*|Security\(|current_user|get_jwt_identity|verify_\w*token|HTTPBearer|OAuth2PasswordBearer|abort\(\s*401|status_code\s*=\s*401|HTTP_401/i;

const MUTATING_EXPORT = /export\s+(?:async\s+)?(?:function\s+|const\s+)(POST|PUT|PATCH|DELETE)\b/g;

type Detector = (file: SourceFile) => Candidate[];

const detectors: Detector[] = [
  // Next.js App Router, SvelteKit +server, Astro endpoints: `export async function POST`
  (file) => {
    if (!/(^|\/)(app\/(.*\/)?api\/.*route|routes\/.*\+server|pages\/api\/.*)\.(ts|js|tsx|jsx)$/.test(file.path)) return [];
    return [...file.content.matchAll(MUTATING_EXPORT)].map((m) => ({
      index: m.index ?? 0,
      label: `${m[1]} ${file.path}`,
      scope: file.content,
    }));
  },
  // Next.js Pages Router: `export default function handler(req, res)`
  (file) => {
    if (!/(^|\/)pages\/api\/.*\.(ts|js)$/.test(file.path)) return [];
    if (new RegExp(MUTATING_EXPORT.source).test(file.content)) return []; // Astro-style named exports
    const index = file.content.search(/export\s+default/);
    return index < 0 ? [] : [{ index, label: `handler ${file.path}`, scope: file.content }];
  },
  // Nuxt / Nitro: server/api/notes.post.ts
  (file) => {
    const m = /(^|\/)server\/(api|routes)\/.*\.(post|put|patch|delete)\.(ts|js)$/.exec(file.path);
    if (!m) return [];
    const index = Math.max(0, file.content.search(/defineEventHandler|export\s+default/));
    return [{ index, label: `${m[3].toUpperCase()} ${file.path}`, scope: file.content }];
  },
  // Remix / React Router: `export async function action`
  (file) => {
    if (!/(^|\/)routes\/.*\.(tsx|ts|jsx|js)$/.test(file.path)) return [];
    const m = /export\s+(?:async\s+)?(?:function\s+|const\s+)action\b/.exec(file.content);
    return m ? [{ index: m.index, label: `action ${file.path}`, scope: file.content }] : [];
  },
  // Express, Hono, Fastify, Koa: router.post("/path", async (req, res) => ...) with no middleware in between
  (file) => {
    if (!/\.(ts|js|mjs|cjs)$/.test(file.path)) return [];
    if (!/from\s+["'](express|hono|fastify|koa|@koa\/router|koa-router)["']|require\(\s*["'](express|hono|fastify|koa|@koa\/router|koa-router)["']\s*\)/.test(file.content)) return [];
    const route = /\b(\w+)\.(post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*(?:async\s*)?(?:\(|function\b|\w+\s*=>)/g;
    const nextRoute = /\b\w+\.(get|post|put|patch|delete|all|use)\s*\(/g;
    return [...file.content.matchAll(route)].map((m) => {
      const start = m.index ?? 0;
      // Scope: this handler only, up to the next route definition.
      nextRoute.lastIndex = start + m[0].length;
      const next = nextRoute.exec(file.content);
      return {
        index: start,
        label: `${m[2].toUpperCase()} ${m[3]}`,
        scope: file.content.slice(start, next ? next.index : start + 2000),
      };
    });
  },
  // Flask & FastAPI: @app.post("/path") or @bp.route("/path", methods=["POST"])
  (file) => {
    if (!file.path.endsWith(".py")) return [];
    const route =
      /@(\w+)\.(?:(post|put|patch|delete)\(\s*["']([^"']+)["']|route\(\s*["']([^"']+)["'][^)]*methods\s*=\s*\[[^\]]*["'](POST|PUT|PATCH|DELETE)["'])/gi;
    const out: Candidate[] = [];
    for (const m of file.content.matchAll(route)) {
      const start = m.index ?? 0;
      // Scope: decorators just above, plus everything up to the end of the function signature.
      const before = file.content.lastIndexOf("\n\n", start);
      const after = file.content.slice(start);
      const sig = /def\s+\w+\s*\([\s\S]*?\)\s*(?:->[^:]+)?:/.exec(after);
      const end = start + (sig ? sig.index + sig[0].length : 0);
      // Also include the first few lines of the body, where `if not current_user` checks live.
      // Stop at the next top-level line so the next route's decorators don't leak in.
      const body = file.content.slice(end, end + 400).split(/\n(?=\S)/)[0];
      out.push({
        index: start,
        label: `${(m[2] ?? m[5]).toUpperCase()} ${m[3] ?? m[4]}`,
        scope: file.content.slice(before < 0 ? 0 : before, end) + body,
      });
    }
    return out;
  },
];

function fileWideAuth(file: SourceFile): boolean {
  if (file.path.endsWith(".py")) {
    // Blueprint / router level protection
    return /before_request[\s\S]{0,300}(login|auth|token|401)|APIRouter\([^)]*dependencies\s*=/.test(file.content);
  }
  // app.use(requireAuth) or app.use("/api", requireAuth) protects every route registered in the file.
  return /\.use\(\s*(?:["'`][^"'`]*["'`]\s*,\s*)?[\w.]*(auth|jwt|protect|guard|clerk)/i.test(file.content);
}

export const apiRouteMissingAuth: Rule = {
  id: "api-route-missing-auth",
  title: "API route changes data without checking who is calling",
  description:
    "AI tools often generate working API routes but forget to check the user's session, so anyone can call them directly.",
  check(project: Project) {
    const findings: Finding[] = [];
    for (const file of project.files) {
      if (EXEMPT.test(file.path)) continue;
      const candidates = detectors.flatMap((d) => d(file));
      if (candidates.length === 0 || fileWideAuth(file)) continue;

      const authRe = file.path.endsWith(".py") ? PY_AUTH : JS_AUTH;
      for (const c of candidates) {
        if (EXEMPT.test(c.label) || authRe.test(c.scope)) continue;
        const line = lineOf(file.content, c.index);
        if (isIgnored(file.content, line)) continue;
        const mitigated = project.hasMiddleware && !file.path.endsWith(".py");
        findings.push({
          ruleId: this.id,
          severity: mitigated ? "medium" : "high",
          title: `Unauthenticated endpoint: ${c.label}`,
          file: file.path,
          line,
          message:
            `This handler changes data but never checks the caller's session or token. ` +
            `Anyone can call it with curl, no login needed.` +
            (mitigated ? " A middleware file exists; verify it actually covers this route." : ""),
          fixPrompt:
            `The endpoint "${c.label}" in ${file.path} (line ${line}) has no authentication check. ` +
            `Using the auth system this project already has, get the current user on the server side at the start of the handler ` +
            `(or add the project's auth middleware / decorator / dependency to this route) and return 401 if there is no user. ` +
            `Then check that the user owns the record being changed and return 403 otherwise. ` +
            `Never trust a user id sent in the request body.`,
        });
      }
    }
    return findings;
  },
};

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { detectStacks } from "./stacks.js";
import type { Project, SourceFile } from "./types.js";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".vercel",
  ".netlify",
  ".turbo",
  ".expo",
  "dist",
  "build",
  "out",
  "coverage",
  "venv",
  ".venv",
  "env",
  "__pycache__",
  "site-packages",
  "vendor",
  "Pods",
  ".dart_tool",
  ".gradle",
  "target",
  "bin",
  "obj",
]);

const SOURCE_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|html|py|rb|php|go|java|kt|kts|swift|dart|cs|rs|sql|rules|json|ya?ml|toml)$/;
const ENV_FILE = /(^|\/)\.env(\.[\w-]+)?$/;
const MANIFESTS = new Set(["requirements.txt", "Pipfile", "Gemfile", "go.mod", "Dockerfile"]);
const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "composer.lock",
  "Gemfile.lock",
  "poetry.lock",
  "Cargo.lock",
  "pubspec.lock",
  "go.sum",
]);
const MAX_FILE_BYTES = 1024 * 1024;

export function loadProject(root: string): Project {
  const paths: string[] = [];
  walk(root, root, paths);

  const raw = paths.map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }));
  const stacks = detectStacks(raw);
  const mobileJs = stacks.includes("Expo / React Native");
  const spa = stacks.includes("Vite") && !stacks.includes("Next.js");

  const files: SourceFile[] = raw.map((f) => ({
    ...f,
    isClient: guessIsClient(f.path, f.content, { spa, mobileJs }),
  }));

  const hasMiddleware = files.some((f) => /^(src\/)?middleware\.(ts|js)$/.test(f.path));

  return { root, files, stacks, hasMiddleware };
}

function walk(root: string, dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) walk(root, full, out);
      continue;
    }
    if (LOCKFILES.has(entry.name)) continue;
    const rel = relative(root, full).split(sep).join("/");
    if (!SOURCE_EXT.test(rel) && !ENV_FILE.test(rel) && !MANIFESTS.has(basename(rel))) continue;
    if (statSync(full).size > MAX_FILE_BYTES) continue;
    out.push(rel);
  }
}

const SERVER_LANG = /\.(py|rb|php|go|cs|rs|sql|astro|rules|json|ya?ml|toml)$/;
const SERVER_PATH =
  /(^|\/)(api|server|backend|functions|lambda|middleware|supabase\/functions|netlify\/functions)\/|\.server\.|\+server\.|\+page\.server\.|\+layout\.server\./;

function guessIsClient(
  path: string,
  content: string,
  ctx: { spa: boolean; mobileJs: boolean },
): boolean {
  if (/^\s*["']use client["']/m.test(content)) return true;
  if (/^\s*["']use server["']/m.test(content)) return false;
  if (SERVER_LANG.test(path) || SERVER_PATH.test(path)) return false;

  // Native mobile code ships inside the app binary, which is trivial to unpack.
  if (/\.swift$/.test(path)) return true;
  if (/\.dart$/.test(path)) return /(^|\/)lib\//.test(path);
  if (/\.(kt|java)$/.test(path)) return /(^|\/)src\/main\//.test(path) && /android/i.test(content + path);

  if (/\.(vue|svelte|html)$/.test(path)) return true;
  if (/(^|\/)(components|hooks|composables|pages)\//.test(path)) return true;
  // In a Vite SPA or an Expo / React Native app, everything under src/ or app/ ships to users.
  if ((ctx.spa || ctx.mobileJs) && /^(src|app)\//.test(path)) return true;
  return false;
}

export function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Supports `appsecradar-ignore` in any comment style on the same line or the line above. */
export function isIgnored(content: string, line: number): boolean {
  const lines = content.split("\n");
  const here = lines[line - 1] ?? "";
  const above = lines[line - 2] ?? "";
  return /appsecradar-ignore/.test(here) || /appsecradar-ignore/.test(above);
}

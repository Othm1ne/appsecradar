interface RawFile {
  path: string;
  content: string;
}

interface StackSignal {
  name: string;
  /** Matched against the combined text of dependency manifests. */
  dep?: RegExp;
  /** Matched against file paths. */
  file?: RegExp;
}

// Order matters only for display.
const SIGNALS: StackSignal[] = [
  // Frontend / fullstack JS
  { name: "Next.js", dep: /"next"\s*:/ },
  { name: "Nuxt", dep: /"nuxt"\s*:/ },
  { name: "SvelteKit", dep: /"@sveltejs\/kit"\s*:/ },
  { name: "Remix / React Router", dep: /"@remix-run\/\w+"\s*:|"@react-router\/\w+"\s*:/ },
  { name: "Astro", dep: /"astro"\s*:/ },
  { name: "Angular", dep: /"@angular\/core"\s*:/ },
  { name: "Vue", dep: /"vue"\s*:/ },
  { name: "React", dep: /"react"\s*:/ },
  { name: "Vite", dep: /"vite"\s*:/, file: /(^|\/)vite\.config\.(ts|js|mjs)$/ },
  { name: "Expo / React Native", dep: /"(expo|react-native)"\s*:/ },
  // JS backends
  { name: "Express", dep: /"express"\s*:/ },
  { name: "Fastify", dep: /"fastify"\s*:/ },
  { name: "Hono", dep: /"hono"\s*:/ },
  { name: "NestJS", dep: /"@nestjs\/core"\s*:/ },
  // Other languages
  { name: "Django", dep: /^django\b/im },
  { name: "Flask", dep: /^flask\b/im },
  { name: "FastAPI", dep: /^fastapi\b/im },
  { name: "Laravel", dep: /"laravel\/framework"\s*:/ },
  { name: "Rails", dep: /gem\s+["']rails["']/ },
  { name: "Go", file: /(^|\/)go\.mod$/ },
  { name: "Flutter", dep: /^\s*flutter\s*:/m },
  { name: "Rust", file: /(^|\/)Cargo\.toml$/ },
  // Backend-as-a-service and data
  { name: "Supabase", dep: /@supabase\/|^supabase\b|supabase_flutter/im, file: /(^|\/)supabase\/(migrations|config\.toml)/ },
  { name: "Firebase", dep: /"firebase(-admin)?"\s*:|^firebase[-_]admin\b|firebase_core/im, file: /(^|\/)(firebase\.json|firestore\.rules)$/ },
  { name: "Prisma", dep: /"@?prisma(\/client)?"\s*:/ },
  { name: "Drizzle", dep: /"drizzle-orm"\s*:/ },
  { name: "MongoDB", dep: /"(mongodb|mongoose)"\s*:|^(pymongo|motor)\b/im },
  { name: "PostgreSQL", dep: /"(pg|postgres)"\s*:|^(psycopg2?|asyncpg)\b/im },
  // Services
  { name: "Stripe", dep: /"stripe"\s*:|^stripe\b|stripe\/stripe-php|gem\s+["']stripe["']/im },
  { name: "OpenAI", dep: /"openai"\s*:|^openai\b/im },
  { name: "Anthropic", dep: /"@anthropic-ai\/sdk"\s*:|^anthropic\b/im },
  { name: "Clerk", dep: /"@clerk\/\w+"\s*:/ },
];

const MANIFEST = /(^|\/)(package\.json|requirements[\w.-]*\.txt|pyproject\.toml|Pipfile|composer\.json|Gemfile|pubspec\.yaml|go\.mod|Cargo\.toml)$/;

export function detectStacks(files: RawFile[]): string[] {
  const deps = files
    .filter((f) => MANIFEST.test(f.path))
    .map((f) => f.content)
    .join("\n");
  return SIGNALS.filter(
    (s) => (s.dep && s.dep.test(deps)) || (s.file && files.some((f) => s.file!.test(f.path))),
  ).map((s) => s.name);
}

import { isIgnored, lineOf } from "../project.js";
import type { Finding, Rule } from "../types.js";

// Captures [schema, table]; schema is undefined when omitted (defaults to public).
const IDENT = String.raw`(?:"?([A-Za-z_][A-Za-z0-9_]*)"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?`;
const CREATE_TABLE = new RegExp(String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?` + IDENT, "gi");
const ENABLE_RLS = new RegExp(
  String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?` + IDENT + String.raw`\s+enable\s+row\s+level\s+security`,
  "gi",
);
const DISABLE_RLS = new RegExp(
  String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?` + IDENT + String.raw`\s+disable\s+row\s+level\s+security`,
  "gi",
);
// Tables in other schemas (auth., storage., private.) are not exposed through the Supabase REST API.
const isPublic = (schema: string | undefined) => !schema || schema.toLowerCase() === "public";

export const supabaseRlsDisabled: Rule = {
  id: "supabase-rls-disabled",
  title: "Supabase table without Row Level Security",
  description:
    "Supabase exposes every public table through its API using the anon key that ships in your frontend. Without RLS, anyone can read and edit the whole table.",
  check(project) {
    const sqlFiles = project.files.filter((f) => f.path.endsWith(".sql"));
    if (sqlFiles.length === 0) return [];

    // RLS can be enabled in a later migration, so collect it across all files first.
    const enabled = new Set<string>();
    for (const file of sqlFiles) {
      for (const m of file.content.matchAll(ENABLE_RLS)) if (isPublic(m[1])) enabled.add(m[2].toLowerCase());
    }

    const findings: Finding[] = [];
    for (const file of sqlFiles) {
      for (const m of file.content.matchAll(CREATE_TABLE)) {
        if (!isPublic(m[1])) continue;
        const table = m[2].toLowerCase();
        if (enabled.has(table)) continue;
        const line = lineOf(file.content, m.index ?? 0);
        if (isIgnored(file.content, line)) continue;
        findings.push(finding(this.id, file.path, line, table, "never enabled"));
      }
      for (const m of file.content.matchAll(DISABLE_RLS)) {
        if (!isPublic(m[1])) continue;
        const line = lineOf(file.content, m.index ?? 0);
        if (isIgnored(file.content, line)) continue;
        findings.push(finding(this.id, file.path, line, m[2].toLowerCase(), "explicitly disabled"));
      }
    }
    return findings;
  },
};

function finding(ruleId: string, file: string, line: number, table: string, how: string) {
  return {
    ruleId,
    severity: "critical" as const,
    title: `Table "${table}" has RLS ${how}`,
    file,
    line,
    message:
      `Row Level Security is ${how} on public."${table}". Anyone who copies the anon key from your website ` +
      `can run supabase.from("${table}").select("*") and dump, edit or delete every row.`,
    fixPrompt:
      `In Supabase, the table public.${table} (defined in ${file}) has Row Level Security ${how}. ` +
      `Write a new migration that runs: alter table public.${table} enable row level security; ` +
      `then add policies so users can only select/insert/update/delete their own rows ` +
      `(e.g. using (auth.uid() = user_id) and with check (auth.uid() = user_id)). ` +
      `If the table has no user_id column, explain who should be able to access it and write policies to match. Do not use "using (true)".`,
  };
}

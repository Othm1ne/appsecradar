import { isIgnored, lineOf } from "../project.js";
import type { Finding, Rule } from "../types.js";

// Real SQL, not UI text like "Select an option".
const SQL = String.raw`(?:SELECT\s[^;]*?\sFROM|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM)`;

/**
 * A string literal containing SQL, for each quote style, so that `"... WHERE name = '" + x` works
 * (the other quote type may appear inside). `tail` is appended inside the literal, e.g. `[^"]*?\{`.
 */
function literal(quotes: string[], tail: (q: string) => string, prefix = ""): string {
  return (
    "(?:" +
    quotes
      .map((q) => (q.length === 3 ? `${prefix}${q}(?:(?!${q})[\\s\\S])*?${SQL}${tail(q)}` : `${prefix}${q}[^${q}\\n]*?${SQL}${tail(q)}`))
      .join("|") +
    ")"
  );
}

const CLOSED = (q: string) => (q.length === 3 ? `(?:(?!${q})[\\s\\S])*${q}` : `[^${q}\\n]*${q}`);

interface Pattern {
  lang: RegExp;
  regex: RegExp;
  /** Return false to drop a match (e.g. when only constants are interpolated). */
  confirm?: (content: string, index: number) => boolean;
}

// `${TTL_HOURS}` or `{MAX_ROWS}` or `${30}`: values fixed in code, not controlled by users.
const CONSTANT = /^\s*(?:[A-Z][A-Z0-9_]*|\d+(?:\.\d+)?)\s*$/;

/** True unless every interpolation in the string literal starting at/after `index` is a constant. */
function hasNonConstantInterpolation(content: string, index: number, open: RegExp, holes: RegExp): boolean {
  open.lastIndex = index;
  const start = open.exec(content);
  if (!start) return true;
  const quote = start[1];
  const end = content.indexOf(quote, start.index + start[0].length);
  const body = content.slice(start.index + start[0].length, end < 0 ? undefined : end);
  const values = [...body.matchAll(holes)].map((m) => m[1]);
  return values.length === 0 || values.some((v) => !CONSTANT.test(v));
}

const PATTERNS: Pattern[] = [
  // JS/TS: db.query(`SELECT ... ${id}`), prisma.$queryRawUnsafe(`...${x}`)
  {
    lang: /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/,
    regex: new RegExp(
      String.raw`\.(?:query|execute|exec|raw|run|all|get|prepare|\$queryRawUnsafe|\$executeRawUnsafe|unsafe)\s*\(\s*` +
        "`" + String.raw`[^` + "`" + String.raw`]*?` + SQL + String.raw`[^` + "`" + String.raw`]*?\$\{`,
      "gi",
    ),
    confirm: (content, index) => hasNonConstantInterpolation(content, index, /(`)/g, /\$\{([^}]*)\}/g),
  },
  // JS/TS: db.query("SELECT ... WHERE name = '" + name + "'")
  {
    lang: /\.(ts|tsx|js|jsx|mjs|cjs)$/,
    regex: new RegExp(
      String.raw`\.(?:query|execute|exec|raw|run|all|get|prepare)\s*\(\s*` + literal(['"', "'"], CLOSED) + String.raw`\s*\+`,
      "gi",
    ),
  },
  // Python: cursor.execute(f"SELECT ... {id}"), execute("..." % x), execute("...".format(x)), text(f"...")
  {
    lang: /\.py$/,
    regex: new RegExp(
      String.raw`\b(?:execute|executemany|executescript|raw|text|exec_driver_sql)\s*\(\s*(?:` +
        literal(['"""', "'''", '"', "'"], (q) => (q.length === 3 ? String.raw`(?:(?!${q})[\s\S])*?\{` : String.raw`[^${q}\n]*?\{`), "[fF]") +
        "|" +
        literal(['"""', "'''", '"', "'"], CLOSED) +
        String.raw`\s*(?:%|\.format\(|\+))`,
      "gi",
    ),
    // Only f-strings can be checked this way; %-formatting and .format() are always reported.
    confirm: (content, index) => {
      const literalStart = /\(\s*([fF])?("""|'''|"|')/g;
      literalStart.lastIndex = index;
      const m = literalStart.exec(content);
      if (!m || !m[1]) return true;
      return hasNonConstantInterpolation(content, m.index + m[0].length - m[2].length, /("""|'''|"|')/g, /\{([^}]*)\}/g);
    },
  },
  // PHP: $db->query("SELECT ... '$id'") or "..." . $_GET['id']
  {
    lang: /\.php$/,
    regex: new RegExp(
      String.raw`(?:->(?:query|exec|prepare)|mysqli_query|pg_query)\s*\([^;]*?(?:` +
        literal(['"'], () => String.raw`[^"\n]*?\$\w`) +
        "|" +
        literal(['"', "'"], CLOSED) +
        String.raw`\s*\.\s*\$)`,
      "gi",
    ),
  },
  // Go: db.Query(fmt.Sprintf("SELECT ... %s", x)) or "..." + x
  {
    lang: /\.go$/,
    regex: new RegExp(
      String.raw`\.(?:Query|QueryRow|Exec|QueryContext|QueryRowContext|ExecContext)\s*\([^)]*?(?:fmt\.Sprintf\(\s*"[^"]*?` + SQL +
        String.raw`|"[^"]*?` + SQL + String.raw`[^"]*"\s*\+)`,
      "gi",
    ),
  },
  // Ruby on Rails: where("name = '#{params[:name]}'")
  {
    lang: /\.rb$/,
    regex: /\.(?:where|find_by_sql|execute|order|joins|select|from|having)\s*\(\s*"[^"]*#\{/gi,
  },
];

export const sqlInjection: Rule = {
  id: "sql-injection",
  title: "SQL query built from user-controllable strings",
  description:
    "Building SQL by gluing strings together lets attackers rewrite the query and read or delete your whole database.",
  check(project) {
    const findings: Finding[] = [];
    for (const file of project.files) {
      for (const p of PATTERNS) {
        if (!p.lang.test(file.path)) continue;
        for (const m of file.content.matchAll(p.regex)) {
          if (p.confirm && !p.confirm(file.content, m.index ?? 0)) continue;
          const line = lineOf(file.content, m.index ?? 0);
          if (isIgnored(file.content, line)) continue;
          if (findings.some((f) => f.file === file.path && f.line === line)) continue;
          findings.push({
            ruleId: this.id,
            severity: "high",
            title: "Possible SQL injection",
            file: file.path,
            line,
            message:
              `This query is built by inserting variables directly into the SQL text. If any part comes from a user ` +
              `(URL, form, JSON body), an attacker can change the query to dump, modify or delete your data.`,
            fixPrompt:
              `In ${file.path} line ${line}, a SQL query is built with string interpolation or concatenation. ` +
              `Rewrite it as a parameterized query using this project's database library (placeholders like $1, ?, %s or :name, ` +
              `with values passed separately; or the ORM's safe query builder / tagged template). ` +
              `If a table or column name must be dynamic, validate it against a fixed allowlist. Check the rest of the file for the same pattern.`,
          });
        }
      }
    }
    return findings;
  },
};

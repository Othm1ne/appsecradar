<div align="center">

# 🛡️ appsecradar

**Find the security holes your AI left behind.**

A zero-config security scanner for apps built with Cursor, Claude Code, Lovable, Bolt, v0 & Copilot.
It catches the mistakes AI coding tools make most, explains them in plain English,
and gives you a **fix prompt you can paste straight back into your AI editor**.

```bash
npx appsecradar
```

</div>

---

## Why

AI can build a full SaaS in a weekend. It also happily:

- puts your **OpenAI key in a React component**
- names your Supabase **service_role key `NEXT_PUBLIC_…`** so it ships to every visitor
- creates Supabase tables **without Row Level Security**, so anyone with your anon key can dump your users
- writes **Stripe webhooks that never verify the signature**, so anyone can fake a payment
- generates **API routes that never check who is calling**

Generic security scanners are built for security teams. appsecradar is built for the person who just shipped with AI and wants to know: *is this safe to launch?*

## Quick start

```bash
# scan the current project
npx appsecradar

# scan a specific folder
npx appsecradar ./my-app

# try it on our intentionally broken demo apps
git clone https://github.com/Othm1ne/appsecradar && cd appsecradar
npm install && npm run build
npx appsecradar examples/vulnerable-vibe-app      # Next.js + Supabase + Stripe
npx appsecradar examples/vulnerable-express-app   # Express + Postgres
npx appsecradar examples/vulnerable-python-app    # Flask + FastAPI
npx appsecradar examples/vulnerable-firebase-app  # React + Vite + Firebase
```

## Works with your stack

appsecradar auto-detects your stack and needs no config.

| | Supported |
|---|---|
| **Frontend / fullstack** | Next.js, React, Vite, Vue, Nuxt, SvelteKit, Astro, Remix / React Router, Angular, Expo / React Native |
| **Backend** | Express, Fastify, Hono, Koa, NestJS, Flask, FastAPI, Django, Laravel / PHP, Go, Rails (secrets + SQL) |
| **Data & services** | Supabase, Firebase (Firestore + Realtime DB), PostgreSQL, MySQL, MongoDB, Prisma, Stripe, OpenAI, Anthropic |
| **Mobile** | Flutter, Swift, Kotlin / Android (secrets shipped in the app) |

## What it checks

| Rule | Severity | Catches |
|------|----------|---------|
| `hardcoded-secret` | critical / high | 15+ key types (OpenAI, Anthropic, Stripe, AWS, GitHub, Supabase, Groq, Hugging Face, Resend, SendGrid, Slack, Twilio, private keys) and database URLs with real passwords. Critical when the code ships to browsers or phones |
| `public-env-secret` | critical | Secrets behind `NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `EXPO_PUBLIC_`, `NUXT_PUBLIC_`, `PUBLIC_` |
| `supabase-rls-disabled` | critical | Public tables without (or with disabled) Row Level Security |
| `firebase-open-rules` | critical / high | `if true` rules, test-mode rules, "any logged-in user can access everything", open Realtime DB |
| `stripe-webhook-unverified` | critical | Webhooks that never verify the Stripe signature (Node, Python, PHP, Ruby, Go) |
| `api-route-missing-auth` | high | Write endpoints with no auth check in Next.js, SvelteKit, Nuxt, Remix, Astro, Express, Hono, Fastify, Koa, Flask and FastAPI |
| `sql-injection` | high | SQL built with string interpolation in JS/TS, Python, PHP, Go and Ruby |
| `cors-any-origin-credentials` | high | CORS that reflects any origin with credentials (Express, FastAPI, Flask) |
| `debug-mode-enabled` | high / medium | Flask `debug=True`, Django `DEBUG = True`, Laravel `APP_DEBUG` |

## Let your AI editor fix it (MCP)

appsecradar ships an [MCP](https://modelcontextprotocol.io) server, so Cursor, Claude Code, Windsurf or VS Code can scan your project, fix the issues and verify each fix by re-scanning.

**Claude Code**
```bash
claude mcp add appsecradar -- npx -y appsecradar mcp
```

**Cursor**: `.cursor/mcp.json`
```json
{ "mcpServers": { "appsecradar": { "command": "npx", "args": ["-y", "appsecradar", "mcp"] } } }
```

**VS Code**: `.vscode/mcp.json`
```json
{ "servers": { "appsecradar": { "type": "stdio", "command": "npx", "args": ["-y", "appsecradar", "mcp"] } } }
```

Then ask your agent: *"Use appsecradar to secure my app"*, or run the built-in **`secure_my_app`** prompt.

| MCP tool / prompt | What it does |
|---|---|
| `scan` | Scans a folder (optionally only some `files` or a `min_severity`) and returns findings with exact fix instructions |
| `list_rules` | Lists every check and why it matters |
| `secure_my_app` (prompt) | Scan → fix critical issues one by one → re-scan to verify → list keys to rotate |

The server is read-only: it never edits files itself, and it tells the agent never to rotate keys on your behalf.

## Every finding comes with a fix prompt

```
 CRITICAL  Table "notes" has RLS never enabled
 supabase/migrations/20250101000000_init.sql:12  [supabase-rls-disabled]
   Anyone who copies the anon key from your website can run
   supabase.from("notes").select("*") and dump, edit or delete every row.
   Fix prompt (paste into your AI editor):
     Write a new migration that runs: alter table public.notes enable row level security;
     then add policies so users can only access their own rows ...
```

## CI usage

```bash
npx appsecradar --fail-on high      # exit 1 on high or critical findings (default)
npx appsecradar --json > report.json
```

## Options

```
--json               Print findings as JSON
--markdown           Print findings as Markdown (handy for PR comments)
--fail-on <level>    critical | high | medium | low | none   (default: high)
--no-color           Disable colors
```

Ignore a deliberate finding with a `// appsecradar-ignore` comment on the line or the line above.

## Roadmap

- [x] CLI with 9 rules across JS/TS, Python, PHP, Go, Ruby and mobile
- [ ] Django, Laravel, Rails and NestJS auth checks
- [ ] Mobile: Firebase/Supabase misuse in Flutter & React Native, insecure local storage
- [ ] `--url` live scan: secrets in the JS bundle, exposed `.env` / `.git` / source maps, Supabase anon-key table probing (your own domains only)
- [x] MCP server: let Cursor / Claude Code scan and fix on their own
- [ ] GitHub Action + SARIF output (findings in the Security tab)
- [ ] HTML report
- [ ] AI-app checks: prompt injection, unlimited LLM endpoints, hallucinated packages

## Contributing

Each rule is a single file in [`packages/appsecradar/src/rules`](packages/appsecradar/src/rules). Adding a rule takes about 50 lines. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Disclaimer

appsecradar finds common mistakes. A clean scan does not mean an app is secure.
Only scan code and systems you own or have permission to test.

## License

MIT

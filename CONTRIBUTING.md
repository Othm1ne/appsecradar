# Contributing to appsecradar

Thanks for helping make AI-built apps safer! The most valuable contribution is a **new rule** for a mistake you've seen AI tools make.

## Setup

```bash
npm install
npm run build
npm test
npm run demo
```

## Adding a rule

1. Create `packages/appsecradar/src/rules/<rule-id>.ts` exporting a `Rule` (see `stripe-webhook-unverified.ts` for a short example).
2. Register it in `packages/appsecradar/src/rules/index.ts`.
3. Plant the vulnerability in `examples/vulnerable-vibe-app` and add a row to its README table.
4. Add the **safe** version to `packages/appsecradar/test/fixtures/safe-app` so we never flag correct code.
5. Add a test in `packages/appsecradar/test/scan.test.mjs`.

## Rule guidelines

- **Low false positives beat high coverage.** A noisy scanner gets uninstalled.
- The `message` explains, in plain language, what an attacker can actually do.
- The `fixPrompt` must work when pasted into Cursor / Claude Code with no extra context.
- Never print a full secret: mask it.
- Respect `// appsecradar-ignore` via `isIgnored()`.

## Rule ideas (good first issues)

- Supabase policies with `using (true)` on sensitive tables
- Firebase Storage rules (`storage.rules`)
- Auth checks for Django views, Laravel routes, Rails controllers, NestJS controllers, Go (Gin/Echo/Fiber) handlers
- MongoDB NoSQL injection (`find(req.body)`)
- LLM API routes with no rate limiting
- `dangerouslySetInnerHTML` with user or LLM content
- Admin pages protected only on the client side

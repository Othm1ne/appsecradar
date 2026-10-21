# vulnerable-vibe-app

> ⚠️ **Intentionally insecure. Do not deploy.** All keys in this folder are fake.

A tiny Next.js + Supabase + Stripe + OpenAI app written the way AI coding tools often write it.
It exists so you can try appsecradar in seconds and so the test suite has something real to scan.

```bash
npx appsecradar examples/vulnerable-vibe-app
```

## Planted vulnerabilities

| # | File | Problem | Rule |
|---|------|---------|------|
| 1 | `components/ChatWidget.tsx` | OpenAI key hardcoded in a client component | `hardcoded-secret` |
| 2 | `lib/supabase-admin.ts` | Supabase `service_role` key hardcoded | `hardcoded-secret` |
| 3 | `lib/supabase.ts`, `.env.example` | Service role key in a `NEXT_PUBLIC_` variable | `public-env-secret` |
| 4 | `supabase/migrations/…_init.sql` | `notes` table has no Row Level Security | `supabase-rls-disabled` |
| 5 | `supabase/migrations/…_init.sql` | RLS explicitly disabled on `payments` | `supabase-rls-disabled` |
| 6 | `app/api/webhooks/stripe/route.ts` | Webhook trusts unsigned events | `stripe-webhook-unverified` |
| 7 | `app/api/notes/route.ts` | POST/DELETE with no auth, trusts `userId` from the body | `api-route-missing-auth` |

`app/api/profile/route.ts` is the **correct** version of #7 and must not be flagged.

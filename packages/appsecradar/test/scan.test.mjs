import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { scan } from "../dist/index.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const example = (name) => scan(here(`../../../examples/${name}`));

const nextApp = example("vulnerable-vibe-app");
const expressApp = example("vulnerable-express-app");
const pythonApp = example("vulnerable-python-app");
const firebaseApp = example("vulnerable-firebase-app");
const safe = scan(here("./fixtures/safe-app"));

const byRule = (result, id) => result.findings.filter((f) => f.ruleId === id);
const summary = (result) => result.findings.map((f) => `${f.ruleId} ${f.file}:${f.line}`).sort();

test("stack detection", () => {
  for (const s of ["Next.js", "Supabase", "Stripe", "OpenAI"]) assert.ok(nextApp.stacks.includes(s), s);
  for (const s of ["Express", "PostgreSQL", "Stripe"]) assert.ok(expressApp.stacks.includes(s), s);
  for (const s of ["Flask", "FastAPI", "Stripe"]) assert.ok(pythonApp.stacks.includes(s), s);
  for (const s of ["React", "Vite", "Firebase"]) assert.ok(firebaseApp.stacks.includes(s), s);
});

test("next.js + supabase app: hardcoded secrets (client critical, server high)", () => {
  const found = byRule(nextApp, "hardcoded-secret");
  assert.equal(found.length, 2);
  const client = found.find((f) => f.file === "components/ChatWidget.tsx");
  const server = found.find((f) => f.file === "lib/supabase-admin.ts");
  assert.equal(client?.severity, "critical");
  assert.equal(server?.severity, "high");
  assert.match(server.title, /service_role/);
  assert.doesNotMatch(client.message, /DEMO0000fake0000key0000for/, "secret must be masked");
});

test("next.js + supabase app: full findings", () => {
  assert.deepEqual(summary(nextApp), [
    "api-route-missing-auth app/api/notes/route.ts:11",
    "api-route-missing-auth app/api/notes/route.ts:4",
    "hardcoded-secret components/ChatWidget.tsx:6",
    "hardcoded-secret lib/supabase-admin.ts:5",
    "public-env-secret .env.example:3",
    "public-env-secret lib/supabase.ts:6",
    "stripe-webhook-unverified app/api/webhooks/stripe/route.ts:7",
    "supabase-rls-disabled supabase/migrations/20250101000000_init.sql:12",
    "supabase-rls-disabled supabase/migrations/20250101000000_init.sql:25",
  ]);
  assert.equal(nextApp.score, 0);
});

test("express app: findings", () => {
  assert.deepEqual(summary(expressApp), [
    "api-route-missing-auth server.js:25",
    "api-route-missing-auth server.js:30",
    "cors-any-origin-credentials server.js:8",
    "hardcoded-secret server.js:12",
    "sql-injection server.js:26",
    "stripe-webhook-unverified server.js:36",
  ]);
});

test("python app: flask + fastapi findings", () => {
  assert.deepEqual(summary(pythonApp), [
    "api-route-missing-auth fastapi_app.py:10",
    "api-route-missing-auth flask_app.py:13",
    "cors-any-origin-credentials fastapi_app.py:7",
    "cors-any-origin-credentials flask_app.py:8",
    "debug-mode-enabled flask_app.py:38",
    "sql-injection flask_app.py:16",
    "stripe-webhook-unverified flask_app.py:32",
  ]);
});

test("sql-injection across languages and quote styles, no false positives", () => {
  const result = scan(here("./fixtures/sql-cases"));
  assert.deepEqual(summary(result), [
    "sql-injection a.js:2",
    "sql-injection a.js:7",
    "sql-injection b.py:1",
    "sql-injection b.py:2",
    "sql-injection b.py:3",
    "sql-injection c.php:2",
    "sql-injection c.php:3",
    "sql-injection d.go:1",
  ]);
});

test("react + firebase app: findings", () => {
  assert.deepEqual(summary(firebaseApp), [
    "firebase-open-rules database.rules.json:3",
    "firebase-open-rules database.rules.json:4",
    "firebase-open-rules firestore.rules:10",
    "firebase-open-rules firestore.rules:5",
    "public-env-secret src/lib/ai.js:2",
  ]);
  const testMode = firebaseApp.findings.find((f) => f.file === "firestore.rules" && f.line === 10);
  assert.equal(testMode.title, "Firebase is still in test mode");
});

test("every finding has a fix prompt and findings are sorted by severity", () => {
  for (const result of [nextApp, expressApp, pythonApp, firebaseApp]) {
    for (const f of result.findings) assert.ok(f.fixPrompt.length > 50, f.ruleId);
    const order = ["critical", "high", "medium", "low"];
    const ranks = result.findings.map((f) => order.indexOf(f.severity));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  }
});

test("safe app produces no findings", () => {
  assert.deepEqual(summary(safe), []);
  assert.equal(safe.score, 100);
});

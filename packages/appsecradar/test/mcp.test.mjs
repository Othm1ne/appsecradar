import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const examples = here("../../../examples");

let client;

before(async () => {
  client = new Client({ name: "appsecradar-test", version: "0.0.0" });
  // Start the real CLI binary in MCP mode, exactly as an editor would.
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [here("../dist/cli.js"), "mcp"],
      cwd: examples,
      stderr: "ignore",
    }),
  );
});

after(async () => {
  await client?.close();
});

test("exposes scan and list_rules tools and the secure_my_app prompt", async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["list_rules", "scan"]);
  assert.equal(tools.find((t) => t.name === "scan").annotations.readOnlyHint, true);

  const { prompts } = await client.listPrompts();
  assert.deepEqual(prompts.map((p) => p.name), ["secure_my_app"]);
});

test("scan returns markdown + structured findings, path relative to server cwd", async () => {
  const res = await client.callTool({ name: "scan", arguments: { path: "vulnerable-express-app" } });
  assert.notEqual(res.isError, true);
  assert.equal(res.structuredContent.findings.length, 6);
  assert.ok(res.structuredContent.stacks.includes("Express"));
  const text = res.content[0].text;
  assert.match(text, /# appsecradar report/);
  assert.match(text, /\*\*How to fix:\*\*/);
  assert.match(text, /Workflow for the agent/);
});

test("scan filters by severity and by files (verify-a-fix loop)", async () => {
  const critical = await client.callTool({
    name: "scan",
    arguments: { path: "vulnerable-vibe-app", min_severity: "critical" },
  });
  assert.ok(critical.structuredContent.findings.every((f) => f.severity === "critical"));

  const oneFile = await client.callTool({
    name: "scan",
    arguments: { path: "vulnerable-vibe-app", files: ["./lib/supabase.ts"] },
  });
  assert.deepEqual(
    oneFile.structuredContent.findings.map((f) => f.file),
    ["lib/supabase.ts"],
  );
});

test("scan reports a clear error for a missing folder", async () => {
  const res = await client.callTool({ name: "scan", arguments: { path: "does-not-exist" } });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /Not a directory/);
});

test("list_rules lists every rule", async () => {
  const res = await client.callTool({ name: "list_rules", arguments: {} });
  for (const id of ["hardcoded-secret", "supabase-rls-disabled", "sql-injection", "firebase-open-rules"]) {
    assert.match(res.content[0].text, new RegExp(id));
  }
});

test("secure_my_app prompt tells the agent to scan, fix and verify", async () => {
  const res = await client.getPrompt({ name: "secure_my_app", arguments: { path: "vulnerable-vibe-app" } });
  const text = res.messages[0].content.text;
  assert.match(text, /vulnerable-vibe-app/);
  assert.match(text, /re-run `scan`/);
  assert.match(text, /rotate/);
});

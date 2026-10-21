import express from "express";
import cors from "cors";
import pg from "pg";
import { requireAuth } from "./auth.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// FAKE demo credentials: appsecradar should flag this.
const pool = new pg.Pool({
  connectionString: "postgres://app_admin:Tr0ub4dor-demo-only@db.prod-demo.internal:5432/shop",
});

app.post("/api/login", async (req, res) => {
  // public on purpose
  res.json({ ok: true });
});

// Protected correctly: middleware before the handler.
app.get("/api/me", requireAuth, async (req, res) => {
  res.json(req.user);
});

app.post("/api/orders/search", async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM orders WHERE customer_email = '${req.body.email}'`);
  res.json(rows);
});

app.delete("/api/users/:id", async (req, res) => {
  await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  res.json({ deleted: true });
});

app.post("/api/webhooks/stripe", express.json(), async (req, res) => {
  if (req.body.type === "checkout.session.completed") {
    await pool.query("UPDATE users SET plan = 'pro' WHERE id = $1", [req.body.data.object.client_reference_id]);
  }
  res.sendStatus(200);
});

app.listen(3000);

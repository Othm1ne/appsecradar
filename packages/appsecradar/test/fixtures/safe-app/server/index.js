import express from "express";
import cors from "cors";
import pg from "pg";
import { requireAuth } from "./auth.js";

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS.split(","), credentials: true }));

// Local dev default with placeholder credentials is fine.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/dev" });

app.post("/api/orders/search", requireAuth, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM orders WHERE customer_email = $1", [req.body.email]);
  res.json(rows);
});

app.post("/api/register", async (req, res) => {
  res.json({ ok: true });
});

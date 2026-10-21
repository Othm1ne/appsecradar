import express from "express";
db.query("SELECT * FROM users WHERE name = '" + req.query.name + "'");
db.query("SELECT * FROM users WHERE name = $1", [name]);
// constants only: must NOT be flagged (real-world case from a Next.js app)
db.query(`delete from live_games where created_at < now() - interval '${TTL_HOURS} hours'`);
// mixed constant + user value: must be flagged
db.query(`SELECT * FROM t WHERE created_at > ${MAX_AGE} AND name = '${req.query.name}'`);

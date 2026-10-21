import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    req.user = jwt.verify(req.headers.authorization?.replace("Bearer ", ""), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

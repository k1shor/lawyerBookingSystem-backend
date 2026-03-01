export const authorizeRoles = (...roles) => (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (!role) return res.status(401).json({ error: "Unauthorized" });
  if (!roles.map((r) => String(r).toLowerCase()).includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};
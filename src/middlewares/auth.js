import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { verifyToken } from "../utils/jwtUtil.js";
dotenv.config();

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    // const payload = jwt.verify(token, process.env.JWT_SECRET);
    const payload = verifyToken(token);
    req.user = payload; 
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const authorizeAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

export const authorizeClient = (req, res, next) => {
  if (req.user.role !== "client")
    return res.status(403).json({ error: "Client access only" });
  next();
};

export const authorizeLawyer = (req, res, next) => {
  if (req.user?.role === "lawyer") return next();
  return res.status(403).json({ error: "Lawyer access only" });
};

// If you need cross-access checks later:
export const canAccessUserId = (user, id) =>
  user?.role === "admin" || Number(user?.user_id) === Number(id);


export const canAccessLawyerId = (reqUser, lawyerId) => {
  if (!reqUser?.user_id) return false;
  if (reqUser.role === "admin") return true;
  if (reqUser.role === "lawyer" && Number(reqUser.user_id) === Number(lawyerId)) return true;
  return false;
};
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

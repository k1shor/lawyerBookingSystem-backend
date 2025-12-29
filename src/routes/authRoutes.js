// routes/authRoutes.js
import express from "express";
import { login, register } from "../controllers/authController.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Ensure upload directory exists
const uploadDir = "uploads/licenses";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage for license documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `license-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

// Register: supports both
// - multipart/form-data (with licenseDocument file for lawyers)
// - application/json (no file)
router.post("/register", upload.single("licenseDocument"), register);

router.post("/login", login);

export default router;

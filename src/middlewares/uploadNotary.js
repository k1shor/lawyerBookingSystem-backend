import multer from "multer";
import path from "path";
import fs from "fs";

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/notary";
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext || ".bin";
    const name = `notary_${Date.now()}_${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const mimetype = String(file.mimetype || "").toLowerCase();
  const ok =
    mimetype.startsWith("image/") ||
    mimetype === "application/pdf";
  if (!ok) return cb(new Error("Only images or PDF are allowed"), false);
  cb(null, true);
};

export const uploadNotary = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
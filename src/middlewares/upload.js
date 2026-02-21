import multer from "multer";
import path from "path";
import fs from "fs";

/* =========================
   STORAGE CONFIG
========================= */

// ensure uploads folder exists
const uploadDir = path.join("uploads", "licenses");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `license-${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

/* =========================
   FILE FILTER
========================= */

const fileFilter = (req, file, cb) => {
  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF or Image files are allowed"), false);
  }
};

/* =========================
   MULTER INSTANCE
========================= */

export const uploadLicense = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

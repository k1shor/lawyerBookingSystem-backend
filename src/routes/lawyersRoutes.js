import express from "express";
import {
  getLawyers,
  getLawyerById,
  getMyLawyerProfile,
  upsertMyLawyerProfile,
  getMyDashboardProfile,
  getMyDashboardStats,
  getMyDashboardAppointments,
  getMyDashboardCases,
  getMyDashboardDocuments,
  getMyLawyerDashboardBundle,
} from "../controllers/lawyersController.js";

import { authenticate } from "../middlewares/auth.js";
import { uploadLicense } from "../middlewares/upload.js";

const router = express.Router();

/* ---------- PUBLIC ---------- */
router.get("/", getLawyers);

/* ---------- LAWYER SELF ---------- */
router.get("/me", authenticate, getMyLawyerProfile);
router.put(
  "/me/profile",
  authenticate,
  uploadLicense.single("license_document"),
  upsertMyLawyerProfile
);

/* ---------- LAWYER DASHBOARD (BUNDLE) ---------- */
router.get("/:id/dashboard", authenticate, getMyLawyerDashboardBundle);

/* ---------- LAWYER DASHBOARD (SPLIT) ---------- */
router.get("/dashboard/me", authenticate, getMyDashboardProfile);
router.get("/dashboard/stats", authenticate, getMyDashboardStats);
router.get("/dashboard/appointments", authenticate, getMyDashboardAppointments);
router.get("/dashboard/cases", authenticate, getMyDashboardCases);
router.get("/dashboard/documents", authenticate, getMyDashboardDocuments);

/* ---------- PUBLIC BY ID (keep LAST) ---------- */
router.get("/dashboard/:id", getLawyerById);

export default router;
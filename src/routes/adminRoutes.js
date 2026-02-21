import express from "express";
import {
  getAllUsers,
  getAllAdmins,
  verifyUser,
  getAllLawyers,
  verifyLawyer,
  getAllAppointments,
  cancelAppointment,
  getLawyerDashboardByAdmin,
} from "../controllers/adminController.js";

import { authenticate, authorizeAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.use(authenticate, authorizeAdmin);

/* USERS */
router.get("/users", getAllUsers);
router.get("/admins", getAllAdmins);
router.put("/users/verify/:id", verifyUser);

/* LAWYERS */
router.get("/lawyers", getAllLawyers);
router.put("/lawyers/verify/:id", verifyLawyer);

/* APPOINTMENTS */
router.get("/appointments", getAllAppointments);
router.put("/appointments/cancel/:id", cancelAppointment);

/* LAWYER DASHBOARD (ADMIN VIEW) */
router.get("/lawyers/:lawyerId/dashboard", getLawyerDashboardByAdmin);

export default router;
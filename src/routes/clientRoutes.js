import express from "express";
import {
  getClientProfile,
  getClientCases,
  getClientAppointments,
  getClientDocuments,
  getClientBilling
} from "../controllers/clientController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

// authenticated users only
router.use(authenticate);

router.get("/profile/:user_id", getClientProfile);
router.get("/cases/:user_id", getClientCases);
router.get("/appointments/:user_id", getClientAppointments);
router.get("/documents/:user_id", getClientDocuments);
router.get("/billing/:user_id", getClientBilling);

export default router;

import express from "express";
import {
  createAppointment,
  getMyAppointments,
  lawyerOfferFee,
  lawyerAccept,
  lawyerReject,
  clientCounterOffer,
  clientAcceptOffer
} from "../controllers/appointmentsController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.post("/", authenticate, createAppointment);
router.get("/my", authenticate, getMyAppointments);

router.patch("/:id/offer", authenticate, lawyerOfferFee);
router.patch("/:id/accept", authenticate, lawyerAccept);
router.patch("/:id/reject", authenticate, lawyerReject);

router.patch("/:id/counter", authenticate, clientCounterOffer);
router.patch("/:id/confirm", authenticate, clientAcceptOffer);

export default router;

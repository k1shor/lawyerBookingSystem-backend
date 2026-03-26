import express from "express";
import { initiateAppointmentEsewaPayment, initiateEsewaPayment, verifyAppointmentEsewaPayment, verifyEsewaPayment } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/esewa/initiate", initiateEsewaPayment);
router.get("/esewa/success", verifyEsewaPayment);


router.post("/appointment/esewa/initiate", initiateAppointmentEsewaPayment);
router.get("/appointment/esewa/success", verifyAppointmentEsewaPayment);

export default router;
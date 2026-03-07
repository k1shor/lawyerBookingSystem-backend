import express from "express";
import { initiateEsewaPayment, verifyEsewaPayment } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/esewa/initiate", initiateEsewaPayment);
router.get("/esewa/success", verifyEsewaPayment);

export default router;
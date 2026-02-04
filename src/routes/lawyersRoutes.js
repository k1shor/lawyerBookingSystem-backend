import express from "express";
import { getLawyers, getLawyerById } from "../controllers/lawyersController.js";

const router = express.Router();

router.get("/", getLawyers);
router.get("/:id", getLawyerById);

export default router;

// routes/userRoutes.js
import express from "express";
import { getAllUsers, getUserById } from "../controllers/usersController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", authenticate,getAllUsers);
router.get("/:id", authenticate, getUserById);

export default router;

import express from "express";
import { getMessages, postMessage } from "../controllers/messagesController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.get("/:id/messages", authenticate, getMessages);
router.post("/:id/messages", authenticate, postMessage);

export default router;

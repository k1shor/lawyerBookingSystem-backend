import express from "express";
import {
  unreadCount,
  listMyNotifications,
  markRead,
  markAllRead
} from "../controllers/notificationsController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.get("/unread-count", authenticate, unreadCount);
router.get("/", authenticate, listMyNotifications);
router.patch("/:id/read", authenticate, markRead);
router.patch("/read-all", authenticate, markAllRead);

export default router;

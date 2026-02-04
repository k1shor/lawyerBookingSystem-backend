import pool from "../config/db.js";

export const unreadCount = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0`,
      [Number(userId)]
    );
    res.json({ unread: Number(rows[0]?.cnt || 0) });
  } catch {
    res.status(500).json({ error: "Failed to load unread count" });
  }
};

export const listMyNotifications = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const [rows] = await pool.query(
      `SELECT notification_id, appointment_id, type, title, body, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [Number(userId)]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to load notifications" });
  }
};

export const markRead = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const id = Number(req.params.id);
    await pool.query(`UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?`, [id, Number(userId)]);
    res.json({ message: "Marked read" });
  } catch {
    res.status(500).json({ error: "Failed to mark read" });
  }
};

export const markAllRead = async (req, res) => {
  try {
    const userId = req.user.user_id;
    await pool.query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [Number(userId)]);
    res.json({ message: "All marked read" });
  } catch {
    res.status(500).json({ error: "Failed to mark all read" });
  }
};

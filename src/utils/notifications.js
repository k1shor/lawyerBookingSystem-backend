import pool from "../config/db.js";

export async function notifyUser(user_id, appointment_id, type, title, body = null) {
  await pool.query(
    `INSERT INTO notifications (user_id, appointment_id, type, title, body) VALUES (?, ?, ?, ?, ?)`,
    [Number(user_id), appointment_id ? Number(appointment_id) : null, type, title, body]
  );
}

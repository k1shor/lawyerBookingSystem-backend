import pool from "../config/db.js";

const getAppt = async (id) => {
  const [rows] = await pool.query(`SELECT * FROM appointments WHERE appointment_id = ?`, [Number(id)]);
  return rows[0] || null;
};

export const getMessages = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const role = req.user.role;
    const appointment_id = Number(req.params.id);

    const appt = await getAppt(appointment_id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    const isOwner = Number(appt.client_id) === Number(userId) || Number(appt.lawyer_id) === Number(userId) || role === "admin";
    if (!isOwner) return res.status(403).json({ error: "Not allowed" });

    const [rows] = await pool.query(
      `SELECT message_id, appointment_id, sender_id, sender_role, message, created_at
       FROM appointment_messages
       WHERE appointment_id = ?
       ORDER BY created_at ASC`,
      [appointment_id]
    );

    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to load messages" });
  }
};

export const postMessage = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const role = req.user.role;
    const appointment_id = Number(req.params.id);
    const { message } = req.body;

    if (!message || !String(message).trim()) return res.status(400).json({ error: "Message is required" });

    const appt = await getAppt(appointment_id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    const isOwner = Number(appt.client_id) === Number(userId) || Number(appt.lawyer_id) === Number(userId) || role === "admin";
    if (!isOwner) return res.status(403).json({ error: "Not allowed" });

    await pool.query(
      `INSERT INTO appointment_messages (appointment_id, sender_id, sender_role, message)
       VALUES (?, ?, ?, ?)`,
      [appointment_id, userId, role, String(message).trim()]
    );

    res.status(201).json({ message: "Sent" });
  } catch {
    res.status(500).json({ error: "Failed to send message" });
  }
};

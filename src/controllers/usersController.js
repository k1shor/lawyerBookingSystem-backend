// controllers/usersController.js
import pool from "../config/db.js";

export const getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT user_id, full_name, email, phone, role, created_at FROM users"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT user_id, full_name, email, phone, role, created_at FROM users WHERE user_id = ?",
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

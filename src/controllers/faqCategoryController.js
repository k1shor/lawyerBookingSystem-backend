import pool from "../config/db.js";

/* ================= CREATE ================= */
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const [result] = await pool.query(
      "INSERT INTO faq_categories (name) VALUES (?)",
      [name]
    );

    const [rows] = await pool.query(
      "SELECT * FROM faq_categories WHERE category_id = ?",
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= READ ALL ================= */
export const getAllCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM faq_categories ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= READ ONE ================= */
export const getCategoryById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM faq_categories WHERE category_id = ?",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= UPDATE ================= */
export const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;

    const [result] = await pool.query(
      "UPDATE faq_categories SET name = ? WHERE category_id = ?",
      [name, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM faq_categories WHERE category_id = ?",
      [req.params.id]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= DELETE ================= */
export const deleteCategory = async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM faq_categories WHERE category_id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
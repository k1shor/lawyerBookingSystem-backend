import pool from "../config/db.js";

/* ================= CREATE ================= */
export const createFaq = async (req, res) => {
  try {
    const { category_id, question, answer } = req.body;

    if (!category_id || !question || !answer) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO faqs (category_id, question, answer)
       VALUES (?, ?, ?)`,
      [category_id, question, answer]
    );

    const [rows] = await pool.query(
      `SELECT f.*, c.name AS category_name
       FROM faqs f
       JOIN faq_categories c ON f.category_id = c.category_id
       WHERE f.faq_id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= READ ALL ================= */
export const getAllFaqs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, c.name AS category_name
       FROM faqs f
       JOIN faq_categories c ON f.category_id = c.category_id
       ORDER BY f.created_at DESC`
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= READ BY CATEGORY ================= */
export const getFaqsByCategory = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, c.name AS category_name
       FROM faqs f
       JOIN faq_categories c ON f.category_id = c.category_id
       WHERE f.category_id = ?
       ORDER BY f.created_at DESC`,
      [req.params.categoryId]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= READ ONE ================= */
export const getFaqById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, c.name AS category_name
       FROM faqs f
       JOIN faq_categories c ON f.category_id = c.category_id
       WHERE f.faq_id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= UPDATE ================= */
export const updateFaq = async (req, res) => {
  try {
    const { category_id, question, answer } = req.body;

    const [result] = await pool.query(
      `UPDATE faqs
       SET category_id = ?, question = ?, answer = ?
       WHERE faq_id = ?`,
      [category_id, question, answer, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    const [rows] = await pool.query(
      `SELECT f.*, c.name AS category_name
       FROM faqs f
       JOIN faq_categories c ON f.category_id = c.category_id
       WHERE f.faq_id = ?`,
      [req.params.id]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= DELETE ================= */
export const deleteFaq = async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM faqs WHERE faq_id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    res.json({ message: "FAQ deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
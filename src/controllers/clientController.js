import pool from "../config/db.js";

/* ================= PERMISSION HELPER ================= */
const canAccessClient = (reqUser, targetId) => {
  if (!reqUser) return false;

  // admin can access any
  if (reqUser.role === "admin") return true;

  // client can access own only
  if (reqUser.role === "client" && reqUser.user_id === targetId) return true;

  return false;
};

/* ================= PROFILE ================= */
export const getClientProfile = async (req, res) => {
  try {
    const id = Number(req.params.user_id);

    if (!canAccessClient(req.user, id))
      return res.status(403).json({ error: "Access denied" });

    const [rows] = await pool.query(
      `SELECT user_id, full_name, email, phone, address, city, state, zip_code, created_at, is_verified
       FROM users 
       WHERE user_id=? AND role='client'`,
      [id]
    );
    console.log(rows.length)

    if (rows.length <= 0) return res.status(404).json({ error: "Client not found!!!!" });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

/* ================= CASES ================= */
export const getClientCases = async (req, res) => {
  try {
    const id = Number(req.params.user_id);

    if (!canAccessClient(req.user, id))
      return res.status(403).json({ error: "Access denied" });

    const [rows] = await pool.query(
      `SELECT c.case_id, c.title, c.case_type, c.status, c.created_at,
              u.full_name AS lawyer
       FROM cases c
       LEFT JOIN users u ON u.user_id = c.lawyer_id
       WHERE c.client_id=?`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
};

/* ================= APPOINTMENTS ================= */
export const getClientAppointments = async (req, res) => {
  try {
    const id = Number(req.params.user_id);

    if (!canAccessClient(req.user, id))
      return res.status(403).json({ error: "Access denied" });

    const [rows] = await pool.query(
      `SELECT a.appointment_id, a.appointment_date, a.appointment_time,
              a.status, a.subject,
              u.full_name AS lawyer
       FROM appointments a
       JOIN users u ON u.user_id = a.lawyer_id
       WHERE a.client_id=?`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
};

/* ================= DOCUMENTS ================= */
export const getClientDocuments = async (req, res) => {
  try {
    const id = Number(req.params.user_id);

    if (!canAccessClient(req.user, id))
      return res.status(403).json({ error: "Access denied" });

    const [rows] = await pool.query(
      `SELECT document_id, name, file_path, file_size, doc_type, created_at
       FROM client_documents
       WHERE client_id=?`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
};

/* ================= BILLING ================= */
export const getClientBilling = async (req, res) => {
  try {
    const id = Number(req.params.user_id);

    if (!canAccessClient(req.user, id))
      return res.status(403).json({ error: "Access denied" });

    const [rows] = await pool.query(
      `SELECT billing_month AS month, amount, status
       FROM billing 
       WHERE client_id=?`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch billing" });
  }
};

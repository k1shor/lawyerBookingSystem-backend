import pool from "../config/db.js";

/* ================= HELPERS ================= */

const roleOf = (req) => String(req.user?.role || "").toLowerCase();
const userIdOf = (req) => Number(req.user?.user_id || 0);

const mustAuth = (req, res) => {
  const id = userIdOf(req);
  if (!id) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return id;
};

const computeNotaryAmount = (urgency) => {
  // ✅ You can replace with a config table later
  const u = String(urgency || "normal").toLowerCase();
  return u === "urgent" ? 1500.0 : 800.0;
};

const canAccessNotary = (req, row) => {
  const r = roleOf(req);
  const uid = userIdOf(req);
  if (r === "admin") return true;
  if (r === "lawyer") return true; // lawyers can view all requests
  if (r === "client") return Number(row.client_id) === Number(uid);
  return false;
};

/* =========================
   CLIENT: CREATE REQUEST
   POST /api/notary
   form-data: title, doc_type, urgency
   file: document
========================= */
export const createNotaryRequest = async (req, res) => {
  try {
    const uid = mustAuth(req, res);
    if (!uid) return;

    if (roleOf(req) !== "client") {
      return res.status(403).json({ error: "Client access only" });
    }

    const { title, doc_type, urgency } = req.body;

    if (!title || !doc_type) {
      return res.status(400).json({ error: "title and doc_type are required" });
    }
    if (!req.file?.path) {
      return res.status(400).json({ error: "document file is required" });
    }

    const urg = String(urgency || "normal").toLowerCase();
    if (!["normal", "urgent"].includes(urg)) {
      return res.status(400).json({ error: "Invalid urgency" });
    }

    const amount = computeNotaryAmount(urg);

    const [result] = await pool.query(
      `
      INSERT INTO notary_requests
        (title, doc_type, urgency, client_id, status, payment_status, amount, client_document_path)
      VALUES
        (?, ?, ?, ?, 'submitted', 'unpaid', ?, ?)
      `,
      [title, doc_type, urg, uid, amount, req.file.path]
    );

    const notaryId = result.insertId;

    const [rows] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=? LIMIT 1`,
      [notaryId]
    );

    res.status(201).json({ success: true, item: rows[0] });
  } catch (e) {
    console.error("createNotaryRequest error:", e);
    res.status(500).json({ error: "Failed to create notary request" });
  }
};

/* =========================
   CLIENT: PAY
   POST /api/notary/:id/pay
   body: { payment_ref? }
========================= */
export const payNotaryRequest = async (req, res) => {
  try {
    const uid = mustAuth(req, res);
    if (!uid) return;

    if (roleOf(req) !== "client") {
      return res.status(403).json({ error: "Client access only" });
    }

    const notaryId = Number(req.params.id);
    if (!notaryId) return res.status(400).json({ error: "Invalid notary id" });

    const [rows] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=? LIMIT 1`,
      [notaryId]
    );
    if (!rows.length) return res.status(404).json({ error: "Notary request not found" });

    const item = rows[0];
    if (Number(item.client_id) !== Number(uid)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (String(item.payment_status).toLowerCase() === "paid") {
      return res.json({ success: true, message: "Already paid" });
    }

    const payment_ref = req.body?.payment_ref ? String(req.body.payment_ref) : null;

    await pool.query(
      `
      UPDATE notary_requests
      SET payment_status='paid',
          status=IF(status='submitted','paid',status),
          payment_ref=COALESCE(?, payment_ref)
      WHERE notary_id=?
      `,
      [payment_ref, notaryId]
    );

    const [updated] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=? LIMIT 1`,
      [notaryId]
    );

    res.json({ success: true, item: updated[0] });
  } catch (e) {
    console.error("payNotaryRequest error:", e);
    res.status(500).json({ error: "Failed to mark payment" });
  }
};

/* =========================
   LIST (ROLE AWARE)
   GET /api/notary
   - admin/lawyer: all
   - client: own
========================= */
export const listNotaryRequests = async (req, res) => {
  try {
    const uid = mustAuth(req, res);
    if (!uid) return;

    const r = roleOf(req);

    if (!["admin", "lawyer", "client"].includes(r)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Lawyers can view all requests (without exposing other lawyer PII - we return ids + names only)
    // Admin can view all
    // Client only own

    const where =
      r === "client" ? "WHERE n.client_id = ?" : "";
    const params = r === "client" ? [uid] : [];

    const [rows] = await pool.query(
      `
      SELECT
        n.notary_id,
        n.title,
        n.doc_type,
        n.urgency,
        n.status,
        n.payment_status,
        n.amount,
        n.client_id,
        n.lawyer_id,
        n.created_at,
        n.updated_at,

        c.full_name AS client_name,
        c.email AS client_email,
        c.phone AS client_phone,

        lw.full_name AS lawyer_name
      FROM notary_requests n
      JOIN users c ON c.user_id = n.client_id
      LEFT JOIN users lw ON lw.user_id = n.lawyer_id
      ${where}
      ORDER BY n.created_at DESC
      `,
      params
    );

    // ✅ Lawyers should not see other lawyers' personal data:
    // We did not include lawyer email/phone, only name and id.
    // Clients will see their own row anyway.

    res.json({ success: true, items: rows });
  } catch (e) {
    console.error("listNotaryRequests error:", e);
    res.status(500).json({ error: "Failed to fetch notary requests" });
  }
};

/* =========================
   DETAILS (ROLE AWARE)
   GET /api/notary/:id
========================= */
export const getNotaryById = async (req, res) => {
  try {
    const uid = mustAuth(req, res);
    if (!uid) return;

    const notaryId = Number(req.params.id);
    if (!notaryId) return res.status(400).json({ error: "Invalid notary id" });

    const [rows] = await pool.query(
      `
      SELECT
        n.*,
        c.full_name AS client_name,
        c.email AS client_email,
        c.phone AS client_phone,
        lw.full_name AS lawyer_name
      FROM notary_requests n
      JOIN users c ON c.user_id = n.client_id
      LEFT JOIN users lw ON lw.user_id = n.lawyer_id
      WHERE n.notary_id=?
      LIMIT 1
      `,
      [notaryId]
    );

    if (!rows.length) return res.status(404).json({ error: "Notary request not found" });

    const item = rows[0];
    if (!canAccessNotary(req, item)) return res.status(403).json({ error: "Forbidden" });

    // Lawyers should not see other lawyers' PII (we only selected lawyer_name)
    res.json({ success: true, item });
  } catch (e) {
    console.error("getNotaryById error:", e);
    res.status(500).json({ error: "Failed to fetch notary details" });
  }
};

/* =========================
   LAWYER: NOTARIZE + UPLOAD FINAL
   PUT /api/notary/:id/notarize
   file: notarized_document (image/pdf)
========================= */
export const notarizeRequest = async (req, res) => {
  try {
    const uid = mustAuth(req, res);
    if (!uid) return;

    if (roleOf(req) !== "lawyer") {
      return res.status(403).json({ error: "Lawyer access only" });
    }

    const notaryId = Number(req.params.id);
    if (!notaryId) return res.status(400).json({ error: "Invalid notary id" });

    if (!req.file?.path) {
      return res.status(400).json({ error: "notarized_document file is required" });
    }

    const [rows] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=? LIMIT 1`,
      [notaryId]
    );
    if (!rows.length) return res.status(404).json({ error: "Notary request not found" });

    const item = rows[0];

    // Optional policy: only notarize if paid
    if (String(item.payment_status).toLowerCase() !== "paid") {
      return res.status(400).json({ error: "Payment not completed for this request" });
    }

    await pool.query(
      `
      UPDATE notary_requests
      SET lawyer_id=?,
          notarized_document_path=?,
          status='notarized'
      WHERE notary_id=?
      `,
      [uid, req.file.path, notaryId]
    );

    const [updated] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=? LIMIT 1`,
      [notaryId]
    );

    res.json({ success: true, item: updated[0] });
  } catch (e) {
    console.error("notarizeRequest error:", e);
    res.status(500).json({ error: "Failed to upload notarized document" });
  }
};

/* =========================
   CLIENT: VERIFY FINAL
   POST /api/notary/:id/verify
========================= */
export const verifyNotaryFinal = async (req, res) => {
  try {
    const uid = mustAuth(req, res);
    if (!uid) return;

    if (roleOf(req) !== "client") {
      return res.status(403).json({ error: "Client access only" });
    }

    const notaryId = Number(req.params.id);
    if (!notaryId) return res.status(400).json({ error: "Invalid notary id" });

    const [rows] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=? LIMIT 1`,
      [notaryId]
    );
    if (!rows.length) return res.status(404).json({ error: "Notary request not found" });

    const item = rows[0];
    if (Number(item.client_id) !== Number(uid)) return res.status(403).json({ error: "Forbidden" });

    if (!item.notarized_document_path) {
      return res.status(400).json({ error: "No notarized document uploaded yet" });
    }

    await pool.query(
      `UPDATE notary_requests SET status='verified' WHERE notary_id=?`,
      [notaryId]
    );

    const [updated] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=? LIMIT 1`,
      [notaryId]
    );

    res.json({ success: true, item: updated[0] });
  } catch (e) {
    console.error("verifyNotaryFinal error:", e);
    res.status(500).json({ error: "Failed to verify notarized document" });
  }
};

/* =========================
   LAWYER: CLAIM REQUEST
   POST /api/notary/:id/claim
   - assigns lawyer_id
   - sets status='in_review'
========================= */
export const claimNotaryRequest = async (req, res) => {
  try {
    const uid = mustAuth(req, res);
    if (!uid) return;

    if (roleOf(req) !== "lawyer") {
      return res.status(403).json({ error: "Lawyer access only" });
    }

    const notaryId = Number(req.params.id);
    if (!notaryId) return res.status(400).json({ error: "Invalid notary id" });

    const [rows] = await pool.query(
      `
      SELECT *
      FROM notary_requests
      WHERE notary_id=?
      LIMIT 1
      `,
      [notaryId]
    );

    if (!rows.length) return res.status(404).json({ error: "Notary request not found" });
    const item = rows[0];

    // ✅ must be paid before claiming
    if (String(item.payment_status || "").toLowerCase() !== "paid") {
      return res.status(400).json({ error: "Payment not completed for this request" });
    }

    const status = String(item.status || "").toLowerCase();
    if (["verified"].includes(status)) {
      return res.status(400).json({ error: "This request is already verified" });
    }

    // ✅ already claimed by someone else?
    if (item.lawyer_id && Number(item.lawyer_id) !== Number(uid)) {
      return res.status(409).json({ error: "This request is already claimed by another lawyer" });
    }

    // If already claimed by same lawyer, keep it idempotent
    await pool.query(
      `
      UPDATE notary_requests
      SET
        lawyer_id = ?,
        status = 'in_review'
      WHERE notary_id = ?
      `,
      [uid, notaryId]
    );

    const [updated] = await pool.query(
      `
      SELECT
        n.*,
        c.full_name AS client_name,
        c.email AS client_email,
        c.phone AS client_phone,
        lw.full_name AS lawyer_name
      FROM notary_requests n
      JOIN users c ON c.user_id = n.client_id
      LEFT JOIN users lw ON lw.user_id = n.lawyer_id
      WHERE n.notary_id=?
      LIMIT 1
      `,
      [notaryId]
    );

    res.json({ success: true, item: updated[0] });
  } catch (e) {
    console.error("claimNotaryRequest error:", e);
    res.status(500).json({ error: "Failed to claim notary request" });
  }
};
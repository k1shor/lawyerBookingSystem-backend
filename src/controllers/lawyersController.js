import pool from "../config/db.js";

/* =========================
   HELPERS
========================= */

const mustBeLawyer = (req, res) => {
  const userId = Number(req.user?.user_id);
  const role = req.user?.role;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  if (role !== "lawyer") {
    res.status(403).json({ error: "Lawyer access only" });
    return null;
  }

  return userId;
};

/* =========================
   GET ALL LAWYERS (PUBLIC)
   GET /api/lawyers
========================= */
export const getLawyers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        u.user_id AS lawyer_id,
        u.full_name,
        u.email,
        u.phone,
        l.specialization,
        l.experience_years,
        l.hourly_rate,
        LEFT(IFNULL(l.bio, ''), 180) AS bio,
        l.is_verified,
        l.license_document
      FROM users u
      INNER JOIN lawyers l ON l.lawyer_id = u.user_id
      WHERE u.role = 'lawyer'
      ORDER BY l.is_verified DESC, l.experience_years DESC
      `
    );

    res.json(rows);
  } catch (e) {
    console.error("getLawyers error:", e);
    res.status(500).json({ error: "Failed to fetch lawyers" });
  }
};

/* =========================
   GET LAWYER BY ID (PUBLIC)
   GET /api/lawyers/:id
========================= */
export const getLawyerById = async (req, res) => {
  try {
    const lawyerId = Number(req.params.id);
    console.log(lawyerId)
    if (!lawyerId) {
      return res.status(400).json({ error: "Invalid lawyer id" });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        u.user_id AS lawyer_id,
        u.full_name,
        u.email,
        u.phone,
        l.specialization,
        l.experience_years,
        l.hourly_rate,
        l.bio,
        l.is_verified,
        l.license_document
      FROM users u
      INNER JOIN lawyers l ON l.lawyer_id = u.user_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [lawyerId]
    );

    if (!rows.length) return res.status(404).json({ error: "Lawyer not found" });

    res.json(rows[0]);
  } catch (e) {
    console.error("getLawyerById error:", e);
    res.status(500).json({ error: "Failed to fetch lawyer details" });
  }
};

/* =========================
   GET MY LAWYER PROFILE (AUTH)
   GET /api/lawyers/me/profile
========================= */
export const getMyLawyerProfile = async (req, res) => {
  try {
    const userId = mustBeLawyer(req, res);
    if (!userId) return;

    const [rows] = await pool.query(
      `
      SELECT 
        u.user_id AS lawyer_id,
        u.full_name,
        u.email,
        u.phone,
        u.created_at AS user_created_at,
        u.is_verified AS user_verified,

        l.specialization,
        l.experience_years,
        l.hourly_rate,
        l.bio,
        l.license_document,
        l.is_verified AS lawyer_verified,
        l.created_at AS lawyer_created_at
      FROM users u
      INNER JOIN lawyers l ON l.lawyer_id = u.user_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) return res.status(404).json({ error: "Lawyer profile not found" });

    res.json(rows[0]);
  } catch (e) {
    console.error("getMyLawyerProfile error:", e);
    res.status(500).json({ error: "Failed to fetch my lawyer profile" });
  }
};

/* =========================
   UPDATE MY LAWYER PROFILE (AUTH)
   PUT /api/lawyers/me/profile
   Supports optional file upload: license_document
========================= */
export const upsertMyLawyerProfile = async (req, res) => {
  try {
    const userId = mustBeLawyer(req, res);
    if (!userId) return;

    const { specialization, experience_years, hourly_rate, bio } = req.body;

    // optional uploaded file (multer)
    const licensePath = req.file ? req.file.path : null;

    // ensure lawyer exists
    const [exists] = await pool.query(
      `SELECT lawyer_id FROM lawyers WHERE lawyer_id = ? LIMIT 1`,
      [userId]
    );
    if (!exists.length) return res.status(404).json({ error: "Lawyer record not found" });

    await pool.query(
      `
      UPDATE lawyers
      SET
        specialization   = COALESCE(?, specialization),
        experience_years = COALESCE(?, experience_years),
        hourly_rate      = COALESCE(?, hourly_rate),
        bio              = COALESCE(?, bio),
        license_document = COALESCE(?, license_document)
      WHERE lawyer_id = ?
      `,
      [
        specialization ?? null,
        experience_years !== undefined && experience_years !== null && experience_years !== ""
          ? Number(experience_years)
          : null,
        hourly_rate !== undefined && hourly_rate !== null && hourly_rate !== ""
          ? Number(hourly_rate)
          : null,
        bio ?? null,
        licensePath,
        userId,
      ]
    );

    // return updated
    const [rows] = await pool.query(
      `
      SELECT 
        u.user_id AS lawyer_id,
        u.full_name,
        u.email,
        u.phone,
        u.created_at AS user_created_at,
        u.is_verified AS user_verified,

        l.specialization,
        l.experience_years,
        l.hourly_rate,
        l.bio,
        l.license_document,
        l.is_verified AS lawyer_verified,
        l.created_at AS lawyer_created_at
      FROM users u
      INNER JOIN lawyers l ON l.lawyer_id = u.user_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    res.json(rows[0]);
  } catch (e) {
    console.error("upsertMyLawyerProfile error:", e);
    res.status(500).json({ error: "Failed to update lawyer profile" });
  }
};

/* ==========================================================
   ✅ LAWYER DASHBOARD (AUTH)
   Recommended base: /api/lawyers/dashboard/*
========================================================== */

/* GET /api/lawyers/dashboard/me */
export const getMyDashboardProfile = async (req, res) => {
  try {
    const userId = mustBeLawyer(req, res);
    if (!userId) return;

    const [rows] = await pool.query(
      `
      SELECT
        u.user_id AS lawyer_id,
        u.full_name,
        u.email,
        u.phone,
        u.created_at AS user_created_at,
        u.is_verified AS user_verified,

        l.specialization,
        l.experience_years,
        l.hourly_rate,
        l.bio,
        l.license_document,
        l.is_verified AS lawyer_verified,
        l.created_at AS lawyer_created_at
      FROM users u
      JOIN lawyers l ON l.lawyer_id = u.user_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) return res.status(404).json({ error: "Lawyer not found" });

    res.json(rows[0]);
  } catch (e) {
    console.error("getMyDashboardProfile error:", e);
    res.status(500).json({ error: "Failed to fetch dashboard profile" });
  }
};

/* GET /api/lawyers/dashboard/stats */
export const getMyDashboardStats = async (req, res) => {
  try {
    const userId = mustBeLawyer(req, res);
    if (!userId) return;

    const [[apptTotal]] = await pool.query(
      `SELECT COUNT(*) AS c FROM appointments WHERE lawyer_id=?`,
      [userId]
    );

    const [[apptUpcoming]] = await pool.query(
      `
      SELECT COUNT(*) AS c
      FROM appointments
      WHERE lawyer_id=?
        AND status IN ('pending','negotiating','approved')
      `,
      [userId]
    );

    const [[caseTotal]] = await pool.query(
      `SELECT COUNT(*) AS c FROM cases WHERE lawyer_id=?`,
      [userId]
    );

    const [[caseActive]] = await pool.query(
      `SELECT COUNT(*) AS c FROM cases WHERE lawyer_id=? AND status='active'`,
      [userId]
    );

    const [[docCount]] = await pool.query(
      `
      SELECT COUNT(*) AS c
      FROM client_documents
      WHERE client_id IN (
        SELECT DISTINCT a.client_id
        FROM appointments a
        WHERE a.lawyer_id = ?
      )
      `,
      [userId]
    );

    res.json({
      totalAppointments: Number(apptTotal?.c || 0),
      upcomingAppointments: Number(apptUpcoming?.c || 0),
      totalCases: Number(caseTotal?.c || 0),
      activeCases: Number(caseActive?.c || 0),
      totalClientDocs: Number(docCount?.c || 0),
    });
  } catch (e) {
    console.error("getMyDashboardStats error:", e);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

/* GET /api/lawyers/dashboard/appointments */
export const getMyDashboardAppointments = async (req, res) => {
  try {
    const userId = mustBeLawyer(req, res);
    if (!userId) return;

    const [rows] = await pool.query(
      `
      SELECT
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
        a.subject,
        a.status,
        a.proposed_fee,
        a.offered_fee,
        a.final_fee,
        a.negotiation_note,
        a.created_at,

        c.user_id AS client_id,
        c.full_name AS client_name,
        c.email AS client_email,
        c.phone AS client_phone
      FROM appointments a
      JOIN users c ON c.user_id = a.client_id
      WHERE a.lawyer_id = ?
      ORDER BY a.created_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (e) {
    console.error("getMyDashboardAppointments error:", e);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
};

/* GET /api/lawyers/dashboard/cases */
export const getMyDashboardCases = async (req, res) => {
  try {
    const userId = mustBeLawyer(req, res);
    if (!userId) return;

    const [rows] = await pool.query(
      `
      SELECT
        cs.case_id,
        cs.title,
        cs.case_type,
        cs.status,
        cs.created_at,
        u.user_id AS client_id,
        u.full_name AS client_name
      FROM cases cs
      JOIN users u ON u.user_id = cs.client_id
      WHERE cs.lawyer_id = ?
      ORDER BY cs.created_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (e) {
    console.error("getMyDashboardCases error:", e);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
};

/* GET /api/lawyers/dashboard/documents */
export const getMyDashboardDocuments = async (req, res) => {
  try {
    const userId = mustBeLawyer(req, res);
    if (!userId) return;

    const [[licenseRow]] = await pool.query(
      `SELECT license_document FROM lawyers WHERE lawyer_id=?`,
      [userId]
    );

    const license_document = licenseRow?.license_document || null;

    const [clientDocs] = await pool.query(
      `
      SELECT
        d.document_id,
        d.client_id,
        u.full_name AS client_name,
        d.name,
        d.file_path,
        d.file_size,
        d.doc_type,
        d.created_at
      FROM client_documents d
      JOIN users u ON u.user_id = d.client_id
      WHERE d.client_id IN (
        SELECT DISTINCT a.client_id
        FROM appointments a
        WHERE a.lawyer_id = ?
      )
      ORDER BY d.created_at DESC
      LIMIT 200
      `,
      [userId]
    );

    res.json({ license_document, client_documents: clientDocs });
  } catch (e) {
    console.error("getMyDashboardDocuments error:", e);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
};

/* ==========================================================
   ✅ DASHBOARD BUNDLE (AUTH) - BEST FOR REACT
   GET /api/lawyers/me/dashboard
   (single request returns everything)
========================================================== */
export const getMyLawyerDashboardBundle = async (req, res) => {
  try {
    const userId = await req.params.id
    if (!userId) return;
    console.log(userId)

    // profile
    const [lawyerRows] = await pool.query(
      `
      SELECT 
        u.user_id AS lawyer_id,
        u.full_name,
        u.email,
        u.phone,
        u.created_at,
        u.is_verified AS user_verified,

        l.specialization,
        l.experience_years,
        l.hourly_rate,
        l.bio,
        l.license_document,
        l.is_verified AS lawyer_verified
      FROM users u
      INNER JOIN lawyers l ON l.lawyer_id = u.user_id
      WHERE l.lawyer_id=? AND u.role='lawyer'
      LIMIT 1
      `,
      [userId]
    );

    console.log(lawyerRows)

    if (!lawyerRows.length) return res.status(400).json({ error: "Lawyer profile not found" });
    const lawyer = lawyerRows[0];

    // appointments
    const [appointments] = await pool.query(
      `
      SELECT 
        a.appointment_id,
        a.appointment_date,
        a.appointment_time,
        a.subject,
        a.status,
        a.proposed_fee,
        a.offered_fee,
        a.final_fee,
        a.negotiation_note,
        a.created_at,
        c.full_name AS client_name,
        c.user_id AS client_id
      FROM appointments a
      INNER JOIN users c ON c.user_id = a.client_id
      WHERE a.lawyer_id=?
      ORDER BY a.created_at DESC
      `,
      [userId]
    );

    // cases
    const [cases] = await pool.query(
      `
      SELECT 
        cs.case_id,
        cs.title,
        cs.case_type,
        cs.status,
        cs.created_at,
        c.full_name AS client_name,
        c.user_id AS client_id
      FROM cases cs
      INNER JOIN users c ON c.user_id = cs.client_id
      WHERE cs.lawyer_id=?
      ORDER BY cs.created_at DESC
      `,
      [userId]
    );

    // documents (client docs for my clients)
    const [documents] = await pool.query(
      `
      SELECT 
        d.document_id,
        d.name,
        d.file_path,
        d.file_size,
        d.doc_type,
        d.created_at,
        c.full_name AS client_name,
        c.user_id AS client_id
      FROM client_documents d
      INNER JOIN users c ON c.user_id = d.client_id
      WHERE d.client_id IN (
        SELECT DISTINCT client_id FROM appointments WHERE lawyer_id=?
      )
      ORDER BY d.created_at DESC
      `,
      [userId]
    );

    // messages
    const [messages] = await pool.query(
      `
      SELECT 
        m.message_id,
        m.appointment_id,
        m.sender_id,
        m.sender_role,
        m.message,
        m.created_at,
        u.full_name AS sender_name
      FROM appointment_messages m
      INNER JOIN users u ON u.user_id = m.sender_id
      WHERE m.appointment_id IN (
        SELECT appointment_id FROM appointments WHERE lawyer_id=?
      )
      ORDER BY m.created_at DESC
      `,
      [userId]
    );

    const stats = {
      totalAppointments: appointments.length,
      upcomingAppointments: appointments.filter((a) =>
        !["completed", "cancelled", "rejected"].includes(String(a.status).toLowerCase())
      ).length,
      totalCases: cases.length,
      activeCases: cases.filter((c) => String(c.status).toLowerCase() === "active").length,
      totalDocs: documents.length,
      totalMessages: messages.length,
    };

    res.json({ lawyer, stats, appointments, cases, documents, messages });
  } catch (e) {
    console.error("getMyLawyerDashboardBundle error:", e);
    res.status(500).json({ error: "Failed to load lawyer dashboard" });
  }
};
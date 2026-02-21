import pool from "../config/db.js";

/* ================= USERS ================= */

export const getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT user_id, full_name, email, phone, role, is_verified, created_at
      FROM users
      WHERE role != 'admin'
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT user_id, full_name, email, phone, created_at
      FROM users
      WHERE role = 'admin'
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch admins" });
  }
};

export const verifyUser = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [result] = await pool.query(
      `UPDATE users SET is_verified = 1 WHERE user_id = ?`,
      [id]
    );

    if (!result.affectedRows)
      return res.status(404).json({ error: "User not found" });

    res.json({ message: "User verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify user" });
  }
};

/* ================= LAWYERS ================= */

export const getAllLawyers = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        l.specialization,
        l.experience_years,
        l.hourly_rate,
        l.license_document,
        l.is_verified
      FROM users u
      JOIN lawyers l ON l.lawyer_id = u.user_id
      WHERE u.role='lawyer'
      ORDER BY l.is_verified ASC, l.experience_years DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch lawyers" });
  }
};

export const verifyLawyer = async (req, res) => {
  try {
    const id = Number(req.params.id);

    await pool.query(
      `UPDATE lawyers SET is_verified = 1 WHERE lawyer_id = ?`,
      [id]
    );

    res.json({ message: "Lawyer verified successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to verify lawyer" });
  }
};

/* ================= APPOINTMENTS ================= */

export const getAllAppointments = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.appointment_id,
        a.subject,
        a.status,
        a.appointment_date,
        a.appointment_time,
        c.full_name AS client_name,
        l.full_name AS lawyer_name, 
        l.user_id as lawyerId,
        c.user_id
      FROM appointments a
      JOIN users c ON c.user_id = a.client_id
      JOIN users l ON l.user_id = a.lawyer_id
      ORDER BY a.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const id = Number(req.params.id);

    await pool.query(
      `UPDATE appointments SET status='cancelled' WHERE appointment_id=?`,
      [id]
    );

    res.json({ message: "Appointment cancelled" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
};

/* ==========================================================
   ✅ ADMIN: LAWYER DASHBOARD VIEW
   Admin can view ANY lawyer dashboard by lawyerId
   Suggested routes:
   GET /api/admin/lawyers/:lawyerId/dashboard
   GET /api/admin/lawyers/:lawyerId/appointments
   GET /api/admin/lawyers/:lawyerId/cases
   GET /api/admin/lawyers/:lawyerId/documents
   GET /api/admin/lawyers/:lawyerId/messages
========================================================== */

/* GET /api/admin/lawyers/:lawyerId/dashboard */
export const getLawyerDashboardByAdmin = async (req, res) => {
  try {
    const lawyerId = Number(req.params.lawyerId);
    if (!lawyerId) return res.status(400).json({ error: "Invalid lawyer id" });

    // 1) profile
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
      WHERE u.user_id=? AND u.role='lawyer'
      LIMIT 1
      `,
      [lawyerId]
    );

    if (!lawyerRows.length) return res.status(404).json({ error: "Lawyer not found" });
    const lawyer = lawyerRows[0];

    // 2) appointments for that lawyer
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

        c.user_id AS client_id,
        c.full_name AS client_name,
        c.email AS client_email,
        c.phone AS client_phone
      FROM appointments a
      INNER JOIN users c ON c.user_id = a.client_id
      WHERE a.lawyer_id=?
      ORDER BY a.created_at DESC
      `,
      [lawyerId]
    );

    // 3) cases assigned to that lawyer
    const [cases] = await pool.query(
      `
      SELECT 
        cs.case_id,
        cs.title,
        cs.case_type,
        cs.status,
        cs.created_at,
        c.user_id AS client_id,
        c.full_name AS client_name
      FROM cases cs
      INNER JOIN users c ON c.user_id = cs.client_id
      WHERE cs.lawyer_id=?
      ORDER BY cs.created_at DESC
      `,
      [lawyerId]
    );

    // 4) documents: client docs for clients who have appointments with that lawyer
    const [documents] = await pool.query(
      `
      SELECT 
        d.document_id,
        d.name,
        d.file_path,
        d.file_size,
        d.doc_type,
        d.created_at,
        c.user_id AS client_id,
        c.full_name AS client_name
      FROM client_documents d
      INNER JOIN users c ON c.user_id = d.client_id
      WHERE d.client_id IN (
        SELECT DISTINCT client_id FROM appointments WHERE lawyer_id=?
      )
      ORDER BY d.created_at DESC
      `,
      [lawyerId]
    );

    // 5) messages for appointments of that lawyer
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
      [lawyerId]
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
    console.error("getLawyerDashboardByAdmin error:", e);
    res.status(500).json({ error: "Failed to load lawyer dashboard" });
  }
};
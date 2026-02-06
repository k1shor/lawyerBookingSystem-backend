import pool from "../config/db.js";
import { notifyUser } from "../utils/notifications.js";

/* =========================
   Helpers
========================= */

const isOwnerClient = (authUserId, appt) =>
  Number(appt.client_id) === Number(authUserId);

const isOwnerLawyer = (authUserId, appt) =>
  Number(appt.lawyer_id) === Number(authUserId);

const getAppt = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM appointments WHERE appointment_id = ?`,
    [Number(id)]
  );
  return rows[0] || null;
};

const hasSlotConflict = async (
  lawyer_id,
  appointment_date,
  appointment_time,
  excludeAppointmentId = null
) => {
  const params = [Number(lawyer_id), appointment_date, appointment_time];

  let sql = `
    SELECT appointment_id
    FROM appointments
    WHERE lawyer_id = ?
      AND appointment_date = ?
      AND appointment_time = ?
      AND status IN ('pending','negotiating','approved')
  `;

  if (excludeAppointmentId) {
    sql += ` AND appointment_id <> ?`;
    params.push(Number(excludeAppointmentId));
  }

  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
};

const addMessage = async (
  appointment_id,
  sender_id,
  sender_role,
  message
) => {
  await pool.query(
    `
    INSERT INTO appointment_messages
    (appointment_id, sender_id, sender_role, message)
    VALUES (?, ?, ?, ?)
    `,
    [Number(appointment_id), Number(sender_id), sender_role, String(message)]
  );
};

/* =========================
   CREATE APPOINTMENT (CLIENT)
========================= */

export const createAppointment = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const role = req.user.role;

    if (role !== "client") {
      return res.status(403).json({ error: "Only clients can create appointments" });
    }

    const {
      lawyer_id,
      appointment_date,
      appointment_time,
      subject,
      details,
      proposed_fee,
    } = req.body;

    if (!lawyer_id || !appointment_date || !appointment_time || !subject) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [lawyerRows] = await pool.query(
      `SELECT lawyer_id, hourly_rate FROM lawyers WHERE lawyer_id = ?`,
      [Number(lawyer_id)]
    );

    if (!lawyerRows.length) {
      return res.status(404).json({ error: "Lawyer not found" });
    }

    const conflict = await hasSlotConflict(
      lawyer_id,
      appointment_date,
      appointment_time
    );

    if (conflict) {
      return res.status(409).json({
        error: "Selected time slot is not available",
      });
    }

    const baseFee = Number(lawyerRows[0].hourly_rate || 0);
    const feeToStore =
      proposed_fee !== undefined && proposed_fee !== null && proposed_fee !== ""
        ? Number(proposed_fee)
        : baseFee;

    const [result] = await pool.query(
      `
      INSERT INTO appointments
      (client_id, lawyer_id, appointment_date, appointment_time, subject, details, proposed_fee, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      [
        userId,
        Number(lawyer_id),
        appointment_date,
        appointment_time,
        subject,
        details || null,
        feeToStore,
      ]
    );

    const apptId = result.insertId;

    await addMessage(
      apptId,
      userId,
      "client",
      `Requested appointment. Proposed fee: $${feeToStore.toFixed(2)}`
    );

    await notifyUser(
      lawyer_id,
      apptId,
      "APPOINTMENT_REQUEST",
      "New appointment request",
      `Client requested "${subject}" on ${appointment_date} ${appointment_time}`
    );

    res.status(201).json({
      message: "Appointment requested",
      appointment_id: apptId,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to create appointment" });
  }
};

/* =========================
   LIST APPOINTMENTS
========================= */

export const getMyAppointments = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const role = req.user.role;

    let where = "1=1";
    let params = [];

    if (role === "client") {
      where = "a.client_id = ?";
      params = [userId];
    }

    if (role === "lawyer") {
      where = "a.lawyer_id = ?";
      params = [userId];
    }

    const [rows] = await pool.query(
      `
      SELECT
        a.*,
        cu.full_name AS client_name,
        lu.full_name AS lawyer_name,
        l.specialization,
        l.experience_years,
        l.hourly_rate
      FROM appointments a
      INNER JOIN users cu ON cu.user_id = a.client_id
      INNER JOIN users lu ON lu.user_id = a.lawyer_id
      INNER JOIN lawyers l ON l.lawyer_id = a.lawyer_id
      WHERE ${where}
      ORDER BY a.created_at DESC
      `,
      params
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to load appointments" });
  }
};

/* =========================
   LAWYER COUNTER / ACCEPT / REJECT
========================= */

export const lawyerOfferFee = async (req, res) => {
  try {
    const userId = req.user.user_id;
    if (req.user.role !== "lawyer") {
      return res.status(403).json({ error: "Only lawyers can offer fees" });
    }

    const id = req.params.id;
    const { offered_fee, negotiation_note } = req.body;

    if (!offered_fee) {
      return res.status(400).json({ error: "offered_fee is required" });
    }

    const appt = await getAppt(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (!isOwnerLawyer(userId, appt)) {
      return res.status(403).json({ error: "Not your appointment" });
    }

    if (["approved", "rejected", "cancelled", "completed"].includes(appt.status)) {
      return res.status(400).json({ error: "Appointment already finalized" });
    }

    await pool.query(
      `
      UPDATE appointments
      SET offered_fee = ?, negotiation_note = ?, status = 'negotiating'
      WHERE appointment_id = ?
      `,
      [Number(offered_fee), negotiation_note || null, Number(id)]
    );

    await addMessage(
      id,
      userId,
      "lawyer",
      `Offered fee: $${Number(offered_fee).toFixed(2)}`
    );

    await notifyUser(
      appt.client_id,
      id,
      "FEE_OFFER",
      "Lawyer sent a fee offer",
      `Offered $${Number(offered_fee).toFixed(2)}`
    );

    res.json({ message: "Offer sent" });
  } catch (e) {
    res.status(500).json({ error: "Failed to offer fee" });
  }
};

export const lawyerAccept = async (req, res) => {
  try {
    const userId = req.user.user_id;
    if (!["lawyer", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const id = req.params.id;
    const appt = await getAppt(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    if (appt.status === "approved") {
      return res.status(400).json({ error: "Appointment already approved" });
    }

    if (req.user.role === "lawyer" && !isOwnerLawyer(userId, appt)) {
      return res.status(403).json({ error: "Not your appointment" });
    }

    const conflict = await hasSlotConflict(
      appt.lawyer_id,
      appt.appointment_date,
      appt.appointment_time,
      appt.appointment_id
    );

    if (conflict) {
      return res.status(409).json({
        error: "Time slot is no longer available",
      });
    }

    const finalFee =
      appt.offered_fee !== null && appt.offered_fee !== undefined
        ? appt.offered_fee
        : appt.proposed_fee;

    await pool.query(
      `
      UPDATE appointments
      SET final_fee = ?, status = 'approved'
      WHERE appointment_id = ?
      `,
      [Number(finalFee || 0), Number(id)]
    );

    await addMessage(
      id,
      userId,
      req.user.role,
      `Accepted appointment. Final fee: $${Number(finalFee).toFixed(2)}`
    );

    await notifyUser(
      appt.client_id,
      id,
      "APPT_ACCEPTED",
      "Appointment accepted",
      `Your appointment "${appt.subject}" was accepted`
    );

    res.json({ message: "Appointment accepted", final_fee: finalFee });
  } catch (e) {
    res.status(500).json({ error: "Failed to accept appointment" });
  }
};

export const lawyerReject = async (req, res) => {
  try {
    const userId = req.user.user_id;
    if (!["lawyer", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const id = req.params.id;
    const appt = await getAppt(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    if (req.user.role === "lawyer" && !isOwnerLawyer(userId, appt)) {
      return res.status(403).json({ error: "Not your appointment" });
    }

    await pool.query(
      `UPDATE appointments SET status = 'rejected' WHERE appointment_id = ?`,
      [Number(id)]
    );

    await addMessage(id, userId, req.user.role, "Rejected appointment");

    await notifyUser(
      appt.client_id,
      id,
      "APPT_REJECTED",
      "Appointment rejected",
      `Your appointment "${appt.subject}" was rejected`
    );

    res.json({ message: "Appointment rejected" });
  } catch (e) {
    res.status(500).json({ error: "Failed to reject appointment" });
  }
};

/* =========================
   CLIENT COUNTER / ACCEPT
========================= */

export const clientCounterOffer = async (req, res) => {
  try {
    const userId = req.user.user_id;
    if (req.user.role !== "client") {
      return res.status(403).json({ error: "Only clients can counter offer" });
    }

    const id = req.params.id;
    const { proposed_fee, negotiation_note } = req.body;

    if (!proposed_fee) {
      return res.status(400).json({ error: "proposed_fee is required" });
    }

    const appt = await getAppt(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (!isOwnerClient(userId, appt)) {
      return res.status(403).json({ error: "Not your appointment" });
    }

    if (["approved", "rejected", "cancelled", "completed"].includes(appt.status)) {
      return res.status(400).json({ error: "Appointment already finalized" });
    }

    await pool.query(
      `
      UPDATE appointments
      SET proposed_fee = ?, negotiation_note = ?, status = 'negotiating'
      WHERE appointment_id = ?
      `,
      [Number(proposed_fee), negotiation_note || null, Number(id)]
    );

    await addMessage(
      id,
      userId,
      "client",
      `Counter offered: $${Number(proposed_fee).toFixed(2)}`
    );

    await notifyUser(
      appt.lawyer_id,
      id,
      "COUNTER_OFFER",
      "Client counter-offer",
      `Client countered on "${appt.subject}"`
    );

    res.json({ message: "Counter offer sent" });
  } catch (e) {
    res.status(500).json({ error: "Failed to counter offer" });
  }
};

export const clientAcceptOffer = async (req, res) => {
  try {
    const userId = req.user.user_id;
    if (req.user.role !== "client") {
      return res.status(403).json({ error: "Only clients can accept offers" });
    }

    const id = req.params.id;
    const appt = await getAppt(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    if (appt.status === "approved") {
      return res.status(400).json({ error: "Appointment already approved" });
    }

    if (!isOwnerClient(userId, appt)) {
      return res.status(403).json({ error: "Not your appointment" });
    }

    if (appt.offered_fee === null || appt.offered_fee === undefined) {
      return res.status(400).json({ error: "No lawyer offer to accept" });
    }

    const conflict = await hasSlotConflict(
      appt.lawyer_id,
      appt.appointment_date,
      appt.appointment_time,
      appt.appointment_id
    );

    if (conflict) {
      return res.status(409).json({
        error: "Time slot no longer available",
      });
    }

    await pool.query(
      `
      UPDATE appointments
      SET final_fee = ?, status = 'approved'
      WHERE appointment_id = ?
      `,
      [Number(appt.offered_fee), Number(id)]
    );

    await addMessage(
      id,
      userId,
      "client",
      `Accepted lawyer offer. Final fee: $${Number(appt.offered_fee).toFixed(2)}`
    );

    await notifyUser(
      appt.lawyer_id,
      id,
      "OFFER_ACCEPTED",
      "Client accepted your offer",
      `Appointment "${appt.subject}" finalized`
    );

    res.json({
      message: "Offer accepted",
      final_fee: Number(appt.offered_fee),
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to accept offer" });
  }
};

import crypto from "crypto";
import pool from "../config/db.js";
import axios from "axios";

const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE;
const ESEWA_SECRET = process.env.ESEWA_SECRET;

/* =========================
   INITIATE PAYMENT (NOTARY)
========================= */
export const initiateEsewaPayment = async (req, res) => {
  try {
    const { notary_id } = req.body;

    const [rows] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=?`,
      [notary_id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Notary request not found" });
    }

    const item = rows[0];

    if (item.payment_status === "paid") {
      return res.status(400).json({ error: "Already paid" });
    }

    const amount = Number(item.amount);

    const transaction_uuid = `NOTARY_${item.notary_id}_${Date.now()}`;

    const message = `total_amount=${amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_PRODUCT_CODE}`;

    const signature = crypto
      .createHmac("sha256", ESEWA_SECRET)
      .update(message)
      .digest("base64");

    // ✅ Save payment
    await pool.query(
      `
      INSERT INTO payments (notary_id, amount, status, esewa_pid)
      VALUES (?, ?, 'pending', ?)
      `,
      [item.notary_id, amount, transaction_uuid]
    );

    res.json({
      amount,
      transaction_uuid,
      product_code: ESEWA_PRODUCT_CODE,
      signature,
      success_url: `http://localhost:5000/api/payment/appointment/esewa/success`,
      failure_url: `${process.env.APP_URL}/payment/esewa-failure`,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment initialization failed" });
  }
};

/* =========================
   VERIFY PAYMENT (NOTARY)
========================= */
export const verifyEsewaPayment = async (req, res) => {
  try {
    const { refId, oid } = req.query;

    if (!refId || !oid) {
      return res.status(400).send("Invalid transaction");
    }

    // Extract notary_id
    const parts = oid.split("_");
    const notary_id = parts[1];

    // Find payment
    const [payments] = await pool.query(
      `SELECT * FROM payments WHERE esewa_pid=?`,
      [oid]
    );

    if (!payments.length) {
      return res.status(404).send("Payment not found");
    }

    const payment = payments[0];

    // ✅ Update payment
    await pool.query(
      `
      UPDATE payments
      SET status='paid',
          esewa_ref_id=?
      WHERE payment_id=?
      `,
      [refId, payment.payment_id]
    );

    // ✅ Update notary
    await pool.query(
      `
      UPDATE notary_requests
      SET payment_status='paid',
          status='paid',
          payment_ref=?
      WHERE notary_id=?
      `,
      [refId, notary_id]
    );

    return res.redirect(`/notary/${notary_id}`);

  } catch (e) {
    console.error(e);
    res.status(500).send("Verification failed");
  }
};

/* =========================
   INITIATE PAYMENT (APPOINTMENT)
========================= */
export const initiateAppointmentEsewaPayment = async (req, res) => {
  try {

    const { appointment_id } = req.body;

    const [rows] = await pool.query(
      `SELECT * FROM appointments WHERE appointment_id=?`,
      [appointment_id]
    );

    if (!rows.length) {
      return res.status(400).json({ error: "Appointment not found" });
    }

    const appt = rows[0];

    if (appt.status !== "awaiting_payment") {
      return res.status(400).json({ error: "Payment not required" });
    }

    // ✅ Prevent duplicate payment
    const [existing] = await pool.query(
      `SELECT * FROM payments WHERE appointment_id=? AND status='pending'`,
      [appointment_id]
    );

    // if (existing.length) {
    //   return res.status(400).json({ error: "Payment already initiated" });
    // }
    console.log(appt)
    const amount = Number(appt.final_fee);

    const transaction_uuid = `APPOINTMENT_${appt.appointment_id}_${Date.now()}`;

    const message = `total_amount=${amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_PRODUCT_CODE}`;

    const signature = crypto
      .createHmac("sha256", ESEWA_SECRET)
      .update(message)
      .digest("base64");

    // ✅ Save payment
    await pool.query(
      `
      INSERT INTO payments (appointment_id, amount, status, esewa_pid)
      VALUES (?, ?, 'pending', ?)
      `,
      [appt.appointment_id, amount, transaction_uuid]
    );

     await pool.query(
      `
      UPDATE appointments 
      SET status='approved'
      WHERE appointment_id = ?
      `,
      [appt.appointment_id]
    );


    res.json({
      amount,
      transaction_uuid,
      product_code: ESEWA_PRODUCT_CODE,
      signature,
      success_url: `${process.env.APP_URL}/profile?payment=success`,
      failure_url: `${process.env.APP_URL}/profile?payment=failed`,
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

/* =========================
   VERIFY PAYMENT (APPOINTMENT)
========================= */
export const verifyAppointmentEsewaPayment = async (req, res) => {




  try {
    console.log("🔥 eSewa Callback Hit:", req.query);

    const { transaction_uuid, total_amount } = req.query;

    if (!transaction_uuid || !total_amount) {
      console.log("❌ Missing params");
      return res.redirect(`${process.env.APP_URL}/profile?payment=error`);
    }

    // ⚠️ IMPORTANT: ensure number format
    const amount = Number(total_amount);

    const verificationUrl = `https://rc-epay.esewa.com.np/api/epay/transaction/status/?product_code=${process.env.ESEWA_PRODUCT_CODE}&total_amount=${amount}&transaction_uuid=${transaction_uuid}`;

    console.log("🔍 Verifying URL:", verificationUrl);

    const response = await axios.get(verificationUrl);

    console.log("🧾 eSewa Response:", response.data);

    // ✅ ACCEPT BOTH COMPLETE & SUCCESS
    if (!["COMPLETE", "SUCCESS"].includes(response.data.status)) {
      console.log("❌ Payment NOT completed:", response.data.status);
      return res.redirect(`${process.env.APP_URL}/profile?payment=failed`);
    }

    // 🔍 DEBUG: check payment exists
    const [check] = await pool.query(
      `SELECT * FROM payments WHERE esewa_pid=?`,
      [transaction_uuid]
    );

    console.log("💾 Existing Payment:", check);

    if (!check.length) {
      console.log("❌ Payment record not found in DB");
      return res.redirect(`${process.env.APP_URL}/profile?payment=error`);
    }

    // ✅ UPDATE PAYMENT
    const [paymentUpdate] = await pool.query(
      `
      UPDATE payments 
      SET status='completed', payment_status='paid'
      WHERE esewa_pid=? AND payment_status!='paid'
      `,
      [transaction_uuid]
    );

    console.log("✅ Payment Update Result:", paymentUpdate);

    // ✅ UPDATE APPOINTMENT
    const [apptUpdate] = await pool.query(
      `
      UPDATE appointments 
      SET status='paid'
      WHERE appointment_id = ?
      `,
      [check[0].appointment_id]
    );

    console.log("✅ Appointment Update Result:", apptUpdate);

    return res.redirect(`${process.env.APP_URL}/profile?payment=success`);

  } catch (err) {
    console.error("❌ VERIFY ERROR:", err.message);
    return res.redirect(`${process.env.APP_URL}/profile?payment=error`);
  }
};

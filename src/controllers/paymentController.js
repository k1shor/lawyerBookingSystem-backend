import crypto from "crypto";
import pool from "../config/db.js";

const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE;
const ESEWA_SECRET = process.env.ESEWA_SECRET;

export const initiateEsewaPayment = async (req, res) => {
  try {
    const { notary_id } = req.body;

    const [rows] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=?`,
      [notary_id]
    );

    if (!rows.length)
      return res.status(404).json({ error: "Notary request not found" });

    const item = rows[0];

    const transaction_uuid = `NOTARY_${item.notary_id}_${Date.now()}`;

    const amount = Number(item.amount);

    const message = `total_amount=${amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_PRODUCT_CODE}`;

    const signature = crypto
      .createHmac("sha256", ESEWA_SECRET)
      .update(message)
      .digest("base64");

    res.json({
      amount,
      transaction_uuid,
      product_code: ESEWA_PRODUCT_CODE,
      signature,
      success_url: `${process.env.APP_URL}/notary`,
      failure_url: `${process.env.APP_URL}/payment/esewa-failure`,
      notary_id: item.notary_id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment initialization failed" });
  }
};

export const verifyEsewaPayment = async (req, res) => {
  try {
    const { refId, oid, amt } = req.query;

    if (!refId) return res.status(400).send("Invalid transaction");

    const [rows] = await pool.query(
      `SELECT * FROM notary_requests WHERE notary_id=?`,
      [oid]
    );

    if (!rows.length) return res.status(404).send("Notary not found");

    await pool.query(
      `
      UPDATE notary_requests
      SET payment_status='paid',
          status='paid',
          payment_ref=?
      WHERE notary_id=?
      `,
      [refId, oid]
    );

    res.redirect(`/notary/${oid}`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Verification failed");
  }
};
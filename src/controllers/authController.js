// controllers/authController.js
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { signToken } from "../utils/jwtUtil.js";
import crypto from "crypto";
import { sendResetEmail } from "../utils/mailer.js";


const safeParseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeSpecialization = (value) => {
  if (value === undefined || value === null) return null;

  if (Array.isArray(value)) {
    const cleaned = value.map(v => String(v || "").trim()).filter(Boolean);
    return cleaned.length ? cleaned.join(", ") : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const maybe = safeParseJson(trimmed);
    if (Array.isArray(maybe)) {
      const cleaned = maybe.map(v => String(v || "").trim()).filter(Boolean);
      return cleaned.length ? cleaned.join(", ") : null;
    }

    return trimmed;
  }

  return String(value);
};

export const register = async (req, res) => {
  try {
    const {
      full_name,
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      userType,

      // lawyer-related (frontend can send any of these)
      specialization,
      yearsOfExperience,
      experience_years,
      hourly_rate,
      bio,
      is_verified,
    } = req.body;

    const effectiveRole = (userType || role || "client").toLowerCase().trim();

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const fullName =
      (full_name && String(full_name).trim()) ||
      [firstName, lastName].filter(Boolean).join(" ").trim();

    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    const [exists] = await pool.query("SELECT user_id FROM users WHERE email = ?", [cleanEmail]);
    if (exists.length) {
      return res.status(400).json({ message: "Email already used" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (full_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)",
      [fullName, cleanEmail, hashed, phone || null, effectiveRole]
    );

    const userId = result.insertId;

    if (effectiveRole === "lawyer") {
      const licenseDocumentPath = req.file ? req.file.path : null;

      const spec = normalizeSpecialization(specialization);

      const expRaw =
        yearsOfExperience !== undefined && yearsOfExperience !== null && yearsOfExperience !== ""
          ? yearsOfExperience
          : experience_years;

      const expYears = Number(expRaw || 0);
      if (!Number.isFinite(expYears) || expYears < 0) {
        return res.status(400).json({ message: "Invalid experience years" });
      }

      const rate = hourly_rate !== undefined && hourly_rate !== null && hourly_rate !== ""
        ? Number(hourly_rate)
        : 0;

      if (!Number.isFinite(rate) || rate < 0) {
        return res.status(400).json({ message: "Invalid hourly rate" });
      }

      const verified = Number(is_verified || 0) ? 1 : 0;

      await pool.query(
        `
        INSERT INTO lawyers
          (lawyer_id, specialization, experience_years, hourly_rate, bio, license_document, is_verified)
        VALUES
          (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          spec,
          expYears,
          rate,
          bio || null,
          licenseDocumentPath,
          verified,
        ]
      );
    }

    const token = signToken({ user_id: userId, role: effectiveRole });

    return res.json({
      user_id: userId,
      full_name: fullName,
      email: cleanEmail,
      phone: phone || null,
      role: effectiveRole,
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const [rows] = await pool.query(
      "SELECT user_id, password, role, full_name, phone FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (!rows.length) return res.status(400).json({ error: "Invalid credentials" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    const token = signToken({ user_id: user.user_id, role: user.role });

    return res.json({
      user_id: user.user_id,
      full_name: user.full_name,
      email: cleanEmail,
      phone: user.phone,
      role: user.role,
      token,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};



export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const [users] = await pool.query(
      "SELECT user_id FROM users WHERE email=?",
      [email]
    );

    if (!users.length) {
      return res.status(400).json({
        error: "Email not registered",
      });
    }

    const user = users[0];

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = Date.now() + 15 * 60 * 1000;

    await pool.query(
      "UPDATE users SET reset_token=?, reset_token_expiry=? WHERE user_id=?",
      [resetToken, expiry, user.user_id]
    );

    const resetLink = `${process.env.APP_URL}/reset-password/${resetToken}`;

    await sendResetEmail(email, resetLink);

    res.json({
      message: "Password reset link has been sent to your email",
    });

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};


/**
 * RESET PASSWORD
 */
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const [users] = await pool.query(
      "SELECT * FROM users WHERE reset_token=?",
      [token]
    );

    if (!users.length) {
      return res.status(400).json({ message: "Invalid token" });
    }

    const user = users[0];

    // Check expiry
    if (Date.now() > user.reset_token_expiry) {
      return res.status(400).json({ message: "Token expired" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users 
       SET password=?, reset_token=NULL, reset_token_expiry=NULL 
       WHERE user_id=?`,
      [hashedPassword, user.user_id]
    );

    res.json({ message: "Password reset successful" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
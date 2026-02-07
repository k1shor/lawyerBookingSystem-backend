// controllers/authController.js
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { signToken } from "../utils/jwtUtil.js";

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

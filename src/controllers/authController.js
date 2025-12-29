// controllers/authController.js
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { signToken } from "../utils/jwtUtil.js";

export const register = async (req, res) => {
  try {
    // Support both old and new payload structures
    const {
      full_name,
      firstName,
      lastName,
      email,
      password,
      phone,
      role,       // old style
      userType,   // new style from frontend
      barNumber,
      lawFirm,
      yearsOfExperience,
      specialization, // can be JSON string or array
    } = req.body;

    // Effective role: userType preferred, then role, default client
    const effectiveRole = userType || role || "client";

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Build full name from firstName + lastName if full_name not provided
    const fullName =
      full_name ||
      [firstName, lastName].filter(Boolean).join(" ").trim();

    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    // Check if email exists
    const [exists] = await pool.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );
    if (exists.length) {
      return res.status(400).json({ message: "Email already used" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Insert into users table
    const [result] = await pool.query(
      "INSERT INTO users (full_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)",
      [fullName, email, hashed, phone || null, effectiveRole]
    );

    const userId = result.insertId;

    // If the user is a lawyer, insert into lawyers table too
    if (effectiveRole === "lawyer") {
      // licenseDocument path (if file uploaded)
      const licenseDocumentPath = req.file ? req.file.path : null;

      // specializations: can come as JSON string or array
      let specializationsValue = null;
      if (specialization) {
        try {
          if (Array.isArray(specialization)) {
            specializationsValue = JSON.stringify(specialization);
          } else if (typeof specialization === "string") {
            // Could already be JSON string from frontend
            specializationsValue = specialization;
          }
        } catch (e) {
          // fallback: store raw string
          specializationsValue = String(specialization);
        }
      }

      // Basic validations for lawyer fields (you may also have validated on frontend)
      if (!barNumber || !lawFirm || !yearsOfExperience) {
        return res.status(400).json({
          message: "Lawyer registration requires barNumber, lawFirm and yearsOfExperience",
        });
      }

      await pool.query(
        `INSERT INTO lawyers 
          (user_id, bar_number, law_firm, specializations, years_of_experience, license_document)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          barNumber,
          lawFirm,
          specializationsValue,
          yearsOfExperience,
          licenseDocumentPath,
        ]
      );
    }

    // Generate JWT token for new user
    const token = signToken({ user_id: userId, role: effectiveRole });

    return res.json({
      user_id: userId,
      full_name: fullName,
      email,
      phone,
      role: effectiveRole,
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body);
  try {
    const [rows] = await pool.query(
      "SELECT user_id, password, role, full_name, phone FROM users WHERE email = ?",
      [email]
    );
    if (rows.length == 0)
      return res.status(400).json({ error: "Invalid credentials" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ error: "Invalid credentials" });

    const token = signToken({ user_id: user.user_id, role: user.role });
    res.json({
      user_id: user.user_id,
      full_name: user.full_name,
      email,
      phone: user.phone,
      role: user.role,
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

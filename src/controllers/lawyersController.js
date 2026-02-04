import pool from "../config/db.js";

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
    res.status(500).json({ error: "Failed to fetch lawyers" });
  }
};

export const getLawyerById = async (req, res) => {
  try {
    const lawyerId = Number(req.params.id);
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
    res.status(500).json({ error: "Failed to fetch lawyer details" });
  }
};


export const upsertMyLawyerProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { law_firm, specializations, years_of_experience, hourly_rate, bio } = req.body;

    const [lawyerRows] = await pool.query("SELECT lawyer_id FROM lawyers WHERE user_id = ?", [userId]);
    if (!lawyerRows.length) return res.status(404).json({ message: "Lawyer record not found" });

    const specializationsValue =
      specializations === undefined || specializations === null
        ? null
        : Array.isArray(specializations)
          ? JSON.stringify(specializations)
          : typeof specializations === "string"
            ? specializations
            : JSON.stringify(specializations);

    await pool.query(
      `UPDATE lawyers
       SET law_firm = COALESCE(?, law_firm),
           specializations = COALESCE(?, specializations),
           years_of_experience = COALESCE(?, years_of_experience),
           hourly_rate = COALESCE(?, hourly_rate),
           bio = COALESCE(?, bio)
       WHERE user_id = ?`,
      [
        law_firm ?? null,
        specializationsValue,
        years_of_experience ?? null,
        hourly_rate ?? null,
        bio ?? null,
        userId
      ]
    );

    const [updated] = await pool.query(
      `SELECT 
          l.lawyer_id,
          l.user_id,
          u.full_name,
          u.email,
          u.phone,
          l.bar_number,
          l.law_firm,
          l.specializations,
          l.years_of_experience,
          l.hourly_rate,
          l.bio,
          l.license_document,
          l.is_verified,
          l.created_at,
          l.updated_at
       FROM lawyers l
       JOIN users u ON u.user_id = l.user_id
       WHERE l.user_id = ?`,
      [userId]
    );

    const r = updated[0];
    res.json({ ...r, specializations: parseJsonSafe(r.specializations) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

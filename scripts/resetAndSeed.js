import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import pool from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const arg = (name) => {
  const hit = process.argv.find((x) => x.startsWith(`${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};

const hasFlag = (flag) => process.argv.includes(flag);

const resolveSchemaPath = () => {
  const override = arg("--schema");
  if (override) return path.resolve(process.cwd(), override);

  // Default: project root schema.sql
  return path.resolve(__dirname, "..", "schema.sql");
};

const fileExists = (p) => {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const runSqlStatements = async (sql) => {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await pool.query(stmt);
  }
};

const resetDb = async () => {
  const schemaPath = resolveSchemaPath();
  if (!fileExists(schemaPath)) {
    throw new Error(`schema.sql not found at: ${schemaPath}`);
  }
  const sql = fs.readFileSync(schemaPath, "utf8");
  await runSqlStatements(sql);
};

const migrateDb = async () => {
  // Minimal safe migration: ensure columns exist (no drops)
  // This lets you run seeding even if DB already existed with older schema.

  const addCol = async (table, colDef) => {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS c
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [table, colDef.name]
    );

    if (Number(rows?.[0]?.c || 0) === 0) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${colDef.sql}`);
    }
  };

  const addEnumValue = async () => {
    // Ensure 'negotiating' exists in appointments.status enum.
    // MySQL needs full enum re-definition. We'll only do it if missing.
    const [rows] = await pool.query(
      `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'appointments'
         AND COLUMN_NAME = 'status'`
    );

    const colType = rows?.[0]?.COLUMN_TYPE || "";
    if (!colType.includes("'negotiating'")) {
      await pool.query(`
        ALTER TABLE appointments
        MODIFY COLUMN status ENUM(
          'pending','negotiating','approved','rejected','completed','cancelled'
        ) DEFAULT 'pending'
      `);
    }
  };

  await addCol("appointments", {
    name: "proposed_fee",
    sql: "`proposed_fee` DECIMAL(10,2) DEFAULT NULL",
  });

  await addCol("appointments", {
    name: "offered_fee",
    sql: "`offered_fee` DECIMAL(10,2) DEFAULT NULL",
  });

  await addCol("appointments", {
    name: "final_fee",
    sql: "`final_fee` DECIMAL(10,2) DEFAULT NULL",
  });

  await addCol("appointments", {
    name: "negotiation_note",
    sql: "`negotiation_note` TEXT DEFAULT NULL",
  });

  await addEnumValue();
};

const seedUsers = async () => {
  const passwordHash = await bcrypt.hash("password123", 10);

  // Upsert users by email (safe re-run)
  const users = [
    ["Admin User", "admin@hirelawyer.com", "9800000000", passwordHash, "admin"],
    ["Client One", "client1@hirelawyer.com", "9811111111", passwordHash, "client"],
    ["Client Two", "client2@hirelawyer.com", "9822222222", passwordHash, "client"],
    ["Adv. Sushil Koirala", "sushil@law.com", "9801234567", passwordHash, "lawyer"],
    ["Adv. Rina Shrestha", "rina@law.com", "9807654321", passwordHash, "lawyer"],
  ];

  for (const u of users) {
    await pool.query(
      `
      INSERT INTO users (full_name, email, phone, password, role)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        phone = VALUES(phone),
        password = VALUES(password),
        role = VALUES(role)
      `,
      u
    );
  }
};

const seedLawyers = async () => {
  // find lawyer user_ids by email
  const [sushil] = await pool.query(`SELECT user_id FROM users WHERE email = ?`, ["sushil@law.com"]);
  const [rina] = await pool.query(`SELECT user_id FROM users WHERE email = ?`, ["rina@law.com"]);

  const sushilId = sushil?.[0]?.user_id;
  const rinaId = rina?.[0]?.user_id;

  if (!sushilId || !rinaId) throw new Error("Lawyer users not found. Seed users first.");

  const rows = [
    [sushilId, "Corporate & Company Law", 16, 1500.0, "Senior corporate lawyer based in Kathmandu.", 1],
    [rinaId, "Family & Divorce Law", 11, 1200.0, "Specialist in family disputes and mediation.", 1],
  ];

  for (const r of rows) {
    await pool.query(
      `
      INSERT INTO lawyers
      (lawyer_id, specialization, experience_years, hourly_rate, bio, is_verified)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        specialization = VALUES(specialization),
        experience_years = VALUES(experience_years),
        hourly_rate = VALUES(hourly_rate),
        bio = VALUES(bio),
        is_verified = VALUES(is_verified)
      `,
      r
    );
  }
};

const seedAppointments = async () => {
  const [[client1]] = await pool.query(`SELECT user_id FROM users WHERE email = ?`, ["client1@hirelawyer.com"]);
  const [[client2]] = await pool.query(`SELECT user_id FROM users WHERE email = ?`, ["client2@hirelawyer.com"]);
  const [[lawyer1]] = await pool.query(`SELECT user_id FROM users WHERE email = ?`, ["sushil@law.com"]);
  const [[lawyer2]] = await pool.query(`SELECT user_id FROM users WHERE email = ?`, ["rina@law.com"]);

  const client1Id = client1?.user_id;
  const client2Id = client2?.user_id;
  const lawyer1Id = lawyer1?.user_id;
  const lawyer2Id = lawyer2?.user_id;

  if (!client1Id || !client2Id || !lawyer1Id || !lawyer2Id) {
    throw new Error("Missing seeded users for appointments.");
  }

  // Clean appointments to avoid duplicates in seed runs
  await pool.query(`DELETE FROM appointments`);

  const [r1] = await pool.query(
    `
    INSERT INTO appointments
    (client_id, lawyer_id, appointment_date, appointment_time, subject, details, proposed_fee, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `,
    [client1Id, lawyer1Id, "2026-02-10", "10:00:00", "Company Registration", "Need help registering a Pvt. Ltd.", 150]
  );

  const appt1 = r1.insertId;

  const [r2] = await pool.query(
    `
    INSERT INTO appointments
    (client_id, lawyer_id, appointment_date, appointment_time, subject, details, proposed_fee, offered_fee, negotiation_note, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'negotiating')
    `,
    [
      client2Id,
      lawyer2Id,
      "2026-02-11",
      "14:00:00",
      "Divorce Consultation",
      "Discuss process and documentation.",
      100,
      140,
      "I can do it for $140 due to complexity.",
    ]
  );

  const appt2 = r2.insertId;

  return { appt1, appt2, client1Id, client2Id, lawyer1Id, lawyer2Id };
};

const seedMessagesAndNotifications = async ({ appt1, appt2, client1Id, client2Id, lawyer1Id, lawyer2Id }) => {
  await pool.query(`DELETE FROM appointment_messages`);
  await pool.query(`DELETE FROM notifications`);

  await pool.query(
    `
    INSERT INTO appointment_messages
    (appointment_id, sender_id, sender_role, message)
    VALUES
    (?, ?, 'client', 'Requested appointment. Proposed fee: $150.00'),
    (?, ?, 'client', 'Requested appointment. Proposed fee: $100.00'),
    (?, ?, 'lawyer', 'Offered fee: $140.00 — I can do it for $140 due to complexity.')
    `,
    [appt1, client1Id, appt2, client2Id, appt2, lawyer2Id]
  );

  await pool.query(
    `
    INSERT INTO notifications
    (user_id, appointment_id, type, title, body, is_read)
    VALUES
    (?, ?, 'APPOINTMENT_REQUEST', 'New appointment request', 'Client requested "Company Registration".', 0),
    (?, ?, 'FEE_OFFER', 'Lawyer sent a fee offer', 'Lawyer offered $140.00 for "Divorce Consultation".', 0)
    `,
    [lawyer1Id, appt1, client2Id, appt2]
  );
};

const main = async () => {
  const schemaPath = resolveSchemaPath();
  const doMigrate = hasFlag("--migrate");
  const doReset = hasFlag("--reset") || !doMigrate;

  try {
    console.log("🔧 Using schema:", schemaPath);

    if (doReset) {
      console.log("🔄 Resetting database...");
      await resetDb();
    } else {
      console.log("🧩 Migrating database...");
      await migrateDb();
    }

    console.log("👤 Seeding users...");
    await seedUsers();

    console.log("⚖️ Seeding lawyers...");
    await seedLawyers();

    console.log("📅 Seeding appointments...");
    const ctx = await seedAppointments();

    console.log("💬 Seeding messages + notifications...");
    await seedMessagesAndNotifications(ctx);

    console.log("✅ Done. Database is ready.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Seeding failed:", e?.message || e);
    process.exit(1);
  }
};

main();

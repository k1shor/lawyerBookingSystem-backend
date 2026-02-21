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
  // Ensure minimal columns exist, safe for re-run.
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

  const ensureEnum = async () => {
    const [rows] = await pool.query(
      `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'appointments'
         AND COLUMN_NAME = 'status'`
    );
    const colType = rows?.[0]?.COLUMN_TYPE || "";
    // keep your final enum set
    const mustHave = [
      "pending",
      "negotiating",
      "approved",
      "rejected",
      "cancelled",
      "completed",
    ];
    const missing = mustHave.some((v) => !colType.includes(`'${v}'`));
    if (missing) {
      await pool.query(`
        ALTER TABLE appointments
        MODIFY COLUMN status ENUM(
          'pending','negotiating','approved','rejected','cancelled','completed'
        ) DEFAULT 'pending'
      `);
    }
  };

  await addCol("users", { name: "is_verified", sql: "`is_verified` TINYINT(1) DEFAULT 0" });
  await addCol("users", { name: "address", sql: "`address` VARCHAR(255) NULL" });
  await addCol("users", { name: "city", sql: "`city` VARCHAR(120) NULL" });
  await addCol("users", { name: "state", sql: "`state` VARCHAR(120) NULL" });
  await addCol("users", { name: "zip_code", sql: "`zip_code` VARCHAR(20) NULL" });

  await addCol("appointments", { name: "proposed_fee", sql: "`proposed_fee` DECIMAL(10,2) DEFAULT NULL" });
  await addCol("appointments", { name: "offered_fee", sql: "`offered_fee` DECIMAL(10,2) DEFAULT NULL" });
  await addCol("appointments", { name: "final_fee", sql: "`final_fee` DECIMAL(10,2) DEFAULT NULL" });
  await addCol("appointments", { name: "negotiation_note", sql: "`negotiation_note` TEXT DEFAULT NULL" });

  await ensureEnum();
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad2 = (n) => String(n).padStart(2, "0");

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const money = (min, max) => {
  const n = Math.floor(min + Math.random() * (max - min + 1));
  // keep to 2 decimals
  return Number(n).toFixed(2);
};

const buildDocPath = (name) => `uploads/licenses/${name}`;

const seedUsers = async () => {
  const passwordHash = await bcrypt.hash("password123", 10);

  // You asked: at least 5+ for each table. We'll create:
  // - 2 admins
  // - 6 lawyers
  // - 10 clients
  const users = [
    // ADMINS
    ["Admin User", "admin@hirelawyer.com", "9800000000", passwordHash, "admin", 1, null, null, null, null],
    ["Platform Admin", "admin2@hirelawyer.com", "9800000009", passwordHash, "admin", 1, null, null, null, null],

    // LAWYERS
    ["Adv. Sushil Koirala", "sushil@law.com", "9801234567", passwordHash, "lawyer", 1, null, null, null, null],
    ["Adv. Rina Shrestha", "rina@law.com", "9807654321", passwordHash, "lawyer", 1, null, null, null, null],
    ["Adv. Pratima Magar", "pratima@law.com", "9876543212", passwordHash, "lawyer", 0, null, null, null, null],
    ["Adv. Bikash Thapa", "bikash@law.com", "9812345678", passwordHash, "lawyer", 0, null, null, null, null],
    ["Adv. Nisha Rai", "nisha@law.com", "9823456789", passwordHash, "lawyer", 1, null, null, null, null],
    ["Adv. Sunil Ghimire", "sunil@law.com", "9845678901", passwordHash, "lawyer", 0, null, null, null, null],

    // CLIENTS (10)
    ["Aarav Sharma", "aarav.client@hirelawyer.com", "9800000001", passwordHash, "client", 1, "Kathmandu", "Kathmandu", "Bagmati", "44600"],
    ["Sita Karki", "sita.client@hirelawyer.com", "9800000002", passwordHash, "client", 1, "Pokhara", "Pokhara", "Gandaki", "33700"],
    ["Ramesh Adhikari", "ramesh.client@hirelawyer.com", "9800000003", passwordHash, "client", 1, "Biratnagar", "Biratnagar", "Koshi", "56600"],
    ["Maya Gurung", "maya.client@hirelawyer.com", "9800000004", passwordHash, "client", 1, "Butwal", "Butwal", "Lumbini", "32900"],
    ["Nabin Shrestha", "nabin.client@hirelawyer.com", "9800000005", passwordHash, "client", 1, "Lalitpur", "Lalitpur", "Bagmati", "44700"],
    ["Priya Joshi", "priya.client@hirelawyer.com", "9800000006", passwordHash, "client", 0, "Dharan", "Dharan", "Koshi", "56700"],
    ["Kiran Bista", "kiran.client@hirelawyer.com", "9800000007", passwordHash, "client", 1, "Hetauda", "Hetauda", "Bagmati", "44100"],
    ["Anita Tamang", "anita.client@hirelawyer.com", "9800000008", passwordHash, "client", 1, "Chitwan", "Bharatpur", "Bagmati", "44200"],
    ["Deepak Pandey", "deepak.client@hirelawyer.com", "9811111112", passwordHash, "client", 0, "Nepalgunj", "Nepalgunj", "Lumbini", "21900"],
    ["Sabina KC", "sabina.client@hirelawyer.com", "9822222223", passwordHash, "client", 1, "Janakpur", "Janakpur", "Madhesh", "45600"],
  ];

  for (const u of users) {
    await pool.query(
      `
      INSERT INTO users (full_name, email, phone, password, role, is_verified, address, city, state, zip_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        phone = VALUES(phone),
        password = VALUES(password),
        role = VALUES(role),
        is_verified = VALUES(is_verified),
        address = VALUES(address),
        city = VALUES(city),
        state = VALUES(state),
        zip_code = VALUES(zip_code)
      `,
      u
    );
  }
};

const seedLawyers = async () => {
  // pull lawyer ids
  const [lawyerUsers] = await pool.query(
    `SELECT user_id, email FROM users WHERE role = 'lawyer' ORDER BY user_id ASC`
  );

  if (!lawyerUsers.length) throw new Error("No lawyer users found. Seed users first.");

  const specSets = [
    "Corporate & Company Law, Land & Property Law, Immigration & Travel, Consumer Protection",
    "Family & Divorce Law, Civil Litigation, Legal Documentation",
    "Criminal Defense, Civil Litigation, Consumer Protection",
    "Tax & Compliance, Banking & Finance, Corporate & Company Law",
    "Cyber & Tech Law, Legal Documentation, Consumer Protection",
    "Labor & Employment Law, Land & Property Law, Civil Litigation",
  ];

  const bios = [
    "Client-focused advocate with strong negotiation skills and practical courtroom experience.",
    "Specialist in documentation, mediation, and resolution-focused legal strategies.",
    "Experienced in handling complex disputes with a detail-oriented approach.",
    "Corporate compliance and contract specialist with proven results for SMEs.",
    "Tech and cyber law specialist supporting startups and online businesses.",
    "Employment and property law practitioner serving clients across Nepal.",
  ];

  // create/ensure 6 lawyers with docs for most
  for (let i = 0; i < lawyerUsers.length; i++) {
    const u = lawyerUsers[i];
    const years = [16, 11, 5, 7, 9, 4][i] ?? (3 + i);
    const rate = [1500, 1200, 4000, 2500, 1800, 2200][i] ?? 1500;
    const verified = [1, 1, 0, 0, 1, 0][i] ?? 0;
    const hasDoc = [1, 1, 1, 1, 0, 1][i] ?? 1;

    const doc = hasDoc ? buildDocPath(`license-${u.user_id}.jpg`) : null;

    await pool.query(
      `
      INSERT INTO lawyers
      (lawyer_id, specialization, experience_years, hourly_rate, bio, license_document, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        specialization = VALUES(specialization),
        experience_years = VALUES(experience_years),
        hourly_rate = VALUES(hourly_rate),
        bio = VALUES(bio),
        license_document = VALUES(license_document),
        is_verified = VALUES(is_verified)
      `,
      [
        u.user_id,
        specSets[i % specSets.length],
        years,
        Number(rate),
        bios[i % bios.length],
        doc,
        verified,
      ]
    );
  }
};

const seedAppointments = async () => {
  // clients + lawyers ids
  const [clients] = await pool.query(
    `SELECT user_id FROM users WHERE role = 'client' ORDER BY user_id ASC`
  );
  const [lawyers] = await pool.query(
    `SELECT lawyer_id FROM lawyers ORDER BY lawyer_id ASC`
  );

  if (clients.length < 5) throw new Error("Need at least 5 clients to seed appointments.");
  if (lawyers.length < 2) throw new Error("Need lawyers in lawyers table to seed appointments.");

  // clean to avoid duplicates
  await pool.query(`DELETE FROM appointments`);

  const subjects = [
    "Company Registration",
    "Divorce Consultation",
    "Property Dispute",
    "Contract Review",
    "Cyber Fraud Complaint",
    "Employment Issue",
    "Tax Filing Consultation",
    "Immigration Documentation",
    "Consumer Rights Case",
    "Civil Litigation Guidance",
  ];

  const detailsList = [
    "Need guidance on documents and process.",
    "Discuss case history and next steps.",
    "Review ownership papers and possible remedies.",
    "Validate contract clauses and obligations.",
    "Help preparing complaint and evidence list.",
    "Notice drafting and legal options review.",
    "Tax compliance review and planning.",
    "Checklist for application and supporting docs.",
    "Advice on filing and negotiation.",
    "Strategy for filing and hearing preparation.",
  ];

  const statuses = ["pending", "negotiating", "approved", "rejected", "cancelled", "completed"];

  const baseDate = new Date("2026-03-01");
  const inserted = [];

  // Create 12 appointments (>=5)
  for (let i = 0; i < 12; i++) {
    const clientId = clients[i % clients.length].user_id;
    const lawyerId = lawyers[i % lawyers.length].lawyer_id;

    const appointment_date = addDays(baseDate, i + 1);
    const appointment_time = `${pad2(9 + (i % 6))}:${pad2((i % 2) * 30)}:00`;
    const subject = subjects[i % subjects.length];
    const details = detailsList[i % detailsList.length];

    const status = statuses[i % statuses.length];

    const proposed_fee = money(800, 6000);
    let offered_fee = null;
    let final_fee = null;
    let note = null;

    if (status === "negotiating") {
      offered_fee = money(Number(proposed_fee), Number(proposed_fee) + 2000);
      note = `Negotiating based on complexity. Proposed: Rs. ${proposed_fee}, Offered: Rs. ${offered_fee}`;
    }
    if (status === "approved" || status === "completed") {
      offered_fee = money(Number(proposed_fee), Number(proposed_fee) + 1500);
      final_fee = offered_fee;
      note = `Finalized at Rs. ${final_fee}`;
    }
    if (status === "rejected" || status === "cancelled") {
      note = "Closed without agreement.";
    }

    const [r] = await pool.query(
      `
      INSERT INTO appointments
      (client_id, lawyer_id, appointment_date, appointment_time, subject, details, proposed_fee, offered_fee, final_fee, negotiation_note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        clientId,
        lawyerId,
        appointment_date,
        appointment_time,
        subject,
        details,
        Number(proposed_fee),
        offered_fee !== null ? Number(offered_fee) : null,
        final_fee !== null ? Number(final_fee) : null,
        note,
        status,
      ]
    );

    inserted.push({
      appointment_id: r.insertId,
      client_id: clientId,
      lawyer_id: lawyerId,
      status,
    });
  }

  return inserted; // for messages + notifications + cases + docs + billing
};

const seedMessagesAndNotifications = async (appointments) => {
  await pool.query(`DELETE FROM appointment_messages`);
  await pool.query(`DELETE FROM notifications`);

  // Create 2-3 messages per appointment (>=5+ total easily)
  for (const a of appointments) {
    const apptId = a.appointment_id;

    // message: client request
    await pool.query(
      `
      INSERT INTO appointment_messages
      (appointment_id, sender_id, sender_role, message)
      VALUES (?, ?, 'client', ?)
      `,
      [apptId, a.client_id, `Requested appointment (status: ${a.status}). Please review my details.`]
    );

    // message: lawyer response
    await pool.query(
      `
      INSERT INTO appointment_messages
      (appointment_id, sender_id, sender_role, message)
      VALUES (?, ?, 'lawyer', ?)
      `,
      [apptId, a.lawyer_id, `Thanks. I reviewed the request. We can proceed. Current status: ${a.status}.`]
    );

    // optional negotiation message
    if (a.status === "negotiating") {
      await pool.query(
        `
        INSERT INTO appointment_messages
        (appointment_id, sender_id, sender_role, message)
        VALUES (?, ?, 'lawyer', ?)
        `,
        [apptId, a.lawyer_id, "I’ve sent a fee offer. Please confirm if acceptable."]
      );
    }

    // notifications: one to lawyer, one to client
    await pool.query(
      `
      INSERT INTO notifications
      (user_id, appointment_id, type, title, body, is_read)
      VALUES
      (?, ?, 'APPOINTMENT', 'New appointment request', 'A client submitted a new appointment request.', 0),
      (?, ?, 'APPOINTMENT', 'Appointment update', ?, 0)
      `,
      [
        a.lawyer_id,
        apptId,
        a.client_id,
        apptId,
        `Your appointment status is now "${a.status}".`,
      ]
    );
  }

  // add a few extra "system" notifications to reach 5+ even if appointments trimmed
  const [admins] = await pool.query(`SELECT user_id FROM users WHERE role = 'admin'`);
  for (const ad of admins.slice(0, 2)) {
    await pool.query(
      `
      INSERT INTO notifications (user_id, appointment_id, type, title, body, is_read)
      VALUES (?, NULL, 'SYSTEM', 'Daily summary', 'You have pending verifications to review.', 0)
      `,
      [ad.user_id]
    );
  }
};

const seedCases = async (appointments) => {
  // Ensure table exists (your schema adds it)
  await pool.query(`DELETE FROM cases`);

  // Create 8 cases (>=5)
  const types = ["Civil", "Corporate", "Family", "Criminal", "Tax", "Employment", "Cyber", "Property"];
  const statuses = ["active", "active", "active", "closed", "active", "closed"];

  for (let i = 0; i < 8; i++) {
    const a = appointments[i % appointments.length];
    const title = `Case: ${a.status.toUpperCase()} • Ref #${a.appointment_id}`;
    const case_type = types[i % types.length];
    const status = statuses[i % statuses.length];

    await pool.query(
      `
      INSERT INTO cases (client_id, lawyer_id, title, case_type, status)
      VALUES (?, ?, ?, ?, ?)
      `,
      [a.client_id, a.lawyer_id, title, case_type, status]
    );
  }
};

const seedClientDocuments = async () => {
  await pool.query(`DELETE FROM client_documents`);

  const [clients] = await pool.query(
    `SELECT user_id, full_name FROM users WHERE role='client' ORDER BY user_id ASC`
  );
  if (!clients.length) throw new Error("No clients found for client_documents.");

  const docTypes = ["Contract", "Identity", "Legal", "Property", "Tax"];
  const names = [
    "Agreement.pdf",
    "Citizenship.pdf",
    "LandOwnership.pdf",
    "TaxClearance.pdf",
    "CaseEvidence.pdf",
    "AuthorizationLetter.pdf",
  ];

  // Create 12 docs total (>=5)
  for (let i = 0; i < 12; i++) {
    const c = clients[i % clients.length];
    const name = names[i % names.length];
    const doc_type = docTypes[i % docTypes.length];
    const file_path = `uploads/docs/${c.user_id}-${i + 1}-${name}`; // dummy path
    const file_size = `${(0.6 + (i % 6) * 0.4).toFixed(1)} MB`;

    await pool.query(
      `
      INSERT INTO client_documents (client_id, name, file_path, file_size, doc_type)
      VALUES (?, ?, ?, ?, ?)
      `,
      [c.user_id, name, file_path, file_size, doc_type]
    );
  }
};

const seedBilling = async () => {
  await pool.query(`DELETE FROM billing`);

  const [clients] = await pool.query(
    `SELECT user_id FROM users WHERE role='client' ORDER BY user_id ASC`
  );
  if (!clients.length) throw new Error("No clients found for billing.");

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const billStatus = ["paid", "paid", "paid", "pending", "paid", "pending"];

  // Create 16 billing rows (>=5)
  for (let i = 0; i < 16; i++) {
    const c = clients[i % clients.length].user_id;
    const amount = money(2000, 25000);
    const status = billStatus[i % billStatus.length];
    const billing_month = months[i % months.length];

    await pool.query(
      `
      INSERT INTO billing (client_id, amount, status, billing_month)
      VALUES (?, ?, ?, ?)
      `,
      [c, Number(amount), status, billing_month]
    );
  }
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
    const appts = await seedAppointments();

    console.log("💬 Seeding messages + notifications...");
    await seedMessagesAndNotifications(appts);

    console.log("📁 Seeding cases...");
    await seedCases(appts);

    console.log("🗂️ Seeding client documents...");
    await seedClientDocuments();

    console.log("💳 Seeding billing...");
    await seedBilling();

    console.log("✅ Done. Database is ready with 5+ rows per table.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Seeding failed:", e?.message || e);
    process.exit(1);
  }
};

main();

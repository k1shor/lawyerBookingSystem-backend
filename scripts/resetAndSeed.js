import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.resolve();

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
};

const schemaPath = path.join(__dirname, "schema.sql");

async function main() {
  const conn = await mysql.createConnection(dbConfig);

  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  await conn.query(schemaSql);

  await conn.query("SET FOREIGN_KEY_CHECKS=0;");
  await conn.query("TRUNCATE TABLE appointments;");
  await conn.query("TRUNCATE TABLE lawyers;");
  await conn.query("TRUNCATE TABLE users;");
  await conn.query("SET FOREIGN_KEY_CHECKS=1;");

  const password = "Password@123";
  const adminHash = await bcrypt.hash(password, 10);
  const client1Hash = await bcrypt.hash(password, 10);
  const client2Hash = await bcrypt.hash(password, 10);
  const lawyer1Hash = await bcrypt.hash(password, 10);
  const lawyer2Hash = await bcrypt.hash(password, 10);
  const lawyer3Hash = await bcrypt.hash(password, 10);

  await conn.query(
    `INSERT INTO users (user_id, full_name, email, phone, password, role) VALUES
     (1, ?, ?, ?, ?, 'admin'),
     (2, ?, ?, ?, ?, 'client'),
     (3, ?, ?, ?, ?, 'client'),
     (4, ?, ?, ?, ?, 'lawyer'),
     (5, ?, ?, ?, ?, 'lawyer'),
     (6, ?, ?, ?, ?, 'lawyer')`,
    [
      "System Admin", "admin@hirelawyer.com", "9800000000", adminHash,
      "Client One", "client1@hirelawyer.com", "9811111111", client1Hash,
      "Client Two", "client2@hirelawyer.com", "9822222222", client2Hash,
      "Adv. Suman Sharma", "lawyer1@hirelawyer.com", "9841111111", lawyer1Hash,
      "Adv. Riya Adhikari", "lawyer2@hirelawyer.com", "9842222222", lawyer2Hash,
      "Adv. Bikash Karki", "lawyer3@hirelawyer.com", "9843333333", lawyer3Hash
    ]
  );

  await conn.query(
    `INSERT INTO lawyers (lawyer_id, specialization, experience_years, hourly_rate, bio, license_document, is_verified) VALUES
     (4, 'Family Law', 6, 25.00, 'Experienced family lawyer focusing on divorce, custody and family disputes.', 'uploads/licenses/lawyer1_license.pdf', 1),
     (5, 'Criminal Defense', 9, 40.00, 'Criminal defense specialist with strong track record in court representation.', 'uploads/licenses/lawyer2_license.pdf', 1),
     (6, 'Property & Land', 5, 20.00, 'Property and land dispute lawyer helping clients with documentation and litigation.', 'uploads/licenses/lawyer3_license.pdf', 0)`
  );

  await conn.query(
    `INSERT INTO appointments (client_id, lawyer_id, appointment_date, appointment_time, subject, details, status) VALUES
     (2, 4, CURDATE(), '10:30:00', 'Divorce consultation', 'Need guidance on divorce procedure and documentation.', 'pending'),
     (2, 5, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '14:00:00', 'Criminal case advice', 'Seeking legal advice for an ongoing police case.', 'approved'),
     (3, 6, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '11:00:00', 'Land ownership issue', 'Need help to resolve land ownership and boundary dispute.', 'pending'),
     (3, 4, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '16:15:00', 'Child custody consultation', 'Discussing child custody and visitation rights.', 'rejected')`
  );
  await conn.query(
    `ALTER TABLE appointments
  ADD COLUMN proposed_fee DECIMAL(10,2) NULL AFTER details,
  ADD COLUMN offered_fee DECIMAL(10,2) NULL AFTER proposed_fee,
  ADD COLUMN final_fee DECIMAL(10,2) NULL AFTER offered_fee,
  ADD COLUMN negotiation_note VARCHAR(255) NULL AFTER final_fee;

ALTER TABLE appointments
  MODIFY status ENUM(
    'pending',
    'negotiating',
    'approved',
    'rejected',
    'completed',
    'cancelled'
  ) DEFAULT 'pending';
`
  )

  await conn.end();
  console.log("✅ Database reset + seeded successfully.");
  console.log("✅ Password for all users: Password@123");
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});

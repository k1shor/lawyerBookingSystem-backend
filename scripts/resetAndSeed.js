import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "../db.js";

/* ================= CONFIG ================= */
const CONFIG = {
  CLIENTS: 20,
  LAWYERS: 15, // ✅ increased (original + 10 more)
  APPOINTMENTS: 40,
  NOTARY: 15,
};

/* ================= DATA ================= */
const NAMES = [
  "Suman Shrestha", "Ramesh Karki", "Anita Gurung", "Bikash Thapa",
  "Prakash Adhikari", "Sunita Rai", "Dipesh Bhandari", "Kiran Lama",
  "Rajesh Khadka", "Nisha KC", "Binod Poudel", "Maya Tamang",
  "Arjun Basnet", "Deepak Acharya", "Sarita Bhattarai",
  "Roshan Nepal", "Gita Shahi", "Mahesh Joshi", "Pooja Oli"
];

const SPECIALIZATIONS = [
  "Corporate Law", "Criminal Law", "Family Law",
  "Property Law", "Civil Litigation", "Immigration Law"
];

const SUBJECTS = [
  "Property Dispute", "Criminal Case", "Marriage Registration",
  "Business Contract", "Land Ownership", "Fraud Case"
];

const FAQ_DATA = [
  {
    category: "Appointments",
    questions: [
      {
        q: "How do I book an appointment with a lawyer?",
        a: "Simply browse our lawyer directory, select your preferred attorney based on their specialization, and click 'Book Appointment'. Choose an available time slot and confirm your booking."
      },
      {
        q: "Can I reschedule my appointment?",
        a: "Yes, you can reschedule up to 24 hours before your scheduled appointment through your dashboard or by contacting our support team."
      },
      {
        q: "What happens if I miss my appointment?",
        a: "Missed appointments may be subject to a cancellation fee. We recommend canceling at least 24 hours in advance to avoid any charges."
      }
    ]
  },
  {
    category: "Payments & Fees",
    questions: [
      {
        q: "What payment methods are accepted?",
        a: "We accept all major credit cards, debit cards, PayPal, and bank transfers. Payment is processed securely through our encrypted payment gateway."
      },
      {
        q: "Is there a consultation fee?",
        a: "Initial consultation fees vary by lawyer. Some offer free 15-minute consultations. Fee details are displayed on each lawyer's profile."
      }
    ]
  },
  {
    category: "Legal Services",
    questions: [
      {
        q: "What areas of law do you cover?",
        a: "Our platform covers Family Law, Criminal Defense, Corporate Law, Immigration, Real Estate, Personal Injury, Employment Law, and more."
      },
      {
        q: "Are consultations confidential?",
        a: "Absolutely. All communications between you and your lawyer are protected by attorney-client privilege and our strict privacy policy."
      }
    ]
  }
];

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const money = (min, max) => Math.floor(min + Math.random() * (max - min));
const phone = () => `98${Math.floor(10000000 + Math.random() * 90000000)}`;

const nextDate = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

/* ================= USERS ================= */
const seedUsers = async () => {
  const pass = await bcrypt.hash("Password@123", 10);

  // admin
  await pool.query(`
    INSERT INTO users (full_name,email,phone,password,role,is_verified)
    VALUES (?,?,?,?,?,?)
  `, ["Admin User", "admin@legalhub.com", phone(), pass, "admin", 1]);

  // clients
  for (let i = 0; i < CONFIG.CLIENTS; i++) {
    const name = random(NAMES);
    await pool.query(`
      INSERT INTO users 
      (full_name,email,phone,password,role,is_verified,city,state,zip_code)
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [
      name,
      `${name.replace(" ", ".").toLowerCase()}${i}@gmail.com`,
      phone(),
      pass,
      "client",
      1,
      "Kathmandu",
      "Bagmati",
      "44600"
    ]);
  }

  // lawyers (✅ 15 total now)
  for (let i = 0; i < CONFIG.LAWYERS; i++) {
    const name = random(NAMES);
    await pool.query(`
      INSERT INTO users (full_name,email,phone,password,role,is_verified)
      VALUES (?,?,?,?,?,?)
    `, [
      `Adv. ${name}`,
      `${name.replace(" ", ".").toLowerCase()}${i}@law.com`,
      phone(),
      pass,
      "lawyer",
      1
    ]);
  }
};

/* ================= LAWYERS ================= */
const seedLawyers = async () => {
  const [lawyers] = await pool.query(`SELECT user_id FROM users WHERE role='lawyer'`);

  for (const l of lawyers) {
    await pool.query(`
      INSERT INTO lawyers
      (lawyer_id,specialization,experience_years,hourly_rate,bio,is_verified)
      VALUES (?,?,?,?,?,?)
    `, [
      l.user_id,
      random(SPECIALIZATIONS),
      Math.floor(Math.random() * 15) + 1,
      money(2000, 10000),
      "Licensed advocate practicing in Nepal courts.",
      1
    ]);
  }
};

/* ================= APPOINTMENTS ================= */
const seedAppointments = async () => {
  const [clients] = await pool.query(`SELECT user_id FROM users WHERE role='client'`);
  const [lawyers] = await pool.query(`SELECT lawyer_id FROM lawyers`);

  const created = [];

  for (let i = 0; i < CONFIG.APPOINTMENTS; i++) {

    const statusList = [
      "pending", "negotiating", "approved",
      "awaiting_payment", "paid", "completed"
    ];

    const status = random(statusList);
    const baseFee = money(2000, 8000);

    const [res] = await pool.query(`
      INSERT INTO appointments
      (client_id,lawyer_id,appointment_date,appointment_time,subject,details,
      proposed_fee,offered_fee,final_fee,status)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, [
      random(clients).user_id,
      random(lawyers).lawyer_id,
      nextDate(i - 10),
      "10:00:00",
      random(SUBJECTS),
      "Legal consultation required",
      baseFee,
      status === "negotiating" ? baseFee + 1000 : null,
      ["paid", "completed"].includes(status) ? baseFee + 1000 : null,
      status
    ]);

    created.push({ id: res.insertId, status });
  }

  return created;
};

/* ================= MESSAGES ================= */
const seedMessages = async (appointments) => {
  for (const a of appointments) {
    if (a.status === "negotiating") {
      await pool.query(`
        INSERT INTO appointment_messages
        (appointment_id,sender_id,sender_role,message)
        VALUES (?,?,?,?)
      `, [
        a.id,
        2,
        "client",
        "Can we negotiate the fee?"
      ]);
    }
  }
};

/* ================= NOTIFICATIONS ================= */
const seedNotifications = async (appointments) => {
  for (const a of appointments.slice(0, 15)) {
    await pool.query(`
      INSERT INTO notifications
      (user_id,appointment_id,type,title,body)
      VALUES (?,?,?,?,?)
    `, [
      2,
      a.id,
      "appointment",
      "Appointment Update",
      "Your appointment status changed"
    ]);
  }
};

/* ================= CASES ================= */
const seedCases = async () => {
  for (let i = 0; i < 10; i++) {
    await pool.query(`
      INSERT INTO cases (client_id,lawyer_id,title,case_type,status)
      VALUES (?,?,?,?,?)
    `, [2, 7, `Case ${i}`, "Civil", "active"]);
  }
};

/* ================= DOCUMENTS ================= */
const seedDocs = async () => {
  for (let i = 0; i < 10; i++) {
    await pool.query(`
      INSERT INTO client_documents
      (client_id,name,file_path,file_size,doc_type)
      VALUES (?,?,?,?,?)
    `, [2, `Doc ${i}`, "docs/file.pdf", "1MB", "Legal"]);
  }
};

/* ================= BILLING ================= */
const seedBilling = async () => {
  for (let i = 0; i < 10; i++) {
    await pool.query(`
      INSERT INTO billing (client_id,amount,status,billing_month)
      VALUES (?,?,?,?)
    `, [2, money(2000, 6000), "paid", "April"]);
  }
};

/* ================= NOTARY ================= */
const seedNotary = async () => {
  for (let i = 0; i < CONFIG.NOTARY; i++) {
    await pool.query(`
      INSERT INTO notary_requests
      (title,doc_type,client_id,status,payment_status,amount,client_document_path)
      VALUES (?,?,?,?,?,?,?)
    `, [
      "Notary Work",
      "Legal",
      2,
      "submitted",
      "unpaid",
      money(1000, 3000),
      "docs/notary.pdf"
    ]);
  }
};

/* ================= PAYMENTS ================= */
const seedPayments = async (appointments) => {
  for (const a of appointments.slice(0, 15)) {
    await pool.query(`
      INSERT INTO payments
      (appointment_id,amount,status,esewa_pid)
      VALUES (?,?,?,?)
    `, [
      a.id,
      money(2000, 8000),
      "paid",
      `PID-${a.id}`
    ]);
  }
};

/* ================= FAQ ================= */
const seedFaqs = async () => {
  for (const item of FAQ_DATA) {

    // insert category
    const [catResult] = await pool.query(
      `INSERT INTO faq_categories (name) VALUES (?)`,
      [item.category]
    );

    const categoryId = catResult.insertId;

    // insert questions
    for (const q of item.questions) {
      await pool.query(
        `INSERT INTO faqs (category_id, question, answer)
         VALUES (?, ?, ?)`,
        [categoryId, q.q, q.a]
      );
    }
  }
};

/* ================= MAIN ================= */
const main = async () => {
  try {
    console.log("🚀 AUTO SEED START");

    await seedUsers();
    await seedLawyers();

    const appts = await seedAppointments();

    await seedMessages(appts);
    await seedNotifications(appts);
    await seedCases();
    await seedDocs();
    await seedBilling();
    await seedNotary();
    await seedPayments(appts);
    await seedFaqs();
    console.log("✅ AUTO SEED COMPLETE");

  } catch (err) {
    console.error("❌ ERROR:", err);
  } finally {
    process.exit();
  }
};

main();
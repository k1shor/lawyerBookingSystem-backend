-- ==========================
-- HireLawyer Schema (CREATE ONLY)
-- ==========================
USE mysql;
DROP DATABASE IF EXISTS hirelawyer;
CREATE DATABASE hirelawyer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hirelawyer;

-- ================= USERS =================
CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password VARCHAR(255) NOT NULL,

  role ENUM('admin','client','lawyer') NOT NULL DEFAULT 'client',

  is_verified TINYINT(1) DEFAULT 0,

  -- profile
  address VARCHAR(255),
  city VARCHAR(120),
  state VARCHAR(120),
  zip_code VARCHAR(20),

  -- auth
  reset_token VARCHAR(255),
  reset_token_expiry BIGINT,
  verify_token VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================= LAWYERS =================
CREATE TABLE lawyers (
  lawyer_id INT PRIMARY KEY,

  specialization VARCHAR(120),
  experience_years INT DEFAULT 0,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  bio TEXT,
  license_document VARCHAR(255),

  is_verified TINYINT(1) DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_lawyer_user
    FOREIGN KEY (lawyer_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
);

-- ================= APPOINTMENTS =================
CREATE TABLE appointments (
  appointment_id INT AUTO_INCREMENT PRIMARY KEY,

  client_id INT NOT NULL,
  lawyer_id INT NOT NULL,

  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,

  subject VARCHAR(160) NOT NULL,
  details TEXT,

  proposed_fee DECIMAL(10,2),
  offered_fee DECIMAL(10,2),
  final_fee DECIMAL(10,2),

  negotiation_note TEXT,
  last_offered_by TEXT,

  status ENUM(
    'pending',
    'negotiating',
    'awaiting_payment',
    'paid',
    'approved',
    'rejected',
    'cancelled',
    'completed'
  ) DEFAULT 'pending',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_appt_client
    FOREIGN KEY (client_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_appt_lawyer
    FOREIGN KEY (lawyer_id)
    REFERENCES lawyers(lawyer_id)
    ON DELETE CASCADE
);

-- ================= APPOINTMENT MESSAGES =================
CREATE TABLE appointment_messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,

  appointment_id INT NOT NULL,
  sender_id INT NOT NULL,

  sender_role ENUM('admin','client','lawyer') NOT NULL,
  message TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_msg_appt
    FOREIGN KEY (appointment_id)
    REFERENCES appointments(appointment_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_msg_sender
    FOREIGN KEY (sender_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
);

-- ================= NOTIFICATIONS =================
CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,

  user_id INT NOT NULL,
  appointment_id INT NULL,

  type VARCHAR(50) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(255),

  is_read TINYINT(1) DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notif_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_notif_appt
    FOREIGN KEY (appointment_id)
    REFERENCES appointments(appointment_id)
    ON DELETE SET NULL
);

-- ================= CASES =================
CREATE TABLE cases (
  case_id INT AUTO_INCREMENT PRIMARY KEY,

  client_id INT NOT NULL,
  lawyer_id INT,

  title VARCHAR(255),
  case_type VARCHAR(120),
  status VARCHAR(50) DEFAULT 'active',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (client_id) REFERENCES users(user_id),
  FOREIGN KEY (lawyer_id) REFERENCES users(user_id)
);

-- ================= CLIENT DOCUMENTS =================
CREATE TABLE client_documents (
  document_id INT AUTO_INCREMENT PRIMARY KEY,

  client_id INT NOT NULL,

  name VARCHAR(255),
  file_path VARCHAR(255),
  file_size VARCHAR(50),
  doc_type VARCHAR(120),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (client_id) REFERENCES users(user_id)
);

-- ================= BILLING =================
CREATE TABLE billing (
  billing_id INT AUTO_INCREMENT PRIMARY KEY,

  client_id INT,
  amount DECIMAL(10,2),

  status VARCHAR(50) DEFAULT 'paid',
  billing_month VARCHAR(20),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (client_id) REFERENCES users(user_id)
);

-- ================= NOTARY REQUESTS =================
CREATE TABLE notary_requests (
  notary_id INT AUTO_INCREMENT PRIMARY KEY,

  title VARCHAR(200) NOT NULL,
  doc_type VARCHAR(100) NOT NULL,

  urgency ENUM('normal','urgent') DEFAULT 'normal',

  client_id INT NOT NULL,
  lawyer_id INT NULL,

  status ENUM(
    'draft',
    'submitted',
    'paid',
    'in_review',
    'notarized',
    'verified',
    'rejected'
  ) DEFAULT 'submitted',

  payment_status ENUM('unpaid','paid','refunded') DEFAULT 'unpaid',

  amount DECIMAL(10,2) DEFAULT 0.00,
  payment_ref VARCHAR(100),

  client_document_path VARCHAR(255) NOT NULL,
  notarized_document_path VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_client_id (client_id),
  INDEX idx_lawyer_id (lawyer_id),
  INDEX idx_status (status),

  CONSTRAINT fk_notary_client
    FOREIGN KEY (client_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_notary_lawyer
    FOREIGN KEY (lawyer_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL
);

-- ================= PAYMENTS =================
CREATE TABLE payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,

  appointment_id INT NULL,
  notary_id INT NULL,

  amount DECIMAL(10,2) NOT NULL,

  status ENUM('pending','paid','failed') DEFAULT 'pending',

  esewa_pid VARCHAR(255),
  esewa_ref_id VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_payment_appt
    FOREIGN KEY (appointment_id)
    REFERENCES appointments(appointment_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_payment_notary
    FOREIGN KEY (notary_id)
    REFERENCES notary_requests(notary_id)
    ON DELETE CASCADE
);

CREATE TABLE faq_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,

  name VARCHAR(150) NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE faqs (
  faq_id INT AUTO_INCREMENT PRIMARY KEY,

  category_id INT NOT NULL,

  question VARCHAR(255) NOT NULL,
  answer TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_faq_category
    FOREIGN KEY (category_id)
    REFERENCES faq_categories(category_id)
    ON DELETE CASCADE
);


-- ================= INDEXES =================
CREATE INDEX idx_appt_client ON appointments(client_id);
CREATE INDEX idx_appt_lawyer ON appointments(lawyer_id);
CREATE INDEX idx_appt_slot ON appointments(lawyer_id, appointment_date, appointment_time, status);

CREATE INDEX idx_msg_appt ON appointment_messages(appointment_id);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read);


ALTER TABLE appointment_messages
ADD message_type ENUM('chat','negotiation','document') DEFAULT 'chat';

ALTER TABLE appointments
ADD review_text TEXT,
ADD rating INT;
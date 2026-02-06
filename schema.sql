-- ==========================
-- HireLawyer Schema (FINAL)
-- ==========================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS appointment_messages;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS lawyers;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','client','lawyer') NOT NULL DEFAULT 'client',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE appointments (
  appointment_id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  lawyer_id INT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  subject VARCHAR(160) NOT NULL,
  details TEXT,

  proposed_fee DECIMAL(10,2) DEFAULT NULL,
  offered_fee DECIMAL(10,2) DEFAULT NULL,
  final_fee DECIMAL(10,2) DEFAULT NULL,
  negotiation_note TEXT DEFAULT NULL,

  status ENUM(
    'pending',
    'negotiating',
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

CREATE INDEX idx_appt_client ON appointments(client_id);
CREATE INDEX idx_appt_lawyer ON appointments(lawyer_id);
CREATE INDEX idx_appt_slot ON appointments(lawyer_id, appointment_date, appointment_time, status);
CREATE INDEX idx_msg_appt ON appointment_messages(appointment_id);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read);

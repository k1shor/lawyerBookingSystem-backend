CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('client', 'lawyer', 'admin') NOT NULL DEFAULT 'client',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lawyers (
    lawyer_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bar_number VARCHAR(50) NOT NULL,
    law_firm VARCHAR(150) NOT NULL,
    specializations JSON NULL,         -- or TEXT if your MySQL version doesn't support JSON
    years_of_experience VARCHAR(20) NOT NULL,
    license_document VARCHAR(255),     -- store file path or URL
    is_verified TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_lawyers_user FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- run this line
-- mysql -u root -p hirelawyer < schema.sql

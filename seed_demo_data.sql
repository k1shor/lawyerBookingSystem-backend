USE hirelawyer;

INSERT INTO users (full_name, email, password, phone, role)
VALUES
('Admin One','admin@example.com', '$2a$10$abcdefghijklmnopqrstuv', '0000000000', 'admin'),
('Lawyer A','lawyer.a@example.com', '$2a$10$abcdefghijklmnopqrstuv', '1111111111', 'lawyer'),
('Client X','client.x@example.com', '$2a$10$abcdefghijklmnopqrstuv', '2222222222', 'client');


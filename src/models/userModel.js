import db from "../config/db.js";

export const getAllUsers = () => {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM users", (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
};

export const createUser = (name, email) => {
    return new Promise((resolve, reject) => {
        db.query(
            "INSERT INTO users (name, email) VALUES (?, ?)",
            [name, email],
            (err, results) => {
                if (err) reject(err);
                else resolve(results);
            }
        );
    });
};

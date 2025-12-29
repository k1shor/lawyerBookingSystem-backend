import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from 'cors';
import authRoutes from "./src/routes/authRoutes.js";
import usersRoutes from "./src/routes/userRoutes.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());


// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

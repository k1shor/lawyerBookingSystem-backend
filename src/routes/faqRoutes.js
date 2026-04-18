import express from "express";
import {
  createFaq,
  getAllFaqs,
  getFaqById,
  updateFaq,
  deleteFaq,
  getFaqsByCategory
} from "../controllers/faqController.js";

const router = express.Router();

router.post("/", createFaq);
router.get("/", getAllFaqs);
router.get("/category/:categoryId", getFaqsByCategory);
router.get("/:id", getFaqById);
router.put("/:id", updateFaq);
router.delete("/:id", deleteFaq);

export default router;
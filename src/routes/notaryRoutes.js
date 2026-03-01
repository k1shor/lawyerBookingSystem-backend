import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/authorize.js";
import { uploadNotary } from "../middlewares/uploadNotary.js";

import {
  createNotaryRequest,
  payNotaryRequest,
  listNotaryRequests,
  getNotaryById,
  notarizeRequest,
  verifyNotaryFinal,
  claimNotaryRequest
} from "../controllers/notaryController.js";

const router = express.Router();

/* All notary endpoints require auth */
router.use(authenticate);

/* LIST (role aware) */
router.get("/", authorizeRoles("admin", "lawyer", "client"), listNotaryRequests);

/* DETAILS (role aware) */
router.get("/:id", authorizeRoles("admin", "lawyer", "client"), getNotaryById);

/* CLIENT: create request */
router.post(
  "/",
  authorizeRoles("client"),
  uploadNotary.single("document"),
  createNotaryRequest
);

/* CLIENT: pay */
router.post("/:id/pay", authorizeRoles("client"), payNotaryRequest);

/* LAWYER: notarize upload */
router.put(
  "/:id/notarize",
  authorizeRoles("lawyer"),
  uploadNotary.single("notarized_document"),
  notarizeRequest
);

/* CLIENT: verify final */
router.post("/:id/verify", authorizeRoles("client"), verifyNotaryFinal);
/* LAWYER: claim */
router.post("/:id/claim", authorizeRoles("lawyer"), claimNotaryRequest);

export default router;
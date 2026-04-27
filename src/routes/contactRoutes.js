import express from "express";
import {
  createContact,
  getAllContacts,
  updateContactStatus,
} from "../controllers/contact.controller.js";
import { isAdminOrProvider, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/", createContact);
router.get("/", verifyToken, isAdminOrProvider, getAllContacts);
router.patch("/:id/status", verifyToken, isAdminOrProvider, updateContactStatus);

export default router;
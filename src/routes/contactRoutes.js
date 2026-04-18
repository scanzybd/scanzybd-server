import express from "express";
import { createContact, getAllContacts } from "../controllers/contact.controller.js";
import { isProvider, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/", createContact);
router.get("/", verifyToken, isProvider, getAllContacts);

export default router;
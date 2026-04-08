import express from "express";
import {
    createPayment,
    confirmPayment,
    getUserPayments,
} from "../controllers/payment.controller.js";

import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// 🔥 create payment
router.post("/create", verifyToken, createPayment);

// 🔥 payment success callback
router.post("/confirm", verifyToken, confirmPayment);

// 🔥 user payment history
router.get("/my", verifyToken, getUserPayments);

export default router;
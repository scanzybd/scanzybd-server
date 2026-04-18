import express from "express";
import { verifyToken } from "../middleware/auth.js";

import {
    createPayment,
    confirmPayment,
    getUserPayments,
} from "../controllers/payment.controller.js";
import { bkashCallback } from "../controllers/bkashCallback.controller.js";


const router = express.Router();

// 🔥 create payment
router.post("/create", verifyToken, createPayment);
router.get("/bkash/callback", bkashCallback);
router.get("/my-payments", verifyToken, getUserPayments);




// 🔥 payment success callback
router.post("/confirm", verifyToken, confirmPayment);

// 🔥 user payment history

export default router;
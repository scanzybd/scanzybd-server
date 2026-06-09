import express from "express";
import { verifyToken } from "../middleware/auth.js";

import {
    createPayment,
    confirmPayment,
    getUserPayments,
} from "../controllers/payment.controller.js";
import { bkashCallback } from "../controllers/bkashCallback.controller.js";
import {
    getGatewaysAdmin,
    getGatewaysPublic,
    updateGatewaysAdmin,
} from "../controllers/paymentGateway.controller.js";
import {
    sslcommerzCancel,
    sslcommerzFail,
    sslcommerzIpn,
    sslcommerzSuccess,
} from "../controllers/sslcommerzCallback.controller.js";
import { isAdmin } from "../middleware/auth.js";
import { paymentCreateRateLimit } from "../middleware/rateLimit.js";


const router = express.Router();

router.get("/gateways", getGatewaysPublic);
router.get("/admin/gateways", verifyToken, isAdmin, getGatewaysAdmin);
router.patch("/admin/gateways", verifyToken, isAdmin, updateGatewaysAdmin);

router.post("/create", verifyToken, paymentCreateRateLimit, createPayment);
router.get("/bkash/callback", bkashCallback);
router.post("/sslcommerz/success", sslcommerzSuccess);
router.get("/sslcommerz/success", sslcommerzSuccess);
router.post("/sslcommerz/fail", sslcommerzFail);
router.get("/sslcommerz/fail", sslcommerzFail);
router.post("/sslcommerz/cancel", sslcommerzCancel);
router.get("/sslcommerz/cancel", sslcommerzCancel);
router.post("/sslcommerz/ipn", sslcommerzIpn);
router.get("/my-payments", verifyToken, getUserPayments);




// 🔥 payment success callback
router.post("/confirm", verifyToken, confirmPayment);

// 🔥 user payment history

export default router;
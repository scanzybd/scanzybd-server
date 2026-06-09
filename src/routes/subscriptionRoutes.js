import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { orderCreateRateLimit } from "../middleware/rateLimit.js";
import {
    createRenewIntent,
    getMyTagSubscriptions,
} from "../controllers/subscription.controller.js";

const router = express.Router();

router.get("/my-tags", verifyToken, getMyTagSubscriptions);
router.post("/renew-intent", verifyToken, orderCreateRateLimit, createRenewIntent);

export default router;

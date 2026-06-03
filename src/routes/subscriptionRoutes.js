import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
    createRenewIntent,
    getMyTagSubscriptions,
} from "../controllers/subscription.controller.js";

const router = express.Router();

router.get("/my-tags", verifyToken, getMyTagSubscriptions);
router.post("/renew-intent", verifyToken, createRenewIntent);

export default router;

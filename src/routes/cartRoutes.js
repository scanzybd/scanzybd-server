import express from "express";
import {
    deleteCart,
    getCart,
    purgeStaleCartsCron,
    putCart,
} from "../controllers/cart.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", verifyToken, getCart);
router.put("/", verifyToken, putCart);
router.delete("/", verifyToken, deleteCart);
router.get("/cron/purge-stale", purgeStaleCartsCron);

export default router;

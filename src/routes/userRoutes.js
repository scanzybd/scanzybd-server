import express from "express";
import { verifyToken, isAdmin } from "../middleware/auth.js";
import {
    listUsers,
    createUserByAdmin,
    updateUserStatus,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/", verifyToken, isAdmin, listUsers);
router.post("/", verifyToken, isAdmin, createUserByAdmin);
router.patch("/:id", verifyToken, isAdmin, updateUserStatus);

export default router;

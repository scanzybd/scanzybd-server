import express from "express";
import { verifyToken, isAdmin, isAdminOrProvider } from "../middleware/auth.js";
import {
    listUsers,
    listAssignableUsers,
    createUserByAdmin,
    updateUserStatus,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/assignable", verifyToken, isAdminOrProvider, listAssignableUsers);
router.get("/", verifyToken, isAdmin, listUsers);
router.post("/", verifyToken, isAdmin, createUserByAdmin);
router.patch("/:id", verifyToken, isAdmin, updateUserStatus);

export default router;

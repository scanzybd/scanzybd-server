import express from "express";
import { createExpense, getExpenses } from "../controllers/expense.controller.js";
import { isAdminOrProvider, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", verifyToken, isAdminOrProvider, getExpenses);
router.post("/", verifyToken, isAdminOrProvider, createExpense);

export default router;

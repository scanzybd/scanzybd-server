import express from "express";
import { createExpense, getExpenses } from "../controllers/expense.controller.js";
import { isProvider, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", verifyToken, isProvider, getExpenses);
router.post("/", verifyToken, isProvider, createExpense);

export default router;

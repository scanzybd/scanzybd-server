import express from "express";
import {
  forgotPassword,
  getMe,
  login,
  register,
  resetPassword,
  socialLogin,
  verifyResetCode,
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middleware/auth.js";


const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/social", socialLogin);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyResetCode);
router.post("/reset-password", resetPassword);
router.get("/me", verifyToken, getMe);


export default router; 
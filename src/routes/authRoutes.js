import express from "express";
import {
  forgotPassword,
  getMe,
  updateMe,
  login,
  register,
  resetPassword,
  socialLogin,
  verifyResetCode,
  logout,
  sessionCheck,
  listSessions,
  revokeSession,
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middleware/auth.js";
import {
    forgotPasswordRateLimit,
    loginEmailRateLimit,
    loginIpRateLimit,
    registerRateLimit,
    socialLoginRateLimit,
} from "../middleware/rateLimit.js";

const router = express.Router();

//change
router.post("/register", registerRateLimit, register);
router.post("/login", loginIpRateLimit, loginEmailRateLimit, login);
router.post("/social", socialLoginRateLimit, socialLogin);
router.post("/forgot-password", forgotPasswordRateLimit, forgotPassword);
router.post("/verify-reset-code", forgotPasswordRateLimit, verifyResetCode);
router.post("/reset-password", forgotPasswordRateLimit, resetPassword);
router.get("/me", verifyToken, getMe);
router.patch("/me", verifyToken, updateMe);
router.post("/logout", verifyToken, logout);
router.get("/session-check", verifyToken, sessionCheck);
router.get("/sessions", verifyToken, listSessions);
router.delete("/sessions/:sessionId", verifyToken, revokeSession);


export default router; 
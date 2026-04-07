import express from "express";
import { firebaseLogin, getMe, login, register } from "../controllers/auth.controller.js";
import { verifyToken } from "../middleware/auth.js";


const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/firebase", firebaseLogin);
router.get("/me", verifyToken, getMe);


export default router; 
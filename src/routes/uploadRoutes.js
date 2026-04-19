import express from "express";
import { uploadToImgbb } from "../controllers/upload.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/imgbb", verifyToken, uploadToImgbb);

export default router;

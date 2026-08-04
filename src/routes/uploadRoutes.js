import express from "express";
import { uploadToCloudinary } from "../controllers/upload.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/image", verifyToken, uploadToCloudinary);
/** @deprecated Prefer POST /api/upload/image */
router.post("/cloudinary", verifyToken, uploadToCloudinary);
router.post("/imgbb", verifyToken, uploadToCloudinary);

export default router;

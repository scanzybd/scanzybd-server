import express from "express";
import {
    getAdminSocialMediaSettings,
    getPublicSocialMediaSettings,
    updateAdminSocialMediaSettings,
} from "../controllers/socialMediaSettings.controller.js";
import { isAdmin, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/social-media", getPublicSocialMediaSettings);
router.get("/admin/social-media", verifyToken, isAdmin, getAdminSocialMediaSettings);
router.put("/admin/social-media", verifyToken, isAdmin, updateAdminSocialMediaSettings);

export default router;

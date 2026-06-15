import express from "express";
import {
    getAdminSocialMediaSettings,
    getPublicSocialMediaSettings,
    updateAdminSocialMediaSettings,
} from "../controllers/socialMediaSettings.controller.js";
import {
    getAdminContactInfoSettings,
    getPublicContactInfoSettings,
    updateAdminContactInfoSettings,
} from "../controllers/contactInfoSettings.controller.js";
import { isAdmin, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/social-media", getPublicSocialMediaSettings);
router.get("/admin/social-media", verifyToken, isAdmin, getAdminSocialMediaSettings);
router.put("/admin/social-media", verifyToken, isAdmin, updateAdminSocialMediaSettings);

router.get("/contact", getPublicContactInfoSettings);
router.get("/admin/contact", verifyToken, isAdmin, getAdminContactInfoSettings);
router.put("/admin/contact", verifyToken, isAdmin, updateAdminContactInfoSettings);

export default router;

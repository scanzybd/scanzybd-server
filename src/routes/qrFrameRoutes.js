import express from "express";
import {
    createFrameTemplate,
    getActiveFrameTemplates,
    getAllFrameTemplatesAdmin,
    getFrameTemplateSvg,
    seedFrameTemplates,
    updateFrameTemplate,
    uploadFrameTemplateSvg,
} from "../controllers/qrFrameTemplate.controller.js";
import { isAdmin, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getActiveFrameTemplates);

router.get("/admin/all", verifyToken, isAdmin, getAllFrameTemplatesAdmin);
router.post("/admin/seed", verifyToken, isAdmin, seedFrameTemplates);
router.post("/admin", verifyToken, isAdmin, createFrameTemplate);
router.patch("/admin/:slug", verifyToken, isAdmin, updateFrameTemplate);
router.post("/admin/:slug/svg", verifyToken, isAdmin, uploadFrameTemplateSvg);

router.get("/:slug/svg", getFrameTemplateSvg);

export default router;

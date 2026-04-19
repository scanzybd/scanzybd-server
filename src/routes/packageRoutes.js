import express from "express";
import { createPackage, getAllPackages } from "../controllers/package.controller.js";
import { isAdmin, optionalVerifyToken, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/", verifyToken, isAdmin, createPackage);
router.get("/", optionalVerifyToken, getAllPackages);

export default router;
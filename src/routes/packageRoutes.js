import express from "express";
import {
    createPackage,
    getAllPackages,
    updatePackage,
    deletePackage,
} from "../controllers/package.controller.js";
import { isAdmin, optionalVerifyToken, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/", verifyToken, isAdmin, createPackage);
router.get("/", optionalVerifyToken, getAllPackages);
router.put("/:id", verifyToken, isAdmin, updatePackage);
router.delete("/:id", verifyToken, isAdmin, deletePackage);

export default router;
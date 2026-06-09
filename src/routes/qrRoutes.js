import express from "express";
import {
    generateQRs,
    scanQR,
    assignQRToVehicle,
    unassignQRFromVehicle,
    getAllQR,
    getQRById,
    getQRByCode,
} from "../controllers/qr.controller.js";
import qrFrameRoutes from "./qrFrameRoutes.js";

import { isAdminOrProvider, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.use("/frames", qrFrameRoutes);

// generate QR
// ✅ FIXED ORDER

router.post("/generate", verifyToken, generateQRs);

router.get("/allQR", verifyToken, isAdminOrProvider, getAllQR);

router.get("/id/:id", verifyToken, getQRById);

router.get("/code/:code", getQRByCode); // ✅ specific

router.post("/assign", verifyToken, assignQRToVehicle);
router.post("/unassign", verifyToken, unassignQRFromVehicle);

// ⚠️ keep wildcard LAST
router.get("/:code", scanQR);

export default router;
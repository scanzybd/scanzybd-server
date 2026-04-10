import express from "express";
import {
    generateQRs,
    scanQR,
    assignQRToVehicle,
    getAllQR,
    getQRById,
} from "../controllers/qr.controller.js";

import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// generate QR
router.post("/generate", verifyToken, generateQRs);

// scan QR (public)

router.get("/allQR", getAllQR);
router.get("/id/:id", verifyToken, getQRById);
router.get("/:code", scanQR);



// assign QR (admin/provider only)
router.post("/assign", verifyToken, assignQRToVehicle);

export default router;
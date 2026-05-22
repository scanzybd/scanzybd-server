import express from "express";
import { getBrtaZones, getBrtaSeries } from "../controllers/brta.controller.js";

const router = express.Router();

router.get("/brta-zones", getBrtaZones);
router.get("/brta-series", getBrtaSeries);

export default router;

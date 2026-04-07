import express from "express";
import { createPackage, getAllPackages } from "../controllers/package.controller.js";


const router = express.Router();

router.post("/", createPackage);
router.get("/", getAllPackages);

export default router;
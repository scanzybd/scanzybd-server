import express from "express";
import { getLocationTree } from "../controllers/location.controller.js";

const router = express.Router();

router.get("/", getLocationTree);

export default router;

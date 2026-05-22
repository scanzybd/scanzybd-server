import express from "express";
import { getTagTypes } from "../controllers/tagType.controller.js";

const router = express.Router();

router.get("/", getTagTypes);

export default router;

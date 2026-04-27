import express from "express";
import {
  createReview,
  deleteReview,
  getAllReviews,
  getPublicReviews,
  updateReview,
} from "../controllers/review.controller.js";
import { isAdmin, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getPublicReviews);
router.get("/all", verifyToken, isAdmin, getAllReviews);
router.post("/", verifyToken, isAdmin, createReview);
router.put("/:id", verifyToken, isAdmin, updateReview);
router.delete("/:id", verifyToken, isAdmin, deleteReview);

export default router;

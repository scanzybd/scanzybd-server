// routes/productRoutes.js

import express from "express";
const router = express.Router();

import { addProduct, getAllProducts, getProductById, myProducts } from "../controllers/product.controller.js";
import { verifyToken } from "../middleware/auth.js";

router.post("/", addProduct);
router.get("/", verifyToken, getAllProducts); // 🔥 ADD THIS
router.get("/my/:email", myProducts);
router.get("/:id", getProductById);

export default router; // 🔥 THIS LINE FIX
// routes/productRoutes.js

import express from "express";
const router = express.Router();

import {
    addProduct,
    getAllProducts,
    getDashboardProducts,
    getProductById,
    myProducts,
    updateProduct,
} from "../controllers/product.controller.js";
import { isAdmin, isProvider, verifyToken } from "../middleware/auth.js";

router.post("/", verifyToken, isAdmin, addProduct);
router.get("/", getAllProducts);
router.get("/mine", verifyToken, isProvider, getDashboardProducts);
router.get("/my/:email", myProducts);
router.put("/:id", verifyToken, isProvider, updateProduct);
router.get("/:id", getProductById);

export default router; // 🔥 THIS LINE FIX
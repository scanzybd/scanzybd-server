// routes/productRoutes.js

import express from "express";
const router = express.Router();

import {
    addProduct,
    getAllProducts,
    getDashboardProducts,
    getProductById,
    myProducts,
    reorderProducts,
    updateProduct,
} from "../controllers/product.controller.js";
import { isAdmin, isAdminOrProvider, isProvider, verifyToken } from "../middleware/auth.js";

router.post("/", verifyToken, isAdmin, addProduct);
router.get("/", getAllProducts);
router.get("/mine", verifyToken, isProvider, getDashboardProducts);
router.get("/my/:email", verifyToken, isAdminOrProvider, myProducts);
router.patch("/reorder", verifyToken, isAdmin, reorderProducts);
router.put("/:id", verifyToken, isAdmin, updateProduct);
router.get("/:id", getProductById);

export default router; // 🔥 THIS LINE FIX
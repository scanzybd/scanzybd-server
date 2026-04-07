// routes/productRoutes.js

import express from "express";
const router = express.Router();

import { addProduct, getAllProducts, myProducts } from "../controllers/product.controller.js";

router.post("/", addProduct);
router.get("/", getAllProducts); // 🔥 ADD THIS
router.get("/my/:email", myProducts);

export default router; // 🔥 THIS LINE FIX
import express from "express";
import { createOrder, getAllOrders, getCancelledOrders, getCompletedOrders, getMyOrders, getPendingOrders } from "../controllers/order.controller.js";
import { isProvider, verifyToken } from "../middleware/auth.js";



const router = express.Router();
// create order

router.post("/create", verifyToken, createOrder);


// get all orders (admin or protected)

router.get("/", verifyToken, isProvider, getAllOrders);
router.get("/pending", verifyToken, isProvider, getPendingOrders);
router.get("/completed", verifyToken, isProvider, getCompletedOrders);
router.get("/cancelled", verifyToken, isProvider, getCancelledOrders);

// get logged-in user's orders
router.get("/my-orders", verifyToken, getMyOrders);

export default router;
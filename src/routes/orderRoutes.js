import express from "express";
import {
    createOrder,
    getAllOrders,
    getCancelledOrders,
    getCompletedOrders,
    getDeliveredOrders,
    getMyOrders,
    getPendingOrders,
    getReturnedOrders,
    getShippedOrders,
    updateOrderStatus,
} from "../controllers/order.controller.js";
import { isProvider, verifyToken } from "../middleware/auth.js";



const router = express.Router();
// create order

router.post("/create", verifyToken, createOrder);


// get all orders (admin or protected)

router.get("/", verifyToken, isProvider, getAllOrders);
router.get("/pending", verifyToken, isProvider, getPendingOrders);
router.get("/completed", verifyToken, isProvider, getCompletedOrders);
router.get("/shipped", verifyToken, isProvider, getShippedOrders);
router.get("/delivered", verifyToken, isProvider, getDeliveredOrders);
router.get("/returned", verifyToken, isProvider, getReturnedOrders);
router.get("/cancelled", verifyToken, isProvider, getCancelledOrders);
router.patch("/:id/status", verifyToken, isProvider, updateOrderStatus);

// get logged-in user's orders
router.get("/my-orders", verifyToken, getMyOrders);

export default router;
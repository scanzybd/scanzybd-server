import express from "express";
import {
    createOrder,
    getAllOrders,
    getCancelledOrders,
    getCompletedOrders,
    getDeliveredOrders,
    deleteMyUnpaidOrder,
    getMyOrders,
    getPendingOrders,
    getReturnedOrders,
    getShippedOrders,
} from "../controllers/order.controller.js";
import {
    staffCreateOrder,
    completeOrder,
    updateStaffOrderStatus,
    deleteStaffOrder,
    bulkDeleteExpiredUnpaidOrders,
    purgeAbandonedOrdersCron,
    updateOrderPayment,
    getStaffOrders,
    getOrderById,
    getDashboardAnalytics,
} from "../controllers/staffOrder.controller.js";
import { isAdmin, isAdminOrProvider, isProvider, verifyToken } from "../middleware/auth.js";
import { orderCreateRateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

router.get("/cron/purge-abandoned", purgeAbandonedOrdersCron);
router.post("/create", verifyToken, orderCreateRateLimit, createOrder);
router.post(
    "/staff-create",
    verifyToken,
    isAdminOrProvider,
    orderCreateRateLimit,
    staffCreateOrder
);

router.get("/my-orders", verifyToken, getMyOrders);
router.delete("/my-orders/:orderId", verifyToken, deleteMyUnpaidOrder);
router.get("/dashboard-analytics", verifyToken, isAdminOrProvider, getDashboardAnalytics);
router.get("/staff-orders", verifyToken, isAdminOrProvider, getStaffOrders);

router.get("/", verifyToken, isProvider, getAllOrders);
router.get("/pending", verifyToken, isProvider, getPendingOrders);
router.get("/returned", verifyToken, isProvider, getReturnedOrders);
router.get("/cancelled", verifyToken, isProvider, getCancelledOrders);
router.get("/completed", verifyToken, isProvider, getCompletedOrders);
router.get("/shipped", verifyToken, isAdmin, getShippedOrders);
router.get("/delivered", verifyToken, isAdmin, getDeliveredOrders);

router.patch("/:orderId/complete", verifyToken, isAdmin, completeOrder);
router.patch("/:orderId/payment", verifyToken, isAdmin, updateOrderPayment);
router.patch("/:orderId/status", verifyToken, isAdmin, updateStaffOrderStatus);
router.delete(
    "/bulk-unpaid",
    verifyToken,
    isAdmin,
    bulkDeleteExpiredUnpaidOrders
);
router.delete("/:orderId", verifyToken, isAdmin, deleteStaffOrder);

router.get("/:orderId", verifyToken, getOrderById);

export default router;

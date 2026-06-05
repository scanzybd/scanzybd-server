import express from "express";
import {
    getProviderFinanceSummary,
    getProviderFinanceOrders,
    getProviderPaymentDetails,
    updateProviderPaymentDetails,
    createSettlementRequest,
    listProviderSettlementRequests,
    listAdminSettlementRequests,
    getSettlementRequestById,
    acceptSettlementRequest,
    rejectSettlementRequest,
    getAdminProviderDueList,
    getAdminProviderDueDetail,
    getAdminPaidOrders,
    getAdminFinanceReport,
} from "../controllers/finance.controller.js";
import { verifyToken, isAdmin, isAdminOrProvider } from "../middleware/auth.js";

const router = express.Router();

router.get("/provider/summary", verifyToken, getProviderFinanceSummary);
router.get("/provider/orders", verifyToken, getProviderFinanceOrders);
router.get("/provider/payment-details", verifyToken, getProviderPaymentDetails);
router.put("/provider/payment-details", verifyToken, updateProviderPaymentDetails);
router.post("/provider/settlement-requests", verifyToken, createSettlementRequest);
router.get("/provider/settlement-requests", verifyToken, listProviderSettlementRequests);

router.get("/admin/paid-orders", verifyToken, isAdmin, getAdminPaidOrders);
router.get("/admin/reports", verifyToken, isAdmin, getAdminFinanceReport);
router.get("/admin/provider-dues", verifyToken, isAdmin, getAdminProviderDueList);
router.get(
    "/admin/provider-dues/:providerId",
    verifyToken,
    isAdmin,
    getAdminProviderDueDetail
);

router.get("/admin/settlement-requests", verifyToken, isAdmin, listAdminSettlementRequests);
router.get(
    "/admin/settlement-requests/:id",
    verifyToken,
    isAdmin,
    getSettlementRequestById
);
router.patch(
    "/admin/settlement-requests/:id/accept",
    verifyToken,
    isAdmin,
    acceptSettlementRequest
);
router.patch(
    "/admin/settlement-requests/:id/reject",
    verifyToken,
    isAdmin,
    rejectSettlementRequest
);

export default router;

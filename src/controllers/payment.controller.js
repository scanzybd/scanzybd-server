import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import { createOnlinePayment } from "../service/paymentInit.service.js";
import {
    getManualBkashConfig,
    resolveGateway,
} from "../service/paymentGateway.service.js";
import {
    assertManualTransactionIdUnique,
    normalizeManualTransactionId,
} from "../utils/transactionId.js";

export const createPayment = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { orderId, gateway: requestedGateway } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (String(order.userId) !== String(userId)) {
            return res.status(403).json({ message: "Not your order" });
        }

        if (String(order.paymentStatus || "").toLowerCase() === "paid") {
            return res.status(400).json({ message: "Order is already paid" });
        }

        const pendingManual = await Payment.findOne({
            orderId: order._id,
            paymentMethod: "manual_bkash",
            status: "pending",
        }).lean();
        if (pendingManual) {
            return res.status(400).json({
                message:
                    "Order has a pending manual payment. Wait for admin review or use manual bKash.",
            });
        }

        const gateway = await resolveGateway(requestedGateway);
        const result = await createOnlinePayment(order, userId, gateway);

        res.json({
            success: true,
            gateway: result.gateway,
            redirectURL: result.redirectURL,
            bkashURL: result.redirectURL,
            paymentId: result.payment._id,
        });
    } catch (error) {
        console.error("createPayment:", error?.response?.data || error);
        const status = error.message?.includes("not enabled") ? 400 : 500;
        res.status(status).json({
            message: error.message || "Payment failed",
        });
    }
};

export const confirmPayment = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { paymentId } = req.body;

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found",
            });
        }

        if (String(payment.userId) !== String(userId)) {
            return res.status(403).json({
                success: false,
                message: "Not your payment",
            });
        }

        if (payment.status === "success") {
            return res.json({
                success: true,
                message: "Payment already completed",
                alreadyPaid: true,
            });
        }

        if (payment.status === "failed") {
            return res.status(400).json({
                success: false,
                message: "Payment failed or was cancelled",
            });
        }

        // Payment is only marked success by gateway callbacks (bKash / SSLCommerz).
        // Never trust client-supplied transactionId to complete payment.
        return res.status(400).json({
            success: false,
            message:
                "Payment is not completed yet. Finish payment at the gateway or wait for confirmation.",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const submitManualPayment = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { orderId, transactionId: rawTrx } = req.body || {};

        const manual = await getManualBkashConfig();
        if (!manual.enabled) {
            return res.status(400).json({
                message: "Manual bKash payment is not available",
            });
        }

        if (!orderId) {
            return res.status(400).json({ message: "orderId is required" });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (String(order.userId) !== String(userId)) {
            return res.status(403).json({ message: "Not your order" });
        }

        if (String(order.paymentStatus || "").toLowerCase() === "paid") {
            return res.status(400).json({ message: "Order is already paid" });
        }

        let payment = await Payment.findOne({
            orderId: order._id,
            paymentMethod: "manual_bkash",
        }).sort({ createdAt: -1 });

        if (payment?.status === "success") {
            return res.status(400).json({ message: "Payment already completed" });
        }

        let trxSuffix;
        try {
            trxSuffix = normalizeManualTransactionId(rawTrx);
            await assertManualTransactionIdUnique(
                trxSuffix,
                payment?._id || null
            );
        } catch (err) {
            return res.status(err.statusCode || 400).json({ message: err.message });
        }

        if (payment?.status === "pending") {
            payment.transactionId = trxSuffix;
            await payment.save();
        } else {
            payment = await Payment.create({
                userId,
                orderId: order._id,
                amount: order.totalAmount,
                currency: "BDT",
                paymentMethod: "manual_bkash",
                transactionId: trxSuffix,
                status: "pending",
            });
        }

        order.paymentMethod = "manual_bkash";
        await order.save();

        res.json({
            success: true,
            paymentId: payment._id,
            status: "pending_review",
            transactionId: trxSuffix,
        });
    } catch (error) {
        console.error("submitManualPayment:", error);
        res.status(500).json({ message: error.message || "Payment submit failed" });
    }
};

export const getUserPayments = async (req, res) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const filter = {
            userId,
            $or: [
                { status: "success" },
                { status: "pending", paymentMethod: "manual_bkash" },
            ],
        };

        const payments = await Payment.find(filter)
            .populate("orderId")
            .sort({ createdAt: -1 });

        res.status(200).json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

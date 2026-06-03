import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import { completeOnlinePayment } from "../utils/paymentCompletion.js";
import { createOnlinePayment } from "../service/paymentInit.service.js";
import { resolveGateway } from "../service/paymentGateway.service.js";

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
        const { paymentId, transactionId } = req.body;

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found",
            });
        }

        if (payment.status === "success") {
            return res.json({
                success: true,
                message: "Payment already completed",
                alreadyPaid: true,
            });
        }

        await completeOnlinePayment(payment, { transactionId });

        return res.json({
            success: true,
            message: "Payment successful & order updated",
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getUserPayments = async (req, res) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const payments = await Payment.find({
            userId,
            status: "success",
        })
            .populate("orderId")
            .sort({ createdAt: -1 });

        res.status(200).json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

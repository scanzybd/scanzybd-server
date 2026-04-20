import axios from "axios";
import Payment from "../models/Payment.js";
import { getBkashIdToken } from "../service/bkash.service.js";
import Order from "../models/Order.js";
import User from "../models/User.js";


export const createPayment = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { orderId } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // 🔥 bKash token (cached ~45 min in bkash.service)
        const id_token = await getBkashIdToken();

        // 🔥 create payment
        const bkashRes = await axios.post(
            process.env.BKASH_CREATE_PAYMENT_URL,
            {
                mode: "0011",
                payerReference: userId.toString(),
                callbackURL: process.env.BKASH_BACKEND_CALLBACK_URL,
                amount: order.totalAmount.toString(),
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: `INV-${Date.now()}`,
                orderId: order,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: id_token,
                    "X-APP-Key": process.env.BKASH_APP_KEY,
                },
            }
        );

        const bkashData = bkashRes.data;

        if (!bkashData.paymentID) {
            return res.status(400).json({
                success: false,
                message: "Payment init failed",
            });
        }

        // save payment record
        const payment = await Payment.create({
            userId,
            orderId: order._id,
            amount: order.totalAmount,
            paymentID: bkashData.paymentID,
            status: "pending",
        });

        res.json({
            success: true,
            bkashURL: bkashData.bkashURL,
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Payment failed" });
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

        // Idempotent: callback may have already marked success
        if (payment.status === "success") {
            return res.json({
                success: true,
                message: "Payment already completed",
                alreadyPaid: true,
            });
        }

        payment.status = "success";
        payment.transactionId = transactionId;
        payment.completedAt = new Date();

        await payment.save();

        // 🔥 STEP 2: update order (IMPORTANT)
        const order = await Order.findById(payment.orderId);

        if (order) {
            order.status = "paid";
            order.paymentStatus = "paid";
            order.transactionId = transactionId;

            await order.save();
        }

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


//write a controller function to get user payment history

export const getUserPayments = async (req, res) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const payments = await Payment.find({
            userId,
            status: "success", // ✅ ONLY SUCCESS
        })
            .populate("orderId")
            .sort({ createdAt: -1 });

        res.status(200).json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

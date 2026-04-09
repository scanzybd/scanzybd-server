import axios from "axios";
import Payment from "../models/Payment.js";
import { grantBkashToken } from "../service/bkash.service.js";


export const createPayment = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized user" });
        }

        const { amount, cartItems } = req.body;

        const payment = await Payment.create({
            userId,
            amount,
            cartItems,
            status: "pending",
        });

        // 🔥 STEP 1: TOKEN
        const id_token = await grantBkashToken();

        // 🔥 STEP 2: CREATE PAYMENT
        const bkashRes = await axios.post(
            process.env.BKASH_CREATE_PAYMENT_URL,
            {
                mode: "0011",
                payerReference: userId.toString(),
                callbackURL: process.env.BKASH_BACKEND_CALLBACK_URL,
                amount: amount.toString(),
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: payment._id.toString(),
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: id_token, // IMPORTANT (no Bearer)
                    "X-APP-Key": process.env.BKASH_APP_KEY,
                },
            }
        );

        return res.json({
            success: true,
            paymentId: payment._id,
            bkashURL: bkashRes.data.bkashURL,
        });
    } catch (error) {
        console.log("CREATE PAYMENT ERROR:", error.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message: error.message,
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

        // ❌ prevent double payment
        if (payment.status === "success") {
            return res.status(400).json({
                success: false,
                message: "Already paid",
            });
        }

        payment.status = "success";
        payment.transactionId = transactionId;
        payment.paidAt = new Date();

        await payment.save();

        return res.json({
            success: true,
            message: "Payment successful",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


export const getUserPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user.id })
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            data: payments,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



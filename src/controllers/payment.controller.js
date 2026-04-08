import Payment from "../models/Payment.js";

// 🔥 Create Payment (Checkout start)
export const createPayment = async (req, res) => {
    try {
        const { amount, cartItems } = req.body;

        const payment = await Payment.create({
            userId: req.user.id, // token middleware must give req.user
            amount,
            cartItems,
            status: "pending",
        });

        // 👉 bkash sandbox redirect (demo)
        res.json({
            success: true,
            message: "Payment created",
            paymentId: payment._id,
            bkashURL: `https://sandbox.bkash.com/payment?paymentId=${payment._id}`,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// 🔥 Success callback (after payment)
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

        payment.status = "success";
        payment.transactionId = transactionId;

        await payment.save();

        res.json({
            success: true,
            message: "Payment successful",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// 🔥 Get user payments
export const getUserPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user.id });

        res.json({
            success: true,
            data: payments,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
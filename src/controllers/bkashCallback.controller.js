import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import axios from "axios";
import { getBkashIdToken } from "../service/bkash.service.js";

function clientOrigin() {
    const raw =
        process.env.CLIENT_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:5173";
    return String(raw).replace(/\/$/, "");
}

export const bkashCallback = async (req, res) => {
    try {
        const { paymentID, status } = req.query;

        if (!paymentID) {
            return res.status(400).json({ message: "No paymentID" });
        }

        const failRedirect = () =>
            res.redirect(`${clientOrigin()}/payment/failed`);

        // User cancelled or failed at bKash UI
        if (status !== "success") {
            await Payment.findOneAndUpdate(
                { paymentID },
                { status: "failed", failedAt: new Date() }
            );
            return failRedirect();
        }

        const id_token = await getBkashIdToken();

        const executeUrl =
            process.env.BKASH_EXECUTE_PAYMENT_URL ||
            "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/execute";

        const executeRes = await axios.post(
            executeUrl,
            { paymentID },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: id_token,
                    "X-APP-Key": process.env.BKASH_APP_KEY,
                },
            }
        );

        const executeData = executeRes.data;

        console.log("bKash execute response:", executeData);

        const completed =
            executeData.transactionStatus === "Completed" ||
            (executeData.trxID && !executeData.errorMessage);

        if (!completed) {
            await Payment.findOneAndUpdate(
                { paymentID },
                { status: "failed", failedAt: new Date() }
            );
            return failRedirect();
        }

        const payment = await Payment.findOneAndUpdate(
            { paymentID },
            {
                status: "success",
                transactionId: executeData.trxID,
                amount: executeData.amount ?? undefined,
                completedAt: new Date(),
            },
            { new: true }
        );

        if (payment?.orderId) {
            await Order.findByIdAndUpdate(payment.orderId, {
                status: "paid",
                paymentStatus: "paid",
            });
        }

        // App expects Mongo payment _id + trxID so PaymentSuccess can call /confirm (idempotent)
        const pid = payment?._id?.toString();
        const trx = encodeURIComponent(executeData.trxID || "");
        if (pid && trx) {
            return res.redirect(
                `${clientOrigin()}/payment/success?paymentId=${pid}&trxID=${trx}`
            );
        }

        return res.redirect(`${clientOrigin()}/payment/success`);
    } catch (error) {
        console.error("bkashCallback:", error?.response?.data || error);
        return res.status(500).json({ message: "Callback error" });
    }
};

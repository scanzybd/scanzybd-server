import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import fetch from "node-fetch";

export const bkashCallback = async (req, res) => {
    try {
        const { paymentID, status } = req.query;

        if (!paymentID) {
            return res.status(400).json({ message: "No paymentID" });
        }

        // ❌ payment failed or cancelled
        if (status !== "success") {
            await Payment.findOneAndUpdate(
                { paymentID },
                { status: "failed", failedAt: new Date() }
            );

            return res.redirect("http://localhost:5173/payment/failed");
        }

        // 🔥 GET TOKEN
        const tokenRes = await fetch(
            "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    username: process.env.BKASH_APP_KEY,
                    password: process.env.BKASH_APP_SECRET,
                },
                body: JSON.stringify({
                    app_key: process.env.BKASH_APP_KEY,
                    app_secret: process.env.BKASH_APP_SECRET,
                }),
            }
        );

        const tokenData = await tokenRes.json();
        const id_token = tokenData.id_token;

        // 🔥 EXECUTE PAYMENT
        const executeRes = await fetch(
            "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/execute",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    authorization: id_token,
                    "x-app-key": process.env.BKASH_APP_KEY,
                },
                body: JSON.stringify({ paymentID }),
            }
        );

        const executeData = await executeRes.json();

        console.log("Execute Response:", executeData);

        // 🔥 SUCCESS CASE
        if (executeData.transactionStatus === "Completed") {
            const payment = await Payment.findOneAndUpdate(
                { paymentID },
                {
                    status: "success",
                    transactionId: executeData.trxID,
                    amount: executeData.amount,
                    completedAt: new Date(),
                },
                { new: true }
            );

            // 🔥 UPDATE ORDER ALSO (IMPORTANT)
            if (payment?.orderId) {
                await Order.findByIdAndUpdate(payment.orderId, {
                    status: "paid",
                    paymentStatus: "paid",
                    transactionId: executeData.trxID,
                });
            }

            return res.redirect(
                "http://localhost:5173/payment/success"
            );
        }

        // ❌ FAILED CASE
        await Payment.findOneAndUpdate(
            { paymentID },
            {
                status: "failed",
                failedAt: new Date(),
            }
        );

        return res.redirect(
            "http://localhost:5173/payment/failed"
        );
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Callback error" });
    }
};
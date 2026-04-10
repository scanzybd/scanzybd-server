import axios from "axios";
import Payment from "../models/Payment.js";
import { grantBkashToken } from "../service/bkash.service.js";

export const bkashCallback = async (req, res) => {
    try {
        const { paymentID, status } = req.query;

        if (!paymentID) {
            return res.status(400).json({ message: "No paymentID" });
        }

        // ❌ if failed বা cancelled
        if (status !== "success") {
            return res.redirect("http://localhost:3000/payment-failed");
        }

        // ✅ Step 1: get token
        const tokenRes = await fetch("https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "username": process.env.BKASH_APP_KEY,
                "password": process.env.BKASH_APP_SECRET,
            },
            body: JSON.stringify({
                app_key: process.env.BKASH_APP_KEY,
                app_secret: process.env.BKASH_APP_SECRET,
            }),
        });

        const tokenData = await tokenRes.json();

        const id_token = tokenData.id_token;

        // ✅ Step 2: execute payment
        const executeRes = await fetch("https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/execute", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "authorization": id_token,
                "x-app-key": process.env.BKASH_APP_KEY,
            },
            body: JSON.stringify({
                paymentID,
            }),
        });

        const executeData = await executeRes.json();

        console.log("Execute Response:", executeData);

        // ✅ Step 3: success হলে DB update
        if (executeData.transactionStatus === "Completed") {
            // এখানে DB update করো
            // await Payment.updateOne(...)

            return res.redirect("http://localhost:3000/payment-success");
        } else {
            return res.redirect("http://localhost:3000/payment-failed");
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Callback error" });
    }
};
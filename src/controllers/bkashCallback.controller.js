import axios from "axios";
import Payment from "../models/Payment.js";
import { grantBkashToken } from "../service/bkash.service.js";

export const bkashCallback = async (req, res) => {
    try {
        const { paymentID, status } = req.query;

        if (status !== "success") {
            return res.redirect(process.env.BKASH_FRONTEND_FAIL_URL);
        }

        const id_token = await grantBkashToken();

        const executeRes = await axios.post(
            process.env.BKASH_EXECUTE_PAYMENT_URL,
            { paymentID },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: id_token,
                    "X-APP-Key": process.env.BKASH_APP_KEY,
                },
            }
        );

        const data = executeRes.data;

        await Payment.findByIdAndUpdate(data.merchantInvoiceNumber, {
            status: "success",
            trxID: data.trxID,
        });

        return res.redirect(process.env.BKASH_FRONTEND_SUCCESS_URL);
    } catch (error) {
        console.log("CALLBACK ERROR:", error.response?.data || error.message);

        return res.redirect(process.env.BKASH_FRONTEND_FAIL_URL);
    }
};
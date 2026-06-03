import Payment from "../models/Payment.js";
import { completeOnlinePayment } from "../utils/paymentCompletion.js";
import {
    clientOrigin,
    validateSslCommerzPayment,
} from "../service/sslcommerz.service.js";

function failRedirect(res) {
    return res.redirect(`${clientOrigin()}/payment/failed`);
}

async function handleSslSuccessPayload(query) {
    const valId = query.val_id;
    const tranId = query.tran_id;

    if (!valId || !tranId) {
        return { ok: false };
    }

    const { valid, data } = await validateSslCommerzPayment(valId);
    if (!valid) {
        return { ok: false };
    }

    const payment = await Payment.findOne({ paymentID: tranId });
    if (!payment) {
        return { ok: false };
    }

    await completeOnlinePayment(payment, {
        transactionId: data.bank_tran_id || data.tran_id || valId,
        amount: data.amount,
    });

    return {
        ok: true,
        payment,
        trx: data.bank_tran_id || data.tran_id || valId,
    };
}

export const sslcommerzSuccess = async (req, res) => {
    try {
        const result = await handleSslSuccessPayload(req.query);
        if (!result.ok) {
            return failRedirect(res);
        }

        const pid = result.payment._id.toString();
        const trx = encodeURIComponent(result.trx || "");
        return res.redirect(
            `${clientOrigin()}/payment/success?paymentId=${pid}&trxID=${trx}`
        );
    } catch (err) {
        console.error("sslcommerzSuccess:", err);
        return failRedirect(res);
    }
};

export const sslcommerzFail = async (req, res) => {
    try {
        const tranId = req.query.tran_id;
        if (tranId) {
            await Payment.findOneAndUpdate(
                { paymentID: tranId },
                { status: "failed", failedAt: new Date() }
            );
        }
        return failRedirect(res);
    } catch (err) {
        console.error("sslcommerzFail:", err);
        return failRedirect(res);
    }
};

export const sslcommerzCancel = async (req, res) => {
    try {
        const tranId = req.query.tran_id;
        if (tranId) {
            await Payment.findOneAndUpdate(
                { paymentID: tranId },
                { status: "failed", failedAt: new Date() }
            );
        }
        return res.redirect(`${clientOrigin()}/user/my-cart`);
    } catch (err) {
        console.error("sslcommerzCancel:", err);
        return failRedirect(res);
    }
};

export const sslcommerzIpn = async (req, res) => {
    try {
        const payload = { ...req.query, ...req.body };
        const result = await handleSslSuccessPayload(payload);
        if (!result.ok) {
            return res.status(400).send("FAILED");
        }
        return res.status(200).send("SUCCESS");
    } catch (err) {
        console.error("sslcommerzIpn:", err);
        return res.status(500).send("ERROR");
    }
};

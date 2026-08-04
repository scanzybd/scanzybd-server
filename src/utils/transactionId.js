import Payment from "../models/Payment.js";

/** Manual bKash: store and match on last 8 alphanumeric characters. */
export function normalizeManualTransactionId(raw) {
    const alnum = String(raw || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    if (alnum.length < 8) {
        const err = new Error("Transaction ID must be at least 8 characters");
        err.statusCode = 400;
        throw err;
    }
    return alnum.slice(-8);
}

export async function assertManualTransactionIdUnique(suffix, excludePaymentId = null) {
    const normalized = String(suffix || "").trim().toUpperCase();
    if (normalized.length !== 8) {
        const err = new Error("Invalid transaction ID");
        err.statusCode = 400;
        throw err;
    }

    const query = {
        status: { $in: ["pending", "success"] },
        transactionId: { $regex: new RegExp(`${normalized}$`, "i") },
    };
    if (excludePaymentId) {
        query._id = { $ne: excludePaymentId };
    }

    const existing = await Payment.findOne(query)
        .populate("orderId", "orderNo")
        .lean();

    if (existing) {
        const orderNo = existing.orderId?.orderNo;
        const err = new Error(
            orderNo
                ? `This transaction ID is already used (Order #${orderNo})`
                : "This transaction ID is already used"
        );
        err.statusCode = 409;
        throw err;
    }

    return normalized;
}

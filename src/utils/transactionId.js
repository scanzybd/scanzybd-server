import Payment from "../models/Payment.js";

export const MANUAL_TRX_MIN_LENGTH = 4;
export const MANUAL_TRX_MAX_LENGTH = 30;

/** Manual payment trx — trimmed alphanumeric, stored as full ID (4–30 chars). */
export function normalizeManualTransactionId(raw) {
    const alnum = String(raw || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    if (alnum.length < MANUAL_TRX_MIN_LENGTH) {
        const err = new Error(
            `Transaction ID must be at least ${MANUAL_TRX_MIN_LENGTH} characters`
        );
        err.statusCode = 400;
        throw err;
    }
    if (alnum.length > MANUAL_TRX_MAX_LENGTH) {
        const err = new Error(
            `Transaction ID must be at most ${MANUAL_TRX_MAX_LENGTH} characters`
        );
        err.statusCode = 400;
        throw err;
    }
    return alnum;
}

export async function assertManualTransactionIdUnique(normalizedId, excludePaymentId = null) {
    const normalized = String(normalizedId || "").trim().toUpperCase();
    if (
        normalized.length < MANUAL_TRX_MIN_LENGTH ||
        normalized.length > MANUAL_TRX_MAX_LENGTH
    ) {
        const err = new Error("Invalid transaction ID");
        err.statusCode = 400;
        throw err;
    }

    const query = {
        status: { $in: ["pending", "success"] },
        transactionId: normalized,
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

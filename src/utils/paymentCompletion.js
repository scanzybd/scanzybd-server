import Order from "../models/Order.js";
import { processOrderPaid } from "./tagSubscription.service.js";

/** Mark payment + order paid and run subscription hooks (idempotent). */
export async function completeOnlinePayment(payment, { transactionId, amount } = {}) {
    if (!payment) return null;

    if (payment.status !== "success") {
        payment.status = "success";
        if (transactionId) payment.transactionId = String(transactionId);
        if (amount != null && !Number.isNaN(Number(amount))) {
            payment.amount = Number(amount);
        }
        payment.completedAt = new Date();
        await payment.save();
    }

    const order = await Order.findById(payment.orderId);
    if (!order) return payment;

    if (String(order.paymentStatus || "").toLowerCase() !== "paid") {
        order.status = "confirmed";
        order.paymentStatus = "paid";
        if (transactionId) order.transactionId = String(transactionId);
        if (payment.paymentMethod) order.paymentMethod = payment.paymentMethod;
        await processOrderPaid(order, payment.completedAt || new Date());
    }

    return payment;
}

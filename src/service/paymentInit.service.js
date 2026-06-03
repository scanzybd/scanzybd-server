import axios from "axios";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import { getBkashIdToken } from "./bkash.service.js";
import { initSslCommerzSession } from "./sslcommerz.service.js";
import { GATEWAYS } from "./paymentGateway.service.js";

export async function createBkashPayment(order, userId) {
    const id_token = await getBkashIdToken();

    const bkashRes = await axios.post(
        process.env.BKASH_CREATE_PAYMENT_URL,
        {
            mode: "0011",
            payerReference: String(userId),
            callbackURL: process.env.BKASH_BACKEND_CALLBACK_URL,
            amount: String(order.totalAmount),
            currency: "BDT",
            intent: "sale",
            merchantInvoiceNumber: `INV-${order.orderNo || order._id}-${Date.now()}`,
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: id_token,
                "X-APP-Key": process.env.BKASH_APP_KEY,
            },
        }
    );

    const bkashData = bkashRes.data;
    if (!bkashData?.paymentID) {
        throw new Error("bKash payment init failed");
    }

    const payment = await Payment.create({
        userId,
        orderId: order._id,
        amount: order.totalAmount,
        paymentMethod: "bkash",
        paymentID: bkashData.paymentID,
        status: "pending",
    });

    return {
        gateway: GATEWAYS.BKASH,
        payment,
        redirectURL: bkashData.bkashURL,
    };
}

export async function createSslCommerzPayment(order, userId) {
    const user = await User.findById(userId).select("name email").lean();

    const payment = await Payment.create({
        userId,
        orderId: order._id,
        amount: order.totalAmount,
        paymentMethod: "sslcommerz",
        paymentID: "",
        status: "pending",
    });

    const tranId = `SZ${String(payment._id)}`;
    payment.paymentID = tranId;
    await payment.save();

    const session = await initSslCommerzSession({
        order,
        payment,
        tranId,
        customer: user,
    });

    return {
        gateway: GATEWAYS.SSLCOMMERZ,
        payment,
        redirectURL: session.GatewayPageURL,
    };
}

export async function createOnlinePayment(order, userId, gateway) {
    if (gateway === GATEWAYS.SSLCOMMERZ) {
        return createSslCommerzPayment(order, userId);
    }
    return createBkashPayment(order, userId);
}

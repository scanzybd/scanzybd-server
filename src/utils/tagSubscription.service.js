import mongoose from "mongoose";
import TagSubscription from "../models/TagSubscription.js";
import QRModel from "../models/QRCode.js";
import Vehicle from "../models/Vehicle.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Counter from "../models/Counter.js";
import { getQrIdsFromVehicle } from "./vehicleQr.js";
import { applyPaidOrderSubscription } from "./orderSubscription.js";

export const ORDER_KIND = {
    PURCHASE: "purchase",
    RENEW_SAME_QR: "renew_same_qr",
    RENEW_NEW_QR: "renew_new_qr",
};

async function nextOrderNo() {
    const row = await Counter.findOneAndUpdate(
        { key: "order_no" },
        { $setOnInsert: { key: "order_no" }, $inc: { seq: 1 } },
        { new: true, upsert: true }
    ).lean();
    return String(row.seq).padStart(5, "0");
}

export async function getProductValidityDays(productId, fallback = 365) {
    if (!productId) return { days: fallback, product: null };
    try {
        const prod = await Product.findById(productId).select("validityDays price title image").lean();
        if (!prod) return { days: fallback, product: null };
        return {
            days: Math.max(1, Number(prod.validityDays) || fallback),
            product: prod,
        };
    } catch {
        return { days: fallback, product: null };
    }
}

function computeWindow(paidAt, days) {
    const start = new Date(paidAt);
    const until = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    return { start, until };
}

/** Whether scan should hide contact data for this QR. */
export async function getQrScanAccess(qr) {
    if (!qr?.isAssigned || !qr.vehicleId) {
        return { allowContact: false, reason: "unassigned", subscription: null };
    }

    const sub = await TagSubscription.findOne({
        qrId: qr._id,
        status: { $in: ["active", "expired", "pending_qr"] },
    })
        .sort({ validUntil: -1 })
        .lean();

    if (!sub) {
        return { allowContact: true, reason: "legacy", subscription: null };
    }

    const now = new Date();
    if (sub.status === "pending_qr") {
        return { allowContact: false, reason: "pending_qr", subscription: sub };
    }
    if (new Date(sub.validUntil) < now || sub.status === "expired") {
        return { allowContact: false, reason: "expired", subscription: sub };
    }
    if (sub.status === "replaced") {
        return { allowContact: false, reason: "replaced", subscription: sub };
    }

    return { allowContact: true, reason: "active", subscription: sub };
}

export async function linkSubscriptionToQr(qrId, vehicleId) {
    const pending = await TagSubscription.findOne({
        vehicleId,
        qrId: null,
        status: "pending_qr",
    }).sort({ createdAt: -1 });

    if (!pending) return null;

    const qr = await QRModel.findById(qrId).lean();
    pending.qrId = qrId;
    pending.qrCode = qr?.code || "";
    pending.status = "active";
    await pending.save();
    return pending;
}

async function upsertSubscriptionForQr({
    qrId,
    qrCode,
    vehicleId,
    userId,
    productId,
    orderId,
    validityDays,
    validFrom,
    validUntil,
    lastRenewMode,
    status = "active",
}) {
    const filter = qrId
        ? { qrId, status: { $in: ["active", "expired", "pending_qr"] } }
        : { vehicleId, orderId, qrId: null, status: "pending_qr" };

    let sub = await TagSubscription.findOne(filter).sort({ createdAt: -1 });

    if (sub) {
        sub.validFrom = validFrom;
        sub.validUntil = validUntil;
        sub.validityDays = validityDays;
        sub.orderId = orderId;
        sub.lastRenewMode = lastRenewMode;
        sub.status = status;
        if (qrId) {
            sub.qrId = qrId;
            sub.qrCode = qrCode || sub.qrCode;
        }
        await sub.save();
        return sub;
    }

    return TagSubscription.create({
        qrId: qrId || null,
        qrCode: qrCode || "",
        vehicleId,
        userId,
        productId: String(productId || ""),
        orderId,
        validityDays,
        validFrom,
        validUntil,
        status: qrId ? status : "pending_qr",
        lastRenewMode,
    });
}

async function syncPurchaseOrderSubscriptions(order, paidAt) {
    const userId = order.userId;
    const assignments = order.tagAssignments || [];
    if (!assignments.length) return;

    for (const tag of assignments) {
        const vehicleId = tag.vehicleId;
        if (!vehicleId) continue;

        const { days } = await getProductValidityDays(tag.productId);
        const { start, until } = computeWindow(paidAt, days);

        const vehicle = await Vehicle.findById(vehicleId).lean();
        const qrIds = vehicle ? getQrIdsFromVehicle(vehicle) : [];

        if (qrIds.length === 0) {
            await upsertSubscriptionForQr({
                qrId: null,
                vehicleId,
                userId,
                productId: tag.productId,
                orderId: order._id,
                validityDays: days,
                validFrom: start,
                validUntil: until,
                lastRenewMode: ORDER_KIND.PURCHASE,
                status: "pending_qr",
            });
            continue;
        }

        for (const qrIdStr of qrIds) {
            const qr = await QRModel.findById(qrIdStr).lean();
            await upsertSubscriptionForQr({
                qrId: qr._id,
                qrCode: qr?.code,
                vehicleId,
                userId,
                productId: tag.productId,
                orderId: order._id,
                validityDays: days,
                validFrom: start,
                validUntil: until,
                lastRenewMode: ORDER_KIND.PURCHASE,
                status: "active",
            });
        }
    }
}

async function renewSameQrSubscription(order, paidAt) {
    const qrId = order.linkedQrId;
    if (!qrId) return;

    const qr = await QRModel.findById(qrId).lean();
    const productId =
        order.items?.[0]?.productId ||
        (await TagSubscription.findOne({ qrId }).sort({ createdAt: -1 }))?.productId;

    const { days } = await getProductValidityDays(productId);
    const { start, until } = computeWindow(paidAt, days);

    await TagSubscription.updateMany(
        { qrId, status: { $in: ["active", "expired"] } },
        { $set: { status: "expired" } }
    );

    await upsertSubscriptionForQr({
        qrId,
        qrCode: qr?.code,
        vehicleId: order.linkedVehicleId || qr?.vehicleId,
        userId: order.userId,
        productId,
        orderId: order._id,
        validityDays: days,
        validFrom: start,
        validUntil: until,
        lastRenewMode: ORDER_KIND.RENEW_SAME_QR,
        status: "active",
    });
}

async function unassignQrById(qrId, vehicleId) {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return;

    const currentIds = getQrIdsFromVehicle(vehicle);
    const target = String(qrId);
    if (!currentIds.includes(target)) return;

    vehicle.qrIds = currentIds
        .filter((id) => String(id) !== target)
        .map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id));
    vehicle.qrData = vehicle.qrIds[0] || null;
    await vehicle.save();

    await QRModel.findByIdAndUpdate(target, {
        $set: { vehicleId: null, isAssigned: false, status: "unassigned" },
        $unset: { assignedBy: "" },
    });
}

async function handleRenewNewQrPaid(order, paidAt) {
    const oldQrId = order.linkedQrId;
    if (oldQrId) {
        await TagSubscription.updateMany(
            { qrId: oldQrId },
            { $set: { status: "replaced", validUntil: paidAt } }
        );
        if (order.linkedVehicleId) {
            await unassignQrById(oldQrId, order.linkedVehicleId);
        }
    }

    for (const tag of order.tagAssignments || []) {
        const { days } = await getProductValidityDays(tag.productId);
        const { start, until } = computeWindow(paidAt, days);
        await upsertSubscriptionForQr({
            qrId: null,
            vehicleId: tag.vehicleId,
            userId: order.userId,
            productId: tag.productId,
            orderId: order._id,
            validityDays: days,
            validFrom: start,
            validUntil: until,
            lastRenewMode: ORDER_KIND.RENEW_NEW_QR,
            status: "pending_qr",
        });
    }
}

/** Called after order is marked paid — does not replace existing order item validity logic. */
export async function processOrderPaid(order, paidAt = new Date()) {
    if (!order) return order;

    const doc = order.save ? order : await Order.findById(order._id);
    if (!doc) return order;

    await applyPaidOrderSubscription(doc, paidAt);

    const kind = String(doc.orderKind || ORDER_KIND.PURCHASE);

    if (kind === ORDER_KIND.RENEW_SAME_QR) {
        await renewSameQrSubscription(doc, paidAt);
    } else if (kind === ORDER_KIND.RENEW_NEW_QR) {
        await handleRenewNewQrPaid(doc, paidAt);
    } else {
        await syncPurchaseOrderSubscriptions(doc, paidAt);
    }

    if (typeof doc.save === "function") {
        await doc.save();
    }

    return doc;
}

export async function createRenewOrder({ userId, qrId, mode }) {
    const qr = await QRModel.findById(qrId).lean();
    if (!qr?.vehicleId) {
        throw new Error("QR is not linked to a vehicle");
    }

    const vehicle = await Vehicle.findById(qr.vehicleId).lean();
    if (!vehicle || String(vehicle.owner) !== String(userId)) {
        throw new Error("You do not own this QR tag");
    }

    const existingSub = await TagSubscription.findOne({ qrId: qr._id })
        .sort({ validUntil: -1 })
        .lean();

    const productId =
        existingSub?.productId ||
        (await TagSubscription.findOne({ vehicleId: vehicle._id }).sort({ createdAt: -1 }))
            ?.productId;

    const { days, product } = await getProductValidityDays(productId);
    const price = Number(product?.price) || 0;
    if (price <= 0) {
        throw new Error("Product price not found for renewal");
    }

    const title = product?.title
        ? `${product.title} (Renewal)`
        : "QR Tag Renewal";

    const items = [
        {
            productId: String(productId || product?._id || ""),
            title,
            image: product?.image || "",
            price,
            quantity: 1,
            validityDays: days,
        },
    ];

    let tagAssignments = [];
    let shippingAddress = {
        fullName: "Renewal",
        phone: vehicle.ownerPhone || "01000000000",
        line1: "Renewal order",
        union: "N/A",
        upazila: "N/A",
        city: "N/A",
        district: "N/A",
    };

    const lastOrder = await Order.findOne({
        userId,
        paymentStatus: "paid",
        "shippingAddress.phone": { $exists: true },
    })
        .sort({ createdAt: -1 })
        .lean();

    if (lastOrder?.shippingAddress?.phone) {
        shippingAddress = { ...lastOrder.shippingAddress };
    }

    if (mode === ORDER_KIND.RENEW_NEW_QR) {
        tagAssignments = [
            {
                productId: String(productId || ""),
                productTitle: product?.title || title,
                vehicleId: vehicle._id,
            },
        ];
    }

    const order = await Order.create({
        userId,
        orderNo: await nextOrderNo(),
        orderKind: mode,
        linkedQrId: qr._id,
        linkedVehicleId: vehicle._id,
        items,
        tagAssignments,
        shippingAddress,
        totalAmount: price,
        status: "pending",
        paymentStatus: "unpaid",
    });

    return order;
}

import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Vehicle from "../models/Vehicle.js";
import TagSubscription from "../models/TagSubscription.js";

export const UNPAID_ORDER_EXPIRE_DAYS = 7;
export const UNPAID_ORDER_EXPIRE_MS =
    UNPAID_ORDER_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

const RENEWAL_ORDER_KINDS = new Set(["renew_same_qr", "renew_new_qr"]);

export function isPurchaseOrderKind(order) {
    const kind = String(order?.orderKind || "purchase").toLowerCase();
    return !RENEWAL_ORDER_KINDS.has(kind);
}

export function unpaidOrderCutoffDate(now = Date.now()) {
    return new Date(now - UNPAID_ORDER_EXPIRE_MS);
}

export function isExpiredUnpaidOrder(order, now = Date.now()) {
    if (!order?.createdAt) return false;
    return new Date(order.createdAt).getTime() <= now - UNPAID_ORDER_EXPIRE_MS;
}

export async function hasPendingPayment(orderId) {
    const pending = await Payment.findOne({
        orderId,
        status: "pending",
    })
        .select("_id")
        .lean();
    return Boolean(pending);
}

/** Returns { ok, message } — whether an abandoned purchase order may be hard-deleted. */
export async function canAdminDeleteOrder(order) {
    const pay = String(order.paymentStatus || "").toLowerCase();
    if (pay === "paid") {
        return { ok: false, message: "Paid orders cannot be deleted" };
    }
    if (pay !== "unpaid" && pay !== "failed") {
        return {
            ok: false,
            message: "Only unpaid or failed orders can be deleted",
        };
    }
    if (!isPurchaseOrderKind(order)) {
        return {
            ok: false,
            message: "Renewal orders cannot be deleted",
        };
    }
    if (!isExpiredUnpaidOrder(order)) {
        return {
            ok: false,
            message: `Order must be at least ${UNPAID_ORDER_EXPIRE_DAYS} days old before deletion`,
        };
    }
    if (await hasPendingPayment(order._id)) {
        return {
            ok: false,
            message: "Cannot delete: a payment is still pending for this order",
        };
    }
    return { ok: true };
}

export async function deleteVehiclesCreatedForOrder(order) {
    if (!order?.tagAssignments?.length) return [];

    const orderId = order._id;
    const removed = [];

    for (const tag of order.tagAssignments) {
        const vehicleId = tag?.vehicleId;
        if (!vehicleId || !mongoose.Types.ObjectId.isValid(String(vehicleId))) {
            continue;
        }

        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) continue;

        if (String(vehicle.sourceOrderId || "") !== String(orderId)) {
            continue;
        }

        const qrCount = Array.isArray(vehicle.qrIds)
            ? vehicle.qrIds.filter(Boolean).length
            : 0;
        if (qrCount > 0) continue;

        await Vehicle.findByIdAndDelete(vehicle._id);
        removed.push(vehicle._id);
    }

    return removed;
}

export async function deleteOrderAndPayments(orderOrId) {
    const order =
        orderOrId?.tagAssignments != null
            ? orderOrId
            : await Order.findById(orderOrId).lean();

    if (!order) return { deleted: false };

    const orderId = order._id;

    await Payment.deleteMany({ orderId });
    await TagSubscription.deleteMany({ orderId });
    const vehiclesRemoved = await deleteVehiclesCreatedForOrder(order);
    await Order.findByIdAndDelete(orderId);

    return {
        deleted: true,
        orderId,
        vehiclesRemoved,
    };
}

export async function linkVehiclesToSourceOrder(orderId, vehicleIds = []) {
    const ids = [...new Set(vehicleIds.map((id) => String(id)).filter(Boolean))];
    if (!ids.length || !mongoose.Types.ObjectId.isValid(String(orderId))) {
        return 0;
    }

    const result = await Vehicle.updateMany(
        { _id: { $in: ids } },
        { $set: { sourceOrderId: orderId } }
    );
    return result.modifiedCount ?? 0;
}

export function abandonedPurchaseOrderQuery(now = Date.now()) {
    return {
        paymentStatus: { $in: ["unpaid", "failed"] },
        createdAt: { $lte: unpaidOrderCutoffDate(now) },
        $or: [
            { orderKind: "purchase" },
            { orderKind: { $exists: false } },
            { orderKind: null },
        ],
    };
}

/** Cron / batch purge of abandoned checkout orders (purchase only). */
export async function purgeAbandonedUnpaidOrders({ limit = 200 } = {}) {
    const candidates = await Order.find(abandonedPurchaseOrderQuery())
        .sort({ createdAt: 1 })
        .limit(limit);

    const deleted = [];
    const skipped = [];

    for (const order of candidates) {
        const guard = await canAdminDeleteOrder(order);
        if (!guard.ok) {
            skipped.push({
                orderId: order._id,
                orderNo: order.orderNo,
                message: guard.message,
            });
            continue;
        }

        const result = await deleteOrderAndPayments(order);
        deleted.push({
            orderId: order._id,
            orderNo: order.orderNo,
            vehiclesRemoved: result.vehiclesRemoved?.length ?? 0,
        });
    }

    return {
        scanned: candidates.length,
        deletedCount: deleted.length,
        skippedCount: skipped.length,
        deleted,
        skipped,
    };
}

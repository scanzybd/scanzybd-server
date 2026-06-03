import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import TagSubscription from "../models/TagSubscription.js";
import { applyPaidOrderSubscription } from "./orderSubscription.js";
import {
    ORDER_KIND,
    processOrderPaid,
} from "./tagSubscription.service.js";

/** Infer productId for legacy order lines (cart saved only `_id`, stripped by schema). */
export function inferProductIdForOrderItem(order, itemIndex = 0) {
    const item = order?.items?.[itemIndex];
    if (!item) return "";

    const direct = String(item.productId || item._id || "").trim();
    if (direct) return direct;

    const tags = order.tagAssignments || [];
    if (tags.length === 1) {
        return String(tags[0].productId || "").trim();
    }
    if (tags[itemIndex]?.productId) {
        return String(tags[itemIndex].productId).trim();
    }
    return String(tags[0]?.productId || "").trim();
}

/** Fill missing productId on order.items only — does not touch validUntil. */
export function ensureOrderItemProductIds(order) {
    if (!order?.items?.length) return false;

    let changed = false;
    for (let i = 0; i < order.items.length; i++) {
        const current = String(order.items[i].productId || "").trim();
        if (current) continue;

        const inferred = inferProductIdForOrderItem(order, i);
        if (!inferred) continue;

        order.items[i].productId = inferred;
        changed = true;
    }

    if (changed && typeof order.markModified === "function") {
        order.markModified("items");
    }
    return changed;
}

export function orderNeedsItemValidityBackfill(order) {
    if (String(order.paymentStatus || "").toLowerCase() !== "paid") return false;
    if (!order.items?.length) return false;
    return order.items.some((item) => !item.validUntil);
}

export async function getOrderPaidAt(order) {
    const payment = await Payment.findOne({
        orderId: order._id,
        status: "success",
    })
        .sort({ completedAt: -1, createdAt: -1 })
        .lean();

    if (payment?.completedAt) return new Date(payment.completedAt);
    if (payment?.createdAt) return new Date(payment.createdAt);

    return new Date(order.updatedAt || order.createdAt || Date.now());
}

export async function orderNeedsTagSubscriptionBackfill(order) {
    if (String(order.paymentStatus || "").toLowerCase() !== "paid") return false;
    if (!order.tagAssignments?.length) return false;

    const count = await TagSubscription.countDocuments({ orderId: order._id });
    return count === 0;
}

/**
 * Safe backfill for one paid order: productId on lines, validFrom/until, TagSubscription.
 * Skips lines that already have validUntil. Skips tag sync if subscriptions already exist for order.
 */
export async function backfillLegacyOrder(orderDoc, options = {}) {
    const { dryRun = true } = options;

    const order =
        orderDoc?.save && typeof orderDoc.toObject === "function"
            ? orderDoc
            : await Order.findById(orderDoc._id || orderDoc);

    if (!order) {
        return { ok: false, reason: "order_not_found" };
    }

    if (String(order.paymentStatus || "").toLowerCase() !== "paid") {
        return { ok: false, reason: "not_paid", orderNo: order.orderNo };
    }

    const needsItems = orderNeedsItemValidityBackfill(order);
    const needsProductIds = order.items?.some(
        (item) => !String(item.productId || "").trim()
    );
    const needsTags = await orderNeedsTagSubscriptionBackfill(order);

    if (!needsItems && !needsProductIds && !needsTags) {
        return {
            ok: true,
            skipped: true,
            orderNo: order.orderNo,
            reason: "already_complete",
        };
    }

    const paidAt = await getOrderPaidAt(order);
    const plan = {
        orderNo: order.orderNo,
        orderId: String(order._id),
        paidAt: paidAt.toISOString(),
        needsProductIds: Boolean(needsProductIds),
        needsItemValidity: Boolean(needsItems),
        needsTagSubscriptions: Boolean(needsTags),
        dryRun,
    };

    if (dryRun) {
        return { ok: true, dryRun: true, plan };
    }

    ensureOrderItemProductIds(order);

    if (needsTags) {
        await processOrderPaid(order, paidAt);
    } else if (needsItems) {
        await applyPaidOrderSubscription(order, paidAt);
    } else if (needsProductIds) {
        await order.save();
    }

    return { ok: true, dryRun: false, plan, applied: true };
}

export async function findLegacyPaidOrders(filter = {}) {
    const base = {
        paymentStatus: "paid",
        ...filter,
    };

    const orders = await Order.find(base).sort({ createdAt: -1 }).lean();
    const out = [];

    for (const order of orders) {
        const needsItems = orderNeedsItemValidityBackfill(order);
        const needsProductIds = order.items?.some(
            (item) => !String(item.productId || "").trim()
        );
        const needsTags = await orderNeedsTagSubscriptionBackfill(order);

        if (needsItems || needsProductIds || needsTags) {
            out.push(order);
        }
    }

    return out;
}

export async function backfillLegacyOrders(options = {}) {
    const {
        dryRun = true,
        orderNo = null,
        orderId = null,
        limit = 500,
    } = options;

    const filter = {};
    if (orderNo) {
        const normalized = String(orderNo).replace(/^#/, "").trim();
        const padded = /^\d+$/.test(normalized)
            ? normalized.padStart(5, "0")
            : normalized;
        filter.$or = [{ orderNo: normalized }, { orderNo: padded }];
    }
    if (orderId) {
        filter._id = orderId;
    }

    const candidates = await findLegacyPaidOrders(filter);
    const slice = candidates.slice(0, limit);
    const results = [];

    for (const row of slice) {
        const order = await Order.findById(row._id);
        const result = await backfillLegacyOrder(order, { dryRun });
        results.push(result);
    }

    return {
        dryRun,
        totalCandidates: candidates.length,
        processed: results.length,
        results,
    };
}

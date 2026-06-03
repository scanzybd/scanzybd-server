import Product from "../models/Product.js";

/** Set validFrom / validUntil on order line items when payment succeeds. */
export async function applyPaidOrderSubscription(order, paidAt = new Date()) {
    if (!order?.items?.length) return order;

    const start = new Date(paidAt);
    let changed = false;

    for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        if (item.validUntil) continue;

        let days = Number(item.validityDays);
        if (!Number.isFinite(days) || days < 1) {
            try {
                const prod = await Product.findById(item.productId)
                    .select("validityDays")
                    .lean();
                days = Math.max(1, Number(prod?.validityDays) || 365);
            } catch {
                days = 365;
            }
        }

        const qty = Math.max(1, Number(item.quantity) || 1);
        const until = new Date(start.getTime() + days * qty * 24 * 60 * 60 * 1000);

        order.items[i].validityDays = days;
        order.items[i].validFrom = start;
        order.items[i].validUntil = until;
        changed = true;
    }

    if (changed) {
        order.markModified("items");
        await order.save();
    }

    return order;
}

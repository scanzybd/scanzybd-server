export const CART_EXPIRE_DAYS = 7;
export const CART_EXPIRE_MS = CART_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

export function cartActivityCutoff(now = Date.now()) {
    return new Date(now - CART_EXPIRE_MS);
}

export function isStaleCart(cart, now = Date.now()) {
    if (!cart?.lastActivityAt) return true;
    return new Date(cart.lastActivityAt).getTime() <= now - CART_EXPIRE_MS;
}

export async function purgeStaleCarts({ limit = 500 } = {}) {
    const Cart = (await import("../models/Cart.js")).default;
    const cutoff = cartActivityCutoff();
    const stale = await Cart.find({
        lastActivityAt: { $lte: cutoff },
    })
        .select("_id")
        .limit(Math.max(1, Number(limit) || 500))
        .lean();

    if (!stale.length) {
        return { deleted: 0, cutoff };
    }

    const result = await Cart.deleteMany({
        _id: { $in: stale.map((c) => c._id) },
    });

    return { deleted: result.deletedCount || 0, cutoff };
}

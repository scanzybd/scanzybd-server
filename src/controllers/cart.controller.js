import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import { isStaleCart, purgeStaleCarts } from "../utils/cartPolicy.js";

function normalizeCartItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = raw.productId ?? raw._id ?? raw.id;
    const idStr = id != null ? String(id).trim() : "";
    if (!idStr || !mongoose.Types.ObjectId.isValid(idStr)) return null;

    return {
        productId: new mongoose.Types.ObjectId(idStr),
        title: String(raw.title || "").trim(),
        price: Number(raw.price) || 0,
        quantity: Math.max(1, Number(raw.quantity) || 1),
        validityDays:
            raw.validityDays != null ? Number(raw.validityDays) : undefined,
        image: raw.image || raw.imageUrl || null,
        type: raw.type != null ? String(raw.type) : null,
        isActive: raw.isActive !== false,
    };
}

function itemsForClient(items = []) {
    return items.map((item) => {
        const doc = item.toObject ? item.toObject() : item;
        const pid = doc.productId ? String(doc.productId) : "";
        return {
            ...doc,
            _id: pid,
            productId: pid,
        };
    });
}

async function findActiveCart(userId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) return null;
    if (isStaleCart(cart)) {
        await Cart.deleteOne({ _id: cart._id });
        return null;
    }
    return cart;
}

export const getCart = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const cart = await findActiveCart(userId);
        res.json({
            success: true,
            items: cart ? itemsForClient(cart.items) : [],
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const putCart = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
        const items = rawItems.map(normalizeCartItem).filter(Boolean);

        const cart = await Cart.findOneAndUpdate(
            { userId },
            { items, lastActivityAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json({
            success: true,
            items: itemsForClient(cart.items),
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const deleteCart = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        await Cart.deleteOne({ userId });
        res.json({ success: true, items: [] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const purgeStaleCartsCron = async (req, res) => {
    try {
        const expected = String(process.env.CRON_SECRET || "").trim();
        const provided = String(
            req.headers["x-cron-secret"] ||
                req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
                ""
        ).trim();

        if (!expected || provided !== expected) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const result = await purgeStaleCarts();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

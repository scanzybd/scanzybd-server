import mongoose from "mongoose";
import Product from "../models/Product.js";

/**
 * Resolve cart lines from the database — ignores client-sent price/title.
 * @throws {{ statusCode: number, message: string }}
 */
export async function resolveOrderLineItems(cartItems) {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        const err = new Error("Cart is empty");
        err.statusCode = 400;
        throw err;
    }

    const lineInputs = [];
    for (const raw of cartItems) {
        const productId = String(raw?.productId || raw?._id || "").trim();
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            const err = new Error("Invalid product in cart");
            err.statusCode = 400;
            throw err;
        }
        lineInputs.push({
            productId,
            quantity: Math.max(1, Number(raw.quantity) || 1),
        });
    }

    const uniqueIds = [...new Set(lineInputs.map((l) => l.productId))];
    const products = await Product.find({ _id: { $in: uniqueIds } }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const items = [];
    let totalAmount = 0;

    for (const { productId, quantity } of lineInputs) {
        const product = productMap.get(productId);
        if (!product || product.isActive === false) {
            const err = new Error("One or more products are not available");
            err.statusCode = 400;
            throw err;
        }
        if (product.inStock === false) {
            const err = new Error(`${product.title} is out of stock`);
            err.statusCode = 400;
            throw err;
        }

        const price = Number(product.price);
        if (Number.isNaN(price) || price < 0) {
            const err = new Error(`Invalid catalog price for ${product.title}`);
            err.statusCode = 400;
            throw err;
        }

        totalAmount += price * quantity;

        items.push({
            productId,
            title: product.title,
            image: product.image || "",
            price,
            quantity,
            validityDays:
                product.validityDays != null
                    ? Number(product.validityDays)
                    : undefined,
            type: product.type != null ? String(product.type) : null,
        });
    }

    return { items, totalAmount };
}

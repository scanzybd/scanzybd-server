import Order from "../models/Order.js";
import Product from "../models/Product.js";

/** Product _id strings for items this provider added to the catalog */
const providerProductIds = async (email) => {
    const rows = await Product.find({
        "createdBy.email": email,
    })
        .select("_id")
        .lean();
    return rows.map((r) => r._id.toString());
};

const providerOrderQuery = async (req, extra = {}) => {
    if (req.user.role === "admin") {
        return extra;
    }
    const ids = await providerProductIds(req.user.email);
    if (ids.length === 0) {
        return null;
    }
    return {
        ...extra,
        "items.productId": { $in: ids },
    };
};


export const createOrder = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { cartItems, amount } = req.body;

        const order = await Order.create({
            userId: userId,   // ✅ FIXED
            items: cartItems,
            totalAmount: amount,
            status: "pending",
            paymentStatus: "unpaid",
        });

        res.status(201).json({
            success: true,
            orderId: order._id,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Order creation failed" });
    }
};



// GET ALL ORDERS — admin: all; provider: orders that include their products
export const getAllOrders = async (req, res) => {
    try {
        const q = await providerOrderQuery(req, {});
        if (q === null) {
            return res.json([]);
        }
        const orders = await Order.find(q)
            .populate("userId")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getPendingOrders = async (req, res) => {
    try {
        const q = await providerOrderQuery(req, { status: "pending" });
        if (q === null) {
            return res.json([]);
        }
        const orders = await Order.find(q).sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getCompletedOrders = async (req, res) => {
    try {
        const q = await providerOrderQuery(req, { status: "paid" });
        if (q === null) {
            return res.json([]);
        }
        const orders = await Order.find(q)
            .populate("userId")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getCancelledOrders = async (req, res) => {
    try {
        const q = await providerOrderQuery(req, { status: "cancelled" });
        if (q === null) {
            return res.json([]);
        }
        const orders = await Order.find(q).sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



export const getMyOrders = async (req, res) => {
    try {
        console.log("REQ USER:", req.user);

        const userId = req.user?._id || req.user?.id;

        console.log("USER ID:", userId);

        const orders = await Order.find({
            userId: userId, // ✅ FIXED
        });

        console.log("ORDERS:", orders);

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
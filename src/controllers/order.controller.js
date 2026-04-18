import Order from "../models/Order.js";
import Payment from "../models/Payment.js";


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



// GET ALL ORDERS (admin use)
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("userId")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
export const getPendingOrders = async (req, res) => {
    const orders = await Order.find({ status: "pending" })
        .sort({ createdAt: -1 });

    res.json(orders);
};

export const getCompletedOrders = async (req, res) => {
    const orders = await Order.find({ status: "paid" })
        .sort({ createdAt: -1 });

    res.json(orders);
};

export const getCancelledOrders = async (req, res) => {
    const orders = await Order.find({ status: "cancelled" })
        .sort({ createdAt: -1 });

    res.json(orders);
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
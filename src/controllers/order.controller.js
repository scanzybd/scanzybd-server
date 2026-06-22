import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import Vehicle from "../models/Vehicle.js";
import Counter from "../models/Counter.js";
import {
    canAdminDeleteOrder,
    deleteOrderAndPayments,
    linkVehiclesToSourceOrder,
} from "../utils/unpaidOrderPolicy.js";
import { resolveOrderLineItems } from "../utils/orderCartValidation.js";

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const nextOrderNo = async () => {
    const row = await Counter.findOneAndUpdate(
        { key: "order_no" },
        {
            // Do not set and increment same path in one update (Mongo conflict).
            $setOnInsert: { key: "order_no" },
            $inc: { seq: 1 },
        },
        {
            new: true,
            upsert: true,
        }
    ).lean();

    return String(row.seq).padStart(5, "0");
};

/** Product _id strings for items this provider added to the catalog */
const providerProductIds = async (email) => {
    const rows = await Product.find({
        "createdBy.email": email,
    })
        .select("_id")
        .lean();
    return rows.map((r) => r._id.toString());
};

/** Orders that include at least one product this provider added to the catalog. */
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

        const { cartItems, tagAssignments: rawSlots, shippingAddress: ship } = req.body;

        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        let items;
        let totalAmount;
        try {
            ({ items, totalAmount } = await resolveOrderLineItems(cartItems));
        } catch (validationErr) {
            const status = validationErr.statusCode || 400;
            return res.status(status).json({ message: validationErr.message });
        }

        const shippingAddress = {
            fullName: String(ship?.fullName || "").trim(),
            phone: String(ship?.phone || "").trim(),
            line1: String(ship?.line1 || "").trim(),
            line2: String(ship?.line2 || "").trim(),
            union: String(ship?.union || "").trim(),
            upazila: String(ship?.upazila || "").trim(),
            city: String(ship?.city || "").trim(),
            district: String(ship?.district || "").trim(),
            postalCode: String(ship?.postalCode || "").trim(),
        };

        if (
            !shippingAddress.fullName ||
            !shippingAddress.phone ||
            !shippingAddress.union ||
            !shippingAddress.upazila ||
            !shippingAddress.city
        ) {
            return res.status(400).json({
                message:
                    "Delivery address required: full name, phone, union/ward, upazila, and district.",
            });
        }

        if (!/^\d{11}$/.test(shippingAddress.phone)) {
            return res.status(400).json({
                message: "Delivery address phone must be exactly 11 digits.",
            });
        }

        const totalQty = items.reduce(
            (sum, i) => sum + Math.max(1, Number(i.quantity) || 1),
            0
        );

        if (!Array.isArray(rawSlots) || rawSlots.length !== totalQty) {
            return res.status(400).json({
                message:
                    "Provide vehicle details for each tag — count must match total items in cart.",
            });
        }

        const tagAssignments = [];
        const newVehicleIds = [];

        for (let i = 0; i < rawSlots.length; i++) {
            const slot = rawSlots[i];
            const model = String(slot.model || "").trim();
            const tagType = String(slot.tagType || "").trim();
            const plateRaw = String(slot.plate || "").trim();
            const chassisLast4 = String(slot.chassisLast4 || "").trim();
            const engineLast4 = String(slot.engineLast4 || "").trim();
            const ownerPhone = String(slot.ownerPhone || "").trim();
            const emergencyPhone = String(slot.emergencyPhone || "").trim();
            const ownerContactVisible = slot.ownerContactVisible !== false;
            const driverContactVisible = slot.driverContactVisible !== false;
            const emergencyContactVisible = Boolean(slot.emergencyContactVisible);
            const productId = String(slot.productId || "").trim();
            const productTitle = String(slot.productTitle || "").trim();
            const vehicleName = String(slot.productTitle || "Vehicle").trim();

            if (!plateRaw || !ownerPhone || !emergencyPhone || !productId) {
                return res.status(400).json({
                    message: `Tag ${i + 1}: fill plate, owner phone, and emergency phone.`,
                });
            }

            if (chassisLast4 && !/^\d{4}$/.test(chassisLast4)) {
                return res.status(400).json({
                    message: `Tag ${i + 1}: chassis last 4 digits must be exactly 4 numbers.`,
                });
            }
            if (engineLast4 && !/^\d{4}$/.test(engineLast4)) {
                return res.status(400).json({
                    message: `Tag ${i + 1}: engine last 4 digits must be exactly 4 numbers.`,
                });
            }

            if (!/^\d{11}$/.test(ownerPhone)) {
                return res.status(400).json({
                    message: `Tag ${i + 1}: owner phone must be exactly 11 digits.`,
                });
            }

            if (!/^\d{11}$/.test(emergencyPhone)) {
                return res.status(400).json({
                    message: `Tag ${i + 1}: emergency phone must be exactly 11 digits.`,
                });
            }

            let driver;
            if (slot.driver?.name?.trim() && slot.driver?.phone?.trim()) {
                const driverPhone = String(slot.driver.phone).trim();
                if (!/^\d{11}$/.test(driverPhone)) {
                    return res.status(400).json({
                        message: `Tag ${i + 1}: driver phone must be exactly 11 digits.`,
                    });
                }
                driver = {
                    name: slot.driver.name.trim(),
                    phone: driverPhone,
                };
            }

            const plate = plateRaw.toUpperCase();

            let vehicle = await Vehicle.findOne({
                owner: userId,
                plate,
            });

            if (!vehicle) {
                vehicle = await Vehicle.create({
                    vehicleName,
                    model,
                    tagType,
                    plate,
                    chassisLast4: chassisLast4 || undefined,
                    engineLast4: engineLast4 || undefined,
                    ownerPhone,
                    emergencyPhone,
                    ownerContactVisible,
                    driverContactVisible,
                    emergencyContactVisible,
                    driver,
                    owner: userId,
                    addedBy: null,
                    qrIds: [],
                    qrData: null,
                });
                newVehicleIds.push(vehicle._id);
            } else {
                vehicle.model = model;
                if (tagType) vehicle.tagType = tagType;
                vehicle.ownerPhone = ownerPhone;
                vehicle.emergencyPhone = emergencyPhone;
                if (chassisLast4) vehicle.chassisLast4 = chassisLast4;
                if (engineLast4) vehicle.engineLast4 = engineLast4;
                vehicle.ownerContactVisible = ownerContactVisible;
                vehicle.driverContactVisible = driverContactVisible;
                vehicle.emergencyContactVisible = emergencyContactVisible;
                if (driver) {
                    vehicle.driver = driver;
                }
                await vehicle.save();
            }

            tagAssignments.push({
                productId,
                productTitle,
                vehicleId: vehicle._id,
            });
        }

        const order = await Order.create({
            userId,
            orderNo: await nextOrderNo(),
            items,
            tagAssignments,
            shippingAddress,
            totalAmount,
            status: "pending",
            paymentStatus: "unpaid",
        });

        await linkVehiclesToSourceOrder(order._id, newVehicleIds);

        res.status(201).json({
            success: true,
            orderId: order._id,
            orderNo: order.orderNo,
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || "Order creation failed",
        });
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
        const { from, to } = req.query;
        const filter = { status: { $in: ["confirmed", "paid"] } };
        if (from || to) {
            const createdAt = {};
            if (from) {
                createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
            }
            if (to) {
                createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
            }
            filter.createdAt = createdAt;
        }

        const q = await providerOrderQuery(req, filter);
        if (q === null) {
            return res.json([]);
        }
        const orders = await Order.find(q)
            .populate("userId")
            .populate({
                path: "tagAssignments.vehicleId",
                select: "plate vehicleName model qrIds",
                populate: { path: "qrIds", select: "code status isAssigned" },
            })
            .sort({ createdAt: -1 })
            .lean();

        const productIds = new Set();
        for (const order of orders) {
            for (const tag of order.tagAssignments || []) {
                const pid = String(tag.productId || "").trim();
                if (pid && isObjectId(pid)) productIds.add(pid);
            }
        }

        const typeByProductId = new Map();
        if (productIds.size > 0) {
            const products = await Product.find({
                _id: { $in: [...productIds] },
            })
                .select("type title")
                .lean();
            for (const p of products) {
                typeByProductId.set(String(p._id), p.type || p.title || "");
            }
        }

        for (const order of orders) {
            for (const tag of order.tagAssignments || []) {
                const pid = String(tag.productId || "").trim();
                tag.tagType = typeByProductId.get(pid) || "";
            }
        }

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getShippedOrders = async (req, res) => {
    try {
        const q = await providerOrderQuery(req, { status: "shipped" });
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

export const getDeliveredOrders = async (req, res) => {
    try {
        const q = await providerOrderQuery(req, { status: "delivered" });
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

export const getReturnedOrders = async (req, res) => {
    try {
        const q = await providerOrderQuery(req, { status: "returned" });
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



/** DELETE /api/order/my-orders/:orderId — owner may remove unpaid orders */
export const deleteMyUnpaidOrder = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: "Invalid order id" });
        }

        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const guard = await canAdminDeleteOrder(order);
        if (!guard.ok) {
            return res.status(400).json({ message: guard.message });
        }

        await deleteOrderAndPayments(order);

        res.json({ success: true, message: "Order deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getMyOrders = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = { userId, paymentStatus: "paid" };

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(filter),
        ]);

        res.json({
            success: true,
            orders,
            total,
            page,
            limit,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const nextStatus = String(req.body?.status || "").trim().toLowerCase();
        const allowedStatuses = ["confirmed", "shipped", "delivered", "returned", "cancelled"];

        if (!allowedStatuses.includes(nextStatus)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const q = await providerOrderQuery(req, { _id: id });
        if (q === null) {
            return res.status(404).json({ message: "Order not found" });
        }

        const updated = await Order.findOneAndUpdate(
            q,
            { status: nextStatus },
            { new: true }
        ).populate("userId");

        if (!updated) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.json({
            success: true,
            message: "Order status updated",
            order: updated,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Vehicle from "../models/Vehicle.js";

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

        const { cartItems, amount, tagAssignments: rawSlots, shippingAddress: ship } = req.body;

        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        const shippingAddress = {
            fullName: String(ship?.fullName || "").trim(),
            phone: String(ship?.phone || "").trim(),
            line1: String(ship?.line1 || "").trim(),
            line2: String(ship?.line2 || "").trim(),
            city: String(ship?.city || "").trim(),
            district: String(ship?.district || "").trim(),
            postalCode: String(ship?.postalCode || "").trim(),
        };

        if (
            !shippingAddress.fullName ||
            !shippingAddress.phone ||
            !shippingAddress.line1 ||
            !shippingAddress.city
        ) {
            return res.status(400).json({
                message:
                    "Delivery address required: full name, phone, address line, and city.",
            });
        }

        const totalQty = cartItems.reduce(
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

        for (let i = 0; i < rawSlots.length; i++) {
            const slot = rawSlots[i];
            const vehicleName = String(slot.vehicleName || "").trim();
            const model = String(slot.model || "").trim();
            const plateRaw = String(slot.plate || "").trim();
            const ownerPhone = String(slot.ownerPhone || "").trim();
            const productId = String(slot.productId || "").trim();
            const productTitle = String(slot.productTitle || "").trim();

            if (!vehicleName || !model || !plateRaw || !ownerPhone || !productId) {
                return res.status(400).json({
                    message: `Tag ${i + 1}: fill vehicle name, model, plate, and owner phone.`,
                });
            }

            let driver;
            if (slot.driver?.name?.trim() && slot.driver?.phone?.trim()) {
                driver = {
                    name: slot.driver.name.trim(),
                    phone: slot.driver.phone.trim(),
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
                    plate,
                    ownerPhone,
                    driver,
                    owner: userId,
                    addedBy: null,
                    qrData: null,
                });
            } else if (driver) {
                vehicle.driver = driver;
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
            items: cartItems,
            tagAssignments,
            shippingAddress,
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
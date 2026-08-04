import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Product from "../models/Product.js";
import SettlementRequest from "../models/SettlementRequest.js";
import Counter from "../models/Counter.js";
import { processOrderPaid } from "../utils/tagSubscription.service.js";
import { createOnlinePayment } from "../service/paymentInit.service.js";
import {
    GATEWAYS,
    getPublicPaymentGateways,
    resolveGateway,
} from "../service/paymentGateway.service.js";
import {
    canAdminDeleteOrder,
    deleteOrderAndPayments,
    linkVehiclesToSourceOrder,
    purgeAbandonedUnpaidOrders,
    unpaidOrderCutoffDate,
} from "../utils/unpaidOrderPolicy.js";
import { resolveOrderLineItems } from "../utils/orderCartValidation.js";
import {
    assertManualTransactionIdUnique,
    normalizeManualTransactionId,
} from "../utils/transactionId.js";

const nextOrderNo = async () => {
    const row = await Counter.findOneAndUpdate(
        { key: "order_no" },
        {
            $setOnInsert: { key: "order_no" },
            $inc: { seq: 1 },
        },
        { new: true, upsert: true }
    ).lean();
    return String(row.seq).padStart(5, "0");
};

const staffRole = (req) =>
    String(req.user?.role || "").trim().toLowerCase();

async function initOnlinePaymentForOrder(order, customerUserId, gateway) {
    const gw = await resolveGateway(gateway);
    const result = await createOnlinePayment(order, customerUserId, gw);
    return result.redirectURL;
}

/** Same vehicle/tag logic as user checkout — owner is customer, addedBy is staff. */
async function buildTagAssignmentsForCustomer(userId, staffId, rawSlots = []) {
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

        if (!model || !plateRaw || !ownerPhone || !emergencyPhone || !productId) {
            const err = new Error(
                `Tag ${i + 1}: fill manufacture year, plate, owner phone, and emergency phone.`
            );
            err.statusCode = 400;
            throw err;
        }

        const isCyclePlate = !chassisLast4 && !engineLast4;
        if (!isCyclePlate) {
            if (!/^\d{4}$/.test(chassisLast4) || !/^\d{4}$/.test(engineLast4)) {
                const err = new Error(
                    `Tag ${i + 1}: chassis and engine last 4 digits must be exactly 4 numbers.`
                );
                err.statusCode = 400;
                throw err;
            }
        }

        if (!/^\d{11}$/.test(ownerPhone) || !/^\d{11}$/.test(emergencyPhone)) {
            const err = new Error(`Tag ${i + 1}: phone numbers must be exactly 11 digits.`);
            err.statusCode = 400;
            throw err;
        }

        let driver;
        if (slot.driver?.name?.trim() && slot.driver?.phone?.trim()) {
            driver = {
                name: slot.driver.name.trim(),
                phone: slot.driver.phone.trim(),
            };
        }

        const plate = plateRaw.toUpperCase();
        let vehicle = await Vehicle.findOne({ owner: userId, plate });

        if (!vehicle) {
            vehicle = await Vehicle.create({
                vehicleName,
                model,
                tagType,
                plate,
                chassisLast4: chassisLast4 || "",
                engineLast4: engineLast4 || "",
                ownerPhone,
                emergencyPhone,
                ownerContactVisible,
                driverContactVisible,
                emergencyContactVisible,
                driver,
                owner: userId,
                addedBy: staffId,
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
            if (driver) vehicle.driver = driver;
            if (!vehicle.addedBy) vehicle.addedBy = staffId;
            await vehicle.save();
        }

        tagAssignments.push({
            productId,
            productTitle,
            vehicleId: vehicle._id,
        });
    }

    return { tagAssignments, newVehicleIds };
}

export const staffCreateOrder = async (req, res) => {
    try {
        const role = staffRole(req);
        if (role !== "admin" && role !== "provider") {
            return res.status(403).json({ message: "Forbidden" });
        }

        const {
            userId,
            cartItems,
            items: itemsBody,
            tagAssignments: rawSlots,
            shippingAddress,
            paymentMethod,
            transactionId,
            note,
        } = req.body;

        const cartItemsList = cartItems || itemsBody;

        if (!userId || !Array.isArray(cartItemsList) || cartItemsList.length === 0) {
            return res.status(400).json({ message: "userId and cart items are required" });
        }

        const method = String(paymentMethod || "cash").trim();
        const allowed = [
            "cash",
            "bkash_manual",
            "bkash_online",
            "sslcommerz_online",
        ];
        if (!allowed.includes(method)) {
            return res.status(400).json({ message: "Invalid paymentMethod" });
        }

        if (method === "bkash_online" || method === "sslcommerz_online") {
            const gateways = await getPublicPaymentGateways();
            if (!gateways.hasOnlinePayment) {
                return res.status(400).json({
                    message: "No online payment gateway is enabled",
                });
            }
            if (method === "bkash_online" && !gateways.bkash) {
                return res.status(400).json({ message: "bKash online is disabled" });
            }
            if (method === "sslcommerz_online" && !gateways.sslcommerz) {
                return res.status(400).json({
                    message: "SSL Commerz is disabled",
                });
            }
        }

        if (method === "bkash_manual" && !String(transactionId || "").trim()) {
            return res.status(400).json({
                message: "transactionId is required for bkash_manual",
            });
        }

        const customer = await User.findById(userId);
        if (!customer || customer.role !== "user") {
            return res.status(400).json({
                message: "Vehicle must be registered under a customer (user) account",
            });
        }

        const staffId = req.user._id;

        let items;
        let totalAmount;
        try {
            ({ items, totalAmount } = await resolveOrderLineItems(cartItemsList));
        } catch (validationErr) {
            const status = validationErr.statusCode || 400;
            return res.status(status).json({ message: validationErr.message });
        }

        const totalQty = items.reduce(
            (sum, i) => sum + Math.max(1, Number(i.quantity) || 1),
            0
        );

        if (!Array.isArray(rawSlots) || rawSlots.length !== totalQty) {
            return res.status(400).json({
                message:
                    "Provide vehicle details for each tag — count must match total items.",
            });
        }

        const { tagAssignments, newVehicleIds } =
            await buildTagAssignmentsForCustomer(userId, staffId, rawSlots);

        let orderStatus = "pending";
        let orderPaymentStatus = "unpaid";

        if (method === "cash" || method === "bkash_manual") {
            orderStatus = "processing";
            orderPaymentStatus = "paid";
        }

        const order = await Order.create({
            userId,
            orderNo: await nextOrderNo(),
            items,
            tagAssignments,
            shippingAddress: shippingAddress || {},
            totalAmount,
            status: orderStatus,
            paymentStatus: orderPaymentStatus,
            createdBy: staffId,
            paymentMethod: method,
        });

        await linkVehiclesToSourceOrder(order._id, newVehicleIds);

        let redirectURL = null;
        let paymentGateway = null;

        if (method === "cash" || method === "bkash_manual") {
            await Payment.create({
                userId,
                orderId: order._id,
                amount: totalAmount,
                currency: "BDT",
                paymentMethod: method,
                transactionId:
                    method === "bkash_manual"
                        ? String(transactionId).trim()
                        : undefined,
                status: "success",
                processedBy: staffId,
                completedAt: new Date(),
                note: String(note || "").trim(),
                cartItems: items.map((i) => ({
                    productId: i.productId,
                    name: i.title,
                    price: i.price,
                    quantity: i.quantity,
                })),
            });
            await processOrderPaid(order, new Date());
        } else if (method === "bkash_online" || method === "sslcommerz_online") {
            try {
                const gateway =
                    method === "sslcommerz_online"
                        ? GATEWAYS.SSLCOMMERZ
                        : GATEWAYS.BKASH;
                await resolveGateway(gateway);
                redirectURL = await initOnlinePaymentForOrder(
                    order,
                    userId,
                    gateway
                );
                paymentGateway = gateway;
            } catch (payErr) {
                await Order.findByIdAndDelete(order._id);
                throw payErr;
            }
        }

        res.status(201).json({
            success: true,
            orderId: order._id,
            orderNo: order.orderNo,
            redirectURL: redirectURL || undefined,
            bkashURL: redirectURL || undefined,
            gateway: paymentGateway || undefined,
        });
    } catch (err) {
        console.error("staffCreateOrder:", err?.response?.data || err);
        const code = err.statusCode || 500;
        res.status(code).json({
            success: false,
            message: err.message || "Staff order creation failed",
        });
    }
};

const STAFF_STATUS_OPTIONS = [
    "pending",
    "processing",
    "confirmed",
    "shipped",
    "delivered",
    "completed",
    "returned",
    "cancelled",
];

export const updateStaffOrderStatus = async (req, res) => {
    try {
        if (staffRole(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const orderId = req.params.orderId || req.params.id;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: "Invalid order id" });
        }

        const existing = await Order.findById(orderId).lean();
        if (!existing) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (String(existing.paymentStatus || "").toLowerCase() === "unpaid") {
            return res.status(400).json({
                message: "Cannot change order status while payment is unpaid",
            });
        }

        const nextStatus = String(req.body?.status || "").trim().toLowerCase();
        if (!STAFF_STATUS_OPTIONS.includes(nextStatus)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const update = { status: nextStatus };
        if (nextStatus === "completed") {
            update.completedBy = req.user._id;
            update.completedAt = new Date();
        }

        const order = await Order.findOneAndUpdate({ _id: orderId }, update, { new: true })
            .populate("userId", "name email")
            .lean();

        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const deleteStaffOrder = async (req, res) => {
    try {
        if (staffRole(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: "Invalid order id" });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const guard = await canAdminDeleteOrder(order);
        if (!guard.ok) {
            return res.status(400).json({ message: guard.message });
        }

        await deleteOrderAndPayments(order._id);

        res.json({ success: true, message: "Order deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const bulkDeleteExpiredUnpaidOrders = async (req, res) => {
    try {
        if (staffRole(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const orderIds = Array.isArray(req.body?.orderIds)
            ? req.body.orderIds
            : [];
        const uniqueIds = [
            ...new Set(
                orderIds
                    .map((id) => String(id || "").trim())
                    .filter((id) => mongoose.Types.ObjectId.isValid(id))
            ),
        ];

        if (!uniqueIds.length) {
            return res.status(400).json({ message: "No valid order ids provided" });
        }

        const orders = await Order.find({ _id: { $in: uniqueIds } });
        const deleted = [];
        const failed = [];

        for (const order of orders) {
            const guard = await canAdminDeleteOrder(order);
            if (!guard.ok) {
                failed.push({
                    orderId: order._id,
                    orderNo: order.orderNo,
                    message: guard.message,
                });
                continue;
            }
            await deleteOrderAndPayments(order._id);
            deleted.push({ orderId: order._id, orderNo: order.orderNo });
        }

        const notFound = uniqueIds.filter(
            (id) => !orders.some((o) => String(o._id) === id)
        );

        res.json({
            success: true,
            deletedCount: deleted.length,
            failedCount: failed.length,
            deleted,
            failed,
            notFound,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const purgeAbandonedOrdersCron = async (req, res) => {
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

        const result = await purgeAbandonedUnpaidOrders();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const completeOrder = async (req, res) => {
    try {
        if (staffRole(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: "Invalid order id" });
        }

        const existing = await Order.findById(orderId).lean();
        if (!existing) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (String(existing.paymentStatus || "").toLowerCase() === "unpaid") {
            return res.status(400).json({
                message: "Cannot complete order while payment is unpaid",
            });
        }

        const order = await Order.findOneAndUpdate(
            { _id: orderId },
            {
                status: "completed",
                completedBy: req.user._id,
                completedAt: new Date(),
            },
            { new: true }
        )
            .populate("userId", "name email")
            .lean();

        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateOrderPayment = async (req, res) => {
    try {
        if (staffRole(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const { orderId } = req.params;
        const { transactionId, paymentStatus, note } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: "Invalid order id" });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const payment = await Payment.findOne({ orderId: order._id }).sort({
            createdAt: -1,
        });

        if (!payment) {
            return res.status(404).json({ message: "Payment record not found" });
        }

        const adminId = req.user._id;
        const prevPaymentStatus = String(payment.status || "");
        const prevOrderPaymentStatus = String(order.paymentStatus || "");
        let changed = false;

        const paymentMethod = String(
            payment.paymentMethod || order.paymentMethod || ""
        ).toLowerCase();
        const nextPaymentStatus = String(paymentStatus || "").toLowerCase();

        if (note !== undefined) {
            const nextNote = String(note).trim();
            if (nextNote !== String(payment.note || "")) {
                payment.note = nextNote;
                changed = true;
            }
        }

        if (nextPaymentStatus === "paid") {
            if (transactionId !== undefined) {
                const nextTrx = String(transactionId).trim();
                if (nextTrx) {
                    let normalizedTrx = nextTrx;
                    if (paymentMethod === "manual_bkash") {
                        try {
                            normalizedTrx = normalizeManualTransactionId(nextTrx);
                            await assertManualTransactionIdUnique(normalizedTrx, payment._id);
                        } catch (err) {
                            return res.status(err.statusCode || 400).json({
                                message: err.message,
                            });
                        }
                    }
                    if (normalizedTrx !== String(payment.transactionId || "")) {
                        payment.transactionId = normalizedTrx;
                        changed = true;
                    }
                }
            }

            const trxToVerify = String(payment.transactionId || "").trim();
            if (paymentMethod === "manual_bkash" && !trxToVerify) {
                return res.status(400).json({
                    message: "Transaction ID is required to approve manual bKash payment",
                });
            }
            if (trxToVerify && paymentMethod === "manual_bkash") {
                try {
                    const normalized = normalizeManualTransactionId(trxToVerify);
                    await assertManualTransactionIdUnique(normalized, payment._id);
                    payment.transactionId = normalized;
                } catch (err) {
                    return res.status(err.statusCode || 400).json({
                        message: err.message,
                    });
                }
            }
            const wasAlreadyPaid =
                prevPaymentStatus === "success" &&
                prevOrderPaymentStatus === "paid";
            if (payment.status !== "success" || order.paymentStatus !== "paid") {
                changed = true;
            }
            payment.status = "success";
            payment.completedAt = payment.completedAt || new Date();
            payment.processedBy = adminId;
            order.paymentStatus = "paid";
            if (!wasAlreadyPaid) {
                await processOrderPaid(order, payment.completedAt);
            }
        } else if (nextPaymentStatus === "unpaid") {
            if (payment.status !== "pending" || order.paymentStatus !== "unpaid") {
                changed = true;
            }
            payment.status = "pending";
            order.paymentStatus = "unpaid";
        } else if (nextPaymentStatus === "failed") {
            if (payment.status !== "failed" || order.paymentStatus !== "failed") {
                changed = true;
            }
            payment.status = "failed";
            payment.failedAt = new Date();
            order.paymentStatus = "failed";
        }

        if (changed) {
            payment.statusUpdates = payment.statusUpdates || [];
            payment.statusUpdates.push({
                updatedBy: adminId,
                updatedAt: new Date(),
                fromPaymentStatus: prevPaymentStatus,
                toPaymentStatus: String(payment.status || ""),
                fromOrderPaymentStatus: prevOrderPaymentStatus,
                toOrderPaymentStatus: String(order.paymentStatus || ""),
                transactionId: String(payment.transactionId || ""),
                note: String(payment.note || ""),
            });
        }

        await payment.save();
        await order.save();

        const updated = await Order.findById(orderId)
            .populate("userId", "name email")
            .lean();
        const pay = await Payment.findById(payment._id)
            .populate("processedBy", "name email role")
            .populate("statusUpdates.updatedBy", "name email role")
            .lean();

        res.json({ success: true, order: updated, payment: pay });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

async function settledOrderIdsForProvider(providerId) {
    const accepted = await SettlementRequest.find({
        providerId,
        status: "accepted",
    })
        .select("orderIds")
        .lean();
    const ids = new Set();
    for (const row of accepted) {
        for (const oid of row.orderIds || []) {
            ids.add(String(oid));
        }
    }
    return ids;
}

/** GET /api/order/dashboard-analytics — role-scoped KPIs for dashboard home */
export const getDashboardAnalytics = async (req, res) => {
    try {
        const role = staffRole(req);
        if (role !== "admin" && role !== "provider") {
            return res.status(403).json({ message: "Forbidden" });
        }

        const orderFilter =
            role === "provider" ? { createdBy: req.user._id } : {};

        const vehicleFilter =
            role === "provider"
                ? {
                      $or: [{ owner: req.user._id }, { addedBy: req.user._id }],
                  }
                : {};

        const productFilter =
            role === "provider"
                ? { "createdBy.email": req.user.email }
                : {};

        const [orders, totalProducts, totalVehicles] = await Promise.all([
            Order.find(orderFilter)
                .select(
                    "totalAmount status paymentStatus paymentMethod createdAt orderNo userId"
                )
                .populate("userId", "name email")
                .sort({ createdAt: -1 })
                .lean(),
            Product.countDocuments(productFilter),
            Vehicle.countDocuments(vehicleFilter),
        ]);

        const monthly = Array(12).fill(0);
        const last7 = Array(7).fill(0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
            const dayStart = new Date(today);
            dayStart.setDate(today.getDate() - (6 - i));
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayStart.getDate() + 1);
            orders.forEach((o) => {
                const d = o.createdAt ? new Date(o.createdAt) : null;
                if (!d || Number.isNaN(d.getTime())) return;
                if (d >= dayStart && d < dayEnd) last7[i] += 1;
            });
        }

        let totalRevenue = 0;
        let paidRevenue = 0;
        let paidOrders = 0;
        let pendingOrders = 0;
        let completedOrders = 0;
        const completedStatuses = new Set([
            "completed",
            "delivered",
            "shipped",
            "confirmed",
            "processing",
        ]);

        for (const o of orders) {
            const amt = Number(o.totalAmount || 0);
            const isPaid = String(o.paymentStatus || "").toLowerCase() === "paid";
            const status = String(o.status || "").toLowerCase();

            if (status === "pending") pendingOrders += 1;
            if (completedStatuses.has(status)) completedOrders += 1;
            if (isPaid) {
                paidOrders += 1;
                paidRevenue += amt;
                const d = o.createdAt ? new Date(o.createdAt) : null;
                if (d && !Number.isNaN(d.getTime())) {
                    monthly[d.getMonth()] += amt;
                }
            }
            totalRevenue += amt;
        }

        let unsettledEarnings = 0;
        if (role === "provider") {
            const settledIds = await settledOrderIdsForProvider(req.user._id);
            for (const o of orders) {
                if (String(o.paymentStatus || "").toLowerCase() !== "paid") continue;
                if (!settledIds.has(String(o._id))) {
                    unsettledEarnings += Number(o.totalAmount || 0);
                }
            }
        }

        res.json({
            success: true,
            role,
            totalOrders: orders.length,
            totalProducts,
            totalVehicles,
            totalRevenue,
            paidRevenue,
            paidOrders,
            pendingOrders,
            completedOrders,
            unsettledEarnings,
            monthly,
            last7,
            recentOrders: orders.slice(0, 8),
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getStaffOrders = async (req, res) => {
    try {
        const role = staffRole(req);
        if (role !== "admin" && role !== "provider") {
            return res.status(403).json({ message: "Forbidden" });
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter = {};
        if (role === "provider") {
            filter.createdBy = req.user._id;
        }
        if (req.query.status) {
            filter.status = String(req.query.status).trim();
        }
        if (req.query.unpaidOrders === "1") {
            if (role !== "admin") {
                return res.status(403).json({ message: "Admin only" });
            }
            filter.paymentStatus = { $in: ["unpaid", "failed"] };
            filter.createdAt = { $lte: unpaidOrderCutoffDate() };
            filter.$and = [
                ...(filter.$and || []),
                {
                    $or: [
                        { orderKind: "purchase" },
                        { orderKind: { $exists: false } },
                        { orderKind: null },
                    ],
                },
            ];
        } else if (req.query.paymentStatus) {
            filter.paymentStatus = String(req.query.paymentStatus).trim();
        }
        if (req.query.search) {
            const q = String(req.query.search).trim();
            const customers = await User.find({
                role: "user",
                $or: [
                    { name: new RegExp(q, "i") },
                    { email: new RegExp(q, "i") },
                ],
            })
                .select("_id")
                .lean();
            const ids = customers.map((c) => c._id);
            filter.$or = [
                { orderNo: new RegExp(q, "i") },
                ...(ids.length ? [{ userId: { $in: ids } }] : []),
            ];
        }

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate("userId", "name email")
                .populate("createdBy", "name email")
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
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: "Invalid order id" });
        }

        const order = await Order.findById(orderId)
            .populate("userId", "name email phone")
            .populate("createdBy", "name email")
            .populate("completedBy", "name email")
            .populate("tagAssignments.vehicleId")
            .lean();

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const role = staffRole(req);
        const uid = String(req.user._id);
        const isOwner = String(order.userId?._id || order.userId) === uid;
        const isStaff =
            role === "admin" ||
            (role === "provider" && String(order.createdBy?._id || order.createdBy) === uid);

        if (!isOwner && !isStaff) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const payment = await Payment.findOne({ orderId: order._id })
            .sort({ createdAt: -1 })
            .populate("processedBy", "name email role")
            .populate("statusUpdates.updatedBy", "name email role")
            .lean();

        res.json({ success: true, order, payment });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

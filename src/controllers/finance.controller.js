import mongoose from "mongoose";
import Order from "../models/Order.js";
import User from "../models/User.js";
import ProviderPaymentProfile from "../models/ProviderPaymentProfile.js";
import SettlementRequest from "../models/SettlementRequest.js";
import { buildAdminFinanceReport } from "../service/financeReport.service.js";

const role = (req) => String(req.user?.role || "").trim().toLowerCase();

async function settledOrderIdSet(providerId) {
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

async function eligiblePaidOrders(providerId, from, to, settledIds) {
    const filter = {
        createdBy: providerId,
        paymentStatus: "paid",
        createdAt: { $gte: from, $lte: to },
    };

    const orders = await Order.find(filter)
        .select("orderNo totalAmount status paymentStatus paymentMethod createdAt")
        .sort({ createdAt: -1 })
        .lean();

    return orders.filter((o) => !settledIds.has(String(o._id)));
}

function parseDateRange(fromStr, toStr) {
    const from = new Date(`${fromStr}T00:00:00.000Z`);
    const to = new Date(`${toStr}T23:59:59.999Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return null;
    }
    if (from > to) {
        return null;
    }
    return { from, to };
}

async function getOrCreatePaymentProfile(userId) {
    let profile = await ProviderPaymentProfile.findOne({ userId }).lean();
    if (!profile) {
        const created = await ProviderPaymentProfile.create({ userId });
        profile = created.toObject();
    }
    return profile;
}

const PAYMENT_METHODS = ["bkash", "bank", "cash"];

function normalizePaymentPayload(body = {}) {
    const preferredMethod = PAYMENT_METHODS.includes(
        String(body.preferredMethod || "").trim()
    )
        ? String(body.preferredMethod).trim()
        : "bkash";

    return {
        preferredMethod,
        bkashNumber: String(body.bkashNumber ?? "").trim(),
        bankName: String(body.bankName ?? "").trim(),
        accountHolder: String(body.accountHolder ?? "").trim(),
        accountNumber: String(body.accountNumber ?? "").trim(),
        moneyReceiptNo: String(body.moneyReceiptNo ?? "").trim(),
        note: String(body.note ?? "").trim(),
    };
}

function validatePaymentByMethod(payment) {
    const { preferredMethod } = payment;
    if (preferredMethod === "bkash") {
        if (!payment.bkashNumber) {
            return "bKash number is required";
        }
        return null;
    }
    if (preferredMethod === "bank") {
        if (!payment.bankName) return "Bank name is required";
        if (!payment.accountHolder) return "Account holder is required";
        if (!payment.accountNumber) return "Account number is required";
        return null;
    }
    if (preferredMethod === "cash") {
        if (!payment.moneyReceiptNo) {
            return "Money receipt number is required";
        }
        return null;
    }
    return "Valid payment method is required";
}

async function upsertProviderPaymentProfile(userId, body) {
    const payment = normalizePaymentPayload(body);
    const profile = await ProviderPaymentProfile.findOneAndUpdate(
        { userId },
        payment,
        { new: true, upsert: true }
    ).lean();
    return profile;
}

function paymentSnapshotFromProfile(profile) {
    return {
        bkashNumber: profile.bkashNumber,
        bankName: profile.bankName,
        accountHolder: profile.accountHolder,
        accountNumber: profile.accountNumber,
        moneyReceiptNo: profile.moneyReceiptNo,
        preferredMethod: profile.preferredMethod,
        note: profile.note,
    };
}

/** GET /api/finance/provider/summary */
export const getProviderFinanceSummary = async (req, res) => {
    try {
        if (role(req) !== "provider") {
            return res.status(403).json({ message: "Provider only" });
        }

        const providerId = req.user._id;
        const settledIds = await settledOrderIdSet(providerId);

        const allPaid = await Order.find({
            createdBy: providerId,
            paymentStatus: "paid",
        })
            .select("totalAmount createdAt")
            .lean();

        let totalEarnings = 0;
        let unsettledEarnings = 0;
        const byDate = {};

        for (const o of allPaid) {
            const amt = Number(o.totalAmount) || 0;
            totalEarnings += amt;
            const settled = settledIds.has(String(o._id));
            if (!settled) {
                unsettledEarnings += amt;
            }
            const day = o.createdAt
                ? new Date(o.createdAt).toISOString().slice(0, 10)
                : "unknown";
            if (!byDate[day]) {
                byDate[day] = { date: day, amount: 0, count: 0, unsettled: 0 };
            }
            byDate[day].amount += amt;
            byDate[day].count += 1;
            if (!settled) {
                byDate[day].unsettled += amt;
            }
        }

        const settlements = await SettlementRequest.find({ providerId })
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const pendingCount = settlements.filter((s) => s.status === "pending").length;

        res.json({
            success: true,
            totalEarnings,
            unsettledEarnings,
            settledEarnings: totalEarnings - unsettledEarnings,
            orderCount: allPaid.length,
            pendingSettlementRequests: pendingCount,
            dailyBreakdown: Object.values(byDate).sort((a, b) =>
                b.date.localeCompare(a.date)
            ),
            settlements,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/finance/provider/orders?from=&to= */
export const getProviderFinanceOrders = async (req, res) => {
    try {
        if (role(req) !== "provider") {
            return res.status(403).json({ message: "Provider only" });
        }

        const range = parseDateRange(req.query.from, req.query.to);
        if (!range) {
            return res.status(400).json({ message: "Valid from and to dates required (YYYY-MM-DD)" });
        }

        const providerId = req.user._id;
        const settledIds = await settledOrderIdSet(providerId);
        const orders = await eligiblePaidOrders(
            providerId,
            range.from,
            range.to,
            settledIds
        );

        const amount = orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

        res.json({
            success: true,
            orders,
            orderCount: orders.length,
            amount,
            periodFrom: range.from,
            periodTo: range.to,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/finance/provider/payment-details */
export const getProviderPaymentDetails = async (req, res) => {
    try {
        if (role(req) !== "provider") {
            return res.status(403).json({ message: "Provider only" });
        }

        const profile = await getOrCreatePaymentProfile(req.user._id);
        res.json({ success: true, profile });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** PUT /api/finance/provider/payment-details */
export const updateProviderPaymentDetails = async (req, res) => {
    try {
        if (role(req) !== "provider") {
            return res.status(403).json({ message: "Provider only" });
        }

        const payment = normalizePaymentPayload(req.body);
        const validationError = validatePaymentByMethod(payment);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const profile = await upsertProviderPaymentProfile(req.user._id, payment);

        res.json({ success: true, profile });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** POST /api/finance/provider/settlement-requests */
export const createSettlementRequest = async (req, res) => {
    try {
        if (role(req) !== "provider") {
            return res.status(403).json({ message: "Provider only" });
        }

        const { from, to, providerNote } = req.body || {};
        const range = parseDateRange(from, to);
        if (!range) {
            return res.status(400).json({
                message: "Valid from and to dates required (YYYY-MM-DD)",
            });
        }

        const providerId = req.user._id;
        const payment = normalizePaymentPayload(req.body);
        const validationError = validatePaymentByMethod(payment);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const profile = await upsertProviderPaymentProfile(providerId, payment);

        const settledIds = await settledOrderIdSet(providerId);
        const orders = await eligiblePaidOrders(
            providerId,
            range.from,
            range.to,
            settledIds
        );

        if (orders.length === 0) {
            return res.status(400).json({
                message: "No unsettled paid orders in this date range",
            });
        }

        const amount = orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

        const overlappingPending = await SettlementRequest.findOne({
            providerId,
            status: "pending",
            periodFrom: { $lte: range.to },
            periodTo: { $gte: range.from },
        }).lean();

        if (overlappingPending) {
            return res.status(400).json({
                message: "You already have a pending settlement request for an overlapping period",
            });
        }

        const request = await SettlementRequest.create({
            providerId,
            periodFrom: range.from,
            periodTo: range.to,
            amount,
            orderCount: orders.length,
            orderIds: orders.map((o) => o._id),
            providerNote: String(providerNote || "").trim(),
            paymentSnapshot: paymentSnapshotFromProfile(profile),
        });

        const populated = await SettlementRequest.findById(request._id)
            .populate("providerId", "name email")
            .lean();

        res.status(201).json({ success: true, request: populated });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/finance/provider/settlement-requests */
export const listProviderSettlementRequests = async (req, res) => {
    try {
        if (role(req) !== "provider") {
            return res.status(403).json({ message: "Provider only" });
        }

        const requests = await SettlementRequest.find({ providerId: req.user._id })
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, requests });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/finance/admin/paid-orders — income from paymentStatus paid */
export const getAdminPaidOrders = async (req, res) => {
    try {
        if (role(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const orders = await Order.find({ paymentStatus: "paid" })
            .select(
                "orderNo orderKind totalAmount status paymentStatus paymentMethod createdAt userId createdBy"
            )
            .sort({ createdAt: -1 })
            .limit(1000)
            .lean();

        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/finance/admin/settlement-requests */
export const listAdminSettlementRequests = async (req, res) => {
    try {
        if (role(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const filter = {};
        if (req.query.status) {
            filter.status = String(req.query.status).trim();
        }

        const requests = await SettlementRequest.find(filter)
            .populate("providerId", "name email phone")
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, requests });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/finance/admin/settlement-requests/:id */
export const getSettlementRequestById = async (req, res) => {
    try {
        if (role(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }

        const request = await SettlementRequest.findById(id)
            .populate("providerId", "name email phone")
            .populate("reviewedBy", "name email")
            .lean();

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        const orders = await Order.find({ _id: { $in: request.orderIds || [] } })
            .select("orderNo totalAmount createdAt paymentMethod status paymentStatus")
            .lean();

        res.json({ success: true, request, orders });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** PATCH /api/finance/admin/settlement-requests/:id/accept */
export const acceptSettlementRequest = async (req, res) => {
    try {
        if (role(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const { id } = req.params;
        const request = await SettlementRequest.findById(id);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }
        if (request.status !== "pending") {
            return res.status(400).json({ message: "Request is not pending" });
        }

        request.status = "accepted";
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        request.rejectNote = "";
        await request.save();

        const populated = await SettlementRequest.findById(id)
            .populate("providerId", "name email phone")
            .populate("reviewedBy", "name email")
            .lean();

        res.json({ success: true, request: populated });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** PATCH /api/finance/admin/settlement-requests/:id/reject */
export const rejectSettlementRequest = async (req, res) => {
    try {
        if (role(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const { id } = req.params;
        const { rejectNote } = req.body || {};

        const request = await SettlementRequest.findById(id);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }
        if (request.status !== "pending") {
            return res.status(400).json({ message: "Request is not pending" });
        }

        request.status = "rejected";
        request.rejectNote = String(rejectNote || "").trim();
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        await request.save();

        const populated = await SettlementRequest.findById(id)
            .populate("providerId", "name email phone")
            .populate("reviewedBy", "name email")
            .lean();

        res.json({ success: true, request: populated });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

async function buildSettledOrderMap() {
    const accepted = await SettlementRequest.find({ status: "accepted" })
        .select("providerId orderIds")
        .lean();

    const map = new Map();
    for (const row of accepted) {
        const pid = String(row.providerId);
        if (!map.has(pid)) map.set(pid, new Set());
        for (const oid of row.orderIds || []) {
            map.get(pid).add(String(oid));
        }
    }
    return map;
}

/** GET /api/finance/admin/provider-dues */
export const getAdminProviderDueList = async (req, res) => {
    try {
        if (role(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const providers = await User.find({ role: "provider" })
            .select("name email phone")
            .sort({ name: 1 })
            .lean();

        const providerIds = providers.map((p) => p._id);
        const settledMap = await buildSettledOrderMap();

        const paidOrders = await Order.find({
            createdBy: { $in: providerIds },
            paymentStatus: "paid",
        })
            .select("createdBy totalAmount createdAt")
            .lean();

        const dueMap = new Map();
        for (const o of paidOrders) {
            const pid = String(o.createdBy);
            const settledIds = settledMap.get(pid) || new Set();
            if (settledIds.has(String(o._id))) continue;

            if (!dueMap.has(pid)) {
                dueMap.set(pid, {
                    unsettledAmount: 0,
                    unsettledOrderCount: 0,
                    lastOrderAt: null,
                });
            }
            const row = dueMap.get(pid);
            row.unsettledAmount += Number(o.totalAmount) || 0;
            row.unsettledOrderCount += 1;
            if (!row.lastOrderAt || new Date(o.createdAt) > new Date(row.lastOrderAt)) {
                row.lastOrderAt = o.createdAt;
            }
        }

        const pendingRows = await SettlementRequest.find({ status: "pending" })
            .select("providerId")
            .lean();
        const pendingCount = new Map();
        for (const r of pendingRows) {
            const pid = String(r.providerId);
            pendingCount.set(pid, (pendingCount.get(pid) || 0) + 1);
        }

        const profiles = await ProviderPaymentProfile.find({
            userId: { $in: providerIds },
        }).lean();
        const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

        const list = providers.map((p) => {
            const pid = String(p._id);
            const due = dueMap.get(pid) || {
                unsettledAmount: 0,
                unsettledOrderCount: 0,
                lastOrderAt: null,
            };
            return {
                providerId: p._id,
                name: p.name,
                email: p.email,
                phone: p.phone || "",
                unsettledAmount: due.unsettledAmount,
                unsettledOrderCount: due.unsettledOrderCount,
                lastOrderAt: due.lastOrderAt,
                pendingRequestCount: pendingCount.get(pid) || 0,
                paymentMethod: profileMap.get(pid)?.preferredMethod || "",
            };
        });

        list.sort((a, b) => b.unsettledAmount - a.unsettledAmount);

        const totalDue = list.reduce((s, r) => s + r.unsettledAmount, 0);
        const providersWithDue = list.filter((r) => r.unsettledAmount > 0).length;

        res.json({
            success: true,
            providers: list,
            totals: {
                totalDue,
                providersWithDue,
                providerCount: list.length,
            },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/finance/admin/provider-dues/:providerId */
export const getAdminProviderDueDetail = async (req, res) => {
    try {
        if (role(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const { providerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(providerId)) {
            return res.status(400).json({ message: "Invalid provider id" });
        }

        const provider = await User.findOne({ _id: providerId, role: "provider" })
            .select("name email phone")
            .lean();
        if (!provider) {
            return res.status(404).json({ message: "Provider not found" });
        }

        const settledIds = await settledOrderIdSet(providerId);
        const orders = await Order.find({
            createdBy: providerId,
            paymentStatus: "paid",
        })
            .select("orderNo totalAmount createdAt paymentMethod status paymentStatus")
            .sort({ createdAt: -1 })
            .lean();

        const unsettledOrders = orders.filter((o) => !settledIds.has(String(o._id)));
        const unsettledAmount = unsettledOrders.reduce(
            (s, o) => s + Number(o.totalAmount || 0),
            0
        );

        const profile = await ProviderPaymentProfile.findOne({ userId: providerId }).lean();
        const pendingRequests = await SettlementRequest.find({
            providerId,
            status: "pending",
        })
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            provider,
            unsettledAmount,
            unsettledOrderCount: unsettledOrders.length,
            orders: unsettledOrders,
            paymentProfile: profile,
            pendingRequests,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/finance/admin/reports?year=2026&month=6 (month optional = yearly) */
export const getAdminFinanceReport = async (req, res) => {
    try {
        if (role(req) !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const { year, month } = req.query;
        if (!year) {
            return res.status(400).json({ message: "year query param is required" });
        }

        const report = await buildAdminFinanceReport(year, month);
        res.json({ success: true, report });
    } catch (err) {
        const msg = err.message || "Failed to build report";
        const status = msg.includes("Invalid") ? 400 : 500;
        res.status(status).json({ message: msg });
    }
};

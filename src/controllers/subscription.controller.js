import TagSubscription from "../models/TagSubscription.js";
import Vehicle from "../models/Vehicle.js";
import QRModel from "../models/QRCode.js";
import {
    ORDER_KIND,
    createRenewOrder,
} from "../utils/tagSubscription.service.js";

export const getMyTagSubscriptions = async (req, res) => {
    try {
        const userId = req.user._id;
        const subs = await TagSubscription.find({ userId })
            .sort({ validUntil: -1 })
            .lean();

        const vehicleIds = [...new Set(subs.map((s) => String(s.vehicleId)))];
        const vehicles = await Vehicle.find({ _id: { $in: vehicleIds } })
            .select("plate brand model ownerPhone")
            .lean();
        const vehicleMap = Object.fromEntries(
            vehicles.map((v) => [String(v._id), v])
        );

        const qrIds = subs.filter((s) => s.qrId).map((s) => s.qrId);
        const qrs = await QRModel.find({ _id: { $in: qrIds } }).select("code").lean();
        const qrMap = Object.fromEntries(qrs.map((q) => [String(q._id), q]));

        const now = new Date();
        const tags = subs.map((s) => {
            const expired =
                s.status === "expired" ||
                (s.validUntil && new Date(s.validUntil) < now);
            return {
                ...s,
                vehicle: vehicleMap[String(s.vehicleId)] || null,
                qr: s.qrId ? qrMap[String(s.qrId)] || { code: s.qrCode } : null,
                isExpired: expired && s.status !== "pending_qr",
                isActive:
                    !expired &&
                    (s.status === "active" || s.status === "pending_qr"),
            };
        });

        res.json({ success: true, tags });
    } catch (err) {
        console.error("getMyTagSubscriptions:", err);
        res.status(500).json({ message: err.message });
    }
};

export const createRenewIntent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { qrId, mode } = req.body || {};

        if (!qrId) {
            return res.status(400).json({ message: "qrId is required" });
        }

        const allowed = [ORDER_KIND.RENEW_SAME_QR, ORDER_KIND.RENEW_NEW_QR];
        if (!allowed.includes(mode)) {
            return res.status(400).json({
                message: `mode must be ${ORDER_KIND.RENEW_SAME_QR} or ${ORDER_KIND.RENEW_NEW_QR}`,
            });
        }

        const order = await createRenewOrder({ userId, qrId, mode });

        res.status(201).json({
            success: true,
            order,
            message: "Renewal order created. Complete payment to activate.",
        });
    } catch (err) {
        console.error("createRenewIntent:", err);
        res.status(400).json({ message: err.message });
    }
};

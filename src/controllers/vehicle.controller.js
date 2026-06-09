import mongoose from "mongoose";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import QRModel from "../models/QRCode.js";
import {
    getQrIdsFromVehicle,
    normalizeVehicleDoc,
    syncVehicleQrFields,
} from "../utils/vehicleQr.js";

/** User-facing list: paid-order, manual, or QR-assigned vehicles only. */
async function filterVehiclesVisibleToUser(vehicles) {
    const sourceOrderIds = [
        ...new Set(
            vehicles
                .map((v) => v.sourceOrderId)
                .filter(Boolean)
                .map((id) => String(id))
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        ),
    ];

    const paidSourceOrderIds = new Set();
    if (sourceOrderIds.length) {
        const paidOrders = await Order.find({
            _id: { $in: sourceOrderIds },
            paymentStatus: "paid",
        })
            .select("_id")
            .lean();
        for (const order of paidOrders) {
            paidSourceOrderIds.add(String(order._id));
        }
    }

    return vehicles.filter((vehicle) => {
        if (getQrIdsFromVehicle(vehicle).length > 0) return true;
        if (!vehicle.sourceOrderId) return true;
        return paidSourceOrderIds.has(String(vehicle.sourceOrderId));
    });
}

const canManageVehicle = (vehicle, reqUser) => {
    if (!vehicle || !reqUser?._id) return false;
    const uid = String(reqUser._id);

    if (reqUser.role === "admin") return true;
    if (reqUser.role === "user") {
        return String(vehicle.owner) === uid;
    }
    if (reqUser.role === "provider") {
        return (
            String(vehicle.owner) === uid ||
            (vehicle.addedBy && String(vehicle.addedBy) === uid)
        );
    }
    return false;
};

// ➕ ADD VEHICLE — end user: owner = self; admin/provider: must assign a customer (role user) + addedBy = staff
export const addVehicle = async (req, res) => {
    try {
        let {
            vehicleName,
            model,
            plate,
            chassisLast4,
            engineLast4,
            ownerPhone,
            emergencyPhone,
            ownerContactVisible,
            driverContactVisible,
            emergencyContactVisible,
            driver,
            qrData,
            owner,
        } = req.body;
        const role = req.user?.role;
        let addedBy = null;

        if (role === "user") {
            owner = req.user._id;
        } else if (role === "admin" || role === "provider") {
            if (!owner) {
                return res.status(400).json({
                    success: false,
                    message: "Assign a customer user as vehicle owner",
                });
            }
            const ownerUser = await User.findById(owner);
            if (!ownerUser) {
                return res.status(404).json({
                    success: false,
                    message: "Owner user not found",
                });
            }
            if (ownerUser.role !== "user") {
                return res.status(400).json({
                    success: false,
                    message: "Vehicle must be registered under a customer (user) account",
                });
            }
            addedBy = req.user._id;
        } else {
            return res.status(403).json({
                success: false,
                message: "Forbidden",
            });
        }

        const createPayload = {
            vehicleName: vehicleName || model || "Vehicle",
            model,
            plate,
            chassisLast4: chassisLast4 || "",
            engineLast4: engineLast4 || "",
            ownerPhone,
            emergencyPhone,
            ownerContactVisible: ownerContactVisible ?? true,
            driverContactVisible: driverContactVisible ?? true,
            emergencyContactVisible: emergencyContactVisible ?? false,
            driver,
            owner,
            addedBy,
            qrIds: [],
            qrData: null,
        };

        if (qrData) {
            createPayload.qrIds = [qrData];
            syncVehicleQrFields(createPayload);
        }

        const vehicle = await Vehicle.create(createPayload);

        res.status(201).json({
            success: true,
            data: normalizeVehicleDoc(vehicle),
        });

    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message,
        });
    }
};

// 📄 GET ALL — admin: all; provider: vehicles they own or registered for customers
export const getVehicles = async (req, res) => {
    try {
        const filter =
            req.user?.role === "provider"
                ? {
                      $or: [
                          { owner: req.user._id },
                          { addedBy: req.user._id },
                      ],
                  }
                : {};

        const vehicles = await Vehicle.find(filter)
            .populate("owner", "name email role")
            .populate("addedBy", "name email role")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: vehicles.map((v) => normalizeVehicleDoc(v)),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// 👤 MY VEHICLES — token user only (no email spoofing)
export const getMyVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ owner: req.user._id }).sort({
            createdAt: -1,
        });

        const visible = await filterVehiclesVisibleToUser(vehicles);

        res.status(200).json({
            success: true,
            data: visible.map((v) => normalizeVehicleDoc(v)),
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};



// ✏️ UPDATE VEHICLE
export const updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            vehicleName,
            model,
            plate,
            ownerPhone,
            emergencyPhone,
            ownerContactVisible,
            driverContactVisible,
            emergencyContactVisible,
            driver,
            qrData,
        } = req.body;

        const vehicle = await Vehicle.findById(id);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
        }

        if (!canManageVehicle(vehicle, req.user)) {
            return res.status(403).json({
                success: false,
                message: "Vehicle not found or unauthorized",
            });
        }

        vehicle.vehicleName = vehicleName ?? vehicle.vehicleName;
        vehicle.model = model ?? vehicle.model;
        vehicle.plate = plate ?? vehicle.plate;
        vehicle.ownerPhone = ownerPhone ?? vehicle.ownerPhone;
        vehicle.emergencyPhone = emergencyPhone ?? vehicle.emergencyPhone;
        vehicle.ownerContactVisible = ownerContactVisible ?? vehicle.ownerContactVisible;
        vehicle.driverContactVisible = driverContactVisible ?? vehicle.driverContactVisible;
        vehicle.emergencyContactVisible = emergencyContactVisible ?? vehicle.emergencyContactVisible;

        vehicle.driver = driver ?? vehicle.driver;
        if (qrData !== undefined) {
            if (qrData) {
                vehicle.qrIds = getQrIdsFromVehicle(vehicle);
                if (!vehicle.qrIds.map(String).includes(String(qrData))) {
                    vehicle.qrIds.push(qrData);
                }
            }
            syncVehicleQrFields(vehicle);
        }

        await vehicle.save();

        res.status(200).json({
            success: true,
            data: normalizeVehicleDoc(vehicle),
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};


// 🗑️ DELETE VEHICLE
export const deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;

        const vehicle = await Vehicle.findById(id);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
        }

        if (!canManageVehicle(vehicle, req.user)) {
            return res.status(403).json({
                success: false,
                message: "Vehicle not found or unauthorized",
            });
        }

        const qrIds = getQrIdsFromVehicle(vehicle);
        await Vehicle.findByIdAndDelete(id);

        if (qrIds.length > 0) {
            await QRModel.updateMany(
                { _id: { $in: qrIds } },
                {
                    $set: {
                        vehicleId: null,
                        isAssigned: false,
                        status: "unassigned",
                    },
                    $unset: { assignedBy: "" },
                }
            );
        }

        res.status(200).json({
            success: true,
            message: "Vehicle deleted successfully",
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};


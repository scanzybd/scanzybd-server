import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";

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
        console.log("BODY:", req.body);

        let { vehicleName, model, plate, ownerPhone, driver, qrData, owner } = req.body;
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

        const vehicle = await Vehicle.create({
            vehicleName,
            model,
            plate,
            ownerPhone,
            driver,
            qrData,
            owner,
            addedBy,
        });

        res.status(201).json({
            success: true,
            data: vehicle,
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
            data: vehicles,
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
        const vehicles = await Vehicle.find({ owner: req.user._id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: vehicles,
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

        console.log("PARAM ID:", id);
        console.log("USER ID:", req.user._id);

        const { vehicleName, model, plate, ownerPhone, driver, qrData } = req.body;

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

        vehicle.driver = driver ?? vehicle.driver;
        vehicle.qrData = qrData ?? vehicle.qrData;

        await vehicle.save();

        res.status(200).json({
            success: true,
            data: vehicle,
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

        await Vehicle.findByIdAndDelete(id);

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


import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";

// ➕ ADD VEHICLE
export const addVehicle = async (req, res) => {
    try {
        console.log("BODY:", req.body);

        const { vehicleName, model, plate, ownerPhone, driver, qrData, owner } = req.body;

        if (!owner) {
            return res.status(400).json({
                success: false,
                message: "Owner missing from request body",
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

// 📄 GET ALL (ADMIN)
export const getVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find()
            .populate("owner", "name email role")
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


// 👤 MY VEHICLES
export const getMyVehicles = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        // 🔍 user find by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // 🚗 vehicles find by owner
        const vehicles = await Vehicle.find({ owner: user._id })
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
        const { id } = req.params; // ✅ MUST BE HERE

        console.log("PARAM ID:", id);
        console.log("USER ID:", req.user._id);

        const { vehicleName, model, plate, ownerPhone, driver, qrData } = req.body;

        const vehicle = await Vehicle.findOne({
            _id: id,
            owner: req.user._id,
        });

        if (!vehicle) {
            return res.status(404).json({
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

        const vehicle = await Vehicle.findOneAndDelete({
            _id: id,
            owner: req.user._id, // 🔐 owner check
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found or unauthorized",
            });
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


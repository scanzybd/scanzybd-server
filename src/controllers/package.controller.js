import Package from "../models/Package.js";
import User from "../models/User.js";

// CREATE PACKAGE (createdBy forced from logged-in staff)
export const createPackage = async (req, res) => {
    try {
        const dbUser = await User.findById(req.user._id);
        if (!dbUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const { createdBy: _c, createdAt: _a, ...rest } = req.body;

        const result = await Package.create({
            ...rest,
            createdBy: {
                name: dbUser.name,
                email: dbUser.email,
                uid: req.user.uid,
            },
        });

        res.status(201).json({
            success: true,
            message: "Package created successfully",
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// GET ALL PACKAGES — dashboard: full list for admin & provider
export const getAllPackages = async (req, res) => {
    try {
        const result = await Package.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
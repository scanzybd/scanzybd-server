import Package from "../models/Package.js";

// CREATE PACKAGE
export const createPackage = async (req, res) => {
    try {
        const data = req.body;

        const result = await Package.create(data);

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

// GET ALL PACKAGES
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
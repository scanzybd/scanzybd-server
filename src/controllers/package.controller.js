import mongoose from "mongoose";
import Package from "../models/Package.js";
import User from "../models/User.js";

const PACKAGE_UPDATE_FIELDS = new Set([
    "title",
    "price",
    "description",
    "features",
    "category",
    "highlight",
    "currency",
]);

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

// UPDATE PACKAGE — admin only
export const updatePackage = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admins can update packages",
            });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid package id",
            });
        }

        const existing = await Package.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Package not found",
            });
        }

        const body = req.body || {};
        const patch = {};

        for (const key of PACKAGE_UPDATE_FIELDS) {
            if (body[key] !== undefined) {
                patch[key] = body[key];
            }
        }

        if (patch.price !== undefined) {
            patch.price = Number(patch.price);
            if (Number.isNaN(patch.price)) {
                return res.status(400).json({ success: false, message: "Invalid price" });
            }
        }
        if (patch.features !== undefined && !Array.isArray(patch.features)) {
            return res.status(400).json({
                success: false,
                message: "features must be an array",
            });
        }

        const updated = await Package.findByIdAndUpdate(
            id,
            { $set: patch },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Package updated",
            data: updated,
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
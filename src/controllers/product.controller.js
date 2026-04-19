import mongoose from "mongoose";
import Product from "../models/Product.js";
import User from "../models/User.js";

const UPDATE_FIELDS = new Set([
    "title",
    "description",
    "price",
    "originalPrice",
    "image",
    "type",
    "packInfo",
    "validityDays",
    "rating",
    "reviews",
    "inStock",
    "features",
    "specifications",
]);

// ➕ Add Product (createdBy forced from logged-in staff)
export const addProduct = async (req, res) => {
    try {
        const dbUser = await User.findById(req.user._id);
        if (!dbUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const { createdBy: _c, _id: _i, createdAt: _a, ...rest } = req.body;

        const result = await Product.create({
            ...rest,
            createdBy: {
                name: dbUser.name,
                email: dbUser.email,
                uid: req.user.uid,
            },
            createdAt: new Date(),
        });

        res.status(201).send({
            success: true,
            message: "Product created successfully",
            data: result,
        });

    } catch (error) {
        console.log(error);

        res.status(500).send({
            success: false,
            message: "Failed to add product",
            error: error.message,
        });
    }
};

// 👤 My Products
export const myProducts = async (req, res) => {
    try {
        const email = req.params.email;

        const result = await Product.find({
            "createdBy.email": email,
        });

        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to get products" });
    }
};

export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        res.status(200).json({
            success: true,
            data: product,
        });

    } catch (error) {
        console.log(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch product",
        });
    }
};

/** Public catalog — everyone (guest, user, provider, admin) sees full list */
export const getAllProducts = async (req, res) => {
    try {
        const result = await Product.find().sort({ createdAt: -1 });
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to get products" });
    }
};

/** Dashboard product table — admin & provider see full catalog (edit still restricted in updateProduct) */
export const getDashboardProducts = async (req, res) => {
    try {
        const result = await Product.find().sort({ createdAt: -1 });
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to get products" });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product id",
            });
        }

        const existing = await Product.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        if (
            req.user.role === "provider" &&
            existing.createdBy?.email !== req.user.email
        ) {
            return res.status(403).json({
                success: false,
                message: "Not allowed to edit this product",
            });
        }

        const body = req.body || {};
        const patch = {};

        for (const key of UPDATE_FIELDS) {
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
        if (patch.originalPrice !== undefined) {
            patch.originalPrice = Number(patch.originalPrice);
            if (Number.isNaN(patch.originalPrice)) patch.originalPrice = 0;
        }
        if (patch.validityDays !== undefined) {
            patch.validityDays = Math.max(1, Number(patch.validityDays) || 365);
        }
        if (patch.rating !== undefined) {
            patch.rating = Number(patch.rating);
            if (Number.isNaN(patch.rating)) patch.rating = 0;
        }
        if (patch.reviews !== undefined) {
            patch.reviews = Number(patch.reviews);
            if (Number.isNaN(patch.reviews)) patch.reviews = 0;
        }
        if (patch.features !== undefined && !Array.isArray(patch.features)) {
            return res.status(400).json({ success: false, message: "features must be an array" });
        }

        const updated = await Product.findByIdAndUpdate(
            id,
            { $set: patch },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Product updated",
            data: updated,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Failed to update product",
            error: error.message,
        });
    }
};
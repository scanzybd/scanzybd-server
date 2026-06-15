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
    "isActive",
    "features",
    "specifications",
]);

/** Public catalog — only products visible to customers */
const PUBLIC_PRODUCT_FILTER = { isActive: { $ne: false } };

const PRODUCT_SORT = { displayOrder: 1, createdAt: -1 };

/** Assign displayOrder to legacy products that never had one */
async function ensureProductDisplayOrders() {
    const missing = await Product.countDocuments({
        $or: [{ displayOrder: null }, { displayOrder: { $exists: false } }],
    });
    if (missing === 0) return;

    const all = await Product.find().sort({ createdAt: -1 }).select("_id");
    await Promise.all(
        all.map((p, index) =>
            Product.updateOne({ _id: p._id }, { $set: { displayOrder: index } })
        )
    );
}

// ➕ Add Product (createdBy forced from logged-in staff)
export const addProduct = async (req, res) => {
    try {
        const dbUser = await User.findById(req.user._id);
        if (!dbUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const { createdBy: _c, _id: _i, createdAt: _a, displayOrder: _d, ...rest } = req.body;

        const top = await Product.findOne({ displayOrder: { $ne: null } })
            .sort({ displayOrder: -1 })
            .select("displayOrder")
            .lean();
        const nextOrder = (top?.displayOrder ?? -1) + 1;

        const result = await Product.create({
            ...rest,
            displayOrder: nextOrder,
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
        res.status(500).send({
            success: false,
            message: "Failed to add product",
            error: error.message,
        });
    }
};

// 👤 Provider catalog by email — admin: any; provider: own email only
export const myProducts = async (req, res) => {
    try {
        const email = String(req.params.email || "").toLowerCase().trim();
        if (!email) {
            return res.status(400).send({ message: "Email is required" });
        }

        const role = String(req.user?.role || "").trim().toLowerCase();
        if (role === "provider") {
            const ownEmail = String(req.user.email || "").toLowerCase().trim();
            if (email !== ownEmail) {
                return res.status(403).send({ message: "Forbidden" });
            }
        }

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

        if (!product || product.isActive === false) {
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
        res.status(500).json({
            success: false,
            message: "Failed to fetch product",
        });
    }
};

/** Public catalog — everyone (guest, user, provider, admin) sees full list */
export const getAllProducts = async (req, res) => {
    try {
        await ensureProductDisplayOrders();
        const result = await Product.find(PUBLIC_PRODUCT_FILTER).sort(PRODUCT_SORT);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to get products" });
    }
};

/** Dashboard product table — admin & provider see full catalog (only admin may update) */
export const getDashboardProducts = async (req, res) => {
    try {
        await ensureProductDisplayOrders();
        const result = await Product.find().sort(PRODUCT_SORT);
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

        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admins can update products",
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
        if (patch.isActive !== undefined && typeof patch.isActive !== "boolean") {
            return res.status(400).json({ success: false, message: "isActive must be boolean" });
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
        res.status(500).json({
            success: false,
            message: "Failed to update product",
            error: error.message,
        });
    }
};

/** PATCH /api/products/reorder — admin sets storefront list order */
export const reorderProducts = async (req, res) => {
    try {
        const { orderedIds } = req.body || {};

        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "orderedIds must be a non-empty array",
            });
        }

        for (const id of orderedIds) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product id in orderedIds",
                });
            }
        }

        const unique = new Set(orderedIds.map(String));
        if (unique.size !== orderedIds.length) {
            return res.status(400).json({
                success: false,
                message: "orderedIds must not contain duplicates",
            });
        }

        const count = await Product.countDocuments({ _id: { $in: orderedIds } });
        if (count !== orderedIds.length) {
            return res.status(400).json({
                success: false,
                message: "One or more products were not found",
            });
        }

        await Product.bulkWrite(
            orderedIds.map((id, index) => ({
                updateOne: {
                    filter: { _id: id },
                    update: { $set: { displayOrder: index } },
                },
            }))
        );

        res.status(200).json({
            success: true,
            message: "Product order updated",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to reorder products",
            error: error.message,
        });
    }
};
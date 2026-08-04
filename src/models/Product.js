import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            required: true,
        },

        price: {
            type: Number,
            required: true,
        },

        originalPrice: {
            type: Number,
            default: 0,
        },

        image: {
            type: String,
            required: true,
        },

        /** Up to 4 gallery images; `image` is kept in sync as the cover (first). */
        images: {
            type: [String],
            default: [],
            validate: {
                validator(arr) {
                    return !arr || arr.length <= 4;
                },
                message: "A product can have at most 4 images",
            },
        },

        type: {
            type: String,
            required: true,
        },

        packInfo: {
            type: String,
        },

        validityDays: {
            type: Number,
            default: 365,
            min: 1,
        },

        rating: {
            type: Number,
            default: 0,
        },

        reviews: {
            type: Number,
            default: 0,
        },

        inStock: {
            type: Boolean,
            default: true,
        },

        /** When false, hidden from storefront — customers cannot view or add to cart */
        isActive: {
            type: Boolean,
            default: true,
        },

        /** Homepage “Choose Your Smart QR Tag Package” spotlight — only one should be true */
        isFeatured: {
            type: Boolean,
            default: false,
            index: true,
        },

        /** Lower number = shown first in product list (dashboard + storefront) */
        displayOrder: {
            type: Number,
            default: null,
        },

        features: {
            type: [String], // array of strings
            default: [],
        },

        specifications: {
            material: String,
            dimensions: String,
            weight: String,
            battery: String,
            waterproof: String,
        },

        createdBy: {
            name: String,
            email: String,
            uid: String,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Product", productSchema);
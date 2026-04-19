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
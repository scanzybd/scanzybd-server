import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        price: {
            type: Number,
            required: true,
        },

        currency: {
            type: String,
            default: "BDT",
        },

        description: {
            type: String,
            required: true,
        },

        features: {
            type: [String],
            default: [],
        },

        category: {
            type: String,
            enum: ["starter", "standard", "premium"],
            default: "starter",
        },

        highlight: {
            type: Boolean,
            default: false,
        },

        createdBy: {
            name: String,
            email: String,
            uid: String,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Package", packageSchema);
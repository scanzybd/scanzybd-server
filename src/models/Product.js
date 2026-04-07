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
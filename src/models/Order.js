import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        items: [
            {
                productId: String,
                title: String,
                image: String,
                price: Number,
                quantity: Number,
            },
        ],

        totalAmount: {
            type: Number,
            required: true,
        },

        status: {
            type: String,
            enum: ["pending", "paid", "cancelled"],
            default: "pending",
        },

        paymentStatus: {
            type: String,
            enum: ["unpaid", "paid"],
            default: "unpaid",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Order", orderSchema);
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",

        },

        amount: {
            type: Number,
            required: true,
        },

        currency: {
            type: String,
            default: "BDT",
        },

        paymentMethod: {
            type: String,
            default: "bkash",
        },

        // 🔥 bkash payment ID (initial)
        paymentID: {
            type: String,
        },

        // 🔥 final transaction ID (bkash trxID)
        transactionId: {
            type: String,
            default: "",
        },

        status: {
            type: String,
            enum: ["pending", "success", "failed"],
            default: "pending",
        },

        cartItems: [
            {
                productId: String,
                name: String,
                price: Number,
                quantity: Number,
            },
        ],

        completedAt: Date,
        failedAt: Date,
    },
    { timestamps: true }
);
export default mongoose.model("Payment", paymentSchema);
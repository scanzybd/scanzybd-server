import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
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
    },
    { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
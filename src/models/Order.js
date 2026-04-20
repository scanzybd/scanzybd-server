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

        /** One entry per physical tag sold — links to Vehicle after checkout */
        tagAssignments: {
            type: [
                {
                    productId: { type: String, required: true },
                    productTitle: { type: String, default: "" },
                    vehicleId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Vehicle",
                        required: true,
                    },
                },
            ],
            default: [],
        },

        /** Delivery / contact for shipping the physical tags */
        shippingAddress: {
            fullName: { type: String, trim: true, default: "" },
            phone: { type: String, trim: true, default: "" },
            line1: { type: String, trim: true, default: "" },
            line2: { type: String, trim: true, default: "" },
            city: { type: String, trim: true, default: "" },
            district: { type: String, trim: true, default: "" },
            postalCode: { type: String, trim: true, default: "" },
        },

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
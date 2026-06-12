import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        title: { type: String, trim: true, default: "" },
        price: { type: Number, default: 0 },
        quantity: { type: Number, min: 1, default: 1 },
        validityDays: { type: Number },
        image: { type: String, default: null },
        type: { type: String, default: null },
        isActive: { type: Boolean, default: true },
    },
    { _id: false }
);

const cartSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        items: {
            type: [cartItemSchema],
            default: [],
        },
        lastActivityAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Cart", cartSchema);

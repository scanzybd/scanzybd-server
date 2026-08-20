import mongoose from "mongoose";

const tagSubscriptionSchema = new mongoose.Schema(
    {
        qrId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "QRCode",
            default: null,
            index: true,
        },
        qrCode: { type: String, trim: true, default: "" },
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        productId: { type: String, default: "" },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        validityDays: { type: Number, min: 1, default: 365 },
        validFrom: { type: Date, required: true },
        validUntil: { type: Date, required: true },
        status: {
            type: String,
            enum: ["active", "expired", "pending_qr", "replaced"],
            default: "active",
            index: true,
        },
        lastRenewMode: {
            type: String,
            enum: ["purchase", "same_qr", "new_qr", null],
            default: "purchase",
        },
    },
    { timestamps: true }
);

tagSubscriptionSchema.index({ qrId: 1, status: 1 });
tagSubscriptionSchema.index({ vehicleId: 1, orderId: 1 });
tagSubscriptionSchema.index({ qrId: 1, validUntil: -1 });

export default mongoose.model("TagSubscription", tagSubscriptionSchema);

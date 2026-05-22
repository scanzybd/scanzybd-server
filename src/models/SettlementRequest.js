import mongoose from "mongoose";

const settlementRequestSchema = new mongoose.Schema(
    {
        providerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        periodFrom: { type: Date, required: true },
        periodTo: { type: Date, required: true },
        amount: { type: Number, required: true, min: 0 },
        orderCount: { type: Number, default: 0 },
        orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
            index: true,
        },
        providerNote: { type: String, trim: true, default: "" },
        rejectNote: { type: String, trim: true, default: "" },
        paymentSnapshot: {
            bkashNumber: String,
            bankName: String,
            accountHolder: String,
            accountNumber: String,
            moneyReceiptNo: String,
            preferredMethod: String,
            note: String,
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        reviewedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

export default mongoose.model("SettlementRequest", settlementRequestSchema);

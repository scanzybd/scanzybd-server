import mongoose from "mongoose";

const providerPaymentProfileSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        bkashNumber: { type: String, trim: true, default: "" },
        bankName: { type: String, trim: true, default: "" },
        accountHolder: { type: String, trim: true, default: "" },
        accountNumber: { type: String, trim: true, default: "" },
        moneyReceiptNo: { type: String, trim: true, default: "" },
        preferredMethod: {
            type: String,
            enum: ["bkash", "bank", "cash"],
            default: "bkash",
        },
        note: { type: String, trim: true, default: "" },
    },
    { timestamps: true }
);

export default mongoose.model("ProviderPaymentProfile", providerPaymentProfileSchema);

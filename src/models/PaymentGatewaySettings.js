import mongoose from "mongoose";

const gatewayToggleSchema = new mongoose.Schema(
    {
        enabled: { type: Boolean, default: true },
    },
    { _id: false }
);

const manualBkashSchema = new mongoose.Schema(
    {
        enabled: { type: Boolean, default: false },
        qrImageUrl: { type: String, trim: true, default: "" },
        merchantNumber: { type: String, trim: true, default: "" },
        instructions: { type: String, trim: true, default: "" },
    },
    { _id: false }
);

const paymentGatewaySettingsSchema = new mongoose.Schema(
    {
        key: { type: String, default: "global", unique: true },
        bkash: {
            type: gatewayToggleSchema,
            default: () => ({ enabled: true }),
        },
        sslcommerz: {
            type: gatewayToggleSchema,
            default: () => ({ enabled: false }),
        },
        manualBkash: {
            type: manualBkashSchema,
            default: () => ({
                enabled: false,
                qrImageUrl: "",
                merchantNumber: "",
                instructions: "",
            }),
        },
        defaultGateway: {
            type: String,
            enum: ["bkash", "sslcommerz"],
            default: "bkash",
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

export default mongoose.model(
    "PaymentGatewaySettings",
    paymentGatewaySettingsSchema
);

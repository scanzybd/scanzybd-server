import mongoose from "mongoose";

const gatewayToggleSchema = new mongoose.Schema(
    {
        enabled: { type: Boolean, default: true },
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

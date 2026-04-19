import mongoose from "mongoose";

const qrSchema = new mongoose.Schema(
    {
        code: { type: String, unique: true, required: true },
        qrCode: String,
        qrLink: String,

        status: {
            type: String,
            default: "unassigned",
        },

        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null,
        },

        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        isAssigned: {
            type: Boolean,
            default: false,
        },

        scanCount: {
            type: Number,
            default: 0,
        },

        qrType: {
            type: String,
            default: "bike",
        },
    },
    { timestamps: true }
);

export default mongoose.model("QRCode", qrSchema);
import mongoose from "mongoose";

const qrSchema = new mongoose.Schema(
    {
        code: { type: String, unique: true, required: true },
        qrCode: String,
        qrLink: String,

        status: {
            type: String,
            enum: ["not assigned", "assigned"],
            default: "not assigned",
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

        scanCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

export default mongoose.model("QRCode", qrSchema);
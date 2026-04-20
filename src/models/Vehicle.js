import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
    {
        vehicleName: {
            type: String,
            required: true,
            trim: true,
        },
        model: {
            type: String,
            required: true,
        },
        plate: {
            type: String,
            required: true,
            trim: true,
        },
        ownerPhone: {
            type: String,
            trim: true,
            required: true,
        },
        driver: {
            name: String,
            phone: String,
        },

        qrData: {
            type: String,
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        /** Set when admin/provider registers the vehicle for a customer (owner). */
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

vehicleSchema.index({ owner: 1, plate: 1 }, { unique: true });

export default mongoose.model("Vehicle", vehicleSchema);
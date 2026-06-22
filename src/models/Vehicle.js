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
            trim: true,
            default: "",
        },
        /** Tag type name (e.g. "Car Tag", "Bike Tag", "Cycle Tag") — drives driver visibility. */
        tagType: {
            type: String,
            trim: true,
            default: "",
        },
        plate: {
            type: String,
            required: true,
            trim: true,
        },
        chassisLast4: {
            type: String,
            trim: true,
            default: "",
        },
        engineLast4: {
            type: String,
            trim: true,
            default: "",
        },
        ownerPhone: {
            type: String,
            trim: true,
            required: true,
        },
        ownerContactVisible: {
            type: Boolean,
            default: true,
        },
        emergencyPhone: {
            type: String,
            trim: true,
            required: true,
        },
        emergencyContactVisible: {
            type: Boolean,
            default: false,
        },
        driverContactVisible: {
            type: Boolean,
            default: true,
        },
        driver: {
            name: String,
            phone: String,
        },

        /** Up to 2 separate QR codes per vehicle */
        qrIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "QRCode",
            },
        ],
        /** @deprecated Legacy — kept in sync with first entry in qrIds */
        qrData: {
            type: String,
            default: null,
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
        /** Checkout order that first created this vehicle (for safe cascade delete). */
        sourceOrderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null,
            index: true,
        },
    },
    { timestamps: true }
);

vehicleSchema.index({ owner: 1, plate: 1 }, { unique: true });

export default mongoose.model("Vehicle", vehicleSchema);
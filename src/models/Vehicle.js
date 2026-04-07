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
            unique: true,
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
    },
    { timestamps: true }
);

export default mongoose.model("Vehicle", vehicleSchema);
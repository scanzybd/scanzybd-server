import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        seq: {
            type: Number,
            required: true,
            default: -1,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Counter", counterSchema);

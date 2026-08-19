import mongoose from "mongoose";

const userSessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        sessionId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        role: {
            type: String,
            enum: ["admin", "provider", "user"],
            required: true,
        },
        userAgent: {
            type: String,
            default: "",
        },
        ip: {
            type: String,
            default: "",
        },
        label: {
            type: String,
            default: "Unknown device",
        },
        lastSeenAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

userSessionSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model("UserSession", userSessionSchema);

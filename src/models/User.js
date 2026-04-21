import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            default: null,

        },
        uid: {
            type: String,
            default: null,
        },

        phone: {
            type: String,
            trim: true,
        },

        role: {
            type: String,
            enum: ["admin", "provider", "user"],
            default: "user",
        },

        photo: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        resetCodeHash: {
            type: String,
            default: null,
        },
        resetCodeExpiresAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true, // 🔥 createdAt, updatedAt
    }
);

export default mongoose.model("User", userSchema);
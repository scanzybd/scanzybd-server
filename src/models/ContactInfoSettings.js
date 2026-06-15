import mongoose from "mongoose";

const contactInfoSettingsSchema = new mongoose.Schema(
    {
        key: { type: String, default: "global", unique: true },
        phone: { type: String, default: "", trim: true },
        phoneEnabled: { type: Boolean, default: true },
        whatsapp: { type: String, default: "", trim: true },
        whatsappEnabled: { type: Boolean, default: false },
        email: { type: String, default: "", trim: true },
        addressLine1: { type: String, default: "", trim: true },
        addressLine2: { type: String, default: "", trim: true },
        businessHours: { type: String, default: "", trim: true },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

export default mongoose.model("ContactInfoSettings", contactInfoSettingsSchema);

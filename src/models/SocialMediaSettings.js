import mongoose from "mongoose";

const linkSchema = new mongoose.Schema(
    {
        url: { type: String, default: "" },
        enabled: { type: Boolean, default: true },
    },
    { _id: false }
);

const socialMediaSettingsSchema = new mongoose.Schema(
    {
        key: { type: String, default: "global", unique: true },
        facebook: { type: linkSchema, default: () => ({ enabled: true, url: "" }) },
        instagram: { type: linkSchema, default: () => ({ enabled: true, url: "" }) },
        tiktok: { type: linkSchema, default: () => ({ enabled: true, url: "" }) },
        twitter: { type: linkSchema, default: () => ({ enabled: false, url: "" }) },
        linkedin: { type: linkSchema, default: () => ({ enabled: false, url: "" }) },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

export default mongoose.model("SocialMediaSettings", socialMediaSettingsSchema);

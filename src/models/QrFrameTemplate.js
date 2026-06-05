import mongoose from "mongoose";

const overlaySchema = new mongoose.Schema(
    {
        top: { type: Number, default: 50 },
        left: { type: Number, default: 50 },
        size: { type: Number, default: 30 },
    },
    { _id: false }
);

const stickerMmSchema = new mongoose.Schema(
    {
        w: { type: Number, required: true },
        h: { type: Number, required: true },
    },
    { _id: false }
);

const cardSizeSchema = new mongoose.Schema(
    {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
    },
    { _id: false }
);

const pageInsetSchema = new mongoose.Schema(
    {
        top: { type: Number, default: 6 },
        bottom: { type: Number, default: 6 },
        left: { type: Number, default: 4 },
        right: { type: Number, default: 4 },
        gap: { type: Number, default: 2 },
    },
    { _id: false }
);

const qrFrameTemplateSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        label: { type: String, required: true, trim: true },
        category: { type: String, trim: true, default: "" },
        icon: {
            type: String,
            enum: ["bike", "car", "box"],
            default: "box",
        },
        /** Client public path fallback e.g. /qr-frame/bike.svg */
        svgPath: { type: String, trim: true, default: "" },
        /** Uploaded SVG markup stored in DB (preferred when set) */
        svgMarkup: { type: String, default: "" },
        overlay: { type: overlaySchema, default: () => ({}) },
        overlayCss: {
            type: overlaySchema,
            default: () => ({}),
        },
        frameZoom: { type: Number, default: 1 },
        frameOffsetX: { type: String, default: "0%" },
        frameOffsetY: { type: String, default: "0%" },
        stickerMm: { type: stickerMmSchema, required: true },
        cardSize: { type: cardSizeSchema, required: true },
        pageInset: { type: pageInsetSchema, default: () => ({}) },
        sortOrder: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: "qr_frame_templates" }
);

export default mongoose.model("QrFrameTemplate", qrFrameTemplateSchema);

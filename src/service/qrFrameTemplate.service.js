import QrFrameTemplate from "../models/QrFrameTemplate.js";

export const DEFAULT_QR_FRAME_TEMPLATES = [
    {
        slug: "bike",
        label: "Bike tag",
        category: "bike",
        icon: "bike",
        svgPath: "/qr-frame/bike.svg",
        overlay: { top: 50, left: 26, size: 28 },
        overlayCss: { top: 50, left: 26, size: 35 },
        frameZoom: 1,
        frameOffsetX: "0%",
        frameOffsetY: "0%",
        stickerMm: { w: 82.55, h: 44.45 },
        cardSize: {
            width: Math.round((180 * 82.55) / 44.45),
            height: 180,
        },
        pageInset: { top: 6, bottom: 6, left: 4, right: 4, gap: 2 },
        sortOrder: 1,
    },
    {
        slug: "car",
        label: "Car tag",
        category: "car",
        icon: "car",
        svgPath: "/qr-frame/car.svg",
        overlay: { top: 40, left: 50, size: 52 },
        overlayCss: { top: 40, left: 50, size: 65 },
        frameZoom: 1,
        frameOffsetX: "0%",
        frameOffsetY: "0%",
        stickerMm: { w: 69.85, h: 95.25 },
        cardSize: {
            width: Math.round((410 * 69.85) / 95.25),
            height: 410,
        },
        pageInset: { top: 6, bottom: 6, left: 4, right: 4, gap: 2 },
        sortOrder: 2,
    },
];

export async function ensureQrFrameTemplatesSeeded() {
    const count = await QrFrameTemplate.countDocuments();
    if (count > 0) return;
    await QrFrameTemplate.insertMany(DEFAULT_QR_FRAME_TEMPLATES);
}

export async function listActiveQrFrameTemplates() {
    await ensureQrFrameTemplatesSeeded();
    return QrFrameTemplate.find({ isActive: { $ne: false } })
        .sort({ sortOrder: 1, label: 1 })
        .lean();
}

export async function listAllQrFrameTemplates() {
    await ensureQrFrameTemplatesSeeded();
    return QrFrameTemplate.find().sort({ sortOrder: 1, label: 1 }).lean();
}

export async function getActiveQrTypeSlugs() {
    const rows = await listActiveQrFrameTemplates();
    return rows.map((r) => r.slug);
}

export async function findQrFrameTemplateBySlug(slug) {
    await ensureQrFrameTemplatesSeeded();
    const s = String(slug || "").trim().toLowerCase();
    if (!s) return null;
    return QrFrameTemplate.findOne({ slug: s }).lean();
}

export async function resolveQrTypeForGenerate(rawType) {
    const slugs = await getActiveQrTypeSlugs();
    const t = String(rawType || "").trim().toLowerCase();
    if (slugs.includes(t)) return t;
    return slugs[0] || "bike";
}

export function normalizeSlugInput(raw) {
    return String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

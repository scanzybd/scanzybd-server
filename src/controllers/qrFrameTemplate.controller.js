import QrFrameTemplate from "../models/QrFrameTemplate.js";
import {
    ensureQrFrameTemplatesSeeded,
    findQrFrameTemplateBySlug,
    listActiveQrFrameTemplates,
    listAllQrFrameTemplates,
    normalizeSlugInput,
} from "../service/qrFrameTemplate.service.js";

function serializeTemplate(doc) {
    if (!doc) return null;
    const hasMarkup = Boolean(String(doc.svgMarkup || "").trim());
    const { svgMarkup: _omit, ...rest } = doc;
    return {
        ...rest,
        hasSvgMarkup: hasMarkup,
    };
}

export const getActiveFrameTemplates = async (req, res) => {
    try {
        const templates = await listActiveQrFrameTemplates();
        res.json({
            success: true,
            templates: templates.map(serializeTemplate),
        });
    } catch (err) {
        console.error("getActiveFrameTemplates:", err);
        res.status(500).json({ message: err.message });
    }
};

export const getAllFrameTemplatesAdmin = async (req, res) => {
    try {
        const templates = await listAllQrFrameTemplates();
        res.json({
            success: true,
            templates: templates.map(serializeTemplate),
        });
    } catch (err) {
        console.error("getAllFrameTemplatesAdmin:", err);
        res.status(500).json({ message: err.message });
    }
};

export const getFrameTemplateSvg = async (req, res) => {
    try {
        const doc = await findQrFrameTemplateBySlug(req.params.slug);
        if (!doc) {
            return res.status(404).json({ message: "Frame template not found" });
        }
        const markup = String(doc.svgMarkup || "").trim();
        if (markup) {
            res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
            res.setHeader("Cache-Control", "public, max-age=300");
            return res.send(markup);
        }
        return res.status(404).json({
            message: "No uploaded SVG for this template. Use svgPath on client or upload SVG.",
            svgPath: doc.svgPath || "",
        });
    } catch (err) {
        console.error("getFrameTemplateSvg:", err);
        res.status(500).json({ message: err.message });
    }
};

export const createFrameTemplate = async (req, res) => {
    try {
        const slug = normalizeSlugInput(req.body?.slug);
        if (!slug) {
            return res.status(400).json({ message: "slug is required (a-z, 0-9, _)" });
        }
        const exists = await QrFrameTemplate.findOne({ slug });
        if (exists) {
            return res.status(409).json({ message: "slug already exists" });
        }

        const body = req.body || {};
        const stickerMm = body.stickerMm || { w: 80, h: 45 };
        const cardSize =
            body.cardSize ||
            {
                width: Math.round((180 * stickerMm.w) / stickerMm.h),
                height: 180,
            };

        const doc = await QrFrameTemplate.create({
            slug,
            label: String(body.label || slug).trim(),
            category: String(body.category || "").trim(),
            icon: ["bike", "car", "box"].includes(body.icon) ? body.icon : "box",
            svgPath: String(body.svgPath || "").trim(),
            svgMarkup: String(body.svgMarkup || "").trim(),
            overlay: body.overlay || { top: 50, left: 50, size: 30 },
            overlayCss: body.overlayCss || body.overlay || { top: 50, left: 50, size: 35 },
            frameZoom: Number(body.frameZoom) || 1,
            frameOffsetX: String(body.frameOffsetX ?? "0%"),
            frameOffsetY: String(body.frameOffsetY ?? "0%"),
            stickerMm,
            cardSize,
            pageInset: body.pageInset || { top: 6, bottom: 6, left: 4, right: 4, gap: 2 },
            sortOrder: Number(body.sortOrder) || 0,
            isActive: body.isActive !== false,
        });

        res.status(201).json({ success: true, template: serializeTemplate(doc.toObject()) });
    } catch (err) {
        console.error("createFrameTemplate:", err);
        res.status(500).json({ message: err.message });
    }
};

export const updateFrameTemplate = async (req, res) => {
    try {
        const slug = normalizeSlugInput(req.params.slug);
        const doc = await QrFrameTemplate.findOne({ slug });
        if (!doc) {
            return res.status(404).json({ message: "Frame template not found" });
        }

        const body = req.body || {};
        const fields = [
            "label",
            "category",
            "icon",
            "svgPath",
            "svgMarkup",
            "overlay",
            "overlayCss",
            "frameZoom",
            "frameOffsetX",
            "frameOffsetY",
            "stickerMm",
            "cardSize",
            "pageInset",
            "sortOrder",
            "isActive",
        ];

        for (const key of fields) {
            if (body[key] !== undefined) {
                doc[key] = body[key];
            }
        }

        if (body.icon && !["bike", "car", "box"].includes(body.icon)) {
            return res.status(400).json({ message: "icon must be bike, car, or box" });
        }

        await doc.save();
        res.json({ success: true, template: serializeTemplate(doc.toObject()) });
    } catch (err) {
        console.error("updateFrameTemplate:", err);
        res.status(500).json({ message: err.message });
    }
};

export const uploadFrameTemplateSvg = async (req, res) => {
    try {
        const slug = normalizeSlugInput(req.params.slug);
        const doc = await QrFrameTemplate.findOne({ slug });
        if (!doc) {
            return res.status(404).json({ message: "Frame template not found" });
        }

        const markup = String(req.body?.svgMarkup || req.body?.svg || "").trim();
        if (!markup || !markup.includes("<svg")) {
            return res.status(400).json({ message: "svgMarkup must be valid SVG text" });
        }

        doc.svgMarkup = markup;
        await doc.save();

        res.json({ success: true, template: serializeTemplate(doc.toObject()) });
    } catch (err) {
        console.error("uploadFrameTemplateSvg:", err);
        res.status(500).json({ message: err.message });
    }
};

export const seedFrameTemplates = async (req, res) => {
    try {
        await ensureQrFrameTemplatesSeeded();
        const templates = await listAllQrFrameTemplates();
        res.json({
            success: true,
            message: "Defaults ensured (existing rows kept)",
            templates: templates.map(serializeTemplate),
        });
    } catch (err) {
        console.error("seedFrameTemplates:", err);
        res.status(500).json({ message: err.message });
    }
};

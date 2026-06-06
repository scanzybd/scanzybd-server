import SocialMediaSettings from "../models/SocialMediaSettings.js";

export const DEFAULT_SOCIAL_MEDIA = {
    facebook: {
        url: "https://www.facebook.com/people/Scanzybd/61589104403859/",
        enabled: true,
    },
    instagram: {
        url: "https://www.instagram.com/scanzybdofficial",
        enabled: true,
    },
    tiktok: {
        url: "https://www.tiktok.com/@scanzybd",
        enabled: true,
    },
    twitter: { url: "", enabled: false },
    linkedin: { url: "", enabled: false },
};

const PLATFORMS = ["facebook", "instagram", "tiktok", "twitter", "linkedin"];

function normalizeLink(raw, fallback) {
    const base = fallback || { url: "", enabled: false };
    return {
        url: String(raw?.url ?? base.url ?? "").trim(),
        enabled: raw?.enabled !== undefined ? Boolean(raw.enabled) : Boolean(base.enabled),
    };
}

export function serializeSocialMedia(doc) {
    const out = {};
    for (const p of PLATFORMS) {
        out[p] = normalizeLink(doc?.[p], DEFAULT_SOCIAL_MEDIA[p]);
    }
    return out;
}

export async function getOrCreateSocialMediaSettings() {
    let doc = await SocialMediaSettings.findOne({ key: "global" }).lean();
    if (!doc) {
        const created = await SocialMediaSettings.create({
            key: "global",
            ...DEFAULT_SOCIAL_MEDIA,
        });
        doc = created.toObject();
    }
    return serializeSocialMedia(doc);
}

export async function updateSocialMediaSettings(body, userId) {
    let doc = await SocialMediaSettings.findOne({ key: "global" });
    if (!doc) {
        doc = await SocialMediaSettings.create({
            key: "global",
            ...DEFAULT_SOCIAL_MEDIA,
        });
    }

    for (const p of PLATFORMS) {
        if (body?.[p] !== undefined) {
            doc[p] = normalizeLink(body[p], DEFAULT_SOCIAL_MEDIA[p]);
            doc.markModified(p);
        }
    }

    doc.updatedBy = userId || null;
    await doc.save();

    return serializeSocialMedia(doc.toObject());
}

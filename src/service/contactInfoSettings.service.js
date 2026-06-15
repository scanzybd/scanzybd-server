import ContactInfoSettings from "../models/ContactInfoSettings.js";

export const DEFAULT_CONTACT_INFO = {
    phone: "01850000000",
    phoneEnabled: true,
    whatsapp: "01850000000",
    whatsappEnabled: false,
    email: "scanzybd@gmail.com",
    addressLine1: "Dhaka",
    addressLine2: "Bangladesh",
    businessHours: "10 AM – 8 PM (Sat–Thu)",
};

const FIELDS = [
    "phone",
    "phoneEnabled",
    "whatsapp",
    "whatsappEnabled",
    "email",
    "addressLine1",
    "addressLine2",
    "businessHours",
];

function normalizePhone(value) {
    return String(value || "")
        .replace(/\D/g, "")
        .slice(0, 11);
}

export function serializeContactInfo(doc) {
    const base = { ...DEFAULT_CONTACT_INFO };
    const out = {};
    for (const key of FIELDS) {
        if (key === "phone" || key === "whatsapp") {
            out[key] = normalizePhone(doc?.[key] ?? base[key]);
            continue;
        }
        if (key.endsWith("Enabled")) {
            out[key] =
                doc?.[key] !== undefined ? Boolean(doc[key]) : Boolean(base[key]);
            continue;
        }
        out[key] = String(doc?.[key] ?? base[key] ?? "").trim();
    }
    return out;
}

export async function getOrCreateContactInfoSettings() {
    let doc = await ContactInfoSettings.findOne({ key: "global" }).lean();
    if (!doc) {
        const created = await ContactInfoSettings.create({
            key: "global",
            ...DEFAULT_CONTACT_INFO,
        });
        doc = created.toObject();
    }
    return serializeContactInfo(doc);
}

export async function updateContactInfoSettings(body, userId) {
    let doc = await ContactInfoSettings.findOne({ key: "global" });
    if (!doc) {
        doc = await ContactInfoSettings.create({
            key: "global",
            ...DEFAULT_CONTACT_INFO,
        });
    }

    for (const key of FIELDS) {
        if (body?.[key] === undefined) continue;
        if (key === "phone" || key === "whatsapp") {
            doc[key] = normalizePhone(body[key]);
        } else if (key.endsWith("Enabled")) {
            doc[key] = Boolean(body[key]);
        } else {
            doc[key] = String(body[key] ?? "").trim();
        }
    }

    if (doc.phone && !/^\d{11}$/.test(doc.phone)) {
        const err = new Error("Phone must be exactly 11 digits");
        err.statusCode = 400;
        throw err;
    }
    if (doc.whatsapp && !/^\d{11}$/.test(doc.whatsapp)) {
        const err = new Error("WhatsApp number must be exactly 11 digits");
        err.statusCode = 400;
        throw err;
    }
    if (doc.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.email)) {
        const err = new Error("Invalid email address");
        err.statusCode = 400;
        throw err;
    }

    doc.updatedBy = userId || null;
    await doc.save();

    return serializeContactInfo(doc.toObject());
}

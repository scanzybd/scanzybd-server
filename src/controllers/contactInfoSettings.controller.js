import {
    getOrCreateContactInfoSettings,
    updateContactInfoSettings,
} from "../service/contactInfoSettings.service.js";

export const getPublicContactInfoSettings = async (req, res) => {
    try {
        const contact = await getOrCreateContactInfoSettings();
        res.json({ success: true, contact });
    } catch (err) {
        console.error("getPublicContactInfoSettings:", err);
        res.status(500).json({ message: err.message });
    }
};

export const getAdminContactInfoSettings = async (req, res) => {
    try {
        const contact = await getOrCreateContactInfoSettings();
        res.json({ success: true, contact });
    } catch (err) {
        console.error("getAdminContactInfoSettings:", err);
        res.status(500).json({ message: err.message });
    }
};

export const updateAdminContactInfoSettings = async (req, res) => {
    try {
        const contact = await updateContactInfoSettings(req.body, req.user?._id);
        res.json({ success: true, contact });
    } catch (err) {
        const status = err.statusCode || 500;
        console.error("updateAdminContactInfoSettings:", err);
        res.status(status).json({ message: err.message });
    }
};

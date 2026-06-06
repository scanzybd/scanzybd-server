import {
    getOrCreateSocialMediaSettings,
    updateSocialMediaSettings,
} from "../service/socialMediaSettings.service.js";

export const getPublicSocialMediaSettings = async (req, res) => {
    try {
        const social = await getOrCreateSocialMediaSettings();
        res.json({ success: true, social });
    } catch (err) {
        console.error("getPublicSocialMediaSettings:", err);
        res.status(500).json({ message: err.message });
    }
};

export const getAdminSocialMediaSettings = async (req, res) => {
    try {
        const social = await getOrCreateSocialMediaSettings();
        res.json({ success: true, social });
    } catch (err) {
        console.error("getAdminSocialMediaSettings:", err);
        res.status(500).json({ message: err.message });
    }
};

export const updateAdminSocialMediaSettings = async (req, res) => {
    try {
        const social = await updateSocialMediaSettings(req.body, req.user?._id);
        res.json({ success: true, social });
    } catch (err) {
        console.error("updateAdminSocialMediaSettings:", err);
        res.status(500).json({ message: err.message });
    }
};

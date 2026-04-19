import User from "../models/User.js";
import bcrypt from "bcrypt";
import admin from "../config/firebaseAdmin.js";

const ALLOWED_CREATE_ROLES = ["user", "provider"];

export const listUsers = async (req, res) => {
    try {
        const { search, role } = req.query;
        const filter = {};

        if (role && ["admin", "provider", "user"].includes(role)) {
            filter.role = role;
        }

        if (search && String(search).trim()) {
            const q = String(search).trim();
            filter.$or = [
                { name: new RegExp(q, "i") },
                { email: new RegExp(q, "i") },
            ];
        }

        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .select("-password")
            .lean();

        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const createUserByAdmin = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name?.trim() || !email?.trim() || !password) {
            return res.status(400).json({
                message: "Name, email, and password are required",
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters",
            });
        }

        if (!ALLOWED_CREATE_ROLES.includes(role)) {
            return res.status(400).json({
                message: "Role must be user or provider",
            });
        }

        const emailNorm = email.toLowerCase().trim();
        const exist = await User.findOne({ email: emailNorm });
        if (exist) {
            return res.status(400).json({ message: "Email already registered" });
        }

        let firebaseUid = null;
        try {
            const fbUser = await admin.auth().createUser({
                email: emailNorm,
                password: String(password),
                displayName: name.trim(),
            });
            firebaseUid = fbUser.uid;
        } catch (e) {
            if (e?.code === "auth/email-already-exists") {
                return res.status(400).json({
                    message: "Email already registered in authentication",
                });
            }
            console.error("Firebase createUser:", e);
            return res.status(500).json({
                message: e?.message || "Could not create authentication account",
            });
        }

        const hashed = await bcrypt.hash(String(password), 10);

        try {
            const user = await User.create({
                name: name.trim(),
                email: emailNorm,
                password: hashed,
                uid: firebaseUid,
                role,
            });

            const safe = user.toObject();
            delete safe.password;

            res.status(201).json({ success: true, data: safe });
        } catch (err) {
            await admin.auth().deleteUser(firebaseUid).catch(() => {});
            res.status(500).json({ message: err.message });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {
            return res.status(400).json({ message: "isActive boolean required" });
        }

        if (req.user._id.toString() === id && isActive === false) {
            return res.status(400).json({ message: "You cannot deactivate your own account" });
        }

        const user = await User.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

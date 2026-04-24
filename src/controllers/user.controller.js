import User from "../models/User.js";
import bcrypt from "bcrypt";

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

/** Customer accounts only — for admin/provider to assign vehicle owner */
export const listAssignableUsers = async (req, res) => {
    try {
        const { search } = req.query;
        const filter = { role: "user", isActive: { $ne: false } };

        if (search && String(search).trim()) {
            const q = String(search).trim();
            filter.$or = [
                { name: new RegExp(q, "i") },
                { email: new RegExp(q, "i") },
            ];
        }

        const users = await User.find(filter)
            .sort({ name: 1 })
            .select("name email role")
            .limit(200)
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

        const hashed = await bcrypt.hash(String(password), 10);

        try {
            const user = await User.create({
                name: name.trim(),
                email: emailNorm,
                password: hashed,
                role,
            });

            const safe = user.toObject();
            delete safe.password;

            res.status(201).json({ success: true, data: safe });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, name, role } = req.body;
        const updates = {};

        if (isActive !== undefined) {
            if (typeof isActive !== "boolean") {
                return res.status(400).json({ message: "isActive must be boolean" });
            }
            updates.isActive = isActive;
        }

        if (name !== undefined) {
            const trimmedName = String(name || "").trim();
            if (!trimmedName) {
                return res.status(400).json({ message: "Name is required" });
            }
            updates.name = trimmedName;
        }

        if (role !== undefined) {
            if (!["admin", "provider", "user"].includes(role)) {
                return res.status(400).json({ message: "Invalid role" });
            }
            updates.role = role;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        if (req.user._id.toString() === id && updates.isActive === false) {
            return res.status(400).json({ message: "You cannot deactivate your own account" });
        }

        const user = await User.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendResetCodeEmail } from "../utils/mailer.js";

/** Backend app JWT: 24h — returns token + expiresAt (ms) for client storage */
function signAppJwt(user) {
    const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
    );
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000;
    return { token, expiresAt };
}

// ================= REGISTER =================
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // check duplicate
        const exist = await User.findOne({ email });
        if (exist) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            // phone,
            password: hashed,
        });

        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// ================= LOGIN =================
export const login = async (req, res) => {
    try {
        const email = String(req.body?.email || "").toLowerCase().trim();
        const password = String(req.body?.password || "");

        if (!email || !password) {
            return res.status(400).json({ msg: "Email and password are required" });
        }

        const usersWithEmail = await User.find({ email }).sort({ createdAt: -1 });
        if (!usersWithEmail.length) {
            return res.status(404).json({ msg: "User not found" });
        }

        // Hard block by email if any matching account is disabled.
        if (usersWithEmail.some((u) => u.isActive === false)) {
            return res.status(403).json({ msg: "Account is disabled" });
        }

        // Prefer DB account that actually has a password (in case a social-only record also exists).
        let user = usersWithEmail.find(
            (u) => typeof u.password === "string" && u.password !== ""
        );

        // Fallback: any account with this email (for better error messaging).
        if (!user) {
            user = usersWithEmail[0];
        }
        if (!user.password || typeof user.password !== "string") {
            return res.status(400).json({
                msg: "Password is not set for this account. Use Forgot Password to set a new password, then login with email and password.",
            });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ msg: "Wrong password" });

        const { token, expiresAt } = signAppJwt(user);

        res.json({ token, expiresAt, user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ================= SOCIAL LOGIN (DB-FIRST) =================
export const socialLogin = async (req, res) => {
    try {
        const { email, name, photo, provider, providerId } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required for social login",
            });
        }

        const emailNorm = String(email).toLowerCase().trim();
        const usersWithEmail = await User.find({ email: emailNorm }).sort({ createdAt: -1 });
        if (usersWithEmail.some((u) => u.isActive === false)) {
            return res.status(403).json({
                success: false,
                message: "Account is disabled",
            });
        }
        let user = usersWithEmail[0] || null;

        // Create social user in DB on first login.
        if (!user) {
            user = await User.create({
                name: name?.trim() || "Social User",
                email: emailNorm,
                photo: photo || null,
                uid: providerId || null,
                role: "user",
            });
        } else {
            const updates = {};
            if (photo && photo !== user.photo) updates.photo = photo;
            if (providerId && providerId !== user.uid) updates.uid = providerId;
            if (name?.trim() && name.trim() !== user.name) updates.name = name.trim();
            if (Object.keys(updates).length > 0) {
                user = await User.findByIdAndUpdate(user._id, updates, { new: true });
            }
        }

        const { token: appToken, expiresAt } = signAppJwt(user);

        return res.json({
            success: true,
            provider: provider || "social",
            token: appToken,
            expiresAt,
            user,
        });

    } catch (err) {
        console.log("Social login error:", err);
        return res.status(401).json({
            success: false,
            message: "Social login failed",
        });
    }
};



export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password").lean();

        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        res.json(user);

    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const email = String(req.body?.email || "").toLowerCase().trim();
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({ email });
        // Do not reveal user existence to avoid email enumeration.
        if (!user) {
            return res.json({ success: true, message: "If account exists, reset code was sent." });
        }
        const recipientEmail = String(user.email || email).toLowerCase().trim();

        const code = String(crypto.randomInt(100000, 1000000));
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await User.findByIdAndUpdate(user._id, {
            resetCodeHash: codeHash,
            resetCodeExpiresAt: expiresAt,
        });

        let emailSent = false;
        try {
            emailSent = await sendResetCodeEmail({
                toEmail: recipientEmail,
                code,
                expiresMinutes: 10,
            });
        } catch (mailErr) {
            console.log("Reset mail send failed:", mailErr.message);
        }

        return res.json({
            success: true,
            message: emailSent ? "Reset code sent to email" : "If account exists, reset code was sent.",
            expiresAt: expiresAt.getTime(),
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Could not process reset request" });
    }
};

export const verifyResetCode = async (req, res) => {
    try {
        const email = String(req.body?.email || "").toLowerCase().trim();
        const code = String(req.body?.code || "").trim();
        if (!email || !code) {
            return res.status(400).json({ message: "Email and code are required" });
        }

        const user = await User.findOne({ email });
        if (!user?.resetCodeHash || !user?.resetCodeExpiresAt) {
            return res.status(400).json({ message: "No active reset code" });
        }
        if (new Date(user.resetCodeExpiresAt).getTime() < Date.now()) {
            return res.status(400).json({ message: "Reset code expired" });
        }

        const ok = await bcrypt.compare(code, user.resetCodeHash);
        if (!ok) {
            return res.status(400).json({ message: "Invalid reset code" });
        }

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Could not verify reset code" });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const email = String(req.body?.email || "").toLowerCase().trim();
        const code = String(req.body?.code || "").trim();
        const newPassword = String(req.body?.newPassword || "");
        if (!email || !code || !newPassword) {
            return res.status(400).json({ message: "Email, code and newPassword are required" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const user = await User.findOne({ email });
        if (!user?.resetCodeHash || !user?.resetCodeExpiresAt) {
            return res.status(400).json({ message: "No active reset code" });
        }
        if (new Date(user.resetCodeExpiresAt).getTime() < Date.now()) {
            return res.status(400).json({ message: "Reset code expired" });
        }

        const ok = await bcrypt.compare(code, user.resetCodeHash);
        if (!ok) {
            return res.status(400).json({ message: "Invalid reset code" });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(user._id, {
            password: hashed,
            resetCodeHash: null,
            resetCodeExpiresAt: null,
        });

        return res.json({ success: true, message: "Password reset successful" });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Could not reset password" });
    }
};
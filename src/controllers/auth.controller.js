import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendResetCodeEmail } from "../utils/mailer.js";
import { verifyFirebaseIdToken } from "../utils/verifyFirebaseToken.js";

const INVALID_CREDENTIALS_MSG = "Invalid email or password";

function publicUser(user) {
    if (!user) return null;
    const doc = user.toObject ? user.toObject() : user;
    return {
        _id: doc._id,
        name: doc.name,
        email: doc.email,
        role: doc.role,
        photo: doc.photo ?? null,
        phone: doc.phone ?? null,
    };
}

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
        const name = String(req.body?.name || "").trim();
        const email = String(req.body?.email || "").toLowerCase().trim();
        const password = String(req.body?.password || "");

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email, and password are required",
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters",
            });
        }

        const exist = await User.findOne({ email });
        if (exist) {
            return res.status(400).json({
                message:
                    "Unable to create account with this email. Try logging in or use forgot password.",
            });
        }

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashed,
        });

        res.status(201).json({
            success: true,
            message: "Registration successful. You can log in now.",
            user: publicUser(user),
        });
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
            return res.status(401).json({ msg: INVALID_CREDENTIALS_MSG });
        }

        if (usersWithEmail.some((u) => u.isActive === false)) {
            return res.status(403).json({ msg: "Account is disabled" });
        }

        let user = usersWithEmail.find(
            (u) => typeof u.password === "string" && u.password !== ""
        );

        if (!user) {
            user = usersWithEmail[0];
        }
        if (!user.password || typeof user.password !== "string") {
            return res.status(401).json({ msg: INVALID_CREDENTIALS_MSG });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ msg: INVALID_CREDENTIALS_MSG });
        }

        const { token, expiresAt } = signAppJwt(user);

        res.json({ token, expiresAt, user: publicUser(user) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ================= SOCIAL LOGIN (Firebase ID token verified server-side) =================
export const socialLogin = async (req, res) => {
    try {
        const { idToken, provider } = req.body;

        if (!idToken) {
            return res.status(400).json({
                success: false,
                message: "idToken is required for social login",
            });
        }

        let verified;
        try {
            verified = await verifyFirebaseIdToken(idToken);
        } catch (verifyErr) {
            return res.status(401).json({
                success: false,
                message: verifyErr.message || "Invalid social login token",
            });
        }

        if (!verified.email) {
            return res.status(400).json({
                success: false,
                message: "Verified account has no email",
            });
        }

        const emailNorm = verified.email;
        const usersWithEmail = await User.find({ email: emailNorm }).sort({ createdAt: -1 });
        if (usersWithEmail.some((u) => u.isActive === false)) {
            return res.status(403).json({
                success: false,
                message: "Account is disabled",
            });
        }
        let user = usersWithEmail[0] || null;

        if (!user) {
            user = await User.create({
                name: verified.name?.trim() || "Social User",
                email: emailNorm,
                photo: verified.photo || null,
                uid: verified.uid || null,
                role: "user",
            });
        } else {
            const updates = {};
            if (verified.photo && verified.photo !== user.photo) updates.photo = verified.photo;
            if (verified.uid && verified.uid !== user.uid) updates.uid = verified.uid;
            if (verified.name?.trim() && verified.name.trim() !== user.name) {
                updates.name = verified.name.trim();
            }
            if (Object.keys(updates).length > 0) {
                user = await User.findByIdAndUpdate(user._id, updates, { new: true });
            }
        }

        const { token: appToken, expiresAt } = signAppJwt(user);

        return res.json({
            success: true,
            provider: provider || "google",
            token: appToken,
            expiresAt,
            user: publicUser(user),
        });
    } catch (err) {
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

export const updateMe = async (req, res) => {
    try {
        const name = String(req.body?.name ?? "").trim();

        if (!name) {
            return res.status(400).json({ message: "Name is required" });
        }

        if (name.length > 120) {
            return res.status(400).json({ message: "Name is too long" });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { name },
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        } catch {
            /* email delivery failed — response still generic */
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
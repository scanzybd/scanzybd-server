import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import admin from "../config/firebaseAdmin.js";
import { findUserByFirebaseEmail } from "../utils/findUserByEmail.js";

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
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ msg: "User not found" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ msg: "Wrong password" });

        const { token, expiresAt } = signAppJwt(user);

        res.json({ token, expiresAt, user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ================= FIREBASE / GOOGLE LOGIN =================
export const firebaseLogin = async (req, res) => {
    try {
        const { token } = req.body;

        const decoded = await admin.auth().verifyIdToken(token);

        const email = decoded.email;
        const name = decoded.name || "No Name";
        const photo = decoded.picture || "";

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "No email from Firebase",
            });
        }

        // STEP 1: existing user (same lookup as auth middleware — case-insensitive)
        let user = await findUserByFirebaseEmail(email);

        // STEP 2: create only if no document matches this Firebase email
        if (!user) {
            user = await User.create({
                name,
                email: String(email).toLowerCase().trim(),
                photo,
                role: "user",
            });
        }



        const { token: appToken, expiresAt } = signAppJwt(user);

        return res.json({
            success: true,
            token: appToken,
            expiresAt,
            user,
        });

    } catch (err) {
        console.log("Firebase error:", err);
        return res.status(401).json({
            success: false,
            message: "Firebase login failed",
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
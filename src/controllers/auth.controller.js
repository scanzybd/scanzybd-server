import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import admin from "../config/firebaseAdmin.js";

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

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ token, user });
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

        // 🔥 STEP 1: CHECK USER
        let user = await User.findOne({ email });

        // 🔥 STEP 2: CREATE ONLY IF NOT EXISTS
        if (!user) {
            user = await User.create({
                name,
                email,
                photo,
                role: "user",
            });
        }



        // 🔥 STEP 3: JWT
        const appToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({
            success: true,
            token: appToken,
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
        // 🔥 email comes from verifyToken middleware
        const email = req.user.email;


        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        res.json(user);

    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};
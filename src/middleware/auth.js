import admin from "../config/firebaseAdmin.js";
import User from "../models/User.js";

export const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "No token" });
        }

        const decoded = await admin.auth().verifyIdToken(token);

        const dbUser = await User.findOne({ email: decoded.email });

        if (!dbUser) {
            return res.status(404).json({ message: "User not found in DB" });
        }

        req.user = {
            _id: dbUser._id,   // 🔥 FIX HERE
            email: dbUser.email,
            uid: decoded.uid,
            role: dbUser.role,
        };

        next();
    } catch (err) {
        console.log(err);
        return res.status(401).json({ message: "Invalid token" });
    }
};

export const isProvider = (req, res, next) => {
    if (!req.user?.role) {
        return res.status(401).json({ message: "No role found" });
    }

    if (req.user.role !== "provider" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }

    next();
};

export const isAdmin = (req, res, next) => {
    if (!req.user?.role) {
        return res.status(401).json({ message: "No role found" });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }

    next();
};
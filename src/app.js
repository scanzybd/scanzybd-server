import express from "express";
import cors from "cors";

// routes
import authRoutes from "./routes/authRoutes.js";
import qrRoutes from "./routes/qrRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import productRoutes from "./routes/productRoutes.js"; // 🔥 ADD THIS
import packageRoutes from "./routes/packageRoutes.js"; // 🔥 ADD THIS
import paymentRoutes from "./routes/paymentRoutes.js"; // 🔥 ADD THIS

const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/auth", authRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api/products", productRoutes); // now OK ✅
app.use("/api/package", packageRoutes); // now OK ✅
app.use("/api/payment", paymentRoutes); // now OK ✅

export default app;
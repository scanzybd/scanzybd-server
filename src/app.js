import express from "express";
import cors from "cors";

// routes
import authRoutes from "./routes/authRoutes.js";
import qrRoutes from "./routes/qrRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import productRoutes from "./routes/productRoutes.js"; // 🔥 ADD THIS
import packageRoutes from "./routes/packageRoutes.js"; // 🔥 ADD THIS
import paymentRoutes from "./routes/paymentRoutes.js"; // 🔥 ADD THIS
import orderRoutes from "./routes/orderRoutes.js"; // 🔥 ADD THIS
import contactRoutes from "./routes/contactRoutes.js"; // 🔥 ADD THIS
import uploadRoutes from "./routes/uploadRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";


const app = express();

app.use(cors());
app.use(express.json({ limit: "12mb" }));

app.get("/", (req, res) => {
  res.type("text").send("QR Tag API — use /api/* routes.");
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api/products", productRoutes); // now OK ✅
app.use("/api/package", packageRoutes); // now OK ✅
app.use("/api/payment", paymentRoutes); // now OK ✅
app.use("/api/order", orderRoutes); // now OK ✅
app.use("/api/contact", contactRoutes); // 🔥 ADD THI  S
app.use("/api/upload", uploadRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reviews", reviewRoutes);

export default app;
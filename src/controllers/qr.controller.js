import QRModel from "../models/QRCode.js";
import QRCodeLib from "qrcode";
import Vehicle from "../models/Vehicle.js";

/**
 * ASSIGN QR TO VEHICLE
 */
export const assignQRToVehicle = async (req, res) => {
  try {
    const { code, vehicleId } = req.body;

    if (!code || !vehicleId) {
      return res.status(400).json({
        message: "code and vehicleId required",
      });
    }

    // 🔥 code দিয়ে QR খুঁজ
    const qr = await QRModel.findOne({ code });

    if (!qr) {
      return res.status(404).json({ message: "QR not found" });
    }

    // 🚗 vehicle check
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    if (req.user?.role === "provider") {
      const uid = req.user._id.toString();
      const isOwner = vehicle.owner?.toString() === uid;
      const isRegistrar = vehicle.addedBy?.toString() === uid;
      if (!isOwner && !isRegistrar) {
        return res.status(403).json({
          message: "You can only assign QR to vehicles you own or registered for a customer",
        });
      }
    }

    // ✅ QR update
    qr.vehicleId = vehicleId;
    qr.isAssigned = true;
    qr.assignedBy = req.user._id;
    qr.status = "assigned";

    await qr.save();

    // ✅ vehicle update (important)
    vehicle.qrData = qr._id;
    await vehicle.save();

    res.json({
      success: true,
      message: "QR assigned successfully",
      data: qr,
    });

  } catch (err) {
    console.error("ASSIGN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Generate QR Codes
 */
export const generateQRs = async (req, res) => {
  try {
    const { count, qrType: rawType } = req.body;

    const allowedTypes = ["bike", "car"];
    const qrType =
      typeof rawType === "string" && allowedTypes.includes(rawType.trim().toLowerCase())
        ? rawType.trim().toLowerCase()
        : "bike";

    const baseUrl = "http://localhost:5173/qr-landing";
    const list = [];

    for (let i = 0; i < count; i++) {
      const code = `QR-${Date.now()}-${i}`;
      const qrLink = `${baseUrl}/${code}`;

      const qrImage = await QRCodeLib.toDataURL(qrLink);

      const qr = await QRModel.create({
        code,
        qrCode: qrImage,
        qrLink,
        isAssigned: false,
        qrType,
      });

      list.push(qr);
    }

    res.status(201).json({
      success: true,
      data: list,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Scan QR
 */
export const scanQR = async (req, res) => {
  try {
    const { code } = req.params;

    const qr = await QRModel.findOne({ code });

    if (!qr) {
      return res.status(404).send("QR not found");
    }

    qr.scanCount += 1; // ✅ now safe
    await qr.save();

    if (!qr.isAssigned) {
      return res.redirect("http://localhost:5173/dashboard/assign-vehicle");
    }

    return res.redirect(`http://localhost:5123/vehicle/${qr.vehicleId}`);

  } catch (err) {
    res.status(500).send(err.message);
  }
};



export const getQRById = async (req, res) => {
  try {
    const { id } = req.params;

    // ❗ validate id first (important)
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "QR id is required",
      });
    }

    const qr = await QRModel.findById(id);

    if (!qr) {
      return res.status(404).json({
        success: false,
        message: "QR not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: qr,
    });

  } catch (err) {
    console.error("QR FETCH ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching QR",
    });
  }
};

/** Query: year, month (1–12), day — filter by `createdAt` (timestamps). */
function buildCreatedAtFilter(query) {
  const rawY = query.year;
  const rawM = query.month;
  const rawD = query.day;

  const year =
    rawY != null && rawY !== "" ? parseInt(String(rawY), 10) : null;
  const month =
    rawM != null && rawM !== "" ? parseInt(String(rawM), 10) : null;
  const day =
    rawD != null && rawD !== "" ? parseInt(String(rawD), 10) : null;

  const now = new Date();
  const yFallback = now.getFullYear();

  if (month != null && month >= 1 && month <= 12 && day != null && day >= 1 && day <= 31) {
    const y = year != null && !Number.isNaN(year) ? year : yFallback;
    const start = new Date(y, month - 1, day, 0, 0, 0, 0);
    if (start.getMonth() !== month - 1 || start.getDate() !== day) {
      return {};
    }
    const end = new Date(y, month - 1, day, 23, 59, 59, 999);
    return { createdAt: { $gte: start, $lte: end } };
  }

  if (month != null && month >= 1 && month <= 12) {
    const y = year != null && !Number.isNaN(year) ? year : yFallback;
    const start = new Date(y, month - 1, 1);
    const end = new Date(y, month, 0, 23, 59, 59, 999);
    return { createdAt: { $gte: start, $lte: end } };
  }

  if (year != null && !Number.isNaN(year)) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { createdAt: { $gte: start, $lte: end } };
  }

  return {};
}

function mergeQrTypeFilter(query, dateFilter) {
  const raw = query.qrType;
  const t = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (t !== "bike" && t !== "car") {
    return dateFilter;
  }

  if (t === "car") {
    return { ...dateFilter, qrType: "car" };
  }

  return {
    ...dateFilter,
    $or: [
      { qrType: "bike" },
      { qrType: { $exists: false } },
      { qrType: null },
    ],
  };
}

function summarizeQrAnalytics(docs) {
  const total = docs.length;
  let assigned = 0;
  let totalScans = 0;
  const byType = {};

  for (const q of docs) {
    if (q.status === "assigned" || q.isAssigned === true) assigned += 1;
    totalScans += Number(q.scanCount) || 0;
    const ty = q.qrType || "bike";
    byType[ty] = (byType[ty] || 0) + 1;
  }

  return {
    total,
    assigned,
    unassigned: total - assigned,
    totalScans,
    byType,
  };
}

export const getAllQR = async (req, res) => {
  try {
    const dateFilter = buildCreatedAtFilter(req.query);
    const filter = mergeQrTypeFilter(req.query, dateFilter);
    const data = await QRModel.find(filter).sort({ createdAt: -1 }).lean();

    const analytics = summarizeQrAnalytics(data);

    res.json({
      success: true,
      data,
      analytics,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


export const getQRByCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "QR code is required",
      });
    }

    // 🔥 CODE দিয়ে search
    const qr = await QRModel.findOne({ code });

    if (!qr) {
      return res.status(404).json({
        success: false,
        message: "QR not found",
      });
    }

    let vehicle = null;

    // ✅ যদি assigned থাকে → vehicle load
    if (qr.status === "assigned" && qr.vehicleId) {
      vehicle = await Vehicle.findById(qr.vehicleId);
    }

    return res.status(200).json({
      success: true,
      qr,
      vehicle,
    });

  } catch (err) {
    console.error("QR FETCH BY CODE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

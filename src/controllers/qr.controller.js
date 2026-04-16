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
    const { count } = req.body;

    const baseUrl = "http://localhost:5000/qr";
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



export const getAllQR = async (req, res) => {
  try {
    const data = await QRModel.find();
    res.json(data);
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


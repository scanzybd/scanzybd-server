import QRModel from "../models/QRCode.js";
import Vehicle from "../models/Vehicle.js";
import * as QRCodeLib from "qrcode";

/**
 * ASSIGN QR TO VEHICLE
 */
export const assignQRToVehicle = async (req, res) => {
  try {
    const { qrId, vehicleId } = req.body;

    const qr = await QRModel.findById(qrId);

    if (!qr) {
      return res.status(404).json({ message: "QR not found" });
    }

    qr.vehicleId = vehicleId;
    qr.isAssigned = true; // ✅ FIXED
    qr.assignedBy = req.user._id;

    await qr.save();

    res.json({
      success: true,
      message: "QR assigned successfully",
      data: qr,
    });

  } catch (err) {
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
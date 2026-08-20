import QRModel from "../models/QRCode.js";
import {
    getActiveQrTypeSlugs,
    resolveQrTypeForGenerate,
} from "../service/qrFrameTemplate.service.js";
import QRCodeLib from "qrcode";
import Vehicle from "../models/Vehicle.js";
import { nanoid } from "nanoid";
import {
    MAX_VEHICLE_QRS,
    canAddQrToVehicle,
    getQrIdsFromVehicle,
    syncVehicleQrFields,
} from "../utils/vehicleQr.js";
import {
    getQrScanAccess,
    linkSubscriptionToQr,
} from "../utils/tagSubscription.service.js";
import { clientOrigin, qrLandingBaseUrl } from "../utils/clientOrigin.js";


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

    if (qr.isAssigned || qr.status === "assigned") {
      const existingVehicle = qr.vehicleId ? String(qr.vehicleId) : null;
      if (existingVehicle && existingVehicle !== String(vehicleId)) {
        return res.status(400).json({
          message: "This QR is already assigned to another vehicle",
        });
      }
      if (existingVehicle === String(vehicleId)) {
        return res.status(400).json({
          message: "This QR is already assigned to this vehicle",
        });
      }
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
    } else if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const currentIds = getQrIdsFromVehicle(vehicle);
    const qrIdStr = String(qr._id);

    if (currentIds.includes(qrIdStr)) {
      return res.status(400).json({
        message: "This QR is already linked to this vehicle",
      });
    }

    if (!canAddQrToVehicle(vehicle)) {
      return res.status(400).json({
        message: `Maximum ${MAX_VEHICLE_QRS} QR codes per vehicle`,
      });
    }

    // ✅ QR update
    qr.vehicleId = vehicleId;
    qr.isAssigned = true;
    qr.assignedBy = req.user._id;
    qr.status = "assigned";

    await qr.save();

    vehicle.qrIds = [...currentIds, qrIdStr];
    syncVehicleQrFields(vehicle);
    await vehicle.save();

    await linkSubscriptionToQr(qr._id, vehicleId);

    res.json({
      success: true,
      message: "QR assigned successfully",
      data: qr,
      vehicleQrCount: getQrIdsFromVehicle(vehicle).length,
    });

  } catch (err) {
    console.error("ASSIGN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/qr/unassign — remove one QR from a vehicle (QR becomes unassigned)
 */
export const unassignQRFromVehicle = async (req, res) => {
  try {
    const { vehicleId, qrId } = req.body || {};

    if (!vehicleId || !qrId) {
      return res.status(400).json({
        message: "vehicleId and qrId are required",
      });
    }

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
          message: "You can only manage QR on vehicles you own or registered",
        });
      }
    } else if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const currentIds = getQrIdsFromVehicle(vehicle);
    const target = String(qrId);
    if (!currentIds.includes(target)) {
      return res.status(400).json({
        message: "This QR is not linked to the vehicle",
      });
    }

    vehicle.qrIds = currentIds.filter((id) => String(id) !== target);
    syncVehicleQrFields(vehicle);
    await vehicle.save();

    await QRModel.findByIdAndUpdate(target, {
      $set: {
        vehicleId: null,
        isAssigned: false,
        status: "unassigned",
      },
      $unset: { assignedBy: "" },
    });

    res.json({
      success: true,
      message: "QR removed from vehicle",
      vehicle: {
        _id: vehicle._id,
        qrIds: getQrIdsFromVehicle(vehicle),
        qrCount: getQrIdsFromVehicle(vehicle).length,
      },
    });
  } catch (err) {
    console.error("UNASSIGN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Generate QR Codes
 */
export const generateQRs = async (req, res) => {
  try {
    const { count, qrType: rawType } = req.body;

    const qrType = await resolveQrTypeForGenerate(rawType);

    // ✅ base url
    const baseUrl = qrLandingBaseUrl();

    // ✅ get last batch
    const lastQR = await QRModel.findOne({})
      .sort({ batchNumber: -1 })
      .lean();

    // ✅ next batch number
    let batchNumber = 1;

    if (lastQR?.batchNumber) {
      batchNumber = lastQR.batchNumber + 1;
    }

    // ✅ formatted batch label
    const batchLabel = String(batchNumber).padStart(4, "0");

    const list = [];

    // ✅ generate QR codes
    for (let i = 0; i < count; i++) {

      // serial number
      const serial = String(i + 1).padStart(3, "0");

      // random unique part
      const random = nanoid(8);

      // final QR code
      const code = `QR-B${batchLabel}-${serial}-${random}`;

      // qr redirect link
      const qrLink = `${baseUrl}/${code}`;

      // qr image
      const qrImage = await QRCodeLib.toDataURL(qrLink);

      // save to DB
      const qr = await QRModel.create({
        code,
        qrCode: qrImage,
        qrLink,
        isAssigned: false,
        qrType,
        batchNumber,
      });

      list.push(qr);
    }

    // ✅ success response
    res.status(201).json({
      success: true,
      batchNumber,
      batchLabel,
      totalGenerated: list.length,
      data: list,
    });

  } catch (err) {

    console.error("QR GENERATE ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Scan QR
 */
// export const scanQR = async (req, res) => {
//   try {
//     const { code } = req.params;

//     const qr = await QRModel.findOne({ code });

//     if (!qr) {
//       return res.status(404).send("QR not found");
//     }

//     qr.scanCount += 1; // ✅ now safe
//     await qr.save();

//     if (!qr.isAssigned) {
//       return res.redirect(`${clientOrigin()}/dashboard/assign-vehicle`);
//     }

//     return res.redirect(`${clientOrigin()}/vehicle/${qr.vehicleId}`);

//   } catch (err) {
//     res.status(500).send(err.message);
//   }
// };



export const scanQR = async (req, res) => {
  try {
    const { code } = req.params;

    const qr = await QRModel.findOneAndUpdate(
      { code },
      { $inc: { scanCount: 1 } },
      { new: true }
    ).lean();

    if (!qr) {
      return res.status(404).send("QR not found");
    }

    if (!qr.isAssigned) {
      return res.redirect(`${clientOrigin()}/dashboard/assign-vehicle`);
    }

    return res.redirect(`${clientOrigin()}/vehicle/${qr.vehicleId}`);

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

async function mergeQrTypeFilter(query, dateFilter) {
  const raw = query.qrType;
  const t = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!t) {
    return dateFilter;
  }

  const activeSlugs = await getActiveQrTypeSlugs();
  if (activeSlugs.includes(t)) {
    if (t === "bike") {
      return {
        ...dateFilter,
        $or: [
          { qrType: "bike" },
          { qrType: { $exists: false } },
          { qrType: null },
        ],
      };
    }
    return { ...dateFilter, qrType: t };
  }

  return dateFilter;
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
    const filter = await mergeQrTypeFilter(req.query, dateFilter);
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


// export const getQRByCode = async (req, res) => {
//   try {
//     const { code } = req.params;

//     if (!code) {
//       return res.status(400).json({
//         success: false,
//         message: "QR code is required",
//       });
//     }

//     // 🔥 CODE দিয়ে search
//     const qr = await QRModel.findOne({ code });

//     if (!qr) {
//       return res.status(404).json({
//         success: false,
//         message: "QR not found",
//       });
//     }

//     let vehicle = null;

//     // ✅ যদি assigned থাকে → vehicle load
//     if (qr.status === "assigned" && qr.vehicleId) {
//       vehicle = await Vehicle.findById(qr.vehicleId);
//     }

//     const scanAccess = await getQrScanAccess(qr);
//     let vehicleOut = vehicle;

//     if (vehicle && !scanAccess.allowContact) {
//       const v = vehicle.toObject ? vehicle.toObject() : { ...vehicle };
//       vehicleOut = {
//         ...v,
//         ownerPhone: "",
//         emergencyPhone: "",
//         ownerContactVisible: false,
//         driverContactVisible: false,
//         emergencyContactVisible: false,
//         driver: v.driver
//           ? { ...v.driver, phone: "" }
//           : v.driver,
//       };
//     }

//     return res.status(200).json({
//       success: true,
//       qr,
//       vehicle: vehicleOut,
//       scanAccess: {
//         allowContact: scanAccess.allowContact,
//         reason: scanAccess.reason,
//         subscriptionExpired: scanAccess.reason === "expired",
//       },
//     });

//   } catch (err) {
//     console.error("QR FETCH BY CODE ERROR:", err);

//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };


export const getQRByCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ success: false, message: "QR code is required" });
    }

    const qr = await QRModel.findOne({ code }).lean();

    if (!qr) {
      return res.status(404).json({ success: false, message: "QR not found" });
    }

    // ✅ vehicle আর scanAccess একসাথে parallel এ চালান
    const [vehicle, scanAccess] = await Promise.all([
      qr.status === "assigned" && qr.vehicleId
        ? Vehicle.findById(qr.vehicleId).lean()
        : Promise.resolve(null),
      getQrScanAccess(qr),
    ]);

    let vehicleOut = vehicle;

    if (vehicle && !scanAccess.allowContact) {
      vehicleOut = {
        ...vehicle,
        ownerPhone: "",
        emergencyPhone: "",
        ownerContactVisible: false,
        driverContactVisible: false,
        emergencyContactVisible: false,
        driver: vehicle.driver ? { ...vehicle.driver, phone: "" } : vehicle.driver,
      };
    }

    return res.status(200).json({
      success: true,
      qr,
      vehicle: vehicleOut,
      scanAccess: {
        allowContact: scanAccess.allowContact,
        reason: scanAccess.reason,
        subscriptionExpired: scanAccess.reason === "expired",
      },
    });
  } catch (err) {
    console.error("QR FETCH BY CODE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
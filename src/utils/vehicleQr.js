import mongoose from "mongoose";

export const MAX_VEHICLE_QRS = 2;

/** Normalize qrIds from qrIds array and legacy qrData field. */
export function getQrIdsFromVehicle(vehicle) {
    const v = vehicle?.toObject?.() ?? vehicle ?? {};
    let ids = Array.isArray(v.qrIds)
        ? v.qrIds.map((id) => String(id)).filter(Boolean)
        : [];
    if (ids.length === 0 && v.qrData) {
        ids = [String(v.qrData)];
    }
    return [...new Set(ids)].slice(0, MAX_VEHICLE_QRS);
}

export function syncVehicleQrFields(vehicle) {
    const ids = getQrIdsFromVehicle(vehicle);
    vehicle.qrIds = ids.map((id) =>
        mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
    );
    vehicle.qrData = ids[0] || null;
    return vehicle;
}

export function normalizeVehicleDoc(vehicle) {
    if (!vehicle) return vehicle;
    const doc = vehicle.toObject ? vehicle.toObject() : { ...vehicle };
    const ids = getQrIdsFromVehicle(doc);
    doc.qrIds = ids;
    doc.qrData = ids[0] || null;
    doc.qrCount = ids.length;
    doc.canAssignMoreQr = ids.length < MAX_VEHICLE_QRS;
    return doc;
}

export function canAddQrToVehicle(vehicle) {
    return getQrIdsFromVehicle(vehicle).length < MAX_VEHICLE_QRS;
}

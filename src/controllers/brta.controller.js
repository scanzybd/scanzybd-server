import BrtaZone from "../models/BrtaZone.js";
import BrtaSeries from "../models/BrtaSeries.js";

function normalizeBrtaOptions(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      label: String(row?.label ?? row?.value ?? "").trim(),
      value: String(row?.value ?? row?.label ?? "").trim(),
    }))
    .filter((row) => row.label && row.value);
}

export const getBrtaZones = async (req, res) => {
  try {
    const rows = await BrtaZone.find({}).sort({ label: 1 }).lean();
    res.json(normalizeBrtaOptions(rows));
  } catch (error) {
    console.error("getBrtaZones error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getBrtaSeries = async (req, res) => {
  try {
    const rows = await BrtaSeries.find({}).sort({ label: 1 }).lean();
    res.json(normalizeBrtaOptions(rows));
  } catch (error) {
    console.error("getBrtaSeries error:", error);
    res.status(500).json({ message: error.message });
  }
};

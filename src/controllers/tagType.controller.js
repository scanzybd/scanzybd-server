import TagType from "../models/TagType.js";

const DEFAULT_TAG_TYPES = [
    { name: "Car Tag", isCycle: false, sortOrder: 1 },
    { name: "Bike Tag", isCycle: false, sortOrder: 2 },
    { name: "Helmet Tag", isCycle: false, sortOrder: 3 },
    { name: "Truck Tag", isCycle: false, sortOrder: 4 },
    { name: "Van Tag", isCycle: false, sortOrder: 5 },
    { name: "Bus Tag", isCycle: false, sortOrder: 6 },
    { name: "Cycle Tag", isCycle: true, sortOrder: 7 },
];

async function ensureTagTypesSeeded() {
    const count = await TagType.countDocuments();
    if (count === 0) {
        await TagType.insertMany(DEFAULT_TAG_TYPES);
    }
}

function normalizeRow(row) {
    const name = String(row?.name || row?.label || row?.title || "").trim();
    if (!name) return null;
    const isCycle =
        row.isCycle !== undefined
            ? Boolean(row.isCycle)
            : row.is_cycle !== undefined
              ? Boolean(row.is_cycle)
              : name.toLowerCase() === "cycle tag";
    return {
        name,
        isCycle,
        sortOrder: Number(row?.sortOrder ?? row?.sort_order ?? 0),
    };
}

/** GET /api/tag-types — active tag types for products & vehicle forms */
export const getTagTypes = async (req, res) => {
    try {
        await ensureTagTypesSeeded();
        const rows = await TagType.find({ isActive: { $ne: false } })
            .sort({ sortOrder: 1, name: 1 })
            .lean();

        const data = rows.map(normalizeRow).filter(Boolean);

        res.json({ success: true, data });
    } catch (error) {
        console.error("getTagTypes error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

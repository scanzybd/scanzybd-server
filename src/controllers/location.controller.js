import Location from "../models/Location.js";

const toArray = (value) => (Array.isArray(value) ? value : []);

const toOption = (row) => {
    if (row && typeof row === "object") {
        const value = row.value ?? row.id ?? row.code ?? row.title ?? row.name;
        const title = row.title ?? row.name ?? row.label ?? String(value ?? "");
        return {
            value: String(value ?? ""),
            title: String(title ?? ""),
        };
    }
    const raw = String(row ?? "");
    return { value: raw, title: raw };
};

const normalizeOptions = (rows) =>
    toArray(rows)
        .map(toOption)
        .filter((row) => row.value && row.title);

const normalizeDictionary = (dict) => {
    if (!dict || typeof dict !== "object") return {};
    const out = {};
    for (const [key, rows] of Object.entries(dict)) {
        out[String(key)] = normalizeOptions(rows);
    }
    return out;
};

export const getLocationTree = async (req, res) => {
    try {
        const doc = await Location.findOne({}).lean();
        if (!doc) {
            return res.json({
                divisions: [],
                districts: {},
                upazilas: {},
                unions: {},
            });
        }

        const divisions = normalizeOptions(doc.divisions_en || doc.divisions);
        const districts = normalizeDictionary(doc.districts_en || doc.districts);
        const upazilas = normalizeDictionary(doc.upazilas_en || doc.upazilas);
        const unions = normalizeDictionary(doc.unions_en || doc.unions);

        return res.json({
            divisions,
            districts,
            upazilas,
            unions,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

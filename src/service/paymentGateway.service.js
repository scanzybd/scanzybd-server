import PaymentGatewaySettings from "../models/PaymentGatewaySettings.js";

const SETTINGS_KEY = "global";
export const GATEWAYS = {
    BKASH: "bkash",
    SSLCOMMERZ: "sslcommerz",
};

const DEFAULTS = {
    bkash: { enabled: true },
    sslcommerz: { enabled: false },
    manualBkash: {
        enabled: false,
        qrImageUrl: "",
        merchantNumber: "",
        instructions: "",
    },
    defaultGateway: GATEWAYS.BKASH,
};

function normalizeManualBkash(doc) {
    const raw = doc?.manualBkash;
    return {
        enabled:
            raw?.enabled !== undefined
                ? Boolean(raw.enabled)
                : DEFAULTS.manualBkash.enabled,
        qrImageUrl: String(raw?.qrImageUrl || "").trim(),
        merchantNumber: String(raw?.merchantNumber || "").trim(),
        instructions: String(raw?.instructions || "").trim(),
    };
}

function normalizeSettings(doc) {
    const bkashEnabled =
        doc?.bkash?.enabled !== undefined
            ? Boolean(doc.bkash.enabled)
            : DEFAULTS.bkash.enabled;
    const sslEnabled =
        doc?.sslcommerz?.enabled !== undefined
            ? Boolean(doc.sslcommerz.enabled)
            : DEFAULTS.sslcommerz.enabled;
    const manualBkash = normalizeManualBkash(doc);

    let defaultGateway = String(doc?.defaultGateway || DEFAULTS.defaultGateway);
    if (defaultGateway !== GATEWAYS.BKASH && defaultGateway !== GATEWAYS.SSLCOMMERZ) {
        defaultGateway = GATEWAYS.BKASH;
    }

    const anyOnline = bkashEnabled || sslEnabled;
    const anyPayment = anyOnline || manualBkash.enabled;

    if (!anyPayment) {
        return {
            bkash: { enabled: true },
            sslcommerz: { enabled: false },
            manualBkash: DEFAULTS.manualBkash,
            defaultGateway: GATEWAYS.BKASH,
        };
    }

    if (!bkashEnabled && defaultGateway === GATEWAYS.BKASH && sslEnabled) {
        defaultGateway = GATEWAYS.SSLCOMMERZ;
    }
    if (!sslEnabled && defaultGateway === GATEWAYS.SSLCOMMERZ && bkashEnabled) {
        defaultGateway = GATEWAYS.BKASH;
    }

    return {
        bkash: { enabled: bkashEnabled },
        sslcommerz: { enabled: sslEnabled },
        manualBkash,
        defaultGateway,
    };
}

export async function getPaymentGatewaySettings() {
    let doc = await PaymentGatewaySettings.findOne({ key: SETTINGS_KEY });
    if (!doc) {
        doc = await PaymentGatewaySettings.create({
            key: SETTINGS_KEY,
            ...DEFAULTS,
        });
    }
    return normalizeSettings(doc.toObject());
}

/** Env fallback when DB has no manual config yet. */
export function getManualBkashConfigFromEnv() {
    const enabled =
        String(process.env.MANUAL_BKASH_ENABLED || "").toLowerCase() === "true";
    return {
        enabled,
        qrImageUrl: String(process.env.MANUAL_BKASH_QR_URL || "").trim(),
        merchantNumber: String(process.env.MANUAL_BKASH_NUMBER || "").trim(),
        instructions: String(process.env.MANUAL_BKASH_INSTRUCTIONS || "").trim(),
    };
}

/** Manual bKash config — DB first, then .env fallback. */
export async function getManualBkashConfig() {
    const s = await getPaymentGatewaySettings();
    const doc = await PaymentGatewaySettings.findOne({ key: SETTINGS_KEY }).lean();
    if (doc?.manualBkash != null) {
        return s.manualBkash;
    }
    return getManualBkashConfigFromEnv();
}

/** Public shape for checkout UI */
export async function getPublicPaymentGateways() {
    const s = await getPaymentGatewaySettings();
    const manual = s.manualBkash;
    const enabled = [];
    if (s.bkash.enabled) enabled.push(GATEWAYS.BKASH);
    if (s.sslcommerz.enabled) enabled.push(GATEWAYS.SSLCOMMERZ);
    if (manual.enabled) enabled.push("manual_bkash");

    return {
        bkash: s.bkash.enabled,
        sslcommerz: s.sslcommerz.enabled,
        manualBkash: manual.enabled,
        manualBkashConfig: manual.enabled
            ? {
                  qrImageUrl: manual.qrImageUrl,
                  merchantNumber: manual.merchantNumber,
                  instructions: manual.instructions,
              }
            : null,
        defaultGateway: s.defaultGateway,
        enabled,
        hasOnlinePayment: Boolean(s.bkash.enabled || s.sslcommerz.enabled),
        hasAnyPayment: enabled.length > 0,
    };
}

function assertAtLeastOnePaymentMethod(bkash, ssl, manual) {
    if (!bkash && !ssl && !manual) {
        throw new Error("At least one payment method must stay enabled");
    }
}

export function assertAtLeastOneEnabled(patch) {
    const bkash = patch.bkash?.enabled;
    const ssl = patch.sslcommerz?.enabled;
    const manual = patch.manualBkash?.enabled;
    if (bkash === false && ssl === false && manual === false) {
        throw new Error("At least one payment method must stay enabled");
    }
}

export async function updatePaymentGatewaySettings(patch, adminUserId) {
    const current = await getPaymentGatewaySettings();

    const nextBkash =
        patch.bkash?.enabled !== undefined
            ? Boolean(patch.bkash.enabled)
            : current.bkash.enabled;
    const nextSsl =
        patch.sslcommerz?.enabled !== undefined
            ? Boolean(patch.sslcommerz.enabled)
            : current.sslcommerz.enabled;
    const nextManual =
        patch.manualBkash?.enabled !== undefined
            ? Boolean(patch.manualBkash.enabled)
            : current.manualBkash.enabled;

    assertAtLeastOnePaymentMethod(nextBkash, nextSsl, nextManual);

    const nextManualBkash = {
        enabled: nextManual,
        qrImageUrl:
            patch.manualBkash?.qrImageUrl !== undefined
                ? String(patch.manualBkash.qrImageUrl || "").trim()
                : current.manualBkash.qrImageUrl,
        merchantNumber:
            patch.manualBkash?.merchantNumber !== undefined
                ? String(patch.manualBkash.merchantNumber || "").trim()
                : current.manualBkash.merchantNumber,
        instructions:
            patch.manualBkash?.instructions !== undefined
                ? String(patch.manualBkash.instructions || "").trim()
                : current.manualBkash.instructions,
    };

    if (nextManual && !nextManualBkash.qrImageUrl) {
        throw new Error("Upload a bKash QR code before enabling manual payment");
    }

    let defaultGateway = patch.defaultGateway ?? current.defaultGateway;
    if (!nextBkash && defaultGateway === GATEWAYS.BKASH && nextSsl) {
        defaultGateway = GATEWAYS.SSLCOMMERZ;
    }
    if (!nextSsl && defaultGateway === GATEWAYS.SSLCOMMERZ && nextBkash) {
        defaultGateway = GATEWAYS.BKASH;
    }

    const normalized = normalizeSettings({
        bkash: { enabled: nextBkash },
        sslcommerz: { enabled: nextSsl },
        manualBkash: nextManualBkash,
        defaultGateway,
    });

    const doc = await PaymentGatewaySettings.findOneAndUpdate(
        { key: SETTINGS_KEY },
        {
            $set: {
                bkash: normalized.bkash,
                sslcommerz: normalized.sslcommerz,
                manualBkash: normalized.manualBkash,
                defaultGateway: normalized.defaultGateway,
                updatedBy: adminUserId || null,
            },
        },
        { new: true, upsert: true }
    );

    return normalizeSettings(doc.toObject());
}

export async function resolveGateway(requested) {
    const settings = await getPaymentGatewaySettings();
    const enabled = [];
    if (settings.bkash.enabled) enabled.push(GATEWAYS.BKASH);
    if (settings.sslcommerz.enabled) enabled.push(GATEWAYS.SSLCOMMERZ);

    if (enabled.length === 0) {
        throw new Error("No online payment gateway is enabled");
    }

    const gw = String(requested || settings.defaultGateway || enabled[0]).toLowerCase();

    if (!enabled.includes(gw)) {
        throw new Error(`Payment gateway "${gw}" is not enabled`);
    }

    return gw;
}

import PaymentGatewaySettings from "../models/PaymentGatewaySettings.js";

const SETTINGS_KEY = "global";
export const GATEWAYS = {
    BKASH: "bkash",
    SSLCOMMERZ: "sslcommerz",
};

const DEFAULTS = {
    bkash: { enabled: true },
    sslcommerz: { enabled: false },
    defaultGateway: GATEWAYS.BKASH,
};

function normalizeSettings(doc) {
    const bkashEnabled = Boolean(doc?.bkash?.enabled ?? DEFAULTS.bkash.enabled);
    const sslEnabled = Boolean(
        doc?.sslcommerz?.enabled ?? DEFAULTS.sslcommerz.enabled
    );

    let defaultGateway = String(doc?.defaultGateway || DEFAULTS.defaultGateway);
    if (defaultGateway !== GATEWAYS.BKASH && defaultGateway !== GATEWAYS.SSLCOMMERZ) {
        defaultGateway = GATEWAYS.BKASH;
    }

    if (!bkashEnabled && !sslEnabled) {
        return {
            bkash: { enabled: true },
            sslcommerz: { enabled: false },
            defaultGateway: GATEWAYS.BKASH,
        };
    }

    if (!bkashEnabled && defaultGateway === GATEWAYS.BKASH) {
        defaultGateway = GATEWAYS.SSLCOMMERZ;
    }
    if (!sslEnabled && defaultGateway === GATEWAYS.SSLCOMMERZ) {
        defaultGateway = GATEWAYS.BKASH;
    }

    return {
        bkash: { enabled: bkashEnabled },
        sslcommerz: { enabled: sslEnabled },
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

/** Public shape for checkout UI */
export async function getPublicPaymentGateways() {
    const s = await getPaymentGatewaySettings();
    const enabled = [];
    if (s.bkash.enabled) enabled.push(GATEWAYS.BKASH);
    if (s.sslcommerz.enabled) enabled.push(GATEWAYS.SSLCOMMERZ);

    return {
        bkash: s.bkash.enabled,
        sslcommerz: s.sslcommerz.enabled,
        defaultGateway: s.defaultGateway,
        enabled,
        hasOnlinePayment: enabled.length > 0,
    };
}

export function assertAtLeastOneEnabled(patch) {
    const bkash = patch.bkash?.enabled;
    const ssl = patch.sslcommerz?.enabled;
    if (bkash === false && ssl === false) {
        throw new Error("At least one payment gateway must stay enabled");
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

    if (!nextBkash && !nextSsl) {
        throw new Error("At least one payment gateway must stay enabled");
    }

    let defaultGateway = patch.defaultGateway ?? current.defaultGateway;
    if (!nextBkash && defaultGateway === GATEWAYS.BKASH) {
        defaultGateway = GATEWAYS.SSLCOMMERZ;
    }
    if (!nextSsl && defaultGateway === GATEWAYS.SSLCOMMERZ) {
        defaultGateway = GATEWAYS.BKASH;
    }

    const normalized = normalizeSettings({
        bkash: { enabled: nextBkash },
        sslcommerz: { enabled: nextSsl },
        defaultGateway,
    });

    const doc = await PaymentGatewaySettings.findOneAndUpdate(
        { key: SETTINGS_KEY },
        {
            $set: {
                bkash: normalized.bkash,
                sslcommerz: normalized.sslcommerz,
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

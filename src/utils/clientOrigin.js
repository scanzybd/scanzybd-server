/** Public storefront origin (no trailing slash). */
export function clientOrigin() {
    const raw =
        process.env.CLIENT_URL ||
        process.env.FRONTEND_URL ||
        "https://scanzybd.com";
    return String(raw).replace(/\/$/, "");
}

/** Base URL embedded in generated QR links. */
export function qrLandingBaseUrl() {
    const custom = String(process.env.QR_LANDING_BASE_URL || "").trim();
    if (custom) {
        return custom.replace(/\/$/, "");
    }
    return `${clientOrigin()}/qr-landing`;
}

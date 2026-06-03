import axios from "axios";

function apiBase() {
    const raw =
        process.env.API_PUBLIC_URL ||
        process.env.SERVER_URL ||
        `http://localhost:${process.env.PORT || 5000}`;
    return String(raw).replace(/\/$/, "");
}

function clientOrigin() {
    const raw =
        process.env.CLIENT_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:5173";
    return String(raw).replace(/\/$/, "");
}

function isLive() {
    return String(process.env.SSLCOMMERZ_IS_LIVE || "").toLowerCase() === "true";
}

function sessionApiUrl() {
    if (process.env.SSLCOMMERZ_SESSION_URL) {
        return process.env.SSLCOMMERZ_SESSION_URL;
    }
    return isLive()
        ? "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
        : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";
}

function validationApiUrl() {
    if (process.env.SSLCOMMERZ_VALIDATION_URL) {
        return process.env.SSLCOMMERZ_VALIDATION_URL;
    }
    return isLive()
        ? "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"
        : "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";
}

export async function initSslCommerzSession({ order, payment, tranId, customer }) {
    const storeId = process.env.SSLCOMMERZ_STORE_ID;
    const storePass = process.env.SSLCOMMERZ_STORE_PASS;

    if (!storeId || !storePass) {
        throw new Error("SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASS are required");
    }

    const base = apiBase();
    const ship = order.shippingAddress || {};

    const params = new URLSearchParams({
        store_id: storeId,
        store_passwd: storePass,
        total_amount: String(order.totalAmount),
        currency: "BDT",
        tran_id: tranId,
        success_url:
            process.env.SSLCOMMERZ_SUCCESS_URL ||
            `${base}/api/payment/sslcommerz/success`,
        fail_url:
            process.env.SSLCOMMERZ_FAIL_URL ||
            `${base}/api/payment/sslcommerz/fail`,
        cancel_url:
            process.env.SSLCOMMERZ_CANCEL_URL ||
            `${base}/api/payment/sslcommerz/cancel`,
        ipn_url:
            process.env.SSLCOMMERZ_IPN_URL ||
            `${base}/api/payment/sslcommerz/ipn`,
        shipping_method: "NO",
        product_name: order.items?.[0]?.title || "ScanzyBD Order",
        product_category: "general",
        product_profile: "general",
        cus_name: ship.fullName || customer?.name || "Customer",
        cus_email: customer?.email || "customer@scanzybd.com",
        cus_add1: ship.line1 || ship.union || "Bangladesh",
        cus_city: ship.city || ship.district || "Dhaka",
        cus_postcode: ship.postalCode || "1000",
        cus_country: "Bangladesh",
        cus_phone: ship.phone || "01700000000",
        value_a: String(order._id),
        value_b: String(payment._id),
    });

    const res = await axios.post(sessionApiUrl(), params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const data = res.data;
    if (String(data?.status || "").toUpperCase() !== "SUCCESS" || !data?.GatewayPageURL) {
        throw new Error(data?.failedreason || "SSL Commerz session init failed");
    }

    return data;
}

export async function validateSslCommerzPayment(valId) {
    const storeId = process.env.SSLCOMMERZ_STORE_ID;
    const storePass = process.env.SSLCOMMERZ_STORE_PASS;

    const url = `${validationApiUrl()}?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePass)}&format=json`;

    const res = await axios.get(url);
    const data = res.data;
    const status = String(data?.status || "").toUpperCase();

    if (status !== "VALID" && status !== "VALIDATED") {
        return { valid: false, data };
    }

    return { valid: true, data };
}

export { clientOrigin };

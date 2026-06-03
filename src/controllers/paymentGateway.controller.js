import {
    getPaymentGatewaySettings,
    getPublicPaymentGateways,
    updatePaymentGatewaySettings,
} from "../service/paymentGateway.service.js";

export const getGatewaysPublic = async (req, res) => {
    try {
        const gateways = await getPublicPaymentGateways();
        res.json({ success: true, gateways });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getGatewaysAdmin = async (req, res) => {
    try {
        const settings = await getPaymentGatewaySettings();
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateGatewaysAdmin = async (req, res) => {
    try {
        const { bkash, sslcommerz, defaultGateway } = req.body || {};
        const settings = await updatePaymentGatewaySettings(
            { bkash, sslcommerz, defaultGateway },
            req.user._id
        );
        res.json({ success: true, settings });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

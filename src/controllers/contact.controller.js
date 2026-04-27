import { Contact } from "../models/Contact.js";

export const createContact = async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: "All fields required" });
        }

        const contact = await Contact.create({
            name,
            email,
            message,
        });

        res.status(201).json({
            message: "Message sent successfully",
            data: contact,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllContacts = async (req, res) => {
    try {
        const messages = await Contact.find().sort({ createdAt: -1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateContactStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        if (status !== "read" && status !== "unread") {
            return res.status(400).json({ message: "status must be read or unread" });
        }

        const updated = await Contact.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Message not found" });
        }

        res.json({
            success: true,
            message: "Status updated",
            data: updated,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
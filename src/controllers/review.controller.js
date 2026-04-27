import mongoose from "mongoose";
import Review from "../models/Review.js";

const allowedTypes = new Set(["stat", "testimonial"]);

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const sanitizeReviewBody = (body = {}) => {
  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!allowedTypes.has(type)) {
    return { error: "type must be stat or testimonial" };
  }

  const payload = {
    type,
    order: toNumber(body.order, 0),
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
  };

  if (type === "stat") {
    payload.label = String(body.label || "").trim();
    payload.value = String(body.value || "").trim();
    if (!payload.label || !payload.value) {
      return { error: "label and value are required for stat" };
    }
  }

  if (type === "testimonial") {
    payload.text = String(body.text || "").trim();
    payload.author = String(body.author || "").trim();
    payload.source = String(body.source || "").trim();
    payload.avatar = String(body.avatar || "").trim();
    payload.stars = Math.max(1, Math.min(5, toNumber(body.stars, 5)));
    if (!payload.text || !payload.author) {
      return { error: "text and author are required for testimonial" };
    }
  }

  return { payload };
};

export const getPublicReviews = async (req, res) => {
  try {
    const docs = await Review.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).lean();
    const stats = docs.filter((d) => d.type === "stat");
    const testimonials = docs.filter((d) => d.type === "testimonial");
    return res.status(200).json({ success: true, stats, testimonials });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load reviews" });
  }
};

export const getAllReviews = async (req, res) => {
  try {
    const docs = await Review.find().sort({ type: 1, order: 1, createdAt: -1 }).lean();
    return res.status(200).json({ success: true, data: docs });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load reviews" });
  }
};

export const createReview = async (req, res) => {
  const { error, payload } = sanitizeReviewBody(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  try {
    const review = await Review.create({
      ...payload,
      createdBy: {
        email: req.user?.email || "",
        name: req.user?.name || "",
        uid: req.user?.uid || "",
      },
    });
    return res.status(201).json({ success: true, data: review });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to create review" });
  }
};

export const updateReview = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid review id" });
  }

  const { error, payload } = sanitizeReviewBody(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  try {
    const updated = await Review.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update review" });
  }
};

export const deleteReview = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid review id" });
  }

  try {
    const deleted = await Review.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    return res.status(200).json({ success: true, message: "Review deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete review" });
  }
};

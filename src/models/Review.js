import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["stat", "testimonial"],
      required: true,
      index: true,
    },
    label: { type: String, trim: true, default: "" },
    value: { type: String, trim: true, default: "" },
    text: { type: String, trim: true, default: "" },
    author: { type: String, trim: true, default: "" },
    source: { type: String, trim: true, default: "" },
    avatar: { type: String, trim: true, default: "" },
    stars: { type: Number, default: 5, min: 1, max: 5 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: {
      email: { type: String, trim: true, default: "" },
      name: { type: String, trim: true, default: "" },
      uid: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Review", reviewSchema);

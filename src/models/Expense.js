import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      default: "general",
      trim: true,
    },
    note: {
      type: String,
      default: "",
    },
    createdBy: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);

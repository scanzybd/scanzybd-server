import Expense from "../models/Expense.js";

export const getExpenses = async (req, res) => {
  try {
    const items = await Expense.find().sort({ createdAt: -1 }).limit(500);
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load expenses" });
  }
};

export const createExpense = async (req, res) => {
  try {
    const { title, amount, category, note } = req.body;

    if (!title || title.trim() === "") {
      return res.status(400).json({ message: "Title is required" });
    }

    const num = Number(amount);
    if (Number.isNaN(num) || num < 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const expense = await Expense.create({
      title: title.trim(),
      amount: num,
      category: (category || "general").trim(),
      note: (note || "").trim(),
      createdBy: req.user?.email,
    });

    res.status(201).json(expense);
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to create expense" });
  }
};

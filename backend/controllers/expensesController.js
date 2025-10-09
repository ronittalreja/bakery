const Expense = require('../models/Expense');

const getExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const expenses = await Expense.findAll(month, year);
    res.json({ success: true, expenses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createExpense = async (req, res) => {
  try {
    const { expenseDate, category, description, amount } = req.body;
    const staffId = req.user.id;
    
    const expense = await Expense.create({
      expenseDate, category, description, amount, staffId
    });
    
    res.json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { expenseDate, category, description, amount } = req.body;
    
    const expense = await Expense.update(id, {
      expenseDate, category, description, amount
    });
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await Expense.delete(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getExpenseSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const summary = await Expense.getSummary(month, year);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary
};
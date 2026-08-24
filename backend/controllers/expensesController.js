const Expense = require('../models/Expense');
const { getDemoData } = require('../middleware/demoMode');
const db = require('../config/database');

const getExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    // Handle "all" case for full year data
    if (month === 'all' || month.includes('-all')) {
      let yearToUse;
      if (month.includes('-all')) {
        yearToUse = month.split('-')[0];
      } else {
        yearToUse = year;
      }
      
      if (!yearToUse || !/^\d{4}$/.test(yearToUse)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid year format' 
        });
      }
      
      // Return demo data if demo user
      if (req.isDemo) {
        const demoExpenses = getDemoData('expenses');
        const filteredExpenses = demoExpenses.filter(exp => {
          const expDate = new Date(exp.expense_date);
          return expDate.getFullYear().toString() === yearToUse;
        });
        return res.json({ success: true, expenses: filteredExpenses });
      }
      
      const [expenses] = await db.execute(
        'SELECT * FROM expenses WHERE YEAR(expense_date) = ?',
        [yearToUse]
      );
      
      return res.json({ success: true, expenses });
    }
    
    // Return demo data if demo user
    if (req.isDemo) {
      const demoExpenses = getDemoData('expenses');
      return res.json({ success: true, expenses: demoExpenses });
    }
    
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
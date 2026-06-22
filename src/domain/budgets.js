import { getExpenses, sumEntries } from './entries.js';

export function getMonthlyBudgetSummary(entries, budgets) {
  const expenses = getExpenses(entries);
  const spent = sumEntries(expenses);
  const monthlyLimit = Number(budgets.monthly || 0);
  const percentage = monthlyLimit ? Math.min(100, (spent / monthlyLimit) * 100) : 0;
  return {
    expenses,
    spent,
    monthlyLimit,
    percentage,
    remaining: Math.max(monthlyLimit - spent, 0),
    isOverLimit: monthlyLimit > 0 && spent > monthlyLimit
  };
}

export function getConfiguredCategoryBudgets(budgets) {
  return Object.entries(budgets.categories || {}).filter(([, value]) => Number(value) > 0);
}

export function getCategoryBudgetUsage(expenses, category, limit) {
  const spent = sumEntries(expenses.filter((entry) => entry.category === category));
  return {
    spent,
    limit: Number(limit),
    percentage: Math.min(100, (spent / Number(limit)) * 100),
    isOverLimit: spent > Number(limit)
  };
}

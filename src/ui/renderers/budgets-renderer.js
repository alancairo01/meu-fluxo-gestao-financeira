import { byId, escapeHtml } from '../../core/dom.js';
import { getCategoryBudgetUsage, getConfiguredCategoryBudgets } from '../../domain/budgets.js';
import { getEntriesForMonth, getExpenses } from '../../domain/entries.js';
import { formatCurrency } from '../../utils/format.js';
import { getCategoryIcon } from '../../utils/category.js';

export function renderBudgets(state, month) {
  byId('monthlyBudgetInput').value = state.budgets.monthly || '';
  const expenses = getExpenses(getEntriesForMonth(state.entries, month));
  const configuredBudgets = getConfiguredCategoryBudgets(state.budgets);

  byId('categoryBudgetList').innerHTML = configuredBudgets.length
    ? configuredBudgets.map(([category, limit]) => {
      const usage = getCategoryBudgetUsage(expenses, category, limit);
      return `<div class="category-budget-row"><strong><span aria-hidden="true">${getCategoryIcon(category)}</span> ${escapeHtml(category)}</strong><span>${formatCurrency(usage.spent)} gastos de ${formatCurrency(limit)} ${usage.isOverLimit ? '· limite ultrapassado' : ''}</span><button class="remove-budget" type="button" aria-label="Remover limite de ${escapeHtml(category)}" data-remove-budget="${escapeHtml(category)}">Remover</button></div>`;
    }).join('')
    : '<p class="empty-copy">Nenhum limite por categoria configurado.</p>';
}

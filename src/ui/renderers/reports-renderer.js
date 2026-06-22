import { byId, escapeHtml } from '../../core/dom.js';
import { getEntriesForMonth, groupExpensesByCategory } from '../../domain/entries.js';
import { formatCurrency } from '../../utils/format.js';
import { formatShortDate } from '../../utils/date.js';
import { getCategoryIcon } from '../../utils/category.js';

export function renderReports(state, month) {
  const entries = getEntriesForMonth(state.entries, month);
  const categoryGroups = groupExpensesByCategory(entries);
  const maximum = Math.max(1, ...categoryGroups.map(([, total]) => total));

  byId('categoryBars').innerHTML = categoryGroups.length
    ? categoryGroups.map(([category, total]) => {
      const percentage = (total / maximum) * 100;
      return `<div class="category-bar-row"><div class="category-bar-top"><strong><span aria-hidden="true">${getCategoryIcon(category)}</span> ${escapeHtml(category)}</strong><span>${formatCurrency(total)}</span></div><div class="category-bar-track" role="progressbar" aria-label="${escapeHtml(category)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percentage)}" aria-valuetext="${formatCurrency(total)} gastos em ${escapeHtml(category)}"><span style="width:${percentage}%"></span></div></div>`;
    }).join('')
    : '<p class="empty-copy">Nenhuma despesa registrada neste mês.</p>';

  const futureInstallments = state.entries
    .filter((entry) => entry.installment && entry.date.slice(0, 7) >= month)
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(0, 8);
  byId('installmentList').innerHTML = futureInstallments.length
    ? futureInstallments.map((entry) => `<div class="installment-row"><div><strong>${escapeHtml(entry.description)}</strong><small>${entry.installment.current}/${entry.installment.total} · vence ${formatShortDate(entry.date)}</small></div><span class="amount expense">${formatCurrency(entry.amount)}</span></div>`).join('')
    : '<p class="empty-copy">Nenhuma parcela futura registrada.</p>';
}

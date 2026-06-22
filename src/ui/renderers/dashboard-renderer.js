import { byId, escapeHtml } from '../../core/dom.js';
import { getCategoryBudgetUsage, getConfiguredCategoryBudgets, getMonthlyBudgetSummary } from '../../domain/budgets.js';
import { getEntriesForMonth, getFinancialSummary, getFutureExpenses, sumEntries } from '../../domain/entries.js';
import { formatCurrency } from '../../utils/format.js';
import { formatFullMonth, formatShortDate } from '../../utils/date.js';
import { getCategoryIcon } from '../../utils/category.js';

export function renderDashboard(state, month) {
  const entries = getEntriesForMonth(state.entries, month);
  const summary = getFinancialSummary(entries);
  const futureExpenses = getFutureExpenses(state.entries, month);

  byId('incomeTotal').textContent = formatCurrency(summary.income);
  byId('expenseTotal').textContent = formatCurrency(summary.expense);
  byId('balanceTotal').textContent = formatCurrency(summary.balance);
  byId('incomeCount').textContent = `${summary.incomes.length || 'Nenhuma'} ${summary.incomes.length === 1 ? 'receita' : 'receitas'} no mês`;
  byId('expenseCount').textContent = `${summary.expenses.length || 'Nenhuma'} ${summary.expenses.length === 1 ? 'despesa' : 'despesas'} no mês`;
  byId('balanceNote').textContent = summary.balance >= 0 ? 'Você fechou o mês no positivo' : 'Atenção: despesas acima das receitas';
  byId('futureTotal').textContent = formatCurrency(sumEntries(futureExpenses));
  byId('futureCount').textContent = futureExpenses.length
    ? `${futureExpenses.length} ${futureExpenses.length === 1 ? 'compromisso futuro' : 'compromissos futuros'}`
    : 'Nenhuma despesa futura';

  renderCashflow(entries, month, summary.income, summary.expense);
  renderBudgetPreview(state, entries);
  renderRecentEntries(entries);
  renderUpcomingEntries(futureExpenses);
}

function renderCashflow(entries, month, income, expense) {
  const [year, numericMonth] = month.split('-').map(Number);
  const totalDays = new Date(year, numericMonth, 0).getDate();
  const entriesByDay = Array.from({ length: totalDays }, (_, index) => ({ day: index + 1, income: 0, expense: 0 }));

  entries.forEach((entry) => {
    const day = Number(entry.date.slice(8, 10));
    if (entriesByDay[day - 1]) entriesByDay[day - 1][entry.type] += Number(entry.amount);
  });

  if (!entries.length) {
    byId('cashflowChart').innerHTML = '<div class="chart-placeholder">Adicione lançamentos para visualizar seu fluxo mensal.</div>';
    byId('cashflowSummary').textContent = `Não há lançamentos registrados em ${formatFullMonth(month)}.`;
    return;
  }

  const maximum = Math.max(1, ...entriesByDay.flatMap((day) => [day.income, day.expense]));
  const highestMovement = [...entriesByDay].sort((first, second) => (second.income + second.expense) - (first.income + first.expense))[0];
  byId('cashflowSummary').textContent = `Em ${formatFullMonth(month)}, foram registradas receitas de ${formatCurrency(income)} e despesas de ${formatCurrency(expense)}. O maior movimento ocorreu no dia ${highestMovement.day}, com ${formatCurrency(highestMovement.income + highestMovement.expense)}.`;
  byId('cashflowChart').innerHTML = entriesByDay.map((day) => {
    const tip = `Dia ${day.day}: receitas ${formatCurrency(day.income)}; despesas ${formatCurrency(day.expense)}.`;
    const incomeHeight = day.income ? Math.max(3, (day.income / maximum) * 100) : 1;
    const expenseHeight = day.expense ? Math.max(3, (day.expense / maximum) * 100) : 1;
    return `<div class="chart-day" aria-hidden="true" data-tip="${escapeHtml(tip)}"><span class="chart-bar chart-income" style="height:${incomeHeight}%"></span><span class="chart-bar chart-expense" style="height:${expenseHeight}%"></span></div>`;
  }).join('');
}

function renderBudgetPreview(state, entries) {
  const summary = getMonthlyBudgetSummary(entries, state.budgets);
  const meter = byId('budgetMeter');
  byId('budgetMeterFill').style.width = `${summary.percentage}%`;
  meter.classList.toggle('over', summary.isOverLimit);
  meter.setAttribute('aria-valuenow', String(Math.round(summary.percentage)));
  meter.setAttribute('aria-valuetext', summary.monthlyLimit
    ? `${formatCurrency(summary.spent)} utilizados de ${formatCurrency(summary.monthlyLimit)}. ${Math.round(summary.percentage)}% do orçamento.`
    : 'Orçamento mensal ainda não definido.');
  byId('budgetSpent').textContent = formatCurrency(summary.spent);
  byId('budgetLimit').textContent = summary.monthlyLimit
    ? `${formatCurrency(summary.remaining)} restantes de ${formatCurrency(summary.monthlyLimit)}`
    : 'Defina um orçamento mensal';

  const configuredBudgets = getConfiguredCategoryBudgets(state.budgets);
  byId('budgetPreview').innerHTML = configuredBudgets.length
    ? configuredBudgets.slice(0, 4).map(([category, limit]) => {
      const usage = getCategoryBudgetUsage(summary.expenses, category, limit);
      const status = usage.isOverLimit ? ' Limite ultrapassado.' : '';
      return `<div class="budget-row"><span class="budget-name"><span aria-hidden="true">${getCategoryIcon(category)}</span> ${escapeHtml(category)}</span><span class="budget-meta">${formatCurrency(usage.spent)} / ${formatCurrency(limit)}</span><div class="budget-mini-track ${usage.isOverLimit ? 'over' : ''}" role="progressbar" aria-label="${escapeHtml(category)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(usage.percentage)}" aria-valuetext="${formatCurrency(usage.spent)} gastos de ${formatCurrency(limit)}.${status}"><span style="width:${usage.percentage}%"></span></div></div>`;
    }).join('')
    : '<p class="empty-copy">Crie limites por categoria para acompanhar seus gastos.</p>';
}

function renderRecentEntries(entries) {
  const recentEntries = [...entries]
    .sort((first, second) => second.date.localeCompare(first.date) || second.createdAt - first.createdAt)
    .slice(0, 5);

  byId('recentList').innerHTML = recentEntries.length
    ? recentEntries.map((entry) => `<div class="recent-item" role="listitem"><div class="category-icon" aria-hidden="true">${getCategoryIcon(entry.category)}</div><div class="recent-main"><strong>${escapeHtml(entry.description)}</strong><span>${escapeHtml(entry.category)} · ${formatShortDate(entry.date)}${entry.installment ? ` · ${entry.installment.current}/${entry.installment.total}` : ''}</span></div><div class="amount ${entry.type}">${entry.type === 'income' ? '+' : '−'} ${formatCurrency(entry.amount)}</div></div>`).join('')
    : '<div class="empty-state" style="position:static;padding:22px"><div aria-hidden="true">◌</div><h3>Seu mês ainda está vazio</h3><p>Use “Novo lançamento” para começar.</p></div>';
  byId('recentList').setAttribute('role', recentEntries.length ? 'list' : 'status');
}

function renderUpcomingEntries(futureExpenses) {
  const upcomingEntries = futureExpenses.slice(0, 4);
  byId('upcomingList').innerHTML = upcomingEntries.length
    ? upcomingEntries.map((entry) => {
      const details = entry.installment
        ? `${entry.installment.current}/${entry.installment.total}`
        : entry.recurring
          ? 'Recorrente'
          : escapeHtml(entry.category);
      return `<div class="upcoming-item"><div class="upcoming-icon" aria-hidden="true">${getCategoryIcon(entry.category)}</div><div class="upcoming-copy"><strong>${escapeHtml(entry.description)}</strong><span>${details} · ${formatShortDate(entry.date)}</span></div><span class="amount expense">${formatCurrency(entry.amount)}</span></div>`;
    }).join('')
    : '<div class="upcoming-empty"><span aria-hidden="true">◷</span><div><strong>Nenhum vencimento futuro</strong><p>As parcelas e contas recorrentes aparecerão aqui.</p></div></div>';
}

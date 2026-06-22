import { escapeHtml } from '../core/dom.js';
import { getEntriesForMonth, getFinancialSummary, getFutureInstallments, groupExpensesByCategory } from '../domain/entries.js';
import { formatCurrency } from '../utils/format.js';
import { formatDate, formatFullMonth, formatGeneratedAt } from '../utils/date.js';

export function openMonthlyReport(state, month, owner) {
  const reportWindow = window.open('', '_blank', 'width=1080,height=860');
  if (!reportWindow) return false;

  reportWindow.document.open();
  reportWindow.document.write(buildReportHtml(state, month, owner));
  reportWindow.document.close();
  return true;
}

function buildReportHtml(state, month, owner) {
  const entries = getEntriesForMonth(state.entries, month);
  const summary = getFinancialSummary(entries);
  const monthlyBudget = Number(state.budgets.monthly || 0);
  const remainingBudget = monthlyBudget - summary.expense;
  const categoryRows = createCategoryRows(groupExpensesByCategory(entries), summary.expense);
  const futureRows = createFutureInstallmentRows(getFutureInstallments(state.entries, month));
  const health = getFinancialHealth(summary.balance);
  const budgetHtml = createBudgetHtml(monthlyBudget, summary.expense, remainingBudget);
  const title = `Relatório Financeiro - ${formatFullMonth(month)}${owner ? ` - ${owner}` : ''}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${getReportStyles()}</style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div>
        <div class="brand"><span class="mark">M</span><span>Meu Fluxo</span></div>
        <p class="eyebrow" style="margin-top:16px">${owner ? `Relatório de ${escapeHtml(owner)}` : 'Gestão financeira pessoal'}</p>
        <h1>Relatório financeiro mensal</h1>
      </div>
      <div class="header-side"><strong>${escapeHtml(formatFullMonth(month))}</strong>Gerado em ${escapeHtml(formatGeneratedAt())}</div>
    </header>

    <section class="summary">
      <div class="metric income"><small>Receitas</small><strong>${formatCurrency(summary.income)}</strong></div>
      <div class="metric expense"><small>Despesas</small><strong>${formatCurrency(summary.expense)}</strong></div>
      <div class="metric"><small>Saldo do mês</small><strong>${formatCurrency(summary.balance)}</strong></div>
    </section>

    <div class="health"><div><strong>${health.label}</strong><span>${health.description}</span></div><div><strong>${entries.length}</strong><span>lançamento${entries.length === 1 ? '' : 's'} registrado${entries.length === 1 ? '' : 's'}</span></div></div>
    ${budgetHtml}

    <div class="grid-2">
      <section class="section">
        <div class="section-head"><h2>Despesas por categoria</h2><span>Participação nas saídas</span></div>
        <table><thead><tr><th>Categoria</th><th>Participação</th><th style="text-align:right">Total</th></tr></thead><tbody>${categoryRows}</tbody></table>
      </section>
      <section class="section">
        <div class="section-head"><h2>Próximas parcelas</h2><span>Após o período selecionado</span></div>
        <table><thead><tr><th>Descrição</th><th>Parcela</th><th>Vencimento</th><th style="text-align:right">Valor</th></tr></thead><tbody>${futureRows}</tbody></table>
      </section>
    </div>

    <section class="section">
      <div class="section-head"><h2>Todos os lançamentos</h2><span>${escapeHtml(formatFullMonth(month))}</span></div>
      <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th style="text-align:right">Valor</th></tr></thead><tbody>${createEntryRows(entries)}</tbody></table>
    </section>

    <footer class="footer"><span>Relatório gerado pelo Meu Fluxo.</span><span>Dados armazenados localmente neste navegador.</span></footer>
    <div class="print-note">Para gerar o arquivo, use a opção <strong>Salvar como PDF</strong> na janela de impressão do navegador.</div>
  </main>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 250); });<\/script>
</body>
</html>`;
}

function createCategoryRows(groups, totalExpense) {
  if (!groups.length) return '<tr><td colspan="3" class="empty-row">Nenhuma despesa registrada no período.</td></tr>';
  return groups.map(([category, total]) => {
    const percentage = totalExpense ? Math.round((total / totalExpense) * 100) : 0;
    return `<tr><td>${escapeHtml(category)}</td><td>${percentage}%</td><td class="currency">${formatCurrency(total)}</td></tr>`;
  }).join('');
}

function createFutureInstallmentRows(entries) {
  if (!entries.length) return '<tr><td colspan="4" class="empty-row">Não há parcelas futuras registradas.</td></tr>';
  return entries.map((entry) => `<tr><td>${escapeHtml(entry.description)}</td><td>${entry.installment.current}/${entry.installment.total}</td><td>${escapeHtml(formatDate(entry.date))}</td><td class="currency">${formatCurrency(entry.amount)}</td></tr>`).join('');
}

function createEntryRows(entries) {
  if (!entries.length) return '<tr><td colspan="5" class="empty-row">Nenhum lançamento registrado no período.</td></tr>';
  return [...entries]
    .sort((first, second) => first.date.localeCompare(second.date) || first.createdAt - second.createdAt)
    .map((entry) => {
      const detail = entry.installment
        ? `${entry.installment.current}/${entry.installment.total}`
        : entry.recurring
          ? 'Recorrente'
          : 'À vista';
      return `<tr><td>${escapeHtml(formatDate(entry.date))}</td><td><strong>${escapeHtml(entry.description)}</strong><small>${escapeHtml(entry.notes || '')}</small></td><td>${escapeHtml(entry.category)}</td><td>${detail}</td><td class="currency ${entry.type === 'income' ? 'income-text' : 'expense-text'}">${entry.type === 'income' ? '+' : '-'} ${formatCurrency(entry.amount)}</td></tr>`;
    }).join('');
}

function getFinancialHealth(balance) {
  if (balance > 0) return { label: 'Mês com saldo positivo', description: `Suas receitas ficaram ${formatCurrency(balance)} acima das despesas no período.` };
  if (balance < 0) return { label: 'Mês com saldo negativo', description: `Suas despesas ficaram ${formatCurrency(Math.abs(balance))} acima das receitas no período.` };
  return { label: 'Mês equilibrado', description: 'Receitas e despesas ficaram equilibradas no período.' };
}

function createBudgetHtml(monthlyBudget, expense, remainingBudget) {
  if (!monthlyBudget) {
    return '<div class="budget-note"><strong>Orçamento mensal</strong><span>Não foi definido um limite de orçamento para este período.</span></div>';
  }
  const description = remainingBudget >= 0
    ? `${formatCurrency(remainingBudget)} restantes`
    : `${formatCurrency(Math.abs(remainingBudget))} acima do limite`;
  return `<div class="budget-note ${remainingBudget < 0 ? 'danger' : ''}"><strong>Orçamento mensal</strong><span>${formatCurrency(expense)} utilizados de ${formatCurrency(monthlyBudget)} - ${description}</span></div>`;
}

function getReportStyles() {
  return `
    @page { size: A4; margin: 15mm; }
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #152033; background: #f3f6fb; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.45; }
    .page { width: 100%; max-width: 210mm; min-height: 265mm; margin: 0 auto; padding: 20px; background: #fff; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 2px solid #213cce; }
    .brand { display: flex; align-items: center; gap: 10px; color: #0d1b3f; font-weight: 800; letter-spacing: -.2px; }
    .mark { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: #fff; background: linear-gradient(135deg, #3157ed, #7538e8); font-size: 16px; }
    .eyebrow { margin: 0 0 6px; color: #59677f; text-transform: uppercase; font-size: 9px; font-weight: 700; letter-spacing: .8px; }
    h1 { margin: 0; color: #0d1b3f; font-size: 24px; line-height: 1.1; letter-spacing: -.65px; }
    .header-side { text-align: right; color: #59677f; font-size: 10px; }
    .header-side strong { display: block; color: #0d1b3f; font-size: 12px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 18px 0 12px; }
    .metric { padding: 14px; border: 1px solid #dce3f2; border-radius: 11px; background: #fff; }
    .metric small { display: block; color: #59677f; font-weight: 700; text-transform: uppercase; letter-spacing: .35px; font-size: 9px; }
    .metric strong { display: block; margin-top: 7px; color: #0d1b3f; font-size: 18px; line-height: 1; }
    .metric.income strong { color: #067047; }
    .metric.expense strong { color: #b22945; }
    .health { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 10px 0 18px; padding: 12px 14px; border-radius: 10px; background: #eff4ff; border-left: 4px solid #3157ed; }
    .health strong { display: block; color: #0d1b3f; font-size: 12px; }
    .health span { color: #43516a; }
    .budget-note { display: flex; justify-content: space-between; gap: 15px; margin: 0 0 18px; padding: 11px 14px; border: 1px solid #dce3f2; border-radius: 10px; background: #fafcff; }
    .budget-note strong { color: #0d1b3f; }
    .budget-note span { text-align: right; color: #43516a; }
    .budget-note.danger { border-color: #e9b4be; background: #fff6f7; }
    .section { margin-top: 18px; break-inside: avoid; }
    .section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
    h2 { margin: 0; color: #0d1b3f; font-size: 14px; }
    .section-head span { color: #59677f; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #dce3f2; border-radius: 10px; overflow: hidden; }
    thead { background: #eef3ff; }
    th { padding: 8px 9px; color: #40506c; text-align: left; text-transform: uppercase; letter-spacing: .3px; font-size: 8.5px; }
    td { padding: 8px 9px; border-top: 1px solid #e6ebf4; vertical-align: top; }
    tr:nth-child(even) td { background: #fbfcff; }
    td strong { display: block; color: #152033; }
    td small { display: block; margin-top: 2px; color: #69778e; font-size: 9px; }
    .currency { text-align: right; white-space: nowrap; font-weight: 700; }
    .income-text { color: #067047; }
    .expense-text { color: #b22945; }
    .empty-row { padding: 14px; text-align: center; color: #69778e; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #dce3f2; color: #6f7c90; font-size: 9px; display: flex; justify-content: space-between; gap: 12px; }
    .print-note { margin: 16px 0 0; padding: 11px 13px; border-radius: 9px; color: #31425d; background: #fff8dc; border: 1px solid #eddc8a; font-size: 11px; }
    @media print { body { background: #fff; } .page { max-width: none; min-height: 0; padding: 0; } .print-note { display: none; } }
    @media (max-width: 650px) { .summary, .grid-2 { grid-template-columns: 1fr; } .header, .health, .budget-note, .footer { display: block; } .header-side, .budget-note span { margin-top: 8px; text-align: left; } }
  `;
}

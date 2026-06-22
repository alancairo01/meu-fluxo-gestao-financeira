(() => {
  const STORAGE_KEY = 'meuFluxo.finance.v1';
  const DEFAULT_CATEGORIES = [
    ['Cartão', '💳'], ['Mercado', '🛒'], ['Energia', '⚡'], ['Água', '💧'], ['Internet', '◉'],
    ['Moradia', '⌂'], ['Transporte', '🚗'], ['Saúde', '✚'], ['Educação', '📚'], ['Lazer', '☀'],
    ['Parcelas', '▣'], ['Assinaturas', '◌'], ['Outros', '•']
  ];
  const INCOME_CATEGORIES = [['Salário', '↗'], ['Freelance', '✦'], ['Venda', '◫'], ['Rendimentos', '◌'], ['Outros', '•']];

  const $ = (id) => document.getElementById(id);
  const qs = (selector, parent = document) => parent.querySelector(selector);
  const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  let state = loadState();
  let activeView = 'dashboard';
  let toastTimer;
  let lastDialogFocus = null;
  let lastAccessibilityFocus = null;
  let lastClearDataFocus = null;

  function defaultState() {
    return {
      entries: [],
      budgets: { monthly: 0, categories: {} },
      selectedMonth: '',
      theme: 'light',
      a11y: { fontSize: 'default', highContrast: false, reduceMotion: false }
    };
  }

  function cleanEntries(entries) {
    return Array.isArray(entries)
      ? entries.map((entry) => {
        const { payment, status, cardName, ...cleanEntry } = entry || {};
        return cleanEntry;
      })
      : [];
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const defaults = defaultState();
      return {
        ...defaults,
        ...stored,
        entries: cleanEntries(stored?.entries),
        budgets: { ...defaults.budgets, ...(stored?.budgets || {}) },
        selectedMonth: isValidMonth(stored?.selectedMonth) ? stored.selectedMonth : '',
        a11y: { ...defaults.a11y, ...(stored?.a11y || {}) }
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toISODateLocal(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isoToday() {
    return toISODateLocal(new Date());
  }

  function defaultDueDate() {
    const nextMonth = new Date();
    nextMonth.setHours(12, 0, 0, 0);
    nextMonth.setDate(1);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(5);
    return toISODateLocal(nextMonth);
  }

  function isValidMonth(month) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''));
  }

  function monthFromDate(date) {
    const month = String(date || '').slice(0, 7);
    return isValidMonth(month) ? month : '';
  }

  function getCurrentMonth() {
    return $('monthFilter').value || state.selectedMonth || isoToday().slice(0, 7);
  }

  function getEntryMonths(entries = state.entries) {
    return [...new Set((entries || []).map((entry) => monthFromDate(entry?.date)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  function findMonthToDisplay(preferredMonth = '') {
    const months = getEntryMonths();
    const currentMonth = isoToday().slice(0, 7);
    const preferred = isValidMonth(preferredMonth) ? preferredMonth : '';

    // Keep the current choice only when it actually has data. After restoring a
    // backup, this prevents the app from opening on an empty month while the
    // restored records are already available in a later (or earlier) month.
    if (preferred && months.includes(preferred)) return preferred;
    if (months.includes(currentMonth)) return currentMonth;

    // Prefer the next month with records (common for bills due on the 5th),
    // otherwise use the most recent month contained in the backup.
    return months.find((month) => month >= currentMonth) || months.at(-1) || currentMonth;
  }

  function applyDisplayedMonth(preferredMonth = state.selectedMonth, ensureDataMonth = false) {
    const preferred = isValidMonth(preferredMonth) ? preferredMonth : '';
    const month = !ensureDataMonth && preferred ? preferred : findMonthToDisplay(preferred);
    state.selectedMonth = month;
    $('monthFilter').value = month;
    return month;
  }

  function money(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  }

  function shortDate(date) {
    if (!date) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
      .format(new Date(`${date}T12:00:00`))
      .replace('.', '');
  }

  function fullMonth(month) {
    const [year, mon] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, mon - 1, 1));
  }

  function normalizeText(text) {
    return (text || '')
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function categoryIcon(category) {
    return [...DEFAULT_CATEGORIES, ...INCOME_CATEGORIES].find(([name]) => name === category)?.[1] || '•';
  }

  function uniqueId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function addMonths(dateString, amount) {
    const date = new Date(`${dateString}T12:00:00`);
    const originalDay = date.getDate();
    date.setMonth(date.getMonth() + amount);
    if (date.getDate() < originalDay) date.setDate(0);
    return toISODateLocal(date);
  }

  function setSelectedMonthFromDate(date) {
    const month = monthFromDate(date);
    if (!month) return;
    state.selectedMonth = month;
    $('monthFilter').value = month;
  }

  function isInMonth(entry, month = getCurrentMonth()) {
    return monthFromDate(entry.date) === month;
  }

  function getMonthEntries(month = getCurrentMonth()) {
    return state.entries.filter((entry) => isInMonth(entry, month));
  }

  function getExpenses(entries) {
    return entries.filter((entry) => entry.type === 'expense');
  }

  function getIncomes(entries) {
    return entries.filter((entry) => entry.type === 'income');
  }

  function sum(entries) {
    return entries.reduce((total, entry) => total + Number(entry.amount || 0), 0);
  }

  function escapeHTML(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function setTheme() {
    document.body.classList.toggle('dark', state.theme === 'dark');
    $('themeBtn').setAttribute('aria-label', state.theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
  }

  function applyAccessibility() {
    const a11y = state.a11y || defaultState().a11y;
    document.body.classList.remove('font-large', 'font-extra');
    if (a11y.fontSize === 'large') document.body.classList.add('font-large');
    if (a11y.fontSize === 'extra') document.body.classList.add('font-extra');
    document.body.classList.toggle('high-contrast', Boolean(a11y.highContrast));
    document.body.classList.toggle('reduce-motion', Boolean(a11y.reduceMotion));
    syncAccessibilityControls();
  }

  function syncAccessibilityControls() {
    const a11y = state.a11y || defaultState().a11y;
    const selected = qs(`input[name="fontSize"][value="${a11y.fontSize}"]`);
    if (selected) selected.checked = true;
    $('highContrastInput').checked = Boolean(a11y.highContrast);
    $('reduceMotionInput').checked = Boolean(a11y.reduceMotion);
  }

  function readAccessibilityControls() {
    return {
      fontSize: qs('input[name="fontSize"]:checked')?.value || 'default',
      highContrast: $('highContrastInput').checked,
      reduceMotion: $('reduceMotionInput').checked
    };
  }

  function previewAccessibility() {
    state.a11y = readAccessibilityControls();
    applyAccessibility();
  }

  function openAccessibilityDialog() {
    lastAccessibilityFocus = document.activeElement;
    syncAccessibilityControls();
    $('accessibilityDialog').showModal();
    window.setTimeout(() => qs('input[name="fontSize"]:checked')?.focus(), 0);
  }

  function closeAccessibilityDialog() {
    $('accessibilityDialog').close();
  }

  function saveAccessibility() {
    state.a11y = readAccessibilityControls();
    saveState();
    applyAccessibility();
    closeAccessibilityDialog();
    showToast('Preferências de acessibilidade salvas.');
  }

  function resetAccessibility() {
    state.a11y = defaultState().a11y;
    saveState();
    applyAccessibility();
    showToast('Preferências de acessibilidade restauradas.');
  }

  function initSelects() {
    $('installmentTotal').innerHTML = Array.from({ length: 11 }, (_, index) => `<option value="${index + 2}">${index + 2}x</option>`).join('');
    updateCurrentInstallmentOptions();
    qsa('input[name="expenseMode"]').forEach((input) => input.addEventListener('change', updateExpenseMode));
    $('installmentTotal').addEventListener('change', updateCurrentInstallmentOptions);
  }

  function populateCategories(type, selected = '') {
    const items = type === 'income' ? INCOME_CATEGORIES : DEFAULT_CATEGORIES;
    $('entryCategory').innerHTML = items
      .map(([name, icon]) => `<option value="${name}" ${name === selected ? 'selected' : ''}>${icon} ${name}</option>`)
      .join('');
    $('budgetCategorySelect').innerHTML = DEFAULT_CATEGORIES
      .map(([name, icon]) => `<option value="${name}">${icon} ${name}</option>`)
      .join('');
  }

  function updateCurrentInstallmentOptions(current = 1) {
    const total = Number($('installmentTotal').value || 2);
    $('installmentCurrent').innerHTML = Array.from(
      { length: total },
      (_, index) => `<option value="${index + 1}" ${index + 1 === Number(current) ? 'selected' : ''}>${index + 1} de ${total}</option>`
    ).join('');
  }

  function updateExpenseMode() {
    const mode = qs('input[name="expenseMode"]:checked')?.value || 'oneoff';
    $('installmentFields').classList.toggle('hidden', mode !== 'installment');
    $('recurringFields').classList.toggle('hidden', mode !== 'recurring');
  }

  function updateEntryTypeUI(type) {
    const isExpense = type === 'expense';
    qsa('.type-choice').forEach((button) => {
      const active = button.dataset.type === type;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    $('installmentBox').classList.toggle('hidden', !isExpense);
    $('dateLabel').innerHTML = `${isExpense ? 'Vencimento' : 'Recebimento'} <b aria-hidden="true">*</b>`;
  }

  function setEntryType(type) {
    $('entryType').value = type;
    populateCategories(type);
    updateEntryTypeUI(type);
  }

  function switchView(view) {
    activeView = view;
    qsa('.view').forEach((section) => section.classList.remove('active'));
    $(`${view}View`).classList.add('active');
    qsa('.nav-item[data-view]').forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    const titles = {
      dashboard: ['Acompanhe seu dinheiro', 'Visão geral'],
      lancamentos: ['Tudo em um lugar', 'Lançamentos'],
      orcamentos: ['Planeje antes de gastar', 'Orçamentos'],
      relatorios: ['Entenda seus hábitos', 'Relatórios']
    };
    $('viewEyebrow').textContent = titles[view][0];
    $('viewTitle').textContent = titles[view][1];
    $('sidebar').classList.remove('open');
    $('menuBtn').setAttribute('aria-expanded', 'false');
    renderAll();
  }

  function renderAll() {
    const month = getCurrentMonth();
    $('monthLabel').textContent = `Resumo de ${fullMonth(month)}.`;
    renderDashboard(month);
    renderEntries();
    renderBudgets(month);
    renderReports(month);
  }

  function renderDashboard(month) {
    const entries = getMonthEntries(month);
    const income = sum(getIncomes(entries));
    const expense = sum(getExpenses(entries));
    const balance = income - expense;

    $('incomeTotal').textContent = money(income);
    $('expenseTotal').textContent = money(expense);
    $('balanceTotal').textContent = money(balance);
    $('incomeCount').textContent = `${getIncomes(entries).length || 'Nenhuma'} ${getIncomes(entries).length === 1 ? 'receita' : 'receitas'} no mês`;
    $('expenseCount').textContent = `${getExpenses(entries).length || 'Nenhuma'} ${getExpenses(entries).length === 1 ? 'despesa' : 'despesas'} no mês`;
    $('balanceNote').textContent = balance >= 0 ? 'Você fechou o mês no positivo' : 'Atenção: despesas acima das receitas';
    $('balanceTag').textContent = balance >= 0 ? 'Saldo positivo' : 'Saldo negativo';
    $('balanceTag').style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';
    $('balanceTag').style.background = balance >= 0 ? 'var(--income-soft)' : 'var(--expense-soft)';

    renderCashflow(entries, month, income, expense);
    renderBudgetPreview(month);
    renderRecent(entries);
  }

  function renderCashflow(entries, month, income, expense) {
    const [year, mon] = month.split('-').map(Number);
    const days = new Date(year, mon, 0).getDate();
    const byDay = Array.from({ length: days }, (_, index) => ({ day: index + 1, income: 0, expense: 0 }));
    entries.forEach((entry) => {
      const day = Number(entry.date.slice(8, 10));
      if (byDay[day - 1]) byDay[day - 1][entry.type] += Number(entry.amount);
    });

    if (!entries.length) {
      $('cashflowChart').innerHTML = '<div class="chart-placeholder">Adicione lançamentos para visualizar seu fluxo mensal.</div>';
      $('cashflowSummary').textContent = `Não há lançamentos registrados em ${fullMonth(month)}.`;
      return;
    }

    const max = Math.max(1, ...byDay.flatMap((day) => [day.income, day.expense]));
    const highest = [...byDay].sort((a, b) => (b.income + b.expense) - (a.income + a.expense))[0];
    $('cashflowSummary').textContent = `Em ${fullMonth(month)}, foram registradas receitas de ${money(income)} e despesas de ${money(expense)}. O maior movimento ocorreu no dia ${highest.day}, com ${money(highest.income + highest.expense)}.`;
    $('cashflowChart').innerHTML = byDay.map((day) => {
      const tip = `Dia ${day.day}: receitas ${money(day.income)}; despesas ${money(day.expense)}.`;
      return `<div class="chart-day" aria-hidden="true" data-tip="${tip}"><span class="chart-bar chart-income" style="height:${day.income ? Math.max(3, day.income / max * 100) : 1}%"></span><span class="chart-bar chart-expense" style="height:${day.expense ? Math.max(3, day.expense / max * 100) : 1}%"></span></div>`;
    }).join('');
  }

  function renderBudgetPreview(month) {
    const expenses = getExpenses(getMonthEntries(month));
    const spent = sum(expenses);
    const monthly = Number(state.budgets.monthly || 0);
    const percentage = monthly ? Math.min(100, (spent / monthly) * 100) : 0;
    const meter = $('budgetMeter');

    $('budgetMeterFill').style.width = `${percentage}%`;
    meter.classList.toggle('over', monthly > 0 && spent > monthly);
    meter.setAttribute('aria-valuenow', String(Math.round(percentage)));
    meter.setAttribute('aria-valuetext', monthly ? `${money(spent)} utilizados de ${money(monthly)}. ${Math.round(percentage)}% do orçamento.` : 'Orçamento mensal ainda não definido.');
    $('budgetSpent').textContent = money(spent);
    $('budgetLimit').textContent = monthly ? `${money(Math.max(monthly - spent, 0))} restantes de ${money(monthly)}` : 'Defina um orçamento mensal';

    const configured = Object.entries(state.budgets.categories || {}).filter(([, limit]) => Number(limit) > 0);
    $('budgetPreview').innerHTML = configured.length
      ? configured.slice(0, 4).map(([category, limit]) => {
        const used = sum(expenses.filter((entry) => entry.category === category));
        const ratio = Math.min(100, (used / limit) * 100);
        const status = used > limit ? ' Limite ultrapassado.' : '';
        return `<div class="budget-row"><span class="budget-name"><span aria-hidden="true">${categoryIcon(category)}</span> ${category}</span><span class="budget-meta">${money(used)} / ${money(limit)}</span><div class="budget-mini-track ${used > limit ? 'over' : ''}" role="progressbar" aria-label="${escapeHTML(category)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ratio)}" aria-valuetext="${money(used)} gastos de ${money(limit)}.${status}"><span style="width:${ratio}%"></span></div></div>`;
      }).join('')
      : '<p class="empty-copy">Crie limites por categoria para acompanhar seus gastos.</p>';
  }

  function renderRecent(entries) {
    const list = [...entries]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      .slice(0, 5);

    $('recentList').innerHTML = list.length
      ? list.map((item) => `<div class="recent-item" role="listitem"><div class="category-icon" aria-hidden="true">${categoryIcon(item.category)}</div><div class="recent-main"><strong>${escapeHTML(item.description)}</strong><span>${escapeHTML(item.category)} · ${shortDate(item.date)}${item.installment ? ` · ${item.installment.current}/${item.installment.total}` : ''}</span></div><div class="amount ${item.type}">${item.type === 'income' ? '+' : '−'} ${money(item.amount)}</div></div>`).join('')
      : '<div class="empty-state" style="position:static;padding:22px"><div aria-hidden="true">◌</div><h3>Seu mês ainda está vazio</h3><p>Use “Novo lançamento” para começar.</p></div>';
    $('recentList').setAttribute('role', list.length ? 'list' : 'status');
  }

  function entryDetails(entry) {
    const details = [];
    if (entry.installment) details.push(`Parcela ${entry.installment.current} de ${entry.installment.total}`);
    else if (entry.recurring) details.push('Lançamento recorrente');
    if (entry.notes) details.push(escapeHTML(entry.notes));
    return details.join(' · ');
  }

  function renderEntries() {
    const query = normalizeText($('searchEntries').value);
    const type = $('typeFilter').value;
    const entries = state.entries
      .filter((entry) => {
        const matchesMonth = isInMonth(entry);
        const matchesQuery = !query || normalizeText(`${entry.description} ${entry.category}`).includes(query);
        return matchesMonth && matchesQuery && (type === 'all' || entry.type === type);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

    $('entriesCount').textContent = `${entries.length} ${entries.length === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'} no mês selecionado.`;
    $('entriesTable').innerHTML = entries.map((entry) => `<tr>
      <td>${shortDate(entry.date)}</td>
      <td><div class="table-desc"><div class="category-icon" aria-hidden="true">${categoryIcon(entry.category)}</div><div><strong>${escapeHTML(entry.description)}</strong><small>${entryDetails(entry)}</small></div></div></td>
      <td><span class="category-chip"><span aria-hidden="true">${categoryIcon(entry.category)}</span> ${escapeHTML(entry.category)}</span></td>
      <td><span class="amount ${entry.type}">${entry.type === 'income' ? '+' : '−'} ${money(entry.amount)}</span></td>
      <td><div class="row-actions"><button class="row-button" type="button" aria-label="Editar lançamento ${escapeHTML(entry.description)}" title="Editar" data-action="edit" data-id="${entry.id}">✎</button><button class="row-button delete" type="button" aria-label="Excluir lançamento ${escapeHTML(entry.description)}" title="Excluir" data-action="delete" data-id="${entry.id}">⌫</button></div></td>
    </tr>`).join('');
    $('entriesEmpty').classList.toggle('hidden', entries.length > 0);
  }

  function renderBudgets(month) {
    $('monthlyBudgetInput').value = state.budgets.monthly || '';
    const expenses = getExpenses(getMonthEntries(month));
    const budgets = Object.entries(state.budgets.categories || {}).filter(([, value]) => Number(value) > 0);
    $('categoryBudgetList').innerHTML = budgets.length
      ? budgets.map(([category, limit]) => {
        const used = sum(expenses.filter((entry) => entry.category === category));
        return `<div class="category-budget-row"><strong><span aria-hidden="true">${categoryIcon(category)}</span> ${escapeHTML(category)}</strong><span>${money(used)} gastos de ${money(limit)} ${used > limit ? '· limite ultrapassado' : ''}</span><button class="remove-budget" type="button" aria-label="Remover limite de ${escapeHTML(category)}" data-remove-budget="${escapeHTML(category)}">Remover</button></div>`;
      }).join('')
      : '<p class="empty-copy">Nenhum limite por categoria configurado.</p>';
  }

  function renderReports(month) {
    const expenses = getExpenses(getMonthEntries(month));
    const grouped = Object.entries(expenses.reduce((groups, entry) => {
      groups[entry.category] = (groups[entry.category] || 0) + Number(entry.amount);
      return groups;
    }, {})).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...grouped.map(([, value]) => value));

    $('categoryBars').innerHTML = grouped.length
      ? grouped.map(([category, total]) => {
        const percentage = (total / max) * 100;
        return `<div class="category-bar-row"><div class="category-bar-top"><strong><span aria-hidden="true">${categoryIcon(category)}</span> ${escapeHTML(category)}</strong><span>${money(total)}</span></div><div class="category-bar-track" role="progressbar" aria-label="${escapeHTML(category)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percentage)}" aria-valuetext="${money(total)} gastos em ${escapeHTML(category)}"><span style="width:${percentage}%"></span></div></div>`;
      }).join('')
      : '<p class="empty-copy">Nenhuma despesa registrada neste mês.</p>';

    const future = state.entries
      .filter((entry) => entry.installment && monthFromDate(entry.date) >= month)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
    $('installmentList').innerHTML = future.length
      ? future.map((entry) => `<div class="installment-row"><div><strong>${escapeHTML(entry.description)}</strong><small>${entry.installment.current}/${entry.installment.total} · vence ${shortDate(entry.date)}</small></div><span class="amount expense">${money(entry.amount)}</span></div>`).join('')
      : '<p class="empty-copy">Nenhuma parcela futura registrada.</p>';
  }

  function clearFormError() {
    $('entryFormError').classList.add('hidden');
    $('entryFormError').textContent = '';
    qsa('#entryForm [aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  }

  function showFormError(message, field) {
    $('entryFormError').textContent = message;
    $('entryFormError').classList.remove('hidden');
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  }

  function validateEntry() {
    clearFormError();
    const requiredFields = [
      ['entryDescription', 'Informe uma descrição para o lançamento.'],
      ['entryAmount', 'Informe um valor maior que zero.'],
      ['entryDate', 'Informe a data de vencimento ou recebimento.'],
      ['entryCategory', 'Selecione uma categoria.']
    ];

    for (const [id, message] of requiredFields) {
      const field = $(id);
      if (!field.checkValidity() || !String(field.value).trim()) {
        showFormError(message, field);
        return false;
      }
    }
    return true;
  }

  function openDialog(entry = null) {
    lastDialogFocus = document.activeElement;
    clearFormError();
    $('entryForm').reset();
    $('entryId').value = '';
    $('entryType').value = 'expense';
    $('entryDate').value = defaultDueDate();
    populateCategories('expense');
    updateEntryTypeUI('expense');
    $('installmentTotal').value = '12';
    updateCurrentInstallmentOptions(1);
    $('generateRemaining').checked = true;
    $('generateRecurring').checked = true;
    qs('input[name="expenseMode"][value="oneoff"]').checked = true;
    updateExpenseMode();
    $('dialogTitle').textContent = entry ? 'Editar lançamento' : 'Novo lançamento';

    if (entry) {
      $('entryId').value = entry.id;
      $('entryType').value = entry.type;
      $('entryDescription').value = entry.description;
      $('entryAmount').value = entry.amount;
      $('entryDate').value = entry.date;
      populateCategories(entry.type, entry.category);
      updateEntryTypeUI(entry.type);
      $('entryNotes').value = entry.notes || '';
      const isExpense = entry.type === 'expense';
      if (isExpense && entry.installment) {
        qs('input[name="expenseMode"][value="installment"]').checked = true;
        $('installmentTotal').value = entry.installment.total;
        updateCurrentInstallmentOptions(entry.installment.current);
        $('generateRemaining').checked = false;
      } else if (isExpense && entry.recurring) {
        qs('input[name="expenseMode"][value="recurring"]').checked = true;
        $('recurringMonths').value = entry.recurring.total || 12;
        $('generateRecurring').checked = false;
      }
      updateExpenseMode();
    }

    $('entryDialog').showModal();
    window.setTimeout(() => $('entryDescription').focus(), 0);
  }

  function closeDialog() {
    $('entryDialog').close();
  }

  function submitEntry(event) {
    event.preventDefault();
    if (!validateEntry()) return;

    const type = $('entryType').value;
    const id = $('entryId').value;
    const mode = type === 'expense' ? qs('input[name="expenseMode"]:checked').value : 'oneoff';
    const base = {
      id: id || uniqueId(),
      type,
      description: $('entryDescription').value.trim(),
      amount: Number($('entryAmount').value),
      date: $('entryDate').value,
      category: $('entryCategory').value,
      notes: $('entryNotes').value.trim(),
      createdAt: Date.now(),
      installment: null,
      recurring: null
    };

    if (id) {
      const old = state.entries.find((entry) => entry.id === id);
      base.createdAt = old?.createdAt || Date.now();
      if (type === 'expense' && mode === 'installment') {
        base.installment = {
          current: Number($('installmentCurrent').value),
          total: Number($('installmentTotal').value),
          seriesId: old?.installment?.seriesId || uniqueId()
        };
      }
      if (type === 'expense' && mode === 'recurring') {
        base.recurring = { total: Number($('recurringMonths').value), seriesId: old?.recurring?.seriesId || uniqueId() };
      }
      state.entries = state.entries.map((entry) => entry.id === id ? base : entry);
      setSelectedMonthFromDate(base.date);
      saveState();
      closeDialog();
      renderAll();
      showToast(`Lançamento atualizado e exibido em ${fullMonth(monthFromDate(base.date))}.`);
      return;
    }

    const newEntries = [base];
    if (type === 'expense' && mode === 'installment') {
      const total = Number($('installmentTotal').value);
      const current = Number($('installmentCurrent').value);
      const seriesId = uniqueId();
      base.installment = { current, total, seriesId };
      if ($('generateRemaining').checked) {
        for (let parcel = current + 1; parcel <= total; parcel += 1) {
          newEntries.push({
            ...base,
            id: uniqueId(),
            date: addMonths(base.date, parcel - current),
            createdAt: Date.now() + parcel,
            installment: { current: parcel, total, seriesId }
          });
        }
      }
    }

    if (type === 'expense' && mode === 'recurring') {
      const total = Number($('recurringMonths').value);
      const seriesId = uniqueId();
      base.recurring = { total, seriesId };
      if ($('generateRecurring').checked) {
        for (let index = 1; index < total; index += 1) {
          newEntries.push({
            ...base,
            id: uniqueId(),
            date: addMonths(base.date, index),
            createdAt: Date.now() + index,
            recurring: { total, seriesId }
          });
        }
      }
    }

    state.entries.push(...newEntries);
    setSelectedMonthFromDate(base.date);
    saveState();
    closeDialog();
    renderAll();
    const monthName = fullMonth(monthFromDate(base.date));
    showToast(newEntries.length > 1 ? `${newEntries.length} lançamentos foram criados. Exibindo ${monthName}.` : `Lançamento salvo e exibido em ${monthName}.`);
  }

  function deleteEntry(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    if (!confirm(`Excluir “${entry.description}”?`)) return;
    state.entries = state.entries.filter((item) => item.id !== id);
    saveState();
    renderAll();
    showToast('Lançamento excluído.');
  }

  function showToast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000);
  }

  function reportEntriesRows(entries) {
    if (!entries.length) {
      return '<tr><td colspan="5" class="empty-row">Nenhum lançamento registrado no período.</td></tr>';
    }
    return [...entries]
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
      .map((entry) => {
        const detail = entry.installment ? `${Number(entry.installment.current) || 0}/${Number(entry.installment.total) || 0}` : entry.recurring ? 'Recorrente' : 'À vista';
        return `<tr>
          <td>${escapeHTML(new Intl.DateTimeFormat('pt-BR').format(new Date(`${entry.date}T12:00:00`)))}</td>
          <td><strong>${escapeHTML(entry.description)}</strong><small>${escapeHTML(entry.notes || '')}</small></td>
          <td>${escapeHTML(entry.category)}</td>
          <td>${detail}</td>
          <td class="currency ${entry.type === 'income' ? 'income-text' : 'expense-text'}">${entry.type === 'income' ? '+' : '-'} ${money(entry.amount)}</td>
        </tr>`;
      }).join('');
  }

  function generatePDFReport() {
    const month = getCurrentMonth();
    const entries = getMonthEntries(month);
    const incomes = getIncomes(entries);
    const expenses = getExpenses(entries);
    const income = sum(incomes);
    const expense = sum(expenses);
    const balance = income - expense;
    const monthlyBudget = Number(state.budgets.monthly || 0);
    const remainingBudget = monthlyBudget - expense;
    const expenseGroups = Object.entries(expenses.reduce((groups, entry) => {
      groups[entry.category] = (groups[entry.category] || 0) + Number(entry.amount || 0);
      return groups;
    }, {})).sort((a, b) => b[1] - a[1]);
    const categoryRows = expenseGroups.length
      ? expenseGroups.map(([category, total]) => {
        const percent = expense ? Math.round((total / expense) * 100) : 0;
        return `<tr><td>${escapeHTML(category)}</td><td>${percent}%</td><td class="currency">${money(total)}</td></tr>`;
      }).join('')
      : '<tr><td colspan="3" class="empty-row">Nenhuma despesa registrada no período.</td></tr>';
    const futureInstallments = state.entries
      .filter((entry) => entry.installment && monthFromDate(entry.date) > month)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
    const futureRows = futureInstallments.length
      ? futureInstallments.map((entry) => `<tr><td>${escapeHTML(entry.description)}</td><td>${Number(entry.installment.current) || 0}/${Number(entry.installment.total) || 0}</td><td>${escapeHTML(new Intl.DateTimeFormat('pt-BR').format(new Date(`${entry.date}T12:00:00`)))}</td><td class="currency">${money(entry.amount)}</td></tr>`).join('')
      : '<tr><td colspan="4" class="empty-row">Não há parcelas futuras registradas.</td></tr>';
    const generatedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
    const healthLabel = balance > 0 ? 'Mês com saldo positivo' : balance < 0 ? 'Mês com saldo negativo' : 'Mês equilibrado';
    const healthText = balance > 0
      ? `Suas receitas ficaram ${money(balance)} acima das despesas no período.`
      : balance < 0
        ? `Suas despesas ficaram ${money(Math.abs(balance))} acima das receitas no período.`
        : 'Receitas e despesas ficaram equilibradas no período.';
    const budgetHTML = monthlyBudget > 0
      ? `<div class="budget-note ${remainingBudget < 0 ? 'danger' : ''}"><strong>Orçamento mensal</strong><span>${money(expense)} utilizados de ${money(monthlyBudget)} - ${remainingBudget >= 0 ? `${money(remainingBudget)} restantes` : `${money(Math.abs(remainingBudget))} acima do limite`}</span></div>`
      : `<div class="budget-note"><strong>Orçamento mensal</strong><span>Não foi definido um limite de orçamento para este período.</span></div>`;

    const reportWindow = window.open('', '_blank', 'width=1080,height=860');
    if (!reportWindow) {
      showToast('Não foi possível abrir o relatório. Verifique se o navegador bloqueou pop-ups.');
      return;
    }

    const reportTitle = `Relatório Financeiro - ${fullMonth(month)}`;
    reportWindow.document.open();
    reportWindow.document.write(`<!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHTML(reportTitle)}</title>
        <style>
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
        </style>
      </head>
      <body>
        <main class="page">
          <header class="header">
            <div>
              <div class="brand"><span class="mark">M</span><span>Meu Fluxo</span></div>
              <p class="eyebrow" style="margin-top:16px">Gestão financeira pessoal</p>
              <h1>Relatório financeiro mensal</h1>
            </div>
            <div class="header-side"><strong>${escapeHTML(fullMonth(month))}</strong>Gerado em ${escapeHTML(generatedAt)}</div>
          </header>

          <section class="summary">
            <div class="metric income"><small>Receitas</small><strong>${money(income)}</strong></div>
            <div class="metric expense"><small>Despesas</small><strong>${money(expense)}</strong></div>
            <div class="metric"><small>Saldo do mês</small><strong>${money(balance)}</strong></div>
          </section>

          <div class="health"><div><strong>${healthLabel}</strong><span>${healthText}</span></div><div><strong>${entries.length}</strong><span>lançamento${entries.length === 1 ? '' : 's'} registrado${entries.length === 1 ? '' : 's'}</span></div></div>
          ${budgetHTML}

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
            <div class="section-head"><h2>Todos os lançamentos</h2><span>${escapeHTML(fullMonth(month))}</span></div>
            <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th style="text-align:right">Valor</th></tr></thead><tbody>${reportEntriesRows(entries)}</tbody></table>
          </section>

          <footer class="footer"><span>Relatório gerado pelo Meu Fluxo.</span><span>Dados armazenados localmente neste navegador.</span></footer>
          <div class="print-note">Para gerar o arquivo, use a opção <strong>Salvar como PDF</strong> na janela de impressão do navegador.</div>
        </main>
        <script>window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 250); });<\/script>
      </body>
      </html>`);
    reportWindow.document.close();
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `meu-fluxo-backup-${isoToday()}.json`);
    showToast('Backup JSON exportado.');
  }

  function exportCSV() {
    const headers = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Parcela', 'Observação'];
    const rows = [...state.entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((entry) => [
        entry.date,
        entry.type === 'income' ? 'Receita' : 'Despesa',
        entry.description,
        entry.category,
        entry.amount.toFixed(2).replace('.', ','),
        entry.installment ? `${entry.installment.current}/${entry.installment.total}` : '',
        entry.notes
      ]);
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const blob = new Blob([[headers, ...rows].map((row) => row.map(escape).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `meu-fluxo-${isoToday()}.csv`);
    showToast('Planilha CSV exportada.');
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported.entries)) throw new Error('Arquivo inválido');
        if (!confirm('Restaurar este backup substituirá os dados atuais. Continuar?')) return;

        const defaults = defaultState();
        state = {
          ...defaults,
          ...imported,
          entries: cleanEntries(imported.entries),
          budgets: { ...defaults.budgets, ...(imported.budgets || {}) },
          selectedMonth: '',
          a11y: { ...defaults.a11y, ...(imported.a11y || {}) }
        };

        // Backups may contain entries only for the next months (e.g., bills due
        // on day 05). Select a month that has restored records before rendering
        // the dashboard and the entries list.
        const displayedMonth = applyDisplayedMonth(imported.selectedMonth, true);
        saveState();
        setTheme();
        applyAccessibility();
        renderAll();
        const total = state.entries.length;
        showToast(total
          ? `Backup restaurado: ${total} ${total === 1 ? 'lançamento' : 'lançamentos'}. Exibindo ${fullMonth(displayedMonth)}.`
          : 'Backup restaurado. Não há lançamentos neste arquivo.');
      } catch {
        showToast('Não foi possível ler esse arquivo de backup.');
      } finally {
        $('importFile').value = '';
      }
    };
    reader.readAsText(file);
  }

  function openClearDataDialog() {
    lastClearDataFocus = document.activeElement;
    $('clearDataConfirmation').checked = false;
    $('confirmClearDataBtn').disabled = true;
    $('clearDataDialog').showModal();
    window.setTimeout(() => $('clearDataConfirmation').focus(), 0);
  }

  function closeClearDataDialog() {
    $('clearDataDialog').close();
  }

  function clearAllFinancialData() {
    if (!$('clearDataConfirmation').checked) return;
    const preferences = { theme: state.theme, a11y: state.a11y };
    localStorage.removeItem(STORAGE_KEY);
    state = { ...defaultState(), ...preferences };
    state.selectedMonth = isoToday().slice(0, 7);
    $('monthFilter').value = state.selectedMonth;
    $('searchEntries').value = '';
    $('typeFilter').value = 'all';
    setTheme();
    applyAccessibility();
    saveState();
    closeClearDataDialog();
    switchView('dashboard');
    renderAll();
    showToast('Todos os dados financeiros foram apagados.');
  }

  function bindEvents() {
    qsa('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    qsa('[data-view-link]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.viewLink)));

    $('menuBtn').addEventListener('click', () => {
      const open = $('sidebar').classList.toggle('open');
      $('menuBtn').setAttribute('aria-expanded', String(open));
    });

    $('newEntryBtn').addEventListener('click', () => openDialog());
    $('closeDialogBtn').addEventListener('click', closeDialog);
    $('cancelDialogBtn').addEventListener('click', closeDialog);
    $('entryDialog').addEventListener('close', () => {
      if (lastDialogFocus && document.contains(lastDialogFocus)) lastDialogFocus.focus();
      lastDialogFocus = null;
    });

    $('entryForm').addEventListener('submit', submitEntry);
    qsa('.type-choice').forEach((button) => button.addEventListener('click', () => setEntryType(button.dataset.type)));
    qsa('#entryForm input, #entryForm select, #entryForm textarea').forEach((field) => field.addEventListener('input', () => {
      field.removeAttribute('aria-invalid');
      if (!$('entryFormError').classList.contains('hidden')) clearFormError();
    }));

    $('monthFilter').addEventListener('change', () => {
      state.selectedMonth = $('monthFilter').value || isoToday().slice(0, 7);
      saveState();
      renderAll();
    });
    $('searchEntries').addEventListener('input', renderEntries);
    $('typeFilter').addEventListener('change', renderEntries);

    $('entriesTable').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (button.dataset.action === 'edit') openDialog(entry);
      if (button.dataset.action === 'delete') deleteEntry(button.dataset.id);
    });

    $('monthlyBudgetForm').addEventListener('submit', (event) => {
      event.preventDefault();
      state.budgets.monthly = Number($('monthlyBudgetInput').value) || 0;
      saveState();
      renderAll();
      showToast('Orçamento mensal atualizado.');
    });

    $('categoryBudgetForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const category = $('budgetCategorySelect').value;
      const amount = Number($('budgetCategoryAmount').value);
      if (!amount) {
        $('budgetCategoryAmount').focus();
        showToast('Informe um limite maior que zero.');
        return;
      }
      state.budgets.categories[category] = amount;
      $('budgetCategoryAmount').value = '';
      saveState();
      renderAll();
      showToast(`Limite de ${category} salvo.`);
    });

    $('categoryBudgetList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-budget]');
      if (!button) return;
      delete state.budgets.categories[button.dataset.removeBudget];
      saveState();
      renderAll();
      showToast('Limite removido.');
    });

    $('backupBtn').addEventListener('click', exportJSON);
    $('pdfReportBtn').addEventListener('click', generatePDFReport);
    $('jsonExportBtn').addEventListener('click', exportJSON);
    $('csvExportBtn').addEventListener('click', exportCSV);
    $('importFile').addEventListener('change', (event) => importJSON(event.target.files[0]));
    $('clearDataBtn').addEventListener('click', openClearDataDialog);
    $('closeClearDataDialogBtn').addEventListener('click', closeClearDataDialog);
    $('cancelClearDataBtn').addEventListener('click', closeClearDataDialog);
    $('clearDataConfirmation').addEventListener('change', (event) => {
      $('confirmClearDataBtn').disabled = !event.target.checked;
    });
    $('confirmClearDataBtn').addEventListener('click', clearAllFinancialData);
    $('clearDataDialog').addEventListener('close', () => {
      if (lastClearDataFocus && document.contains(lastClearDataFocus)) lastClearDataFocus.focus();
      lastClearDataFocus = null;
    });
    $('themeBtn').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      setTheme();
      saveState();
      showToast(state.theme === 'dark' ? 'Tema escuro ativado.' : 'Tema claro ativado.');
    });

    $('accessibilityBtn').addEventListener('click', openAccessibilityDialog);
    $('closeAccessibilityDialogBtn').addEventListener('click', closeAccessibilityDialog);
    $('saveAccessibilityBtn').addEventListener('click', saveAccessibility);
    $('resetAccessibilityBtn').addEventListener('click', resetAccessibility);
    qsa('input[name="fontSize"], #highContrastInput, #reduceMotionInput').forEach((field) => field.addEventListener('change', previewAccessibility));
    $('accessibilityDialog').addEventListener('close', () => {
      if (lastAccessibilityFocus && document.contains(lastAccessibilityFocus)) lastAccessibilityFocus.focus();
      lastAccessibilityFocus = null;
    });
  }

  function init() {
    applyDisplayedMonth(state.selectedMonth);
    populateCategories('expense');
    initSelects();
    setTheme();
    applyAccessibility();
    saveState();
    bindEvents();
    renderAll();
  }

  init();
})();

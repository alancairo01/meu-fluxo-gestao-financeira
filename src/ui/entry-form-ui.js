import { DEFAULT_CATEGORIES, INCOME_CATEGORIES } from '../config/constants.js';
import { byId, query, queryAll } from '../core/dom.js';
import { getDefaultDueDate } from '../utils/date.js';

export function initializeEntryForm() {
  byId('installmentTotal').innerHTML = Array.from(
    { length: 11 },
    (_, index) => `<option value="${index + 2}">${index + 2}x</option>`
  ).join('');
  updateCurrentInstallmentOptions();
  populateEntryCategories('expense');
  updateEntryTypeUI('expense');
  updateExpenseMode();
}

export function populateEntryCategories(type, selected = '') {
  const categories = type === 'income' ? INCOME_CATEGORIES : DEFAULT_CATEGORIES;
  byId('entryCategory').innerHTML = categories
    .map(([name, icon]) => `<option value="${name}" ${name === selected ? 'selected' : ''}>${icon} ${name}</option>`)
    .join('');
  byId('budgetCategorySelect').innerHTML = DEFAULT_CATEGORIES
    .map(([name, icon]) => `<option value="${name}">${icon} ${name}</option>`)
    .join('');
}

export function updateCurrentInstallmentOptions(current = 1) {
  const total = Number(byId('installmentTotal').value || 2);
  byId('installmentCurrent').innerHTML = Array.from(
    { length: total },
    (_, index) => `<option value="${index + 1}" ${index + 1 === Number(current) ? 'selected' : ''}>${index + 1} de ${total}</option>`
  ).join('');
}

export function updateExpenseMode() {
  const mode = query('input[name="expenseMode"]:checked')?.value || 'oneoff';
  byId('installmentFields').classList.toggle('hidden', mode !== 'installment');
  byId('recurringFields').classList.toggle('hidden', mode !== 'recurring');
}

export function updateEntryTypeUI(type) {
  const isExpense = type === 'expense';
  queryAll('.type-choice').forEach((button) => {
    const isActive = button.dataset.type === type;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  byId('installmentBox').classList.toggle('hidden', !isExpense);
  byId('dateLabel').innerHTML = `${isExpense ? 'Vencimento' : 'Recebimento'} <b aria-hidden="true">*</b>`;
}

export function setEntryType(type) {
  byId('entryType').value = type;
  populateEntryCategories(type);
  updateEntryTypeUI(type);
}

export function clearEntryFormError() {
  byId('entryFormError').classList.add('hidden');
  byId('entryFormError').textContent = '';
  queryAll('#entryForm [aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
}

export function showEntryFormError(message, field) {
  byId('entryFormError').textContent = message;
  byId('entryFormError').classList.remove('hidden');
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }
}

export function validateEntryForm() {
  clearEntryFormError();
  const requiredFields = [
    ['entryDescription', 'Informe uma descrição para o lançamento.'],
    ['entryAmount', 'Informe um valor maior que zero.'],
    ['entryDate', 'Informe a data de vencimento ou recebimento.'],
    ['entryCategory', 'Selecione uma categoria.']
  ];

  for (const [id, message] of requiredFields) {
    const field = byId(id);
    if (!field.checkValidity() || !String(field.value).trim()) {
      showEntryFormError(message, field);
      return false;
    }
  }
  return true;
}

export function resetEntryForm() {
  byId('entryForm').reset();
  byId('entryId').value = '';
  byId('entryType').value = 'expense';
  byId('entryDate').value = getDefaultDueDate();
  byId('installmentTotal').value = '12';
  byId('generateRemaining').checked = true;
  byId('generateRecurring').checked = true;
  query('input[name="expenseMode"][value="oneoff"]').checked = true;
  populateEntryCategories('expense');
  updateCurrentInstallmentOptions(1);
  updateEntryTypeUI('expense');
  updateExpenseMode();
  clearEntryFormError();
}

export function fillEntryForm(entry) {
  byId('entryId').value = entry.id;
  byId('entryType').value = entry.type;
  byId('entryDescription').value = entry.description;
  byId('entryAmount').value = entry.amount;
  byId('entryDate').value = entry.date;
  byId('entryNotes').value = entry.notes || '';
  populateEntryCategories(entry.type, entry.category);
  updateEntryTypeUI(entry.type);

  if (entry.type === 'expense' && entry.installment) {
    query('input[name="expenseMode"][value="installment"]').checked = true;
    byId('installmentTotal').value = entry.installment.total;
    updateCurrentInstallmentOptions(entry.installment.current);
    byId('generateRemaining').checked = false;
  } else if (entry.type === 'expense' && entry.recurring) {
    query('input[name="expenseMode"][value="recurring"]').checked = true;
    byId('recurringMonths').value = entry.recurring.total || 12;
    byId('generateRecurring').checked = false;
  }
  updateExpenseMode();
}

export function readEntryForm() {
  const type = byId('entryType').value;
  return {
    id: byId('entryId').value,
    type,
    description: byId('entryDescription').value,
    amount: byId('entryAmount').value,
    date: byId('entryDate').value,
    category: byId('entryCategory').value,
    notes: byId('entryNotes').value,
    mode: type === 'expense' ? query('input[name="expenseMode"]:checked')?.value || 'oneoff' : 'oneoff',
    installmentTotal: byId('installmentTotal').value,
    currentInstallment: byId('installmentCurrent').value,
    recurringMonths: byId('recurringMonths').value,
    generateRemaining: byId('generateRemaining').checked,
    generateRecurring: byId('generateRecurring').checked
  };
}

import { createId } from '../utils/id.js';
import { addMonths, getMonthFromDate, getTodayISO, isValidMonth } from '../utils/date.js';
import { normalizeText } from '../utils/format.js';

export function getEntriesMonths(entries) {
  return [...new Set(entries.map((entry) => getMonthFromDate(entry.date)).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second));
}

export function findDisplayMonth(entries, preferredMonth = '', currentMonth = getTodayISO().slice(0, 7)) {
  const months = getEntriesMonths(entries);
  const preferred = isValidMonth(preferredMonth) ? preferredMonth : '';

  if (preferred && months.includes(preferred)) return preferred;
  if (months.includes(currentMonth)) return currentMonth;
  return months.find((month) => month >= currentMonth) || months.at(-1) || currentMonth;
}

export function isEntryInMonth(entry, month) {
  return getMonthFromDate(entry.date) === month;
}

export function getEntriesForMonth(entries, month) {
  return entries.filter((entry) => isEntryInMonth(entry, month));
}

export function getIncomes(entries) {
  return entries.filter((entry) => entry.type === 'income');
}

export function getExpenses(entries) {
  return entries.filter((entry) => entry.type === 'expense');
}

export function sumEntries(entries) {
  return entries.reduce((total, entry) => total + Number(entry.amount || 0), 0);
}

export function getFinancialSummary(entries) {
  const incomes = getIncomes(entries);
  const expenses = getExpenses(entries);
  const income = sumEntries(incomes);
  const expense = sumEntries(expenses);
  return { incomes, expenses, income, expense, balance: income - expense };
}

export function getFutureExpenses(entries, month) {
  return entries
    .filter((entry) => entry.type === 'expense' && getMonthFromDate(entry.date) > month)
    .sort((first, second) => first.date.localeCompare(second.date));
}

export function getFutureInstallments(entries, month, limit = 8) {
  return entries
    .filter((entry) => entry.installment && getMonthFromDate(entry.date) > month)
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(0, limit);
}

export function groupExpensesByCategory(entries) {
  return Object.entries(getExpenses(entries).reduce((groups, entry) => {
    groups[entry.category] = (groups[entry.category] || 0) + Number(entry.amount || 0);
    return groups;
  }, {})).sort((first, second) => second[1] - first[1]);
}

export function filterEntries(entries, month, query, type) {
  const normalizedQuery = normalizeText(query);
  return entries
    .filter((entry) => {
      const matchesMonth = isEntryInMonth(entry, month);
      const matchesQuery = !normalizedQuery || normalizeText(`${entry.description} ${entry.category}`).includes(normalizedQuery);
      const matchesType = type === 'all' || entry.type === type;
      return matchesMonth && matchesQuery && matchesType;
    })
    .sort((first, second) => second.date.localeCompare(first.date) || second.createdAt - first.createdAt);
}

export function createBaseEntry(values, previousEntry = null) {
  return {
    id: values.id || createId(),
    type: values.type,
    description: String(values.description || '').trim(),
    amount: Number(values.amount),
    date: values.date,
    category: values.category,
    notes: String(values.notes || '').trim(),
    createdAt: previousEntry?.createdAt || Date.now(),
    installment: null,
    recurring: null
  };
}

export function applyExpenseMode(entry, options, previousEntry = null) {
  if (entry.type !== 'expense') return entry;

  if (options.mode === 'installment') {
    return {
      ...entry,
      installment: {
        current: Number(options.currentInstallment),
        total: Number(options.installmentTotal),
        seriesId: previousEntry?.installment?.seriesId || createId()
      }
    };
  }

  if (options.mode === 'recurring') {
    return {
      ...entry,
      recurring: {
        total: Number(options.recurringMonths),
        seriesId: previousEntry?.recurring?.seriesId || createId()
      }
    };
  }

  return entry;
}

export function createEntrySeries(baseEntry, options) {
  const initialEntry = applyExpenseMode(baseEntry, options);
  const entries = [initialEntry];

  if (options.mode === 'installment' && options.generateRemaining) {
    const { current, total, seriesId } = initialEntry.installment;
    for (let installment = current + 1; installment <= total; installment += 1) {
      entries.push({
        ...initialEntry,
        id: createId(),
        date: addMonths(initialEntry.date, installment - current),
        createdAt: Date.now() + installment,
        installment: { current: installment, total, seriesId }
      });
    }
  }

  if (options.mode === 'recurring' && options.generateRecurring) {
    const { total, seriesId } = initialEntry.recurring;
    for (let index = 1; index < total; index += 1) {
      entries.push({
        ...initialEntry,
        id: createId(),
        date: addMonths(initialEntry.date, index),
        createdAt: Date.now() + index,
        recurring: { total, seriesId }
      });
    }
  }

  return entries;
}

export function getEntryDetails(entry) {
  const details = [];
  if (entry.installment) details.push(`Parcela ${entry.installment.current} de ${entry.installment.total}`);
  else if (entry.recurring) details.push('Lançamento recorrente');
  if (entry.notes) details.push(entry.notes);
  return details;
}

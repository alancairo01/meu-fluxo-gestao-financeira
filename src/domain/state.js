import { PROFILE_ACCENTS } from '../config/constants.js';
import { isValidMonth } from '../utils/date.js';

export function createDefaultState() {
  return {
    entries: [],
    budgets: { monthly: 0, categories: {} },
    selectedMonth: '',
    theme: 'light',
    a11y: { fontSize: 'default', highContrast: false, reduceMotion: false },
    profile: { name: '', greeting: '', photo: '', accent: 'violet' }
  };
}

export function cleanProfile(profile) {
  const defaults = createDefaultState().profile;
  const source = profile && typeof profile === 'object' ? profile : {};
  const isValidPhoto = typeof source.photo === 'string'
    && /^data:image\/(jpeg|png|webp);base64,/i.test(source.photo)
    && source.photo.length <= 1500000;

  return {
    ...defaults,
    name: String(source.name || '').trim().slice(0, 40),
    greeting: String(source.greeting || '').trim().slice(0, 120),
    photo: isValidPhoto ? source.photo : '',
    accent: PROFILE_ACCENTS.includes(source.accent) ? source.accent : defaults.accent
  };
}

function cleanInstallment(installment) {
  if (!installment || typeof installment !== 'object') return null;
  const current = Number(installment.current);
  const total = Number(installment.total);
  if (!Number.isInteger(current) || !Number.isInteger(total) || current < 1 || total < current) return null;
  return { current, total, seriesId: String(installment.seriesId || '') };
}

function cleanRecurring(recurring) {
  if (!recurring || typeof recurring !== 'object') return null;
  const total = Number(recurring.total);
  if (!Number.isInteger(total) || total < 1) return null;
  return { total, seriesId: String(recurring.seriesId || '') };
}

export function cleanEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries.reduce((cleaned, source) => {
    if (!source || typeof source !== 'object') return cleaned;
    const amount = Number(source.amount);
    const date = String(source.date || '');
    const type = source.type === 'income' ? 'income' : source.type === 'expense' ? 'expense' : '';
    if (!type || !Number.isFinite(amount) || amount <= 0 || !date) return cleaned;

    cleaned.push({
      id: String(source.id || `${Date.now()}-${cleaned.length}`),
      type,
      description: String(source.description || '').trim().slice(0, 80),
      amount,
      date,
      category: String(source.category || 'Outros').trim().slice(0, 40),
      notes: String(source.notes || '').trim().slice(0, 160),
      createdAt: Number(source.createdAt) || Date.now(),
      installment: cleanInstallment(source.installment),
      recurring: cleanRecurring(source.recurring)
    });
    return cleaned;
  }, []);
}

function cleanBudgets(budgets) {
  const source = budgets && typeof budgets === 'object' ? budgets : {};
  const categories = Object.entries(source.categories || {}).reduce((result, [category, amount]) => {
    const numericAmount = Number(amount);
    if (category && Number.isFinite(numericAmount) && numericAmount > 0) result[String(category)] = numericAmount;
    return result;
  }, {});

  return {
    monthly: Math.max(0, Number(source.monthly) || 0),
    categories
  };
}

function cleanAccessibility(a11y) {
  const source = a11y && typeof a11y === 'object' ? a11y : {};
  const fontSize = ['default', 'large', 'extra'].includes(source.fontSize) ? source.fontSize : 'default';
  return {
    fontSize,
    highContrast: Boolean(source.highContrast),
    reduceMotion: Boolean(source.reduceMotion)
  };
}

export function normalizeState(source) {
  const defaults = createDefaultState();
  const safeSource = source && typeof source === 'object' ? source : {};
  return {
    ...defaults,
    entries: cleanEntries(safeSource.entries),
    budgets: cleanBudgets(safeSource.budgets),
    selectedMonth: isValidMonth(safeSource.selectedMonth) ? safeSource.selectedMonth : '',
    theme: safeSource.theme === 'dark' ? 'dark' : 'light',
    a11y: cleanAccessibility(safeSource.a11y),
    profile: cleanProfile(safeSource.profile)
  };
}

export class StateStore {
  constructor(storage, key) {
    this.storage = storage;
    this.key = key;
    this.state = createDefaultState();
  }

  load() {
    try {
      this.state = normalizeState(JSON.parse(this.storage.getItem(this.key)));
    } catch {
      this.state = createDefaultState();
    }
    return this.state;
  }

  get() {
    return this.state;
  }

  replace(nextState, persist = false) {
    this.state = normalizeState(nextState);
    if (persist) this.persist();
    return this.state;
  }

  patch(partialState, persist = false) {
    return this.replace({ ...this.state, ...partialState }, persist);
  }

  persist() {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.state));
      return true;
    } catch {
      return false;
    }
  }

  resetFinancialData() {
    const { theme, a11y, profile } = this.state;
    this.state = { ...createDefaultState(), theme, a11y, profile };
    return this.state;
  }
}

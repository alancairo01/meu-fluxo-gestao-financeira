export function toISODateLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayISO() {
  return toISODateLocal(new Date());
}

export function getDefaultDueDate() {
  const nextMonth = new Date();
  nextMonth.setHours(12, 0, 0, 0);
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(5);
  return toISODateLocal(nextMonth);
}

export function isValidMonth(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''));
}

export function getMonthFromDate(date) {
  const month = String(date || '').slice(0, 7);
  return isValidMonth(month) ? month : '';
}

export function addMonths(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + amount);
  if (date.getDate() < originalDay) date.setDate(0);
  return toISODateLocal(date);
}

export function formatShortDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(`${date}T12:00:00`))
    .replace('.', '');
}

export function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${date}T12:00:00`));
}

export function formatFullMonth(month) {
  const [year, numberMonth] = String(month).split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, numberMonth - 1, 1));
}

export function formatGeneratedAt() {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
}

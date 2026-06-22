import { byId, query } from '../core/dom.js';

export function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  byId('themeBtn').setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
}

export function applyAccessibility(a11y) {
  document.body.classList.remove('font-large', 'font-extra');
  if (a11y.fontSize === 'large') document.body.classList.add('font-large');
  if (a11y.fontSize === 'extra') document.body.classList.add('font-extra');
  document.body.classList.toggle('high-contrast', Boolean(a11y.highContrast));
  document.body.classList.toggle('reduce-motion', Boolean(a11y.reduceMotion));
  syncAccessibilityControls(a11y);
}

export function syncAccessibilityControls(a11y) {
  const selected = query(`input[name="fontSize"][value="${a11y.fontSize}"]`);
  if (selected) selected.checked = true;
  byId('highContrastInput').checked = Boolean(a11y.highContrast);
  byId('reduceMotionInput').checked = Boolean(a11y.reduceMotion);
}

export function readAccessibilityControls() {
  return {
    fontSize: query('input[name="fontSize"]:checked')?.value || 'default',
    highContrast: byId('highContrastInput').checked,
    reduceMotion: byId('reduceMotionInput').checked
  };
}

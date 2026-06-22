export function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento não encontrado: #${id}`);
  return element;
}

export function query(selector, parent = document) {
  return parent.querySelector(selector);
}

export function queryAll(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

export function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

export function setText(id, value) {
  byId(id).textContent = String(value ?? '');
}

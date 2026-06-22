import { byId, escapeHtml } from '../../core/dom.js';
import { filterEntries, getEntryDetails } from '../../domain/entries.js';
import { formatCurrency } from '../../utils/format.js';
import { formatShortDate } from '../../utils/date.js';
import { getCategoryIcon } from '../../utils/category.js';

export function renderEntries(state, month) {
  const entries = filterEntries(
    state.entries,
    month,
    byId('searchEntries').value,
    byId('typeFilter').value
  );

  byId('entriesCount').textContent = `${entries.length} ${entries.length === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'} no mês selecionado.`;
  byId('entriesTable').innerHTML = entries.map((entry) => {
    const details = getEntryDetails(entry).map(escapeHtml).join(' · ');
    return `<tr>
      <td>${formatShortDate(entry.date)}</td>
      <td><div class="table-desc"><div class="category-icon" aria-hidden="true">${getCategoryIcon(entry.category)}</div><div><strong>${escapeHtml(entry.description)}</strong><small>${details}</small></div></div></td>
      <td><span class="category-chip"><span aria-hidden="true">${getCategoryIcon(entry.category)}</span> ${escapeHtml(entry.category)}</span></td>
      <td><span class="amount ${entry.type}">${entry.type === 'income' ? '+' : '−'} ${formatCurrency(entry.amount)}</span></td>
      <td><div class="row-actions"><button class="row-button" type="button" aria-label="Editar lançamento ${escapeHtml(entry.description)}" title="Editar" data-action="edit" data-id="${escapeHtml(entry.id)}">✎</button><button class="row-button delete" type="button" aria-label="Excluir lançamento ${escapeHtml(entry.description)}" title="Excluir" data-action="delete" data-id="${escapeHtml(entry.id)}">⌫</button></div></td>
    </tr>`;
  }).join('');
  byId('entriesEmpty').classList.toggle('hidden', entries.length > 0);
}

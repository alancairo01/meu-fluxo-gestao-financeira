import { STORAGE_KEY, VIEW_METADATA } from './config/constants.js';
import { byId, query, queryAll } from './core/dom.js';
import { cleanProfile, createDefaultState, StateStore } from './domain/state.js';
import { applyExpenseMode, createBaseEntry, createEntrySeries, findDisplayMonth } from './domain/entries.js';
import { createCsvBlob, downloadBlob, readJsonFile } from './services/file-service.js';
import { compressProfilePhoto } from './services/photo-service.js';
import { openMonthlyReport } from './services/report-service.js';
import { getMonthFromDate, getTodayISO, isValidMonth, formatFullMonth } from './utils/date.js';
import { applyAccessibility, applyTheme, readAccessibilityControls, syncAccessibilityControls } from './ui/preferences-ui.js';
import { getProfileName, renderProfile } from './ui/profile-ui.js';
import {
  clearEntryFormError,
  fillEntryForm,
  initializeEntryForm,
  readEntryForm,
  resetEntryForm,
  setEntryType,
  updateCurrentInstallmentOptions,
  updateExpenseMode,
  validateEntryForm
} from './ui/entry-form-ui.js';
import { renderDashboard } from './ui/renderers/dashboard-renderer.js';
import { renderEntries } from './ui/renderers/entries-renderer.js';
import { renderBudgets } from './ui/renderers/budgets-renderer.js';
import { renderReports } from './ui/renderers/reports-renderer.js';
import { ToastUI } from './ui/toast-ui.js';

export class FinanceApp {
  constructor() {
    this.store = new StateStore(window.localStorage, STORAGE_KEY);
    this.activeView = 'dashboard';
    this.toast = new ToastUI();
    this.lastFocusedElement = {
      entryDialog: null,
      accessibilityDialog: null,
      clearDataDialog: null
    };
  }

  init() {
    this.store.load();
    this.syncDisplayedMonth(this.state.selectedMonth);
    initializeEntryForm();
    this.applyPreferences();
    this.bindEvents();
    this.store.persist();
    this.render();
  }

  get state() {
    return this.store.get();
  }

  getCurrentMonth() {
    return byId('monthFilter').value || this.state.selectedMonth || getTodayISO().slice(0, 7);
  }

  syncDisplayedMonth(preferredMonth = this.state.selectedMonth, ensureDataMonth = false) {
    const preferred = isValidMonth(preferredMonth) ? preferredMonth : '';
    const month = !ensureDataMonth && preferred
      ? preferred
      : findDisplayMonth(this.state.entries, preferred, getTodayISO().slice(0, 7));
    this.store.patch({ selectedMonth: month });
    byId('monthFilter').value = month;
    return month;
  }

  applyPreferences() {
    applyTheme(this.state.theme);
    applyAccessibility(this.state.a11y);
  }

  render() {
    const month = this.getCurrentMonth();
    renderProfile(this.state);
    byId('monthLabel').textContent = this.state.profile.greeting || `Resumo de ${formatFullMonth(month)}. Acompanhe o que entra, sai e o que já está comprometido.`;
    renderDashboard(this.state, month);
    renderEntries(this.state, month);
    renderBudgets(this.state, month);
    renderReports(this.state, month);
  }

  switchView(view) {
    if (!VIEW_METADATA[view]) return;
    this.activeView = view;
    queryAll('.view').forEach((section) => section.classList.remove('active'));
    byId(`${view}View`).classList.add('active');
    queryAll('.nav-item[data-view]').forEach((button) => {
      const isActive = button.dataset.view === view;
      button.classList.toggle('active', isActive);
      if (isActive) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    byId('viewEyebrow').textContent = VIEW_METADATA[view][0];
    byId('viewTitle').textContent = VIEW_METADATA[view][1];
    byId('sidebar').classList.remove('open');
    byId('menuBtn').setAttribute('aria-expanded', 'false');
    this.render();
  }

  openEntryDialog(entry = null) {
    this.lastFocusedElement.entryDialog = document.activeElement;
    resetEntryForm();
    byId('dialogTitle').textContent = entry ? 'Editar lançamento' : 'Novo lançamento';
    if (entry) fillEntryForm(entry);
    byId('entryDialog').showModal();
    window.setTimeout(() => byId('entryDescription').focus(), 0);
  }

  closeEntryDialog() {
    byId('entryDialog').close();
  }

  submitEntry(event) {
    event.preventDefault();
    if (!validateEntryForm()) return;

    const form = readEntryForm();
    const previousEntry = this.state.entries.find((entry) => entry.id === form.id);
    const baseEntry = createBaseEntry(form, previousEntry);
    const options = {
      mode: form.mode,
      installmentTotal: form.installmentTotal,
      currentInstallment: form.currentInstallment,
      recurringMonths: form.recurringMonths,
      generateRemaining: form.generateRemaining,
      generateRecurring: form.generateRecurring
    };

    if (form.id) {
      const updatedEntry = applyExpenseMode(baseEntry, options, previousEntry);
      const entries = this.state.entries.map((entry) => entry.id === form.id ? updatedEntry : entry);
      this.saveEntries(entries, updatedEntry.date);
      this.closeEntryDialog();
      this.render();
      this.toast.show(`Lançamento atualizado e exibido em ${formatFullMonth(getMonthFromDate(updatedEntry.date))}.`);
      return;
    }

    const entriesToCreate = createEntrySeries(baseEntry, options);
    this.saveEntries([...this.state.entries, ...entriesToCreate], baseEntry.date);
    this.closeEntryDialog();
    this.render();
    const monthName = formatFullMonth(getMonthFromDate(baseEntry.date));
    this.toast.show(entriesToCreate.length > 1
      ? `${entriesToCreate.length} lançamentos foram criados. Exibindo ${monthName}.`
      : `Lançamento salvo e exibido em ${monthName}.`);
  }

  saveEntries(entries, selectedDate) {
    const selectedMonth = getMonthFromDate(selectedDate) || this.getCurrentMonth();
    this.store.replace({ ...this.state, entries, selectedMonth }, true);
    byId('monthFilter').value = selectedMonth;
  }

  deleteEntry(id) {
    const entry = this.state.entries.find((item) => item.id === id);
    if (!entry || !window.confirm(`Excluir “${entry.description}”?`)) return;
    this.store.replace({ ...this.state, entries: this.state.entries.filter((item) => item.id !== id) }, true);
    this.render();
    this.toast.show('Lançamento excluído.');
  }

  saveMonthlyBudget(event) {
    event.preventDefault();
    const monthly = Number(byId('monthlyBudgetInput').value) || 0;
    this.store.replace({
      ...this.state,
      budgets: { ...this.state.budgets, monthly }
    }, true);
    this.render();
    this.toast.show('Orçamento mensal atualizado.');
  }

  saveCategoryBudget(event) {
    event.preventDefault();
    const category = byId('budgetCategorySelect').value;
    const amount = Number(byId('budgetCategoryAmount').value);
    if (!amount) {
      byId('budgetCategoryAmount').focus();
      this.toast.show('Informe um limite maior que zero.');
      return;
    }

    this.store.replace({
      ...this.state,
      budgets: {
        ...this.state.budgets,
        categories: { ...this.state.budgets.categories, [category]: amount }
      }
    }, true);
    byId('budgetCategoryAmount').value = '';
    this.render();
    this.toast.show(`Limite de ${category} salvo.`);
  }

  removeCategoryBudget(category) {
    const categories = { ...this.state.budgets.categories };
    delete categories[category];
    this.store.replace({
      ...this.state,
      budgets: { ...this.state.budgets, categories }
    }, true);
    this.render();
    this.toast.show('Limite removido.');
  }

  generatePdfReport() {
    const wasOpened = openMonthlyReport(this.state, this.getCurrentMonth(), getProfileName(this.state.profile));
    if (!wasOpened) this.toast.show('Não foi possível abrir o relatório. Verifique se o navegador bloqueou pop-ups.');
  }

  exportBackup() {
    const file = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
    downloadBlob(file, `meu-fluxo-backup-${getTodayISO()}.json`);
    this.toast.show('Backup JSON exportado.');
  }

  exportCsv() {
    const headers = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Parcela', 'Observação'];
    const rows = [...this.state.entries]
      .sort((first, second) => second.date.localeCompare(first.date))
      .map((entry) => [
        entry.date,
        entry.type === 'income' ? 'Receita' : 'Despesa',
        entry.description,
        entry.category,
        entry.amount.toFixed(2).replace('.', ','),
        entry.installment ? `${entry.installment.current}/${entry.installment.total}` : '',
        entry.notes
      ]);
    downloadBlob(createCsvBlob([headers, ...rows]), `meu-fluxo-${getTodayISO()}.csv`);
    this.toast.show('Planilha CSV exportada.');
  }

  async importBackup(file) {
    if (!file) return;
    try {
      const imported = await readJsonFile(file);
      if (!Array.isArray(imported.entries)) throw new Error('O backup não possui lançamentos válidos.');
      if (!window.confirm('Restaurar este backup substituirá os dados atuais. Continuar?')) return;

      this.store.replace(imported);
      const displayedMonth = this.syncDisplayedMonth(imported.selectedMonth, true);
      this.store.persist();
      this.applyPreferences();
      this.render();
      const total = this.state.entries.length;
      this.toast.show(total
        ? `Backup restaurado: ${total} ${total === 1 ? 'lançamento' : 'lançamentos'}. Exibindo ${formatFullMonth(displayedMonth)}.`
        : 'Backup restaurado. Não há lançamentos neste arquivo.');
    } catch (error) {
      this.toast.show(error.message || 'Não foi possível ler esse arquivo de backup.');
    } finally {
      byId('importFile').value = '';
    }
  }

  openClearDataDialog() {
    this.lastFocusedElement.clearDataDialog = document.activeElement;
    byId('clearDataConfirmation').checked = false;
    byId('confirmClearDataBtn').disabled = true;
    byId('clearDataDialog').showModal();
    window.setTimeout(() => byId('clearDataConfirmation').focus(), 0);
  }

  closeClearDataDialog() {
    byId('clearDataDialog').close();
  }

  clearFinancialData() {
    if (!byId('clearDataConfirmation').checked) return;
    this.store.resetFinancialData();
    this.store.patch({ selectedMonth: getTodayISO().slice(0, 7) }, true);
    byId('monthFilter').value = this.state.selectedMonth;
    byId('searchEntries').value = '';
    byId('typeFilter').value = 'all';
    this.applyPreferences();
    this.closeClearDataDialog();
    this.switchView('dashboard');
    this.toast.show('Todos os dados financeiros foram apagados.');
  }

  saveProfile(event) {
    event.preventDefault();
    const accent = query('input[name="accentColor"]:checked')?.value || 'violet';
    const profile = cleanProfile({
      ...this.state.profile,
      name: byId('profileNameInput').value,
      greeting: byId('profileGreetingInput').value,
      accent
    });
    this.store.patch({ profile }, true);
    this.render();
    this.toast.show('Perfil e personalização salvos.');
  }

  resetProfileStyle() {
    const profile = cleanProfile({ ...this.state.profile, greeting: '', accent: 'violet' });
    this.store.patch({ profile }, true);
    this.render();
    this.toast.show('Estilo do perfil restaurado.');
  }

  removeProfilePhoto() {
    if (!this.state.profile.photo) {
      this.toast.show('Nenhuma foto de perfil foi adicionada.');
      return;
    }
    this.store.patch({ profile: cleanProfile({ ...this.state.profile, photo: '' }) }, true);
    byId('profilePhotoStatus').textContent = 'Foto de perfil removida.';
    this.render();
    this.toast.show('Foto de perfil removida.');
  }

  async updateProfilePhoto(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      byId('profilePhotoStatus').textContent = 'Escolha uma imagem JPG, PNG ou WebP.';
      this.toast.show('Escolha uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      byId('profilePhotoStatus').textContent = 'A imagem precisa ter no máximo 8 MB.';
      this.toast.show('A imagem precisa ter no máximo 8 MB.');
      return;
    }

    try {
      byId('profilePhotoStatus').textContent = 'Preparando foto de perfil…';
      const photo = await compressProfilePhoto(file);
      this.store.patch({ profile: cleanProfile({ ...this.state.profile, photo }) }, true);
      this.render();
      byId('profilePhotoStatus').textContent = 'Foto de perfil atualizada e salva.';
      this.toast.show('Foto de perfil atualizada.');
    } catch (error) {
      const message = error.message || 'Não foi possível atualizar a foto.';
      byId('profilePhotoStatus').textContent = message;
      this.toast.show(message);
    } finally {
      byId('profilePhotoInput').value = '';
    }
  }

  openAccessibilityDialog() {
    this.lastFocusedElement.accessibilityDialog = document.activeElement;
    syncAccessibilityControls(this.state.a11y);
    byId('accessibilityDialog').showModal();
    window.setTimeout(() => query('input[name="fontSize"]:checked')?.focus(), 0);
  }

  closeAccessibilityDialog() {
    byId('accessibilityDialog').close();
  }

  previewAccessibility() {
    this.store.patch({ a11y: readAccessibilityControls() });
    applyAccessibility(this.state.a11y);
  }

  saveAccessibility() {
    this.store.patch({ a11y: readAccessibilityControls() }, true);
    applyAccessibility(this.state.a11y);
    this.closeAccessibilityDialog();
    this.toast.show('Preferências de acessibilidade salvas.');
  }

  resetAccessibility() {
    this.store.patch({ a11y: createDefaultState().a11y }, true);
    applyAccessibility(this.state.a11y);
    this.toast.show('Preferências de acessibilidade restauradas.');
  }

  toggleTheme() {
    const theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.store.patch({ theme }, true);
    applyTheme(theme);
    this.toast.show(theme === 'dark' ? 'Tema escuro ativado.' : 'Tema claro ativado.');
  }

  restoreFocus(dialogName) {
    const element = this.lastFocusedElement[dialogName];
    if (element && document.contains(element)) element.focus();
    this.lastFocusedElement[dialogName] = null;
  }

  bindEvents() {
    queryAll('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => this.switchView(button.dataset.view)));
    queryAll('[data-view-link]').forEach((button) => button.addEventListener('click', () => this.switchView(button.dataset.viewLink)));

    byId('menuBtn').addEventListener('click', () => {
      const isOpen = byId('sidebar').classList.toggle('open');
      byId('menuBtn').setAttribute('aria-expanded', String(isOpen));
    });

    byId('newEntryBtn').addEventListener('click', () => this.openEntryDialog());
    byId('closeDialogBtn').addEventListener('click', () => this.closeEntryDialog());
    byId('cancelDialogBtn').addEventListener('click', () => this.closeEntryDialog());
    byId('entryDialog').addEventListener('close', () => this.restoreFocus('entryDialog'));
    byId('entryForm').addEventListener('submit', (event) => this.submitEntry(event));
    queryAll('.type-choice').forEach((button) => button.addEventListener('click', () => setEntryType(button.dataset.type)));
    queryAll('input[name="expenseMode"]').forEach((input) => input.addEventListener('change', updateExpenseMode));
    byId('installmentTotal').addEventListener('change', () => updateCurrentInstallmentOptions());
    queryAll('#entryForm input, #entryForm select, #entryForm textarea').forEach((field) => field.addEventListener('input', clearEntryFormError));

    byId('monthFilter').addEventListener('change', () => {
      const selectedMonth = byId('monthFilter').value || getTodayISO().slice(0, 7);
      this.store.patch({ selectedMonth }, true);
      this.render();
    });
    byId('searchEntries').addEventListener('input', () => renderEntries(this.state, this.getCurrentMonth()));
    byId('typeFilter').addEventListener('change', () => renderEntries(this.state, this.getCurrentMonth()));
    byId('entriesTable').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'edit') this.openEntryDialog(this.state.entries.find((entry) => entry.id === button.dataset.id));
      if (button.dataset.action === 'delete') this.deleteEntry(button.dataset.id);
    });

    byId('monthlyBudgetForm').addEventListener('submit', (event) => this.saveMonthlyBudget(event));
    byId('categoryBudgetForm').addEventListener('submit', (event) => this.saveCategoryBudget(event));
    byId('categoryBudgetList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-budget]');
      if (button) this.removeCategoryBudget(button.dataset.removeBudget);
    });

    byId('pdfReportBtn').addEventListener('click', () => this.generatePdfReport());
    byId('backupBtn').addEventListener('click', () => this.exportBackup());
    byId('jsonExportBtn').addEventListener('click', () => this.exportBackup());
    byId('csvExportBtn').addEventListener('click', () => this.exportCsv());
    byId('importFile').addEventListener('change', (event) => this.importBackup(event.target.files?.[0]));
    byId('clearDataBtn').addEventListener('click', () => this.openClearDataDialog());
    byId('closeClearDataDialogBtn').addEventListener('click', () => this.closeClearDataDialog());
    byId('cancelClearDataBtn').addEventListener('click', () => this.closeClearDataDialog());
    byId('clearDataConfirmation').addEventListener('change', (event) => {
      byId('confirmClearDataBtn').disabled = !event.target.checked;
    });
    byId('confirmClearDataBtn').addEventListener('click', () => this.clearFinancialData());
    byId('clearDataDialog').addEventListener('close', () => this.restoreFocus('clearDataDialog'));

    byId('profileForm').addEventListener('submit', (event) => this.saveProfile(event));
    byId('profilePhotoInput').addEventListener('change', (event) => this.updateProfilePhoto(event.target.files?.[0]));
    byId('removeProfilePhotoBtn').addEventListener('click', () => this.removeProfilePhoto());
    byId('resetProfileStyleBtn').addEventListener('click', () => this.resetProfileStyle());

    byId('themeBtn').addEventListener('click', () => this.toggleTheme());
    byId('accessibilityBtn').addEventListener('click', () => this.openAccessibilityDialog());
    byId('closeAccessibilityDialogBtn').addEventListener('click', () => this.closeAccessibilityDialog());
    byId('saveAccessibilityBtn').addEventListener('click', () => this.saveAccessibility());
    byId('resetAccessibilityBtn').addEventListener('click', () => this.resetAccessibility());
    queryAll('input[name="fontSize"], #highContrastInput, #reduceMotionInput').forEach((field) => field.addEventListener('change', () => this.previewAccessibility()));
    byId('accessibilityDialog').addEventListener('close', () => this.restoreFocus('accessibilityDialog'));
  }
}

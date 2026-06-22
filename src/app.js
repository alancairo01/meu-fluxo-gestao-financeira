import { LEGACY_STORAGE_KEY, MIGRATION_KEY_PREFIX, USER_STORAGE_PREFIX, VIEW_METADATA } from './config/constants.js';
import { byId, query, queryAll } from './core/dom.js';
import { cleanProfile, createDefaultState, hasMeaningfulState, StateStore } from './domain/state.js';
import { applyExpenseMode, createBaseEntry, createEntrySeries, findDisplayMonth } from './domain/entries.js';
import { createCsvBlob, downloadBlob, readJsonFile } from './services/file-service.js';
import { AuthService } from './services/auth-service.js';
import { FinanceRepository } from './services/finance-repository.js';
import { replaceCloudData } from './services/migration-service.js';
import { blobToDataUrl, compressProfilePhoto } from './services/profile-storage-service.js';
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
    this.store = new StateStore(window.localStorage, LEGACY_STORAGE_KEY);
    this.auth = new AuthService();
    this.repository = null;
    this.user = null;
    this.activeView = 'dashboard';
    this.toast = new ToastUI();
    this.pendingMigrationState = null;
    this.lastFocusedElement = {
      entryDialog: null,
      accessibilityDialog: null,
      clearDataDialog: null
    };
  }

  get state() {
    return this.store.get();
  }

  async init() {
    initializeEntryForm();
    this.bindEvents();

    try {
      const config = await this.auth.initialize();
      if (!config.configured) {
        this.showConfigurationScreen();
        return;
      }

      this.auth.onAuthStateChange((event, session) => {
        window.setTimeout(() => this.handleAuthState(event, session), 0);
      });
      const session = await this.auth.getSession();
      if (session?.user) await this.loadAuthenticatedUser(session.user);
      else this.showAuthScreen('login');
    } catch (error) {
      this.showConfigurationScreen(error.message || 'Não foi possível iniciar a conexão com o Supabase.');
    }
  }

  async handleAuthState(event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      this.showAuthScreen('updatePassword');
      return;
    }
    if (session?.user) {
      await this.loadAuthenticatedUser(session.user);
      return;
    }
    this.user = null;
    this.repository = null;
    this.showAuthScreen('login');
  }

  async loadAuthenticatedUser(user) {
    if (this.user?.id === user.id && this.repository) {
      this.showApplication();
      return;
    }

    this.user = user;
    this.repository = new FinanceRepository(this.auth.getClient(), user.id);
    const userStorageKey = `${USER_STORAGE_PREFIX}:${user.id}`;
    const cachedState = this.store.setKey(userStorageKey);
    this.setSyncStatus('Sincronizando seus dados…', 'saving');

    try {
      const remoteState = await this.repository.getState();
      this.store.replace(remoteState, true);
      this.syncDisplayedMonth(remoteState.selectedMonth);
      this.applyPreferences();
      this.render();
      this.showApplication();
      this.setSyncStatus('Dados sincronizados com sua conta.', 'synced');
      this.updateAccountInfo();
      this.offerLocalMigration(remoteState, cachedState);
    } catch (error) {
      this.showConfigurationScreen(`Não foi possível acessar o banco de dados. Verifique se o arquivo supabase/schema.sql foi executado e se as variáveis do Render estão corretas. Detalhe: ${error.message}`);
    }
  }

  showApplication() {
    byId('authScreen').hidden = true;
    byId('configurationScreen').hidden = true;
    byId('appShell').hidden = false;
  }

  showConfigurationScreen(message = '') {
    byId('appShell').hidden = true;
    byId('authScreen').hidden = true;
    byId('configurationScreen').hidden = false;
    if (message) byId('configurationMessage').textContent = message;
  }

  showAuthScreen(form = 'login') {
    byId('appShell').hidden = true;
    byId('configurationScreen').hidden = true;
    byId('authScreen').hidden = false;
    this.setAuthForm(form);
  }

  setAuthForm(form) {
    const forms = {
      login: byId('loginForm'),
      signup: byId('signUpForm'),
      reset: byId('resetPasswordForm'),
      updatePassword: byId('updatePasswordForm')
    };
    Object.entries(forms).forEach(([name, element]) => element.classList.toggle('hidden', name !== form));
    const isAccountTab = form === 'signup';
    byId('loginTabBtn').classList.toggle('active', !isAccountTab);
    byId('loginTabBtn').setAttribute('aria-selected', String(!isAccountTab));
    byId('signUpTabBtn').classList.toggle('active', isAccountTab);
    byId('signUpTabBtn').setAttribute('aria-selected', String(isAccountTab));
    byId('loginTabBtn').hidden = form === 'reset' || form === 'updatePassword';
    byId('signUpTabBtn').hidden = form === 'reset' || form === 'updatePassword';
    this.setAuthFeedback('', false);
  }

  setAuthFeedback(message, isError = false) {
    const feedback = byId('authFeedback');
    feedback.textContent = message;
    feedback.classList.toggle('hidden', !message);
    feedback.classList.toggle('error', Boolean(message && isError));
  }

  setAuthBusy(buttonId, isBusy, text = '') {
    const button = byId(buttonId);
    if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
    button.disabled = isBusy;
    button.textContent = isBusy ? text : button.dataset.defaultText;
  }

  async submitLogin(event) {
    event.preventDefault();
    const form = byId('loginForm');
    if (!form.reportValidity()) return;
    this.setAuthBusy('loginSubmitBtn', true, 'Entrando…');
    this.setAuthFeedback('');

    try {
      const data = await this.auth.signIn(byId('loginEmail').value.trim(), byId('loginPassword').value);
      if (data.session?.user) await this.loadAuthenticatedUser(data.session.user);
    } catch (error) {
      this.setAuthFeedback(error.message || 'Não foi possível entrar. Verifique seus dados.', true);
    } finally {
      this.setAuthBusy('loginSubmitBtn', false);
    }
  }

  async submitSignUp(event) {
    event.preventDefault();
    const form = byId('signUpForm');
    if (!form.reportValidity()) return;
    const password = byId('signUpPassword').value;
    if (password !== byId('signUpPasswordConfirm').value) {
      this.setAuthFeedback('As senhas não coincidem.', true);
      byId('signUpPasswordConfirm').focus();
      return;
    }

    this.setAuthBusy('signUpSubmitBtn', true, 'Criando conta…');
    this.setAuthFeedback('');
    try {
      const data = await this.auth.signUp(byId('signUpEmail').value.trim(), password);
      if (data.session?.user) {
        await this.loadAuthenticatedUser(data.session.user);
        return;
      }
      form.reset();
      this.setAuthForm('login');
      this.setAuthFeedback('Conta criada. Verifique seu e-mail e confirme o acesso antes de entrar.');
    } catch (error) {
      this.setAuthFeedback(error.message || 'Não foi possível criar sua conta.', true);
    } finally {
      this.setAuthBusy('signUpSubmitBtn', false);
    }
  }

  async submitPasswordReset(event) {
    event.preventDefault();
    const form = byId('resetPasswordForm');
    if (!form.reportValidity()) return;
    this.setAuthBusy('resetSubmitBtn', true, 'Enviando…');
    this.setAuthFeedback('');
    try {
      await this.auth.sendPasswordReset(byId('resetEmail').value.trim());
      this.setAuthFeedback('Se existir uma conta para este e-mail, você receberá um link seguro para redefinir a senha.');
    } catch (error) {
      this.setAuthFeedback(error.message || 'Não foi possível enviar o link de recuperação.', true);
    } finally {
      this.setAuthBusy('resetSubmitBtn', false);
    }
  }

  async submitNewPassword(event) {
    event.preventDefault();
    const form = byId('updatePasswordForm');
    if (!form.reportValidity()) return;
    const password = byId('newPassword').value;
    if (password !== byId('newPasswordConfirm').value) {
      this.setAuthFeedback('As senhas não coincidem.', true);
      byId('newPasswordConfirm').focus();
      return;
    }

    this.setAuthBusy('updatePasswordSubmitBtn', true, 'Salvando…');
    try {
      await this.auth.updatePassword(password);
      const session = await this.auth.getSession();
      if (session?.user) await this.loadAuthenticatedUser(session.user);
      else this.showAuthScreen('login');
    } catch (error) {
      this.setAuthFeedback(error.message || 'Não foi possível atualizar a senha.', true);
    } finally {
      this.setAuthBusy('updatePasswordSubmitBtn', false);
    }
  }

  async signOut() {
    if (!window.confirm('Sair da sua conta neste dispositivo?')) return;
    try {
      await this.auth.signOut();
      this.toast.show('Você saiu da conta.');
    } catch (error) {
      this.toast.show(error.message || 'Não foi possível sair da conta.');
    }
  }

  getCurrentMonth() {
    return byId('monthFilter').value || this.state.selectedMonth || getTodayISO().slice(0, 7);
  }

  syncDisplayedMonth(preferredMonth = this.state.selectedMonth, ensureDataMonth = false) {
    const preferred = isValidMonth(preferredMonth) ? preferredMonth : '';
    const month = !ensureDataMonth && preferred
      ? preferred
      : findDisplayMonth(this.state.entries, preferred, getTodayISO().slice(0, 7));
    this.store.patch({ selectedMonth: month }, true);
    byId('monthFilter').value = month;
    return month;
  }

  applyPreferences() {
    applyTheme(this.state.theme);
    applyAccessibility(this.state.a11y);
  }

  render() {
    if (!this.user) return;
    const month = this.getCurrentMonth();
    renderProfile(this.state);
    byId('monthLabel').textContent = this.state.profile.greeting || `Resumo de ${formatFullMonth(month)}. Acompanhe o que entra, sai e o que já está comprometido.`;
    renderDashboard(this.state, month);
    renderEntries(this.state, month);
    renderBudgets(this.state, month);
    renderReports(this.state, month);
    this.updateAccountInfo();
  }

  updateAccountInfo() {
    const email = this.user?.email || 'Conta conectada';
    const label = byId('profileSyncLabel');
    label.textContent = 'Sincronizado';
    label.title = email;
  }

  setSyncStatus(message, state = '') {
    const status = byId('syncStatus');
    status.textContent = message;
    status.dataset.state = state;
  }

  async syncPreferences(showToast = false) {
    this.store.persist();
    try {
      this.setSyncStatus('Salvando preferências…', 'saving');
      await this.repository.savePreferences(this.state);
      this.setSyncStatus('Dados sincronizados com sua conta.', 'synced');
      if (showToast) this.toast.show('Preferências salvas na sua conta.');
      return true;
    } catch (error) {
      this.setSyncStatus('Preferências salvas neste dispositivo, mas não sincronizadas.', 'error');
      this.toast.show(error.message || 'Não foi possível sincronizar as preferências.');
      return false;
    }
  }

  async runCloudOperation(action, errorMessage) {
    try {
      this.setSyncStatus('Salvando na sua conta…', 'saving');
      const result = await action();
      this.setSyncStatus('Dados sincronizados com sua conta.', 'synced');
      return result;
    } catch (error) {
      this.setSyncStatus('A alteração não foi sincronizada. Tente novamente.', 'error');
      this.toast.show(error.message || errorMessage || 'Não foi possível salvar esta alteração.');
      throw error;
    }
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

  async submitEntry(event) {
    event.preventDefault();
    if (!validateEntryForm()) return;
    const saveButton = byId('saveEntryBtn');
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando…';

    try {
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
        const savedEntry = await this.runCloudOperation(() => this.repository.updateEntry(updatedEntry));
        const entries = this.state.entries.map((entry) => entry.id === form.id ? savedEntry : entry);
        this.store.replace({ ...this.state, entries, selectedMonth: getMonthFromDate(savedEntry.date) }, true);
        byId('monthFilter').value = this.state.selectedMonth;
        this.closeEntryDialog();
        this.render();
        this.syncPreferences();
        this.toast.show(`Lançamento atualizado e exibido em ${formatFullMonth(this.state.selectedMonth)}.`);
        return;
      }

      const entriesToCreate = createEntrySeries(baseEntry, options);
      const savedEntries = await this.runCloudOperation(() => this.repository.createEntries(entriesToCreate));
      const selectedMonth = getMonthFromDate(baseEntry.date);
      this.store.replace({ ...this.state, entries: [...this.state.entries, ...savedEntries], selectedMonth }, true);
      byId('monthFilter').value = selectedMonth;
      this.closeEntryDialog();
      this.render();
      this.syncPreferences();
      this.toast.show(savedEntries.length > 1
        ? `${savedEntries.length} lançamentos foram criados. Exibindo ${formatFullMonth(selectedMonth)}.`
        : `Lançamento salvo e exibido em ${formatFullMonth(selectedMonth)}.`);
    } catch {
      return;
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Salvar lançamento';
    }
  }

  async deleteEntry(id) {
    const entry = this.state.entries.find((item) => item.id === id);
    if (!entry || !window.confirm(`Excluir “${entry.description}”?`)) return;
    try {
      await this.runCloudOperation(() => this.repository.deleteEntry(id));
      this.store.replace({ ...this.state, entries: this.state.entries.filter((item) => item.id !== id) }, true);
      this.render();
      this.toast.show('Lançamento excluído.');
    } catch {
      return;
    }
  }

  async saveMonthlyBudget(event) {
    event.preventDefault();
    const monthly = Number(byId('monthlyBudgetInput').value) || 0;
    const budgets = { ...this.state.budgets, monthly };
    try {
      await this.runCloudOperation(() => this.repository.saveBudget(budgets));
      this.store.patch({ budgets }, true);
      this.render();
      this.toast.show('Orçamento mensal atualizado.');
    } catch {
      return;
    }
  }

  async saveCategoryBudget(event) {
    event.preventDefault();
    const category = byId('budgetCategorySelect').value;
    const amount = Number(byId('budgetCategoryAmount').value);
    if (!amount) {
      byId('budgetCategoryAmount').focus();
      this.toast.show('Informe um limite maior que zero.');
      return;
    }

    const budgets = {
      ...this.state.budgets,
      categories: { ...this.state.budgets.categories, [category]: amount }
    };
    try {
      await this.runCloudOperation(() => this.repository.saveBudget(budgets));
      this.store.patch({ budgets }, true);
      byId('budgetCategoryAmount').value = '';
      this.render();
      this.toast.show(`Limite de ${category} salvo.`);
    } catch {
      return;
    }
  }

  async removeCategoryBudget(category) {
    const categories = { ...this.state.budgets.categories };
    delete categories[category];
    const budgets = { ...this.state.budgets, categories };
    try {
      await this.runCloudOperation(() => this.repository.saveBudget(budgets));
      this.store.patch({ budgets }, true);
      this.render();
      this.toast.show('Limite removido.');
    } catch {
      return;
    }
  }

  generatePdfReport() {
    const wasOpened = openMonthlyReport(this.state, this.getCurrentMonth(), getProfileName(this.state.profile));
    if (!wasOpened) this.toast.show('Não foi possível abrir o relatório. Verifique se o navegador bloqueou pop-ups.');
  }

  async exportBackup() {
    const backup = JSON.parse(JSON.stringify(this.state));
    try {
      if (/^https:\/\//.test(backup.profile.photo || '')) {
        const response = await fetch(backup.profile.photo);
        if (response.ok) backup.profile.photo = await blobToDataUrl(await response.blob());
      }
    } catch {
      backup.profile.photo = '';
    }
    downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `meu-fluxo-backup-${getTodayISO()}.json`);
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
      if (!window.confirm('Restaurar este backup substituirá os dados financeiros atuais da sua conta. Continuar?')) return;
      const restored = await this.runCloudOperation(() => replaceCloudData(this.repository, imported));
      this.store.replace(restored, true);
      const displayedMonth = this.syncDisplayedMonth(restored.selectedMonth, true);
      this.applyPreferences();
      this.render();
      const total = this.state.entries.length;
      this.toast.show(total
        ? `Backup restaurado: ${total} ${total === 1 ? 'lançamento' : 'lançamentos'}. Exibindo ${formatFullMonth(displayedMonth)}.`
        : 'Backup restaurado. Não há lançamentos neste arquivo.');
    } catch (error) {
      this.toast.show(error.message || 'Não foi possível restaurar esse backup.');
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

  async clearFinancialData() {
    if (!byId('clearDataConfirmation').checked) return;
    const button = byId('confirmClearDataBtn');
    button.disabled = true;
    button.textContent = 'Apagando…';
    try {
      await this.runCloudOperation(() => this.repository.clearFinancialData());
      this.store.resetFinancialData();
      this.store.patch({ selectedMonth: getTodayISO().slice(0, 7) }, true);
      byId('monthFilter').value = this.state.selectedMonth;
      byId('searchEntries').value = '';
      byId('typeFilter').value = 'all';
      this.closeClearDataDialog();
      this.switchView('dashboard');
      this.syncPreferences();
      this.toast.show('Todos os dados financeiros foram apagados da sua conta.');
    } catch {
      button.disabled = false;
      button.textContent = 'Apagar tudo';
    }
  }

  async saveProfile(event) {
    event.preventDefault();
    const accent = query('input[name="accentColor"]:checked')?.value || 'violet';
    const profile = cleanProfile({
      ...this.state.profile,
      name: byId('profileNameInput').value,
      greeting: byId('profileGreetingInput').value,
      accent
    });
    try {
      await this.runCloudOperation(() => this.repository.saveProfile(profile));
      this.store.patch({ profile }, true);
      this.render();
      this.toast.show('Perfil e personalização salvos.');
    } catch {
      return;
    }
  }

  async resetProfileStyle() {
    const profile = cleanProfile({ ...this.state.profile, greeting: '', accent: 'violet' });
    try {
      await this.runCloudOperation(() => this.repository.saveProfile(profile));
      this.store.patch({ profile }, true);
      this.render();
      this.toast.show('Estilo do perfil restaurado.');
    } catch {
      return;
    }
  }

  async removeProfilePhoto() {
    if (!this.state.profile.avatarPath) {
      this.toast.show('Nenhuma foto de perfil foi adicionada.');
      return;
    }
    try {
      await this.runCloudOperation(() => this.repository.removeAvatar(this.state.profile.avatarPath));
      this.store.patch({ profile: cleanProfile({ ...this.state.profile, photo: '', avatarPath: '' }) }, true);
      byId('profilePhotoStatus').textContent = 'Foto de perfil removida da sua conta.';
      this.render();
      this.toast.show('Foto de perfil removida.');
    } catch {
      return;
    }
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
      byId('profilePhotoStatus').textContent = 'Enviando foto para sua conta…';
      const photo = await compressProfilePhoto(file);
      const avatar = await this.runCloudOperation(() => this.repository.uploadAvatar(photo));
      this.store.patch({ profile: cleanProfile({ ...this.state.profile, ...avatar }) }, true);
      this.render();
      byId('profilePhotoStatus').textContent = 'Foto de perfil atualizada e sincronizada.';
      this.toast.show('Foto de perfil atualizada.');
    } catch (error) {
      const message = error.message || 'Não foi possível atualizar a foto.';
      byId('profilePhotoStatus').textContent = message;
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

  async saveAccessibility() {
    this.store.patch({ a11y: readAccessibilityControls() }, true);
    applyAccessibility(this.state.a11y);
    const synchronized = await this.syncPreferences(true);
    if (synchronized) this.closeAccessibilityDialog();
  }

  async resetAccessibility() {
    this.store.patch({ a11y: createDefaultState().a11y }, true);
    applyAccessibility(this.state.a11y);
    await this.syncPreferences(true);
  }

  async toggleTheme() {
    const theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.store.patch({ theme }, true);
    applyTheme(theme);
    await this.syncPreferences();
    this.toast.show(theme === 'dark' ? 'Tema escuro ativado.' : 'Tema claro ativado.');
  }

  offerLocalMigration(remoteState, cachedState) {
    const migrationKey = `${MIGRATION_KEY_PREFIX}:${this.user.id}`;
    const cached = hasMeaningfulState(cachedState) ? cachedState : null;
    const legacy = this.store.read(LEGACY_STORAGE_KEY);
    const legacyAvailable = hasMeaningfulState(legacy) && !window.localStorage.getItem(migrationKey);
    const source = !hasMeaningfulState(remoteState) && (cached || (legacyAvailable ? legacy : null));
    if (!source) return;

    this.pendingMigrationState = source;
    const categoryBudgets = Object.keys(source.budgets.categories).length;
    byId('migrationSummary').innerHTML = [
      ['Lançamentos', source.entries.length],
      ['Orçamentos', Number(source.budgets.monthly > 0) + categoryBudgets],
      ['Perfil', source.profile.name ? 'Sim' : 'Não']
    ].map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
    byId('migrationDialog').showModal();
  }

  async importLocalData() {
    if (!this.pendingMigrationState) return;
    const button = byId('importMigrationBtn');
    button.disabled = true;
    button.textContent = 'Importando…';
    try {
      const imported = await this.runCloudOperation(() => replaceCloudData(this.repository, this.pendingMigrationState));
      this.store.replace(imported, true);
      const displayMonth = this.syncDisplayedMonth(imported.selectedMonth, true);
      this.applyPreferences();
      this.render();
      window.localStorage.setItem(`${MIGRATION_KEY_PREFIX}:${this.user.id}`, new Date().toISOString());
      byId('migrationDialog').close();
      this.pendingMigrationState = null;
      this.toast.show(`Dados importados. Exibindo ${formatFullMonth(displayMonth)}.`);
    } catch {
      button.disabled = false;
      button.textContent = 'Importar para minha conta';
    }
  }

  skipLocalMigration() {
    window.localStorage.setItem(`${MIGRATION_KEY_PREFIX}:${this.user.id}`, new Date().toISOString());
    this.pendingMigrationState = null;
    byId('migrationDialog').close();
  }

  restoreFocus(dialogName) {
    const element = this.lastFocusedElement[dialogName];
    if (element && document.contains(element)) element.focus();
    this.lastFocusedElement[dialogName] = null;
  }

  bindEvents() {
    byId('loginTabBtn').addEventListener('click', () => this.setAuthForm('login'));
    byId('signUpTabBtn').addEventListener('click', () => this.setAuthForm('signup'));
    byId('showResetPasswordBtn').addEventListener('click', () => this.setAuthForm('reset'));
    byId('backToLoginBtn').addEventListener('click', () => this.setAuthForm('login'));
    byId('loginForm').addEventListener('submit', (event) => this.submitLogin(event));
    byId('signUpForm').addEventListener('submit', (event) => this.submitSignUp(event));
    byId('resetPasswordForm').addEventListener('submit', (event) => this.submitPasswordReset(event));
    byId('updatePasswordForm').addEventListener('submit', (event) => this.submitNewPassword(event));

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
      this.syncPreferences();
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
    byId('logoutBtn').addEventListener('click', () => this.signOut());
    byId('accessibilityBtn').addEventListener('click', () => this.openAccessibilityDialog());
    byId('closeAccessibilityDialogBtn').addEventListener('click', () => this.closeAccessibilityDialog());
    byId('saveAccessibilityBtn').addEventListener('click', () => this.saveAccessibility());
    byId('resetAccessibilityBtn').addEventListener('click', () => this.resetAccessibility());
    queryAll('input[name="fontSize"], #highContrastInput, #reduceMotionInput').forEach((field) => field.addEventListener('change', () => this.previewAccessibility()));
    byId('accessibilityDialog').addEventListener('close', () => this.restoreFocus('accessibilityDialog'));

    byId('importMigrationBtn').addEventListener('click', () => this.importLocalData());
    byId('skipMigrationBtn').addEventListener('click', () => this.skipLocalMigration());
  }
}

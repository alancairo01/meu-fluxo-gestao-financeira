import { createDefaultState, normalizeState } from '../domain/state.js';

function throwIfError(error, fallbackMessage) {
  if (!error) return;
  const message = String(error.message || fallbackMessage || 'Não foi possível concluir a operação.');
  throw new Error(message);
}

function toPreferenceDate(month) {
  return /^\d{4}-\d{2}$/.test(String(month || '')) ? `${month}-01` : null;
}

function fromPreferenceDate(date) {
  return String(date || '').slice(0, 7);
}

function toEntryRecord(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    entry_type: entry.type,
    description: entry.description,
    amount: Number(entry.amount),
    entry_date: entry.date,
    category: entry.category,
    notes: entry.notes || '',
    created_at: new Date(Number(entry.createdAt) || Date.now()).toISOString(),
    installment_current: entry.installment?.current || null,
    installment_total: entry.installment?.total || null,
    installment_series_id: entry.installment?.seriesId || null,
    recurring_total: entry.recurring?.total || null,
    recurring_series_id: entry.recurring?.seriesId || null
  };
}

function fromEntryRecord(record) {
  return {
    id: record.id,
    type: record.entry_type,
    description: record.description,
    amount: Number(record.amount),
    date: record.entry_date,
    category: record.category,
    notes: record.notes || '',
    createdAt: Date.parse(record.created_at) || Date.now(),
    installment: record.installment_total
      ? {
          current: Number(record.installment_current),
          total: Number(record.installment_total),
          seriesId: record.installment_series_id || ''
        }
      : null,
    recurring: record.recurring_total
      ? {
          total: Number(record.recurring_total),
          seriesId: record.recurring_series_id || ''
        }
      : null
  };
}

export class FinanceRepository {
  constructor(client, userId) {
    this.client = client;
    this.userId = userId;
  }

  async ensureUserRecords() {
    const defaults = createDefaultState();
    const operations = [
      this.client.from('profiles').upsert({ id: this.userId }, { onConflict: 'id', ignoreDuplicates: true }),
      this.client.from('user_preferences').upsert({ user_id: this.userId }, { onConflict: 'user_id', ignoreDuplicates: true }),
      this.client.from('financial_budgets').upsert({
        user_id: this.userId,
        monthly_budget: defaults.budgets.monthly,
        category_budgets: defaults.budgets.categories
      }, { onConflict: 'user_id', ignoreDuplicates: true })
    ];
    const responses = await Promise.all(operations);
    responses.forEach(({ error }) => throwIfError(error, 'Não foi possível preparar sua conta.'));
  }

  async getState() {
    await this.ensureUserRecords();
    const [profileResponse, preferencesResponse, budgetsResponse, entriesResponse] = await Promise.all([
      this.client.from('profiles').select('name, greeting, accent, avatar_path').eq('id', this.userId).maybeSingle(),
      this.client.from('user_preferences').select('theme, font_size, high_contrast, reduce_motion, selected_month').eq('user_id', this.userId).maybeSingle(),
      this.client.from('financial_budgets').select('monthly_budget, category_budgets').eq('user_id', this.userId).maybeSingle(),
      this.client.from('financial_entries').select('*').eq('user_id', this.userId).order('entry_date', { ascending: false }).order('created_at', { ascending: false })
    ]);

    [profileResponse, preferencesResponse, budgetsResponse, entriesResponse].forEach(({ error }) => throwIfError(error, 'Não foi possível carregar seus dados.'));
    const profileRecord = profileResponse.data || {};
    const avatarPath = profileRecord.avatar_path || '';
    const photo = avatarPath ? await this.createAvatarUrl(avatarPath) : '';

    return normalizeState({
      entries: (entriesResponse.data || []).map(fromEntryRecord),
      budgets: {
        monthly: Number(budgetsResponse.data?.monthly_budget || 0),
        categories: budgetsResponse.data?.category_budgets || {}
      },
      selectedMonth: fromPreferenceDate(preferencesResponse.data?.selected_month),
      theme: preferencesResponse.data?.theme || 'light',
      a11y: {
        fontSize: preferencesResponse.data?.font_size || 'default',
        highContrast: Boolean(preferencesResponse.data?.high_contrast),
        reduceMotion: Boolean(preferencesResponse.data?.reduce_motion)
      },
      profile: {
        name: profileRecord.name || '',
        greeting: profileRecord.greeting || '',
        accent: profileRecord.accent || 'violet',
        avatarPath,
        photo
      }
    });
  }

  async createEntries(entries) {
    const records = entries.map((entry) => toEntryRecord(entry, this.userId));
    const { data, error } = await this.client
      .from('financial_entries')
      .insert(records)
      .select();
    throwIfError(error, 'Não foi possível salvar os lançamentos.');
    return (data || []).map(fromEntryRecord);
  }

  async updateEntry(entry) {
    const record = toEntryRecord(entry, this.userId);
    delete record.user_id;
    delete record.created_at;
    const { data, error } = await this.client
      .from('financial_entries')
      .update(record)
      .eq('id', entry.id)
      .select()
      .single();
    throwIfError(error, 'Não foi possível atualizar o lançamento.');
    return fromEntryRecord(data);
  }

  async deleteEntry(id) {
    const { error } = await this.client
      .from('financial_entries')
      .delete()
      .eq('id', id);
    throwIfError(error, 'Não foi possível excluir o lançamento.');
  }

  async saveBudget(budgets) {
    const { error } = await this.client
      .from('financial_budgets')
      .upsert({
        user_id: this.userId,
        monthly_budget: Number(budgets.monthly || 0),
        category_budgets: budgets.categories || {}
      }, { onConflict: 'user_id' });
    throwIfError(error, 'Não foi possível salvar o orçamento.');
  }

  async saveProfile(profile) {
    const { error } = await this.client
      .from('profiles')
      .upsert({
        id: this.userId,
        name: profile.name || '',
        greeting: profile.greeting || '',
        accent: profile.accent || 'violet'
      }, { onConflict: 'id' });
    throwIfError(error, 'Não foi possível salvar o perfil.');
  }

  async savePreferences(state) {
    const { error } = await this.client
      .from('user_preferences')
      .upsert({
        user_id: this.userId,
        theme: state.theme,
        font_size: state.a11y.fontSize,
        high_contrast: Boolean(state.a11y.highContrast),
        reduce_motion: Boolean(state.a11y.reduceMotion),
        selected_month: toPreferenceDate(state.selectedMonth)
      }, { onConflict: 'user_id' });
    throwIfError(error, 'Não foi possível salvar as preferências.');
  }

  async uploadAvatar(blob) {
    const avatarPath = `${this.userId}/avatar.jpg`;
    const { error: uploadError } = await this.client
      .storage
      .from('avatars')
      .upload(avatarPath, blob, {
        upsert: true,
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });
    throwIfError(uploadError, 'Não foi possível enviar a foto de perfil.');

    const { error: profileError } = await this.client
      .from('profiles')
      .upsert({ id: this.userId, avatar_path: avatarPath }, { onConflict: 'id' });
    throwIfError(profileError, 'Não foi possível associar a foto ao seu perfil.');
    return { avatarPath, photo: await this.createAvatarUrl(avatarPath) };
  }

  async removeAvatar(avatarPath) {
    if (avatarPath) {
      const { error: removeError } = await this.client.storage.from('avatars').remove([avatarPath]);
      throwIfError(removeError, 'Não foi possível excluir a foto de perfil.');
    }
    const { error } = await this.client
      .from('profiles')
      .update({ avatar_path: null })
      .eq('id', this.userId);
    throwIfError(error, 'Não foi possível atualizar seu perfil.');
  }

  async createAvatarUrl(avatarPath) {
    const { data, error } = await this.client.storage.from('avatars').createSignedUrl(avatarPath, 60 * 60);
    throwIfError(error, 'Não foi possível carregar a foto de perfil.');
    return data?.signedUrl || '';
  }

  async clearFinancialData() {
    const { error: entriesError } = await this.client
      .from('financial_entries')
      .delete()
      .eq('user_id', this.userId);
    throwIfError(entriesError, 'Não foi possível apagar os lançamentos.');
    await this.saveBudget({ monthly: 0, categories: {} });
  }

  async replaceFinancialData(state) {
    const normalized = normalizeState(state);
    await this.clearFinancialData();
    if (normalized.entries.length) await this.createEntries(normalized.entries);
    await this.saveBudget(normalized.budgets);
    await this.saveProfile(normalized.profile);
    await this.savePreferences(normalized);
    return normalized;
  }
}

import { PROFILE_ACCENTS } from '../config/constants.js';
import { byId, query } from '../core/dom.js';
import { formatCurrency } from '../utils/format.js';

export function getProfileName(profile) {
  return String(profile?.name || '').trim();
}

export function getProfileFirstName(profile) {
  const name = getProfileName(profile);
  return name ? name.split(/\s+/)[0] : '';
}

export function getProfileInitials(profile) {
  const names = getProfileName(profile).split(/\s+/).filter(Boolean);
  if (!names.length) return 'M';
  if (names.length === 1) return names[0].slice(0, 2).toUpperCase();
  return `${names[0][0]}${names.at(-1)[0]}`.toUpperCase();
}

export function renderAvatar(id, profile) {
  const avatar = byId(id);
  avatar.replaceChildren();
  avatar.classList.toggle('has-photo', Boolean(profile.photo));

  if (profile.photo) {
    const image = document.createElement('img');
    image.src = profile.photo;
    image.alt = getProfileName(profile) ? `Foto de perfil de ${getProfileName(profile)}` : 'Foto de perfil';
    avatar.append(image);
    return;
  }

  const initials = document.createElement('span');
  initials.textContent = getProfileInitials(profile);
  avatar.append(initials);
}

export function applyProfileAccent(profile) {
  document.body.dataset.accent = PROFILE_ACCENTS.includes(profile.accent) ? profile.accent : 'violet';
}

export function renderProfile(state) {
  const profile = state.profile;
  const name = getProfileName(profile);
  const greeting = profile.greeting || '';
  const firstName = getProfileFirstName(profile);

  applyProfileAccent(profile);
  ['sidebarAvatar', 'topbarAvatar', 'homeAvatar', 'profilePreviewAvatar', 'profileEditorAvatar'].forEach((id) => renderAvatar(id, profile));
  byId('sidebarProfileName').textContent = name || 'Seu perfil';
  byId('sidebarProfileHint').textContent = name ? 'Personalizar' : 'Adicionar foto e nome';
  byId('homeProfileName').textContent = name || 'Seu espaço financeiro';
  byId('homeProfileHint').textContent = name ? 'Perfil personalizado' : 'Adicione foto, nome e cores';
  byId('dashboardGreetingTitle').textContent = firstName ? `Olá, ${firstName}!` : 'Seu mês em um olhar';
  byId('profilePreviewName').textContent = name || 'Seu perfil';
  byId('profilePreviewGreeting').textContent = greeting || 'Personalize seu espaço para tornar a organização mais sua.';
  byId('profileEntriesCount').textContent = String(state.entries.length);
  byId('profileBudgetValue').textContent = Number(state.budgets.monthly || 0) > 0 ? formatCurrency(state.budgets.monthly) : 'Não definido';
  byId('profileNameInput').value = name;
  byId('profileGreetingInput').value = greeting;
  const selectedAccent = query(`input[name="accentColor"][value="${profile.accent || 'violet'}"]`);
  if (selectedAccent) selectedAccent.checked = true;
}

import { normalizeState } from '../domain/state.js';
import { createId } from '../utils/id.js';
import { dataUrlToBlob } from './profile-storage-service.js';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export function prepareStateForCloud(source) {
  const state = normalizeState(source);
  const usedIds = new Set();
  const entries = state.entries.map((entry) => {
    let id = isUuid(entry.id) ? entry.id : createId();
    while (usedIds.has(id)) id = createId();
    usedIds.add(id);
    return { ...entry, id };
  });
  return normalizeState({ ...state, entries });
}

export async function replaceCloudData(repository, source) {
  const state = prepareStateForCloud(source);
  const localPhoto = dataUrlToBlob(state.profile.photo);
  const profile = localPhoto ? { ...state.profile, photo: '', avatarPath: '' } : state.profile;
  const replaced = await repository.replaceFinancialData({ ...state, profile });

  if (!localPhoto) return replaced;
  const avatar = await repository.uploadAvatar(localPhoto);
  return normalizeState({
    ...replaced,
    profile: { ...replaced.profile, ...avatar }
  });
}

const KEY = 'why:map';
const LEGACY_KEY = 'codageArgument';

export function loadMap(storage) {
  try {
    const store = storage || globalThis.localStorage;
    const current = store.getItem(KEY);
    if (current) return JSON.parse(current);
    const legacy = store.getItem(LEGACY_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy);
    store.setItem(KEY, legacy);
    store.removeItem(LEGACY_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function saveMap(json, storage) {
  try {
    (storage || globalThis.localStorage).setItem(KEY, json);
    return true;
  } catch {
    return false;
  }
}

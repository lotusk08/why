const KEY = 'mode';
const ATTR = 'data-mode';
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

const store = {
  get() {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(value) {
    try {
      if (value === null) sessionStorage.removeItem(KEY);
      else sessionStorage.setItem(KEY, value);
    } catch {
      return;
    }
  }
};

function system() {
  return media.matches ? 'dark' : 'light';
}

function pinned() {
  const mode = root.getAttribute(ATTR);
  return mode === 'light' || mode === 'dark' ? mode : null;
}

export const theme = $state({ mode: pinned() ?? system() });

function syncMeta() {
  const dark = theme.mode === 'dark';
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = dark ? '#000000' : '#ffffff';
  document.head.appendChild(meta);
}

function apply(mode) {
  if (mode === null) root.removeAttribute(ATTR);
  else root.setAttribute(ATTR, mode);
  store.set(mode);
  theme.mode = mode ?? system();
  syncMeta();
}

export function flipTheme() {
  apply(pinned() !== null ? null : media.matches ? 'light' : 'dark');
}

export function initTheme() {
  const stored = store.get();
  const mode = stored === 'light' || stored === 'dark' ? stored : pinned();
  apply(mode !== null && mode !== system() ? mode : null);
  media.addEventListener('change', () => {
    if (pinned() === null) {
      theme.mode = system();
      syncMeta();
    }
  });
}

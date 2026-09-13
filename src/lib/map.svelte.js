import { createMapper } from './reasons/index.js';
import { loadMap, saveMap } from './storage.js';
import { decodeHash, encodeMap, validateMap } from './share.js';
import { downloadBlob } from './download.js';
import { DEFAULT_MAP } from './defaults.js';

const initialMapState = { ready: false, canUndo: false, canRedo: false, scale: 1, nodes: 0, edges: 0, focused: null };
const initialUiState = { editing: null, help: false, toast: '' };

export const map = $state(initialMapState);
export const ui = $state(initialUiState);

let mapper = null;
let saveTimer = null;
let toastTimer = null;

function clearHash() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

function persist(json) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveMap(json), 250);
  clearHash();
}

export function toast(message) {
  ui.toast = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast = ''), 2200);
}

export async function initialMap() {
  const shared = await decodeHash(location.hash);
  if (shared) {
    saveMap(JSON.stringify(shared));
    return shared;
  }
  return validateMap(loadMap()) ?? DEFAULT_MAP;
}

export function mountMap(container, elements) {
  mapper = createMapper(container, {
    blocked: () => Boolean(ui.editing || ui.help),
    onState: (state) => Object.assign(map, state),
    onChange: persist,
    onEdit: (el, isNew) => {
      ui.editing = {
        id: el.id,
        kind: el.kind,
        text: el.kind === 'node' ? el.text : el.type,
        lineType: el.lineType ?? 'solid',
        isNew
      };
    }
  });
  mapper.load(elements);
  map.ready = true;
  return () => {
    mapper?.destroy();
    mapper = null;
    map.ready = false;
  };
}

export const actions = {
  undo: () => mapper?.undo(),
  redo: () => mapper?.redo(),
  zoomIn: () => mapper?.zoomIn(),
  zoomOut: () => mapper?.zoomOut(),
  fit: () => mapper?.fit(),
  refreshTheme: () => mapper?.refreshTheme(),
  openHelp: () => (ui.help = true),
  closeHelp: () => (ui.help = false),
  async saveImage() {
    const blob = await mapper?.toPNG();
    if (!blob) {
      toast('Add an idea first');
      return;
    }
    downloadBlob(blob, 'argument-map.png');
    toast('Image saved');
  },
  async share() {
    if (!mapper) return;
    const payload = await encodeMap(mapper.export());
    history.replaceState(null, '', `#${payload}`);
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied');
    } catch {
      toast('Link is in the address bar');
    }
  },
  submitEdit(text, lineType) {
    const editing = ui.editing;
    if (!editing || !mapper) return;
    const value = text.trim();
    if (editing.kind === 'node') {
      if (value) mapper.update(editing.id, { text: value, lineType });
      else mapper.remove(editing.id);
    } else {
      mapper.update(editing.id, { type: value });
    }
    ui.editing = null;
  },
  cancelEdit() {
    const editing = ui.editing;
    if (editing?.isNew && mapper) mapper.remove(editing.id);
    ui.editing = null;
  },
  deleteEditing() {
    if (ui.editing && mapper) mapper.remove(ui.editing.id);
    ui.editing = null;
  }
};

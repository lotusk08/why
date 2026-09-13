export const NODE_WIDTH = 200;
export const NODE_MIN_HEIGHT = 56;

export function uid() {
  return Math.random().toString(36).slice(2, 7);
}

export function isEdgeData(data) {
  return data != null && typeof data === 'object' && data.to != null && data.from != null;
}

function refId(value) {
  return value && typeof value === 'object' ? value.id : value;
}

export function placeNode(node, center) {
  node.x = center.x;
  node.y = center.y;
  node.x1 = node.x - node.width / 2;
  node.x2 = node.x + node.width / 2;
  node.y1 = node.y - node.height / 2;
  node.y2 = node.y + node.height / 2;
  return node;
}

export function createNode(data = {}) {
  const node = {
    id: typeof data.id === 'string' && data.id ? data.id : uid(),
    kind: 'node',
    text: typeof data.text === 'string' ? data.text : '',
    lineType: data.lineType === 'dashed' ? 'dashed' : 'solid',
    width: NODE_WIDTH,
    height: NODE_MIN_HEIGHT,
    lines: [],
    focused: false,
    hovering: false,
    x: 0,
    y: 0,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  };
  return placeNode(node, { x: Number(data.x) || 0, y: Number(data.y) || 0 });
}

const LEGACY_TYPES = new Set(['do', 'objection !']);

export function createEdge(data = {}) {
  const from = [data.from]
    .flat(Infinity)
    .map(refId)
    .filter((id) => typeof id === 'string' && id);
  const type = typeof data.type === 'string' && !LEGACY_TYPES.has(data.type.trim()) ? data.type.trim() : '';
  return {
    id: typeof data.id === 'string' && data.id ? data.id : uid(),
    kind: 'edge',
    type,
    from: [...new Set(from)],
    to: refId(data.to),
    paths: [],
    center: null,
    labelAt: null,
    label: null,
    focused: false,
    hovering: false
  };
}

export function exportElement(el) {
  if (el.kind === 'edge') {
    return { id: el.id, type: el.type, from: [...el.from], to: el.to };
  }
  return { id: el.id, text: el.text, x: Math.round(el.x), y: Math.round(el.y), lineType: el.lineType };
}

import { NODE_WIDTH, placeNode } from './element.js';
import { arrowHead, bounds, routeEdge, wrapText } from './layout.js';

export const FONT_SIZE = 15;
export const LINE_HEIGHT = 1.35;
export const PADDING = 12;
export const RADIUS = 6;
export const MIN_HEIGHT = 56;
export const LABEL_SIZE = 13;

const VARIABLES = {
  background: '--main-bg',
  nodeBg: '--canvas-node-bg',
  nodeBorder: '--canvas-node-border',
  nodeText: '--canvas-node-text',
  edge: '--canvas-edge',
  edgeText: '--canvas-edge-text',
  focus: '--canvas-focus',
  hover: '--canvas-hover',
  objection: '--canvas-objection',
  placeholder: '--canvas-placeholder',
  font: '--font-sans',
  serif: '--font-serif'
};

const FALLBACK = {
  background: '#ffffff',
  nodeBg: '#ffffff',
  nodeBorder: '#d4d4d4',
  nodeText: '#4f4f4f',
  edge: '#b3b3b3',
  edgeText: '#868686',
  focus: '#0d6efd',
  hover: '#8e8e8e',
  objection: '#da3633',
  placeholder: '#b5b5b5',
  font: 'sans-serif',
  serif: 'serif'
};

const FONT_KEYS = new Set(['font', 'serif']);

export function readTheme(element) {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden';
  element.appendChild(probe);
  const theme = {};
  for (const [key, name] of Object.entries(VARIABLES)) {
    if (FONT_KEYS.has(key)) {
      probe.style.fontFamily = `var(${name})`;
      theme[key] = getComputedStyle(probe).fontFamily || FALLBACK[key];
    } else {
      probe.style.color = `var(${name})`;
      theme[key] = getComputedStyle(probe).color || FALLBACK[key];
    }
  }
  probe.remove();
  return theme;
}

export function nodeFont(theme) {
  return `${FONT_SIZE}px ${theme.font}`;
}

export function labelFont(theme) {
  return `italic ${LABEL_SIZE}px ${theme.serif}`;
}

export function measureNode(ctx, node, theme) {
  ctx.font = nodeFont(theme);
  node.lines = node.text ? wrapText(ctx, node.text, NODE_WIDTH - PADDING * 2) : [];
  const textHeight = Math.max(1, node.lines.length) * FONT_SIZE * LINE_HEIGHT;
  node.height = Math.max(MIN_HEIGHT, Math.round(textHeight + PADDING * 2));
  placeNode(node, node);
}

export function measureAll(ctx, graph, theme) {
  graph.nodes.forEach((node) => measureNode(ctx, node, theme));
}

export function edgeLabel(edge, graph) {
  return edge.type || (graph.isObjection(edge) ? 'objection' : 'therefore');
}

function drawEdge(ctx, edge, graph, theme, scale) {
  routeEdge(edge, graph);
  if (!edge.paths.length) return;
  const objection = graph.isObjection(edge);
  const active = edge.focused || edge.hovering;
  const color = edge.focused ? theme.focus : edge.hovering ? theme.hover : objection ? theme.objection : theme.edge;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = active ? 2 : 1.5;
  ctx.setLineDash(objection ? [6, 5] : []);
  const last = edge.paths.length - 1;
  const head = arrowHead(edge.paths[last]);
  const base = { x: (head[1].x + head[2].x) / 2, y: (head[1].y + head[2].y) / 2 };
  ctx.beginPath();
  edge.paths.forEach((s, i) => {
    ctx.moveTo(s.x1, s.y1);
    if (i === last) ctx.lineTo(base.x, base.y);
    else ctx.lineTo(s.x2, s.y2);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(head[0].x, head[0].y);
  ctx.lineTo(head[1].x, head[1].y);
  ctx.lineTo(head[2].x, head[2].y);
  ctx.closePath();
  ctx.fill();

  if (edge.from.length > 1) {
    ctx.beginPath();
    ctx.arc(edge.center.x, edge.center.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const text = edgeLabel(edge, graph);
  ctx.font = labelFont(theme);
  const width = ctx.measureText(text).width;
  edge.label = { text, width };
  const pad = 6 / Math.max(scale, 0.5);
  const at = edge.labelAt;
  ctx.clearRect(at.x - width / 2 - pad, at.y - LABEL_SIZE * 0.7, width + pad * 2, LABEL_SIZE * 1.4);
  ctx.fillStyle = active ? color : theme.edgeText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, at.x, at.y);
}

function drawNode(ctx, node, theme) {
  const objection = node.lineType === 'dashed';
  ctx.beginPath();
  ctx.roundRect(node.x1, node.y1, node.width, node.height, RADIUS);
  ctx.fillStyle = theme.nodeBg;
  ctx.fill();
  ctx.lineWidth = node.focused ? 2 : 1;
  ctx.strokeStyle = node.focused
    ? theme.focus
    : node.hovering
      ? theme.hover
      : objection
        ? theme.objection
        : theme.nodeBorder;
  ctx.setLineDash(objection ? [5, 4] : []);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = nodeFont(theme);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = FONT_SIZE * LINE_HEIGHT;
  if (!node.lines.length) {
    ctx.fillStyle = theme.placeholder;
    ctx.fillText('…', node.x, node.y);
    return;
  }
  ctx.fillStyle = theme.nodeText;
  const top = node.y - (node.lines.length * lineHeight) / 2;
  node.lines.forEach((line, i) => ctx.fillText(line, node.x, top + (i + 0.5) * lineHeight, node.width - PADDING));
}

export function paint(ctx, graph, camera, theme, dpr = 1) {
  const k = camera.scale * dpr;
  ctx.setTransform(k, 0, 0, k, camera.offset.x * k, camera.offset.y * k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  measureAll(ctx, graph, theme);
  graph.edges.forEach((edge) => drawEdge(ctx, edge, graph, theme, camera.scale));
  graph.elements.forEach((el) => {
    if (el.kind === 'node') drawNode(ctx, el, theme);
  });
}

export function createView(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'reasons-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Argument map');
  canvas.tabIndex = -1;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  const size = { width: 0, height: 0, dpr: 1 };

  function resize() {
    const rect = container.getBoundingClientRect();
    size.width = Math.max(1, Math.round(rect.width));
    size.height = Math.max(1, Math.round(rect.height));
    size.dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(size.width * size.dpr);
    canvas.height = Math.round(size.height * size.dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
  }

  function render(graph, camera, theme) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paint(ctx, graph, camera, theme, size.dpr);
  }

  function destroy() {
    canvas.remove();
  }

  resize();
  return { canvas, ctx, size, resize, render, destroy };
}

export function renderToBlob(graph, theme, { padding = 48, scale = 2 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  measureAll(ctx, graph, theme);
  const box = bounds(graph.nodes);
  if (!box) return Promise.resolve(null);
  const width = Math.ceil(box.x2 - box.x1 + padding * 2);
  const height = Math.ceil(box.y2 - box.y1 + padding * 2);
  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const camera = { scale: 1, offset: { x: padding - box.x1, y: padding - box.y1 } };
  paint(ctx, graph, camera, theme, scale);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

import { Graph } from './graph.js';
import { placeNode } from './element.js';
import { attachInteraction } from './interaction.js';
import { bounds, edgeHit, nodeContains } from './layout.js';
import { createView, labelFont, measureAll, nodeFont, readTheme, renderToBlob } from './view.js';

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;
const HISTORY_LIMIT = 100;
const FIT_PADDING = 64;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createMapper(container, options) {
  const { onChange, onEdit, onState, onNotice, blocked } = { blocked: () => false, ...options };
  const view = createView(container);
  let theme = readTheme(container);
  let graph = new Graph([]);
  const camera = { scale: 1, offset: { x: 0, y: 0 } };
  const history = { past: [], present: '[]', future: [] };
  let frame = 0;
  let hovered = null;

  function toWorld(clientX, clientY) {
    const rect = view.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / camera.scale - camera.offset.x,
      y: (clientY - rect.top) / camera.scale - camera.offset.y
    };
  }

  function viewportCenter() {
    const rect = view.canvas.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function hit(point) {
    const elements = graph.elements;
    const focused = graph.focused;
    graph.markPairs();
    if (focused?.kind === 'node' && nodeContains(focused, point)) return focused;
    for (let i = elements.length - 1; i >= 0; i--) {
      if (elements[i].kind === 'node' && nodeContains(elements[i], point)) return elements[i];
    }
    for (let i = elements.length - 1; i >= 0; i--) {
      if (elements[i].kind === 'edge' && edgeHit(elements[i], point, 8 / camera.scale)) return elements[i];
    }
    return null;
  }

  function requestDraw() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      view.render(graph, camera, theme);
    });
  }

  function publish() {
    onState?.({
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      scale: camera.scale,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      selected: graph.selected.length,
      focused: graph.focused?.id ?? null
    });
  }

  function snapshot() {
    return JSON.stringify(graph.export());
  }

  function commit() {
    const next = snapshot();
    if (next !== history.present) {
      history.past.push(history.present);
      if (history.past.length > HISTORY_LIMIT) history.past.shift();
      history.present = next;
      history.future = [];
      onChange?.(next);
    }
    publish();
    requestDraw();
  }

  function apply(json) {
    graph = new Graph(JSON.parse(json));
    history.present = json;
    hovered = null;
    onChange?.(json);
    publish();
    requestDraw();
  }

  function undo() {
    if (!history.past.length) return;
    history.future.push(history.present);
    apply(history.past.pop());
  }

  function redo() {
    if (!history.future.length) return;
    history.past.push(history.present);
    apply(history.future.pop());
  }

  function center(box) {
    camera.offset.x = view.size.width / 2 / camera.scale - (box.x1 + box.x2) / 2;
    camera.offset.y = view.size.height / 2 / camera.scale - (box.y1 + box.y2) / 2;
  }

  function fit() {
    view.resize();
    measureAll(view.ctx, graph, theme);
    const box = bounds(graph.nodes);
    if (!box) {
      camera.scale = 1;
      camera.offset.x = view.size.width / 2;
      camera.offset.y = view.size.height / 2;
    } else {
      const width = box.x2 - box.x1 + FIT_PADDING * 2;
      const height = box.y2 - box.y1 + FIT_PADDING * 2;
      camera.scale = clamp(Math.min(view.size.width / width, view.size.height / height), MIN_SCALE, 1);
      center(box);
    }
    publish();
    requestDraw();
  }

  function zoomAt(factor, client) {
    const before = toWorld(client.x, client.y);
    camera.scale = clamp(camera.scale * factor, MIN_SCALE, MAX_SCALE);
    const after = toWorld(client.x, client.y);
    camera.offset.x += after.x - before.x;
    camera.offset.y += after.y - before.y;
    publish();
    requestDraw();
  }

  function pinch(scale, anchor, client) {
    camera.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    const rect = view.canvas.getBoundingClientRect();
    camera.offset.x = (client.x - rect.left) / camera.scale - anchor.x;
    camera.offset.y = (client.y - rect.top) / camera.scale - anchor.y;
    publish();
    requestDraw();
  }

  function setHover(el) {
    if (hovered === el) return;
    if (hovered) hovered.hovering = false;
    hovered = el;
    if (hovered) hovered.hovering = true;
    requestDraw();
  }

  function hover(point) {
    const el = point ? hit(point) : null;
    view.canvas.style.cursor = el ? (el.kind === 'node' ? 'grab' : 'pointer') : '';
    setHover(el);
  }

  function load(elements) {
    graph = new Graph(elements);
    history.past = [];
    history.future = [];
    history.present = snapshot();
    hovered = null;
    fit();
  }

  function find(target) {
    return typeof target === 'string' ? graph.find(target) : target;
  }

  function dropTarget(node) {
    return graph.nodes.find((n) => n !== node && nodeContains(n, node)) || null;
  }

  function describe(el) {
    if (el.kind !== 'edge') return {};
    graph.markPairs();
    return {
      joint: el.from.length > 1,
      twoWay: Boolean(graph.reverseOf(el)),
      merged: el.twoWay || el.mirror,
      parts: el.from.map((id) => ({ id, text: graph.find(id)?.text ?? '' })),
      from: graph.find(el.from[0])?.text ?? '',
      to: graph.find(el.to)?.text ?? ''
    };
  }

  const ctl = {
    camera,
    blocked,
    toWorld,
    hit,
    hover,
    pan(offset) {
      camera.offset.x = offset.x;
      camera.offset.y = offset.y;
      requestDraw();
    },
    pinch,
    zoomAt,
    zoomIn: () => zoomAt(1.2, viewportCenter()),
    zoomOut: () => zoomAt(1 / 1.2, viewportCenter()),
    fit,
    undo,
    redo,
    focused: () => graph.focused,
    focus(el) {
      graph.focus(el);
      publish();
      requestDraw();
    },
    unfocus() {
      graph.unfocus();
      publish();
      requestDraw();
    },
    focusNext() {
      graph.focusNext();
      publish();
      requestDraw();
    },
    focusPrevious() {
      graph.focusPrevious();
      publish();
      requestDraw();
    },
    toggle(el) {
      graph.toggle(el);
      publish();
      requestDraw();
    },
    selectAll() {
      graph.selectAll();
      publish();
      requestDraw();
    },
    hasSelection: () => graph.selected.length > 0,
    removeSelected() {
      const selected = graph.selected;
      if (!selected.length) return;
      hovered = null;
      selected.filter((el) => el.kind === 'node').forEach((node) => graph.remove(node));
      selected.filter((el) => el.kind === 'edge' && graph.elements.includes(el)).forEach((edge) => ctl.remove(edge));
      commit();
    },
    drag(node, position) {
      placeNode(node, position);
      view.canvas.style.cursor = 'grabbing';
      setHover(dropTarget(node));
      requestDraw();
    },
    restore(node, origin) {
      placeNode(node, origin);
      setHover(null);
      requestDraw();
    },
    drop(node, origin) {
      const target = dropTarget(node);
      setHover(null);
      view.canvas.style.cursor = 'grab';
      if (target) {
        const problem = graph.linkProblem(node.id, target.id);
        if (problem) {
          onNotice?.(problem);
        } else {
          const added = graph.add({ from: node.id, to: target.id });
          if (added && graph.reverseOf(added)) onNotice?.('both-ways');
        }
        placeNode(node, origin);
      }
      commit();
    },
    nudge(node, dx, dy) {
      placeNode(node, { x: node.x + dx, y: node.y + dy });
      commit();
    },
    createAt(point) {
      const node = graph.add({ text: '', x: point.x, y: point.y });
      graph.focus(node);
      publish();
      requestDraw();
      onEdit?.(node, true, {});
    },
    edit(el) {
      onEdit?.(el, false, describe(el));
    },
    remove(el) {
      const target = find(el);
      if (!target) return;
      if (hovered === target) hovered = null;
      graph.markPairs();
      const reverse = target.twoWay || target.mirror ? graph.reverseOf(target) : null;
      graph.remove(target);
      if (reverse) graph.remove(reverse);
      commit();
    }
  };

  const detachInteraction = attachInteraction(view.canvas, ctl);
  const observer = new ResizeObserver(() => {
    const before = toWorld(viewportCenter().x, viewportCenter().y);
    view.resize();
    const after = toWorld(viewportCenter().x, viewportCenter().y);
    camera.offset.x += after.x - before.x;
    camera.offset.y += after.y - before.y;
    requestDraw();
  });
  observer.observe(container);

  if (document.fonts?.load) {
    Promise.all([document.fonts.load(nodeFont(theme)), document.fonts.load(labelFont(theme))])
      .then(requestDraw)
      .catch(() => {});
    document.fonts.addEventListener?.('loadingdone', requestDraw);
  }

  return {
    load,
    undo,
    redo,
    fit,
    zoomIn: ctl.zoomIn,
    zoomOut: ctl.zoomOut,
    export: () => graph.export(),
    toJSON: () => history.present,
    find: (id) => graph.find(id),
    update(id, patch) {
      const el = graph.find(id);
      if (!el) return;
      if (el.kind === 'node') {
        if (typeof patch.text === 'string') el.text = patch.text;
        if (patch.lineType) el.lineType = patch.lineType === 'dashed' ? 'dashed' : 'solid';
      } else {
        const kept = patch.direction ? graph.setDirection(el, patch.direction) : el;
        if (typeof patch.type === 'string') {
          kept.type = patch.type;
          const reverse = graph.reverseOf(kept);
          if (reverse) reverse.type = patch.type;
        }
      }
      commit();
    },
    remove: ctl.remove,
    clear() {
      if (!graph.elements.length) return;
      graph = new Graph([]);
      hovered = null;
      commit();
    },
    detach(id, sourceId) {
      const edge = graph.find(id);
      if (!edge) return {};
      graph.detach(edge, sourceId);
      commit();
      return describe(edge);
    },
    refreshTheme() {
      theme = readTheme(container);
      requestDraw();
    },
    toPNG: () => renderToBlob(graph, theme),
    destroy() {
      detachInteraction();
      observer.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', requestDraw);
      if (frame) cancelAnimationFrame(frame);
      view.destroy();
    }
  };
}

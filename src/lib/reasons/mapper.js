import { Graph } from './graph.js';
import { NODE_MIN_HEIGHT, NODE_WIDTH, nodeColor, placeNode } from './element.js';
import { attachInteraction } from './interaction.js';
import { bounds, edgeHit, nodeContains } from './layout.js';
import { easeOut, reducedMotion } from './motion.js';
import { createView, labelFont, measureAll, nodeFont, readTheme, renderToBlob, renderToSvg } from './view.js';

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const HISTORY_LIMIT = 100;
const FIT_PADDING = 64;
const REVEAL_MARGIN = 48;
const GLIDE_MS = 280;
const FADE_MS = 240;
const SPOT_STEP = { x: NODE_WIDTH + 100, y: NODE_MIN_HEIGHT + 84 };
const SPOT_CLEARANCE = 24;

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
  let linkFrom = null;
  let glide = 0;
  let heading = null;

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

  function remeasure() {
    graph.nodes.forEach((node) => (node.measured = null));
    requestDraw();
  }

  function requestDraw() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      view.render(graph, camera, theme, linkPreview());
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
    linkFrom = null;
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

  function centered(point, scale) {
    return {
      scale,
      offset: { x: view.size.width / 2 / scale - point.x, y: view.size.height / 2 / scale - point.y }
    };
  }

  function middleOf(cam) {
    return { x: view.size.width / 2 / cam.scale - cam.offset.x, y: view.size.height / 2 / cam.scale - cam.offset.y };
  }

  function stopGlide() {
    if (glide) cancelAnimationFrame(glide);
    glide = 0;
    heading = null;
  }

  function settle(target) {
    camera.scale = target.scale;
    camera.offset.x = target.offset.x;
    camera.offset.y = target.offset.y;
    publish();
    requestDraw();
  }

  function moveCamera(target, animate) {
    stopGlide();
    if (!animate || reducedMotion()) {
      settle(target);
      return;
    }
    heading = target;
    const from = { scale: camera.scale, middle: middleOf(camera) };
    const to = { scale: target.scale, middle: middleOf(target) };
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / GLIDE_MS);
      if (t === 1) {
        glide = 0;
        heading = null;
        settle(target);
        return;
      }
      const k = easeOut(t);
      const scale = from.scale + (to.scale - from.scale) * k;
      const middle = {
        x: from.middle.x + (to.middle.x - from.middle.x) * k,
        y: from.middle.y + (to.middle.y - from.middle.y) * k
      };
      Object.assign(camera, centered(middle, scale));
      view.render(graph, camera, theme, linkPreview());
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  }

  function fadeIn() {
    view.canvas.animate?.([{ opacity: 0 }, { opacity: 1 }], {
      duration: reducedMotion() ? 0 : FADE_MS,
      easing: 'ease-out'
    });
  }

  function fit(animate = false) {
    view.resize();
    measureAll(view.ctx, graph, theme);
    const box = bounds(graph.nodes);
    if (!box) {
      moveCamera({ scale: 1, offset: { x: view.size.width / 2, y: view.size.height / 2 } }, animate);
      return;
    }
    const width = box.x2 - box.x1 + FIT_PADDING * 2;
    const height = box.y2 - box.y1 + FIT_PADDING * 2;
    const scale = clamp(Math.min(view.size.width / width, view.size.height / height), MIN_SCALE, 1);
    moveCamera(centered({ x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 }, scale), animate);
  }

  function zoomBy(factor) {
    const goal = heading ?? camera;
    moveCamera(centered(middleOf(goal), clamp(goal.scale * factor, MIN_SCALE, MAX_SCALE)), true);
  }

  function zoomAt(factor, client) {
    stopGlide();
    const before = toWorld(client.x, client.y);
    camera.scale = clamp(camera.scale * factor, MIN_SCALE, MAX_SCALE);
    const after = toWorld(client.x, client.y);
    camera.offset.x += after.x - before.x;
    camera.offset.y += after.y - before.y;
    publish();
    requestDraw();
  }

  function pinch(scale, anchor, client) {
    stopGlide();
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
    linkFrom = null;
    fit();
    fadeIn();
  }

  function reveal(el) {
    const point = el?.kind === 'node' ? el : el?.center;
    if (!point) return;
    const x = (point.x + camera.offset.x) * camera.scale;
    const y = (point.y + camera.offset.y) * camera.scale;
    const { width, height } = view.size;
    if (x >= REVEAL_MARGIN && y >= REVEAL_MARGIN && x <= width - REVEAL_MARGIN && y <= height - REVEAL_MARGIN) return;
    moveCamera(centered(point, camera.scale), true);
  }

  function isFree(point) {
    return graph.nodes.every(
      (n) =>
        Math.abs(n.x - point.x) >= (n.width + NODE_WIDTH) / 2 + SPOT_CLEARANCE ||
        Math.abs(n.y - point.y) >= (n.height + NODE_MIN_HEIGHT) / 2 + SPOT_CLEARANCE
    );
  }

  function freeSpot(origin, includeOrigin) {
    const steps = [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: 0 }
    ];
    const spots = includeOrigin ? [{ x: origin.x, y: origin.y }] : [];
    for (let ring = 1; ring <= 3; ring++) {
      steps.forEach((step) =>
        spots.push({ x: origin.x + step.x * SPOT_STEP.x * ring, y: origin.y + step.y * SPOT_STEP.y * ring })
      );
    }
    return spots.find(isFree) ?? spots[includeOrigin ? 1 : 0];
  }

  function link(source, target) {
    const problem = graph.linkProblem(source.id, target.id);
    if (problem) {
      onNotice?.(problem);
      return;
    }
    const added = graph.add({ from: source.id, to: target.id });
    if (added && graph.reverseOf(added)) onNotice?.('both-ways');
  }

  function linkPreview() {
    const target = graph.focused;
    return linkFrom && target?.kind === 'node' && target !== linkFrom ? { from: linkFrom, to: target } : null;
  }

  function pickLink(step) {
    const candidates = graph.nodes
      .filter((n) => n !== linkFrom)
      .sort((a, b) => Math.hypot(a.x - linkFrom.x, a.y - linkFrom.y) - Math.hypot(b.x - linkFrom.x, b.y - linkFrom.y));
    if (!candidates.length) {
      linkFrom = null;
      onNotice?.('link-alone');
      return;
    }
    const index = candidates.indexOf(graph.focused);
    const start = index === -1 ? (step > 0 ? -1 : 0) : index;
    const next = candidates[(start + step + candidates.length) % candidates.length];
    graph.focus(next);
    reveal(next);
    publish();
    requestDraw();
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
      stopGlide();
      camera.offset.x = offset.x;
      camera.offset.y = offset.y;
      requestDraw();
    },
    panBy(dx, dy) {
      stopGlide();
      camera.offset.x -= dx / camera.scale;
      camera.offset.y -= dy / camera.scale;
      requestDraw();
    },
    pinch,
    zoomAt,
    zoomIn: () => zoomBy(1.2),
    zoomOut: () => zoomBy(1 / 1.2),
    fit: () => fit(true),
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
      reveal(graph.focusNext());
      publish();
      requestDraw();
    },
    focusPrevious() {
      reveal(graph.focusPrevious());
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
        link(node, target);
        placeNode(node, origin);
      }
      commit();
    },
    linking: () => linkFrom,
    startLink() {
      const source = graph.focused;
      if (source?.kind !== 'node') {
        onNotice?.('link-none');
        return;
      }
      linkFrom = source;
      onNotice?.('link-start');
      pickLink(1);
    },
    pickLink,
    finishLink() {
      const target = graph.focused;
      if (linkFrom && target?.kind === 'node' && target !== linkFrom) {
        link(linkFrom, target);
        linkFrom = null;
        commit();
      }
    },
    cancelLink() {
      if (!linkFrom) return;
      graph.focus(linkFrom);
      linkFrom = null;
      publish();
      requestDraw();
    },
    nudge(node, dx, dy) {
      placeNode(node, { x: node.x + dx, y: node.y + dy });
      commit();
    },
    createNear() {
      const anchor = graph.focused?.kind === 'node' ? graph.focused : null;
      const middle = viewportCenter();
      ctl.createAt(freeSpot(anchor ?? toWorld(middle.x, middle.y), !anchor));
    },
    createAt(point) {
      const node = graph.add({ text: '', x: point.x, y: point.y });
      graph.focus(node);
      reveal(node);
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
    stopGlide();
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
      .then(remeasure)
      .catch(() => {});
    document.fonts.addEventListener?.('loadingdone', remeasure);
  }

  return {
    load,
    undo,
    redo,
    fit: ctl.fit,
    zoomIn: ctl.zoomIn,
    zoomOut: ctl.zoomOut,
    export: () => graph.export(),
    focusMap: () => view.canvas.focus({ preventScroll: true }),
    toJSON: () => history.present,
    find: (id) => graph.find(id),
    update(id, patch) {
      const el = graph.find(id);
      if (!el) return;
      if (el.kind === 'node') {
        if (typeof patch.text === 'string') el.text = patch.text;
        if (patch.lineType) el.lineType = patch.lineType === 'dashed' ? 'dashed' : 'solid';
        if (typeof patch.color === 'string') el.color = nodeColor(patch.color);
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
    replace(elements) {
      graph = new Graph(elements);
      hovered = null;
      commit();
      fit(true);
      fadeIn();
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
    toPNG: () => renderToBlob(new Graph(graph.export()), theme),
    toSVG: () => renderToSvg(new Graph(graph.export()), theme),
    destroy() {
      stopGlide();
      detachInteraction();
      observer.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', remeasure);
      if (frame) cancelAnimationFrame(frame);
      view.destroy();
    }
  };
}

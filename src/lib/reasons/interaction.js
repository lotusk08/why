const TAP_SLOP = 6;
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_DISTANCE = 24;
const SWIPE_DISTANCE = 80;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function typing() {
  const el = document.activeElement;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el instanceof HTMLElement && el.isContentEditable);
}

export function attachInteraction(canvas, ctl) {
  const pointers = new Map();
  let gesture = null;
  let lastTap = { time: -Infinity, x: 0, y: 0 };

  function client(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function capture(pointerId) {
    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      return;
    }
  }

  function release(pointerId) {
    try {
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    } catch {
      return;
    }
  }

  function cancelDrag() {
    if (gesture?.type === 'drag') ctl.restore(gesture.node, gesture.origin);
  }

  function onPointerDown(e) {
    if (ctl.blocked()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    pointers.set(e.pointerId, { ...client(e), start: client(e) });
    capture(e.pointerId);
    if (typeof canvas.focus === 'function' && !typing()) canvas.focus({ preventScroll: true });

    if (pointers.size === 2) {
      cancelDrag();
      const [a, b] = [...pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture = {
        type: 'pinch',
        distance: distance(a, b),
        anchor: ctl.toWorld(mid.x, mid.y),
        scale: ctl.camera.scale
      };
      return;
    }
    if (pointers.size > 2) {
      gesture = { type: 'swipe', startX: [...pointers.values()].reduce((sum, p) => sum + p.x, 0) / pointers.size };
      return;
    }

    const now = performance.now();
    const point = client(e);
    const world = ctl.toWorld(point.x, point.y);
    const doubleTap = now - lastTap.time < DOUBLE_TAP_MS && distance(lastTap, point) < DOUBLE_TAP_DISTANCE;
    lastTap = { time: now, ...point };
    const hit = ctl.hit(world);

    if (doubleTap) {
      lastTap.time = -Infinity;
      gesture = { type: 'none' };
      if (hit) ctl.edit(hit);
      else ctl.createAt(world);
      return;
    }

    if (hit?.kind === 'node') {
      gesture = {
        type: 'drag',
        node: hit,
        origin: { x: hit.x, y: hit.y },
        grab: { x: hit.x - world.x, y: hit.y - world.y },
        moved: false
      };
      ctl.focus(hit);
    } else if (hit) {
      gesture = { type: 'select', element: hit };
      ctl.focus(hit);
    } else {
      gesture = { type: 'pan', offset: { ...ctl.camera.offset }, moved: false };
    }
  }

  function onPointerMove(e) {
    const pointer = pointers.get(e.pointerId);
    if (!pointer) {
      if (e.pointerType === 'mouse' && !ctl.blocked()) ctl.hover(ctl.toWorld(e.clientX, e.clientY));
      return;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!gesture) return;

    if (gesture.type === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      ctl.pinch(gesture.scale * (distance(a, b) / gesture.distance), gesture.anchor, mid);
      return;
    }

    const moved = distance(pointer.start, pointer) >= TAP_SLOP;
    if (gesture.type === 'drag') {
      if (!gesture.moved && !moved) return;
      gesture.moved = true;
      const world = ctl.toWorld(e.clientX, e.clientY);
      ctl.drag(gesture.node, { x: world.x + gesture.grab.x, y: world.y + gesture.grab.y });
    } else if (gesture.type === 'pan') {
      if (!gesture.moved && !moved) return;
      gesture.moved = true;
      ctl.pan({
        x: gesture.offset.x + (pointer.x - pointer.start.x) / ctl.camera.scale,
        y: gesture.offset.y + (pointer.y - pointer.start.y) / ctl.camera.scale
      });
    }
  }

  function onPointerUp(e) {
    const pointer = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    release(e.pointerId);
    if (!gesture || !pointer) return;

    if (gesture.type === 'swipe') {
      if (pointers.size === 0) {
        const delta = e.clientX - gesture.startX;
        if (Math.abs(delta) > SWIPE_DISTANCE) {
          if (delta < 0) ctl.undo();
          else ctl.redo();
        }
        gesture = null;
      }
      return;
    }
    if (gesture.type === 'pinch') {
      if (pointers.size === 0) gesture = null;
      return;
    }
    if (pointers.size > 0) return;

    if (gesture.type === 'drag' && gesture.moved) {
      ctl.drop(gesture.node, gesture.origin);
    } else if (gesture.type === 'pan' && !gesture.moved) {
      ctl.unfocus();
    }
    gesture = null;
    ctl.hover(ctl.toWorld(e.clientX, e.clientY));
  }

  function onPointerCancel(e) {
    pointers.delete(e.pointerId);
    if (gesture?.type === 'drag') ctl.restore(gesture.node, gesture.origin);
    if (pointers.size === 0) gesture = null;
  }

  function onWheel(e) {
    if (ctl.blocked()) return;
    e.preventDefault();
    const step = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 0.5 : 0.0015;
    ctl.zoomAt(Math.exp(-e.deltaY * step), client(e));
  }

  function onKeyDown(e) {
    if (ctl.blocked() || typing()) return;
    const meta = e.metaKey || e.ctrlKey;
    const key = e.key;

    if (meta && key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) ctl.redo();
      else ctl.undo();
      return;
    }
    if (meta && key.toLowerCase() === 'y') {
      e.preventDefault();
      ctl.redo();
      return;
    }
    if (meta) return;

    switch (key) {
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) ctl.focusPrevious();
        else ctl.focusNext();
        break;
      case 'Enter':
        if (ctl.focused()) {
          e.preventDefault();
          ctl.edit(ctl.focused());
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (ctl.focused()) {
          e.preventDefault();
          ctl.remove(ctl.focused());
        }
        break;
      case 'Escape':
        ctl.unfocus();
        break;
      case '+':
      case '=':
        ctl.zoomIn();
        break;
      case '-':
      case '_':
        ctl.zoomOut();
        break;
      case '0':
        ctl.fit();
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        const focused = ctl.focused();
        if (focused?.kind !== 'node') break;
        e.preventDefault();
        const step = e.shiftKey ? 40 : 10;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        ctl.nudge(focused, dx, dy);
        break;
      }
      default:
        break;
    }
  }

  function onLeave() {
    if (!gesture) ctl.hover(null);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', (e) => e.preventDefault());
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
  };
}

export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function boundaryPoint(from, rect, buffer = 0) {
  const dx = from.x - rect.x;
  const dy = from.y - rect.y;
  if (!dx && !dy) return { x: rect.x, y: rect.y1 - buffer };
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const tx = ux ? rect.width / 2 / Math.abs(ux) : Infinity;
  const ty = uy ? rect.height / 2 / Math.abs(uy) : Infinity;
  const t = Math.min(tx, ty) + buffer;
  return { x: rect.x + ux * t, y: rect.y + uy * t };
}

export function routeEdge(edge, graph) {
  const sources = edge.from.map((id) => graph.find(id)).filter((n) => n && n.kind === 'node');
  const target = graph.find(edge.to);
  if (!sources.length || !target || target.kind !== 'node') {
    edge.paths = [];
    edge.center = null;
    return;
  }
  const all = [...sources, target];
  const xs = all.map((n) => n.x);
  const ys = all.map((n) => n.y);
  const center = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2
  };
  edge.center = center;
  edge.paths = sources.map((n) => ({ x1: n.x, y1: n.y, x2: center.x, y2: center.y }));
  const end = boundaryPoint(center, target, 6);
  edge.paths.push({ x1: center.x, y1: center.y, x2: end.x, y2: end.y });
}

export function arrowHead(segment, size = 9) {
  const angle = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
  return [
    { x: segment.x2, y: segment.y2 },
    { x: segment.x2 - size * Math.cos(angle - 0.45), y: segment.y2 - size * Math.sin(angle - 0.45) },
    { x: segment.x2 - size * Math.cos(angle + 0.45), y: segment.y2 - size * Math.sin(angle + 0.45) }
  ];
}

export function distanceToSegment(p, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared ? ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / lengthSquared : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (s.x1 + t * dx), p.y - (s.y1 + t * dy));
}

export function nodeContains(node, p) {
  return p.x >= node.x1 && p.x <= node.x2 && p.y >= node.y1 && p.y <= node.y2;
}

export function rectsOverlap(a, b) {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
}

export function edgeHit(edge, p, tolerance) {
  if (!edge.center) return false;
  if (edge.label) {
    const halfWidth = edge.label.width / 2 + 4;
    if (Math.abs(p.x - edge.center.x) <= halfWidth && Math.abs(p.y - edge.center.y) <= 10) return true;
  }
  return edge.paths.some((segment) => distanceToSegment(p, segment) <= tolerance);
}

export function bounds(nodes) {
  if (!nodes.length) return null;
  return nodes.reduce(
    (box, n) => ({
      x1: Math.min(box.x1, n.x1),
      y1: Math.min(box.y1, n.y1),
      x2: Math.max(box.x2, n.x2),
      y2: Math.max(box.y2, n.y2)
    }),
    { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
  );
}

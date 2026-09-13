import { describe, expect, it } from 'vitest';
import {
  boundaryPoint,
  bounds,
  distanceToSegment,
  edgeHit,
  nodeContains,
  rectsOverlap,
  routeEdge,
  wrapText
} from '../../src/lib/reasons/layout.js';
import { Graph } from '../../src/lib/reasons/graph.js';

const ctx = { measureText: (text) => ({ width: text.length * 7 }) };

describe('wrapText', () => {
  it('wraps on word boundaries within the width', () => {
    expect(wrapText(ctx, 'one two three four', 70)).toEqual(['one two', 'three four']);
  });

  it('keeps explicit line breaks and long words', () => {
    expect(wrapText(ctx, 'a\nb', 100)).toEqual(['a', 'b']);
    expect(wrapText(ctx, 'supercalifragilistic short', 70)).toEqual(['supercalifragilistic', 'short']);
    expect(wrapText(ctx, '', 70)).toEqual(['']);
  });
});

describe('geometry', () => {
  it('measures distance to a segment', () => {
    const segment = { x1: 0, y1: 0, x2: 10, y2: 0 };
    expect(distanceToSegment({ x: 5, y: 3 }, segment)).toBe(3);
    expect(distanceToSegment({ x: 15, y: 0 }, segment)).toBe(5);
    expect(distanceToSegment({ x: 0, y: 0 }, { x1: 1, y1: 1, x2: 1, y2: 1 })).toBeCloseTo(Math.SQRT2);
  });

  it('finds where a line leaves a rectangle', () => {
    const rect = { x: 0, y: 0, x1: -50, y1: -25, width: 100, height: 50 };
    expect(boundaryPoint({ x: 0, y: -200 }, rect, 0)).toEqual({ x: 0, y: -25 });
    expect(boundaryPoint({ x: 300, y: 0 }, rect, 5)).toEqual({ x: 55, y: 0 });
    expect(boundaryPoint({ x: 0, y: 0 }, rect, 0)).toEqual({ x: 0, y: -25 });
  });

  it('tests rectangle overlap and containment', () => {
    const a = { x1: 0, y1: 0, x2: 10, y2: 10 };
    expect(rectsOverlap(a, { x1: 5, y1: 5, x2: 20, y2: 20 })).toBe(true);
    expect(rectsOverlap(a, { x1: 11, y1: 0, x2: 20, y2: 10 })).toBe(false);
    expect(nodeContains(a, { x: 5, y: 5 })).toBe(true);
    expect(nodeContains(a, { x: 15, y: 5 })).toBe(false);
  });

  it('computes bounds of nodes', () => {
    expect(bounds([])).toBeNull();
    expect(
      bounds([
        { x1: -1, y1: 2, x2: 3, y2: 4 },
        { x1: 0, y1: -5, x2: 1, y2: 1 }
      ])
    ).toEqual({ x1: -1, y1: -5, x2: 3, y2: 4 });
  });
});

describe('routeEdge', () => {
  it('routes joint premises through a shared centre point into the target', () => {
    const graph = new Graph([
      { id: 'a', text: 'A', x: -200, y: -200 },
      { id: 'b', text: 'B', x: 200, y: -200 },
      { id: 'c', text: 'C', x: 0, y: 200 },
      { id: 'e', from: ['a', 'b'], to: 'c' }
    ]);
    const edge = graph.edges[0];
    routeEdge(edge, graph);
    const half = graph.find('c').height / 2;
    const entry = 200 - half - 1;
    expect(edge.center).toEqual({ x: 0, y: entry - 64 });
    expect(edge.paths).toHaveLength(3);
    const first = edge.paths[0];
    expect(first.x1).toBeGreaterThan(-200);
    expect(first.y1).toBeGreaterThan(-200);
    expect(first.x2).toBe(0);
    expect(first.y2).toBe(entry - 64);
    const last = edge.paths[2];
    expect(last).toEqual({ x1: 0, y1: entry - 64, x2: 0, y2: entry });
    expect(edge.labelAt).toEqual(edge.center);
    expect(edge.labelSide).toEqual({ x: 1, y: 0 });
    const onPath = { x: -100, y: (-200 + (entry - 64)) / 2 };
    expect(edgeHit(edge, onPath, 4)).toBe(true);
    expect(edgeHit(edge, { x: 150, y: 150 }, 4)).toBe(false);
  });

  it('keeps the stem short when the premises sit close to the conclusion', () => {
    const graph = new Graph([
      { id: 'a', text: 'A', x: -120, y: -40 },
      { id: 'b', text: 'B', x: 120, y: -40 },
      { id: 'c', text: 'C', x: 0, y: 60 },
      { id: 'e', from: ['a', 'b'], to: 'c' }
    ]);
    const edge = graph.edges[0];
    routeEdge(edge, graph);
    const entry = 60 - graph.find('c').height / 2 - 1;
    expect(entry + 40).toBeLessThan(128);
    expect(edge.center.y).toBeCloseTo(entry - (entry + 40) / 2);
  });

  it('routes a single premise border to border with the label in the middle', () => {
    const graph = new Graph([
      { id: 'a', text: 'A', x: 0, y: -200 },
      { id: 'c', text: 'C', x: 0, y: 200 },
      { id: 'e', from: 'a', to: 'c' }
    ]);
    const edge = graph.edges[0];
    routeEdge(edge, graph);
    const half = graph.find('a').height / 2;
    expect(edge.paths).toEqual([{ x1: 0, y1: -200 + half, x2: 0, y2: 200 - half - 1 }]);
    expect(edge.labelAt).toEqual({ x: 0, y: -0.5 });
    expect(edge.center).toEqual(edge.labelAt);
  });

  it('offsets an objection and its support onto parallel lanes', () => {
    const graph = new Graph([
      { id: 'o', text: 'No', x: 0, y: -200, lineType: 'dashed' },
      { id: 'c', text: 'C', x: 0, y: 200 },
      { id: 'e', from: 'o', to: 'c' },
      { id: 'f', from: 'c', to: 'o' }
    ]);
    const [objection, support] = graph.markPairs();
    routeEdge(objection, graph);
    routeEdge(support, graph);
    expect(objection.paths[0].x1).toBe(-7);
    expect(objection.paths[0].x2).toBe(-7);
    expect(support.paths[0].x1).toBe(7);
    expect(support.paths[0].x2).toBe(7);
    expect(objection.paths[0].y1).toBeLessThan(support.paths[0].y1);
    expect(objection.labelAt.y).toBeLessThan(0);
    expect(support.labelAt.y).toBeGreaterThan(0);
    expect(edgeHit(support, { x: 7, y: 100 }, 4)).toBe(true);
    expect(edgeHit(objection, { x: 7, y: 100 }, 4)).toBe(false);
  });

  it('leaves room for an arrowhead at both ends of a two-way link', () => {
    const graph = new Graph([
      { id: 'a', text: 'A', x: 0, y: -200 },
      { id: 'c', text: 'C', x: 0, y: 200 },
      { id: 'e', from: 'a', to: 'c' },
      { id: 'f', from: 'c', to: 'a' }
    ]);
    const [forward, backward] = graph.markPairs();
    routeEdge(forward, graph);
    const half = graph.find('a').height / 2;
    expect(forward.paths).toEqual([{ x1: 0, y1: -200 + half + 1, x2: 0, y2: 200 - half - 1 }]);
    expect(edgeHit(backward, { x: 0, y: 0 }, 4)).toBe(false);
    expect(edgeHit(forward, { x: 0, y: 0 }, 4)).toBe(true);
  });

  it('clears paths when an endpoint is missing', () => {
    const graph = new Graph([{ id: 'a', text: 'A', x: 0, y: 0 }]);
    const edge = { kind: 'edge', from: ['a'], to: 'ghost', paths: [{}], center: { x: 1, y: 1 } };
    routeEdge(edge, graph);
    expect(edge.paths).toEqual([]);
    expect(edge.center).toBeNull();
  });
});

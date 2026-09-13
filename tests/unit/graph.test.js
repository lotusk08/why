import { describe, expect, it } from 'vitest';
import { Graph } from '../../src/lib/reasons/graph.js';

const base = () => [
  { id: 'a', text: 'A', x: 0, y: 0 },
  { id: 'b', text: 'B', x: 100, y: 0 },
  { id: 'c', text: 'C', x: 50, y: 100 }
];

describe('Graph', () => {
  it('adds nodes before edges regardless of input order', () => {
    const graph = new Graph([{ from: 'a', to: 'c' }, ...base()]);
    expect(graph.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toEqual(['a']);
  });

  it('ignores edges that reference unknown nodes, itself, or duplicates', () => {
    const graph = new Graph(base());
    expect(graph.add({ from: 'a', to: 'zzz' })).toBeNull();
    expect(graph.add({ from: 'a', to: 'a' })).toBeNull();
    expect(graph.add({ from: 'a', to: 'c' })).not.toBeNull();
    expect(graph.add({ from: 'a', to: 'c' })).toBeNull();
    expect(graph.edges).toHaveLength(1);
  });

  it('links two ideas both ways and pairs the two links', () => {
    const graph = new Graph(base());
    const forward = graph.add({ from: 'a', to: 'c' });
    const backward = graph.add({ from: 'c', to: 'a' });
    expect(graph.edges).toHaveLength(2);
    expect(graph.reverseOf(forward)).toBe(backward);
    graph.markPairs();
    expect(forward.twoWay).toBe(true);
    expect(backward.mirror).toBe(true);
    expect(graph.visible).not.toContain(backward);
    expect(graph.linkProblem('c', 'a')).toBe('duplicate');
  });

  it('allows longer circles of support', () => {
    const graph = new Graph(base());
    graph.add({ from: 'a', to: 'b' });
    graph.add({ from: 'b', to: 'c' });
    expect(graph.add({ from: 'c', to: 'a' })).not.toBeNull();
    expect(graph.edges).toHaveLength(3);
    expect(graph.linkProblem('a', 'a')).toBe('self');
    expect(graph.linkProblem('a', 'ghost')).toBe('missing');
  });

  it('turns a link around or makes it go both ways', () => {
    const graph = new Graph(base());
    const link = graph.add({ from: 'a', to: 'c', type: 'so' });
    expect(graph.setDirection(link, 'both')).toBe(link);
    expect(graph.edges).toHaveLength(2);
    expect(graph.reverseOf(link).type).toBe('so');
    expect(graph.setDirection(link, 'forward')).toBe(link);
    expect(graph.edges).toHaveLength(1);
    const turned = graph.setDirection(link, 'backward');
    expect(graph.edges).toEqual([turned]);
    expect(turned.from).toEqual(['c']);
    expect(turned.to).toBe('a');
  });

  it('does not join premises when a link is only turned around', () => {
    const graph = new Graph([...base(), { id: 'd', text: 'D', x: 0, y: 200 }]);
    const link = graph.add({ from: 'a', to: 'b' });
    graph.add({ from: 'a', to: 'd' });
    graph.add({ from: 'b', to: 'd' });
    graph.setDirection(link, 'both');
    expect(graph.edges).toHaveLength(4);
    expect(graph.children('a').sort()).toEqual(['b', 'd']);
    expect(graph.children('b').sort()).toEqual(['a', 'd']);
  });

  it('keeps both directions from saved data', () => {
    const graph = new Graph([...base(), { from: 'a', to: 'c' }, { from: 'c', to: 'a' }]);
    expect(graph.edges).toHaveLength(2);
  });

  it('cycles focus forwards and backwards', () => {
    const graph = new Graph(base());
    expect(graph.focused).toBeNull();
    expect(graph.focusNext().id).toBe('a');
    expect(graph.focusNext().id).toBe('b');
    expect(graph.focusNext().id).toBe('c');
    expect(graph.focusNext().id).toBe('a');
    expect(graph.focusPrevious().id).toBe('c');
    expect(graph.focusPrevious().id).toBe('b');
    graph.unfocus();
    expect(graph.focused).toBeNull();
    expect(graph.elements.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('skips the hidden half of a two-way link when cycling focus', () => {
    const graph = new Graph(base());
    const forward = graph.add({ from: 'a', to: 'c' });
    const backward = graph.add({ from: 'c', to: 'a' });
    const seen = [];
    for (let i = 0; i < 4; i++) seen.push(graph.focusNext());
    expect(seen).toContain(forward);
    expect(seen).not.toContain(backward);
  });

  it('keeps the export stable while focus moves', () => {
    const graph = new Graph(base());
    const before = JSON.stringify(graph.export());
    graph.focus(graph.find('c'));
    graph.focusNext();
    graph.focusPrevious();
    expect(JSON.stringify(graph.export())).toBe(before);
  });

  it('exports round-trippable data and normalises legacy labels', () => {
    const graph = new Graph([...base(), { id: 'e', type: 'do', from: ['a', 'b'], to: 'c' }]);
    const data = graph.export();
    expect(data).toHaveLength(4);
    expect(data[3]).toEqual({ id: 'e', type: '', from: ['a', 'b'], to: 'c' });
    expect(data[0]).toEqual({ id: 'a', text: 'A', x: 0, y: 0, lineType: 'solid' });
    const copy = new Graph(JSON.parse(JSON.stringify(data)));
    expect(copy.export()).toEqual(data);
  });

  it('flags an edge from a dashed premise as an objection', () => {
    const graph = new Graph([{ id: 'o', text: 'No', x: 0, y: 0, lineType: 'dashed' }, ...base()]);
    const objection = graph.add({ from: 'o', to: 'c' });
    const support = graph.add({ from: 'a', to: 'c' });
    expect(graph.isObjection(objection)).toBe(true);
    expect(graph.isObjection(support)).toBe(false);
  });

  it('generates unique ids for nodes without one', () => {
    const graph = new Graph([
      { text: 'x', x: 0, y: 0 },
      { text: 'y', x: 0, y: 0 }
    ]);
    const [a, b] = graph.nodes;
    expect(a.id).not.toBe(b.id);
    expect(a.id).toHaveLength(5);
  });
});

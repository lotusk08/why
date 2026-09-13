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

  it('never links two ideas in both directions', () => {
    const graph = new Graph(base());
    graph.add({ from: 'a', to: 'c' });
    expect(graph.linkProblem('c', 'a')).toBe('cycle');
    expect(graph.add({ from: 'c', to: 'a' })).toBeNull();
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toEqual(['a']);
  });

  it('refuses links that would argue in a circle', () => {
    const graph = new Graph(base());
    graph.add({ from: 'a', to: 'b' });
    graph.add({ from: 'b', to: 'c' });
    expect(graph.linkProblem('c', 'a')).toBe('cycle');
    expect(graph.add({ from: 'c', to: 'a' })).toBeNull();
    graph.add({ from: ['a', 'b'], to: 'c' });
    expect(graph.linkProblem('c', 'b')).toBe('cycle');
    expect(graph.linkProblem('a', 'c')).toBe('duplicate');
    expect(graph.linkProblem('a', 'a')).toBe('self');
    expect(graph.linkProblem('a', 'ghost')).toBe('missing');
  });

  it('keeps only the first direction when saved data holds both', () => {
    const graph = new Graph([...base(), { from: 'a', to: 'c' }, { from: 'c', to: 'a' }]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].to).toBe('c');
  });

  it('refuses an edge that starts or ends on another edge', () => {
    const graph = new Graph(base());
    const edge = graph.add({ from: 'a', to: 'c' });
    expect(graph.add({ from: 'b', to: edge.id })).toBeNull();
    expect(graph.add({ from: edge.id, to: 'b' })).toBeNull();
  });

  it('joins two premises that support the same conclusion', () => {
    const graph = new Graph(base());
    graph.add({ from: 'a', to: 'c' });
    graph.add({ from: 'b', to: 'c' });
    const merged = graph.add({ from: 'a', to: 'b' });
    expect(graph.edges).toHaveLength(1);
    expect(merged.to).toBe('c');
    expect([...merged.from].sort()).toEqual(['a', 'b']);
  });

  it('keeps unrelated support when premises are joined', () => {
    const graph = new Graph([...base(), { id: 'd', text: 'D', x: 0, y: 200 }]);
    graph.add({ from: 'a', to: 'c' });
    graph.add({ from: 'b', to: 'c' });
    graph.add({ from: 'a', to: 'd' });
    graph.add({ from: 'a', to: 'b' });
    expect(graph.edges).toHaveLength(2);
    expect(graph.children('a').sort()).toEqual(['c', 'd']);
  });

  it('creates a chain when the target has no shared conclusion', () => {
    const graph = new Graph(base());
    graph.add({ from: 'a', to: 'c' });
    const chain = graph.add({ from: 'b', to: 'a' });
    expect(chain.from).toEqual(['b']);
    expect(graph.edges).toHaveLength(2);
    expect(graph.parents('a')).toEqual(['b']);
  });

  it('removes a node together with its edges and prunes joint premises', () => {
    const graph = new Graph(base());
    graph.add({ from: ['a', 'b'], to: 'c' });
    graph.remove(graph.find('a'));
    expect(graph.nodes.map((n) => n.id)).toEqual(['b', 'c']);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toEqual(['b']);
    graph.remove(graph.find('c'));
    expect(graph.edges).toHaveLength(0);
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

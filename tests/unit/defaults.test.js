import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP } from '../../src/lib/defaults.js';
import { Graph } from '../../src/lib/reasons/graph.js';
import { validateMap } from '../../src/lib/share.js';

describe('demo map', () => {
  it('is a valid map', () => {
    expect(validateMap(DEFAULT_MAP)).toEqual(DEFAULT_MAP);
  });

  it('keeps every idea and link when loaded', () => {
    const graph = new Graph(DEFAULT_MAP);
    expect(graph.nodes).toHaveLength(DEFAULT_MAP.filter((e) => 'text' in e).length);
    expect(graph.edges).toHaveLength(DEFAULT_MAP.filter((e) => 'to' in e).length);
  });

  it('walks the nine stages of the journey back to the start', () => {
    const graph = new Graph(DEFAULT_MAP);
    const stages = ['awareness'];
    for (let step = 1; step <= 9; step++) {
      const link = graph.find(`l${step}`);
      expect(link.from).toEqual([stages.at(-1)]);
      stages.push(link.to);
    }
    expect(stages.map((id) => graph.find(id).text)).toEqual([
      '1. Awareness',
      '2. Interest',
      '3. Search',
      '4. Compare',
      '5. Decision',
      '6. Promotion',
      '7. Purchase',
      '8. Sharing',
      '9. Advice',
      '1. Awareness'
    ]);
  });

  it('colours each stage by its phase and leaves the channels neutral', () => {
    const color = (id) => DEFAULT_MAP.find((e) => e.id === id).color;
    const phases = [
      ['awareness', 'interest'],
      ['search', 'compare'],
      ['decision', 'promotion', 'purchase'],
      ['sharing', 'advice']
    ];
    const shades = phases.map((ids) => [...new Set(ids.map(color))]);
    expect(shades.every((shade) => shade.length === 1 && shade[0])).toBe(true);
    expect(new Set(shades.flat()).size).toBe(phases.length);
    const stages = phases.flat();
    expect(DEFAULT_MAP.filter((e) => 'text' in e && !stages.includes(e.id)).map((e) => e.color)).toEqual(
      Array(DEFAULT_MAP.filter((e) => 'text' in e).length - stages.length).fill(undefined)
    );
  });

  it('joins two drivers into the purchase and lets the competitor object', () => {
    const graph = new Graph(DEFAULT_MAP);
    expect(graph.find('t7').from).toEqual(['koc', 'decision']);
    expect(graph.edges.filter((e) => graph.isObjection(e)).map((e) => e.id)).toEqual(['o1']);
  });
});

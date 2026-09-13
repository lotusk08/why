import { describe, expect, it } from 'vitest';
import { decodeHash, encodeMap, validateMap } from '../../src/lib/share.js';

const sample = [
  { id: 'p1', text: 'Premise', x: -100, y: -50, lineType: 'solid' },
  { id: 'c1', text: 'Conclusion', x: 0, y: 100, lineType: 'dashed' },
  { id: 'e1', type: '', from: ['p1'], to: 'c1' }
];

describe('share links', () => {
  it('round-trips a map through a compressed hash', async () => {
    const payload = await encodeMap(sample);
    expect(payload.startsWith('map=')).toBe(true);
    expect(payload).toMatch(/^map=[A-Za-z0-9_-]+$/);
    expect(await decodeHash(`#${payload}`)).toEqual(sample);
  });

  it('reads legacy links that hold raw JSON', async () => {
    const legacy = `#${encodeURIComponent(
      JSON.stringify([
        { id: 'a', text: 'A', x: 1, y: 2 },
        { from: 'a', to: 'a' }
      ])
    )}`;
    expect(await decodeHash(legacy)).toEqual([
      { id: 'a', text: 'A', x: 1, y: 2, lineType: 'solid' },
      { id: undefined, type: '', from: ['a'], to: 'a' }
    ]);
  });

  it('returns null for empty, broken, or foreign hashes', async () => {
    expect(await decodeHash('')).toBeNull();
    expect(await decodeHash('#')).toBeNull();
    expect(await decodeHash('#map=!!!')).toBeNull();
    expect(await decodeHash('#%7B%22a%22%3A1%7D')).toBeNull();
    expect(await decodeHash('#section')).toBeNull();
  });
});

describe('validateMap', () => {
  it('accepts nodes and edges only', () => {
    expect(validateMap(sample)).toEqual(sample);
    expect(validateMap([{ text: 'x', x: '10', y: 5 }])).toEqual([
      { id: undefined, text: 'x', x: 10, y: 5, lineType: 'solid' }
    ]);
  });

  it('rejects anything that is not a list of elements', () => {
    expect(validateMap(null)).toBeNull();
    expect(validateMap({})).toBeNull();
    expect(validateMap([1])).toBeNull();
    expect(validateMap([{ text: 'x', x: 'nope', y: 0 }])).toBeNull();
    expect(validateMap([{ from: [], to: 'c' }])).toBeNull();
    expect(validateMap(Array.from({ length: 2001 }, () => ({ text: '', x: 0, y: 0 })))).toBeNull();
  });
});

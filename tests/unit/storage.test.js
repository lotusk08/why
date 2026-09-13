import { describe, expect, it } from 'vitest';
import { loadMap, saveMap } from '../../src/lib/storage.js';

function memory(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => (data[key] = String(value)),
    removeItem: (key) => delete data[key],
    data
  };
}

describe('storage', () => {
  it('returns null when nothing is saved', () => {
    expect(loadMap(memory())).toBeNull();
  });

  it('saves and loads the current map', () => {
    const store = memory();
    expect(saveMap('[{"text":"a","x":0,"y":0}]', store)).toBe(true);
    expect(loadMap(store)).toEqual([{ text: 'a', x: 0, y: 0 }]);
  });

  it('migrates the legacy key from the previous version', () => {
    const store = memory({ codageArgument: '[{"text":"old","x":1,"y":2}]' });
    expect(loadMap(store)).toEqual([{ text: 'old', x: 1, y: 2 }]);
    expect(store.data['why:map']).toBe('[{"text":"old","x":1,"y":2}]');
    expect('codageArgument' in store.data).toBe(false);
  });

  it('survives broken JSON and throwing storage', () => {
    expect(loadMap(memory({ 'why:map': '{oops' }))).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {}
    };
    expect(loadMap(broken)).toBeNull();
    expect(saveMap('[]', broken)).toBe(false);
  });
});

import { createEdge, createNode, exportElement, isEdgeData, uid } from './element.js';

function unique(list) {
  return [...new Set(list)];
}

function sameSet(a, b) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export class Graph {
  constructor(elements = []) {
    this.elements = [];
    const list = Array.isArray(elements) ? elements.filter((e) => e && typeof e === 'object') : [];
    list.filter((e) => !isEdgeData(e)).forEach((e) => this.add(e));
    list.filter(isEdgeData).forEach((e) => this.add(e));
  }

  get nodes() {
    return this.elements.filter((e) => e.kind === 'node');
  }

  get edges() {
    return this.elements.filter((e) => e.kind === 'edge');
  }

  get focused() {
    return this.elements.find((e) => e.focused) || null;
  }

  find(id) {
    return this.elements.find((e) => e.id === id) || null;
  }

  add(data) {
    if (isEdgeData(data)) return this.addEdge(createEdge(data));
    const node = createNode(data);
    while (this.find(node.id)) node.id = uid();
    this.elements.push(node);
    return node;
  }

  linkProblem(from, to) {
    const sources = [from].flat();
    if (!sources.length || !to || sources.includes(to)) return 'self';
    const endpoints = [...sources, to].map((id) => this.find(id));
    if (endpoints.some((el) => !el || el.kind !== 'node')) return 'missing';
    if (this.edges.some((e) => e.to === to && sources.every((id) => e.from.includes(id)))) return 'duplicate';
    return null;
  }

  addEdge(edge, { merge = true } = {}) {
    if (this.linkProblem(edge.from, edge.to)) return null;
    while (this.find(edge.id)) edge.id = uid();

    const shared = merge
      ? this.children(edge.to).filter((child) => edge.from.some((id) => this.children(id).includes(child)))
      : [];
    if (!shared.length) {
      this.elements.push(edge);
      return edge;
    }

    let merged = null;
    for (const existing of this.edges) {
      if (!shared.includes(existing.to)) continue;
      if (existing.from.includes(edge.to)) {
        existing.from = unique([...existing.from, ...edge.from]);
        merged = existing;
      } else if (existing.from.some((id) => edge.from.includes(id))) {
        this.remove(existing);
      }
    }
    return merged;
  }

  remove(el) {
    const index = this.elements.indexOf(el);
    if (index < 0) return false;
    this.elements.splice(index, 1);
    if (el.kind === 'node') {
      for (const edge of this.edges) {
        if (edge.to === el.id) {
          this.remove(edge);
        } else if (edge.from.includes(el.id)) {
          edge.from = edge.from.filter((id) => id !== el.id);
          if (!edge.from.length) this.remove(edge);
        }
      }
    }
    return true;
  }

  focus(el) {
    if (!this.elements.includes(el)) return null;
    this.elements.forEach((e) => (e.focused = e === el));
    return el;
  }

  focusNext() {
    const list = this.visible;
    if (!list.length) return null;
    const index = list.findIndex((e) => e.focused);
    return this.focus(list[(index + 1) % list.length]);
  }

  focusPrevious() {
    const list = this.visible;
    if (!list.length) return null;
    const index = list.findIndex((e) => e.focused);
    return this.focus(list[(index - 1 + list.length) % list.length]);
  }

  get visible() {
    this.markPairs();
    return this.elements.filter((e) => !e.mirror);
  }

  reverseOf(edge) {
    if (!edge || edge.kind !== 'edge' || edge.from.length !== 1) return null;
    return (
      this.edges.find((e) => e !== edge && e.from.length === 1 && e.from[0] === edge.to && e.to === edge.from[0]) ||
      null
    );
  }

  markPairs() {
    const edges = this.edges;
    edges.forEach((edge) => {
      edge.twoWay = false;
      edge.mirror = false;
    });
    for (const edge of edges) {
      if (edge.mirror || edge.twoWay) continue;
      const reverse = this.reverseOf(edge);
      if (reverse) {
        edge.twoWay = true;
        reverse.mirror = true;
      }
    }
    return edges;
  }

  setDirection(edge, direction) {
    if (edge.from.length !== 1) return edge;
    const reverse = this.reverseOf(edge);
    const mirrored = () =>
      this.addEdge(createEdge({ from: edge.to, to: edge.from[0], type: edge.type }), { merge: false });
    if (direction === 'both') {
      if (!reverse) mirrored();
      return edge;
    }
    if (direction === 'backward') {
      const kept = reverse || mirrored();
      this.remove(edge);
      return kept;
    }
    if (reverse) this.remove(reverse);
    return edge;
  }

  unfocus() {
    this.elements.forEach((e) => (e.focused = false));
  }

  parents(id) {
    return unique(this.edges.filter((e) => e.to === id).flatMap((e) => e.from));
  }

  children(id) {
    return unique(this.edges.filter((e) => e.from.includes(id)).map((e) => e.to));
  }

  isObjection(edge) {
    return edge.from.some((id) => this.find(id)?.lineType === 'dashed');
  }

  export() {
    return this.elements.map(exportElement);
  }

  static sameEdge(a, b) {
    return a.to === b.to && sameSet(a.from, b.from);
  }
}

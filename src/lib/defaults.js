export const DEFAULT_MAP = [
  { id: 'p1', text: 'Premise 1', x: -150, y: -130, lineType: 'solid' },
  { id: 'p2', text: 'Premise 2', x: 150, y: -130, lineType: 'solid' },
  { id: 'c1', text: 'Conclusion', x: 0, y: 130, lineType: 'solid' },
  { id: 'e1', type: '', from: ['p1', 'p2'], to: 'c1' }
];

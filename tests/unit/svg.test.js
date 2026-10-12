import { describe, expect, it } from 'vitest';
import { Graph } from '../../src/lib/reasons/graph.js';
import { createSvgContext } from '../../src/lib/reasons/svg.js';
import { renderToSvg } from '../../src/lib/reasons/view.js';

function fakeMeasure() {
  return {
    font: '10px sans-serif',
    textBaseline: 'alphabetic',
    measureText(text) {
      return { width: String(text).length * 7, actualBoundingBoxAscent: this.textBaseline === 'middle' ? 4 : 10 };
    }
  };
}

const theme = {
  background: '#ffffff',
  nodeBg: '#ffffff',
  nodeBorder: '#d4d4d4',
  nodeText: '#4f4f4f',
  edge: '#b3b3b3',
  edgeText: '#868686',
  focus: '#0d6efd',
  hover: '#8e8e8e',
  objection: '#da3633',
  placeholder: '#b5b5b5',
  font: '"Inter Display", sans-serif',
  serif: 'Newsreader, serif',
  colors: { teal: { stroke: '#0c8599', fill: '#e2f1f3' } }
};

describe('SVG context', () => {
  it('records transforms, strokes and dashes', () => {
    const ctx = createSvgContext(fakeMeasure());
    ctx.setTransform(2, 0, 0, 2, 10, 20);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(10, 5.555);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    expect(String(ctx)).toBe(
      '<g transform="matrix(2 0 0 2 10 20)">' +
        '<path d="M0 0L10 5.56" fill="none" stroke="red" stroke-width="1.5" stroke-linejoin="miter" stroke-linecap="butt" stroke-dasharray="6 5"/>' +
        '</g>'
    );
  });

  it('draws a full circle as two arcs and rounds rectangle corners', () => {
    const ctx = createSvgContext(fakeMeasure());
    ctx.beginPath();
    ctx.arc(5, 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(0, 0, 20, 10, 6);
    ctx.fill();
    expect(String(ctx)).toBe(
      '<path d="M8 5A3 3 0 0 1 2 5A3 3 0 0 1 8 5" fill="#000000"/>' +
        '<path d="M5 0H15A5 5 0 0 1 20 5V5A5 5 0 0 1 15 10H5A5 5 0 0 1 0 5V5A5 5 0 0 1 5 0Z" fill="#000000"/>'
    );
  });

  it('draws part of a circle with the right arc flags', () => {
    const ctx = createSvgContext(fakeMeasure());
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 1.5);
    ctx.fill();
    expect(String(ctx)).toBe('<path d="M10 0A10 10 0 1 1 0 -10" fill="#000000"/>');
  });

  it('moves middle-aligned text onto its baseline and escapes it', () => {
    const ctx = createSvgContext(fakeMeasure());
    ctx.font = 'italic 13px Newsreader, "Times New Roman"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4f4f4f';
    ctx.fillText('a < b & c', 50, 20, 30);
    expect(String(ctx)).toBe(
      '<text x="50" y="26" text-anchor="middle" fill="#4f4f4f" style="font: italic 13px Newsreader, &quot;Times New Roman&quot;" textLength="30" lengthAdjust="spacingAndGlyphs">a &lt; b &amp; c</text>'
    );
  });

  it('paints cleared areas with the background, if there is one', () => {
    const plain = createSvgContext(fakeMeasure());
    plain.clearRect(0, 0, 10, 10);
    expect(String(plain)).toBe('');
    const filled = createSvgContext(fakeMeasure(), { background: '#000' });
    filled.clearRect(1, 2, 3, 4);
    expect(String(filled)).toBe('<rect x="1" y="2" width="3" height="4" fill="#000"/>');
  });
});

describe('renderToSvg', () => {
  it('draws the whole map on a sized, padded page', () => {
    const graph = new Graph([
      { id: 'p', text: 'Rain & wind', x: 0, y: 0 },
      { id: 'o', text: 'Not <today>', x: 300, y: 0, lineType: 'dashed' },
      { id: 'c', text: 'Stay in', x: 0, y: 200 },
      { from: ['p'], to: 'c' },
      { from: ['o'], to: 'p' }
    ]);
    const svg = renderToSvg(graph, theme, { measure: fakeMeasure() });
    expect(svg.width).toBe(300 + 200 + 48 * 2);
    expect(svg.height).toBe(200 + 56 + 48 * 2);
    expect(svg.markup).toMatch(
      new RegExp(
        `^<svg xmlns="http://www.w3.org/2000/svg" width="${svg.width}" height="${svg.height}" viewBox="0 0 ${svg.width} ${svg.height}"`
      )
    );
    expect(svg.markup).toContain('>Rain &amp; wind</text>');
    expect(svg.markup).toContain('>Not &lt;today&gt;</text>');
    expect(svg.markup).toContain('>objection</text>');
    expect(svg.markup).toContain('>therefore</text>');
    expect(svg.markup).toContain('stroke="#da3633"');
    expect(svg.markup.endsWith('</g></svg>')).toBe(true);
  });

  it('tints a coloured idea and outlines it in its colour', () => {
    const svg = renderToSvg(new Graph([{ id: 't', text: 'Teal', x: 0, y: 0, color: 'teal' }]), theme, {
      measure: fakeMeasure()
    });
    expect(svg.markup).toContain('fill="#e2f1f3"');
    expect(svg.markup).toContain('stroke="#0c8599"');
  });

  it('returns nothing for an empty map', () => {
    expect(renderToSvg(new Graph([]), theme, { measure: fakeMeasure() })).toBeNull();
  });
});

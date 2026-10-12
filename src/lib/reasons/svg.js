const ANCHORS = { center: 'middle', left: 'start', start: 'start', right: 'end', end: 'end' };
const TURN = Math.PI * 2;

function round(value) {
  return Math.round(value * 100) / 100;
}

function escapeXml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ascentAt(measure, text, baseline) {
  const previous = measure.textBaseline;
  measure.textBaseline = baseline;
  const ascent = measure.measureText(text).actualBoundingBoxAscent || 0;
  measure.textBaseline = previous;
  return ascent;
}

export function createSvgContext(measure, { background = 'none' } = {}) {
  const parts = [];
  let path = [];
  let dash = [];
  let grouped = false;

  function rect(x, y, width, height, fill) {
    return `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" fill="${escapeXml(fill)}"/>`;
  }

  function point(x, y) {
    return `${round(x)} ${round(y)}`;
  }

  return {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    get font() {
      return measure.font;
    },
    set font(value) {
      measure.font = value;
    },
    setTransform(a, b, c, d, e, f) {
      if (grouped) parts.push('</g>');
      parts.push(`<g transform="matrix(${[a, b, c, d, e, f].map(round).join(' ')})">`);
      grouped = true;
    },
    beginPath() {
      path = [];
    },
    moveTo(x, y) {
      path.push(`M${point(x, y)}`);
    },
    lineTo(x, y) {
      path.push(`L${point(x, y)}`);
    },
    closePath() {
      path.push('Z');
    },
    arc(x, y, radius, start, end, anticlockwise = false) {
      const at = (angle) => point(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
      const sweep = anticlockwise ? 0 : 1;
      const span = anticlockwise ? start - end : end - start;
      const r = round(radius);
      path.push(`${path.length ? 'L' : 'M'}${at(start)}`);
      if (span >= TURN) {
        const half = start + (anticlockwise ? -Math.PI : Math.PI);
        path.push(`A${r} ${r} 0 0 ${sweep} ${at(half)}`, `A${r} ${r} 0 0 ${sweep} ${at(start)}`);
        return;
      }
      const turn = ((span % TURN) + TURN) % TURN;
      path.push(`A${r} ${r} 0 ${turn > Math.PI ? 1 : 0} ${sweep} ${at(end)}`);
    },
    roundRect(x, y, width, height, radius = 0) {
      const r = round(Math.min(Number(radius) || 0, Math.abs(width) / 2, Math.abs(height) / 2));
      const corner = (cx, cy) => `A${r} ${r} 0 0 1 ${point(cx, cy)}`;
      path.push(
        `M${point(x + r, y)}`,
        `H${round(x + width - r)}`,
        corner(x + width, y + r),
        `V${round(y + height - r)}`,
        corner(x + width - r, y + height),
        `H${round(x + r)}`,
        corner(x, y + height - r),
        `V${round(y + r)}`,
        corner(x + r, y),
        'Z'
      );
    },
    setLineDash(segments) {
      dash = [...segments];
    },
    fill() {
      parts.push(`<path d="${path.join('')}" fill="${escapeXml(this.fillStyle)}"/>`);
    },
    stroke() {
      const attrs = [
        `d="${path.join('')}"`,
        'fill="none"',
        `stroke="${escapeXml(this.strokeStyle)}"`,
        `stroke-width="${round(this.lineWidth)}"`,
        `stroke-linejoin="${this.lineJoin}"`,
        `stroke-linecap="${this.lineCap}"`
      ];
      if (dash.length) attrs.push(`stroke-dasharray="${dash.map(round).join(' ')}"`);
      parts.push(`<path ${attrs.join(' ')}/>`);
    },
    fillRect(x, y, width, height) {
      parts.push(rect(x, y, width, height, this.fillStyle));
    },
    clearRect(x, y, width, height) {
      if (background !== 'none') parts.push(rect(x, y, width, height, background));
    },
    measureText(text) {
      return measure.measureText(text);
    },
    fillText(text, x, y, maxWidth) {
      const shift = ascentAt(measure, text, 'alphabetic') - ascentAt(measure, text, this.textBaseline);
      const attrs = [
        `x="${round(x)}"`,
        `y="${round(y + shift)}"`,
        `text-anchor="${ANCHORS[this.textAlign] ?? 'start'}"`,
        `fill="${escapeXml(this.fillStyle)}"`,
        `style="font: ${escapeXml(measure.font)}"`
      ];
      if (maxWidth !== undefined && measure.measureText(text).width > maxWidth) {
        attrs.push(`textLength="${round(maxWidth)}"`, 'lengthAdjust="spacingAndGlyphs"');
      }
      parts.push(`<text ${attrs.join(' ')}>${escapeXml(text)}</text>`);
    },
    toString() {
      return parts.join('') + (grouped ? '</g>' : '');
    }
  };
}

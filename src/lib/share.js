const PREFIX = 'map=';
const MAX_ELEMENTS = 2000;
const MAX_TEXT = 4000;

function isNode(item) {
  return typeof item.text === 'string' && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y));
}

function isEdge(item) {
  const from = [item.from].flat(Infinity);
  return from.length > 0 && from.every((id) => typeof id === 'string') && typeof item.to === 'string';
}

export function validateMap(data) {
  if (!Array.isArray(data) || data.length > MAX_ELEMENTS) return null;
  const elements = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') return null;
    if (isNode(item)) {
      elements.push({
        id: typeof item.id === 'string' ? item.id : undefined,
        text: item.text.slice(0, MAX_TEXT),
        x: Number(item.x),
        y: Number(item.y),
        lineType: item.lineType === 'dashed' ? 'dashed' : 'solid'
      });
    } else if (isEdge(item)) {
      elements.push({
        id: typeof item.id === 'string' ? item.id : undefined,
        type: typeof item.type === 'string' ? item.type.slice(0, MAX_TEXT) : '',
        from: [item.from].flat(Infinity),
        to: item.to
      });
    } else {
      return null;
    }
  }
  return elements;
}

function toBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function pipe(input, stream) {
  return new Uint8Array(await new Response(new Blob([input]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function encodeMap(elements) {
  const json = JSON.stringify(elements);
  if (typeof CompressionStream === 'undefined') return encodeURIComponent(json);
  const bytes = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  return PREFIX + toBase64Url(bytes);
}

export async function decodeHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return null;
  try {
    if (raw.startsWith(PREFIX)) {
      if (typeof DecompressionStream === 'undefined') return null;
      const bytes = await pipe(fromBase64Url(raw.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
      return validateMap(JSON.parse(new TextDecoder().decode(bytes)));
    }
    return validateMap(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return null;
  }
}

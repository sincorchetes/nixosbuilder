// Texto con `comandos`, archivos .nix/.sh y rutas /dev/... resaltados en monoespaciado.
// Se analiza por fragmentos y no con una única expresión regular, para que el coste sea siempre lineal.

export interface RichPart {
  text: string;
  code: boolean;
}

const PUNCTUATION = '.,;:!?)';
const DEVICE = /^\/dev\/[\w/-]+$/;
const TOOL = /^nixos-[a-z-]+$/;
const FILE_STEM = /^[\w./-]+$/;

const trimEnd = (token: string) => {
  let end = token.length;
  while (end > 0 && PUNCTUATION.includes(token[end - 1])) end--;
  return end;
};

const isCode = (token: string) =>
  DEVICE.test(token) || TOOL.test(token) || ((token.endsWith('.nix') || token.endsWith('.sh')) && FILE_STEM.test(token));

function pushPart(parts: RichPart[], text: string, code: boolean) {
  if (!text) return;
  const last = parts.at(-1);
  if (last && !last.code && !code) last.text += text;
  else parts.push({ text, code });
}

function pushPlain(parts: RichPart[], segment: string) {
  for (const token of segment.split(/(\s+)/)) {
    const end = trimEnd(token);
    const core = token.slice(0, end);
    if (core && isCode(core)) {
      pushPart(parts, core, true);
      pushPart(parts, token.slice(end), false);
    } else {
      pushPart(parts, token, false);
    }
  }
}

export function richParts(text: string): RichPart[] {
  const parts: RichPart[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('`', cursor);
    const close = open < 0 ? -1 : text.indexOf('`', open + 1);
    if (open < 0 || close < 0) {
      pushPlain(parts, text.slice(cursor));
      break;
    }
    pushPlain(parts, text.slice(cursor, open));
    pushPart(parts, text.slice(open + 1, close), true);
    cursor = close + 1;
  }
  return parts;
}

// Análisis y validación del código de un módulo.
import type { HmOptionIndex, ModuleReport, TrieNode } from './options';

/* ------------------------------ Análisis ------------------------------ */

export const HEADER = /^\s*(?:#[^\n]*\n\s*)*\{[^{}]*\}\s*:\s*/;

/** ¿Es un módulo completo (`{ pkgs, ... }: { ... }`) en vez de solo el cuerpo? */
export const isFullModule = (code: string) => HEADER.test(code);

export const lintDistance = (a: string, b: string) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
};

export class SyntaxProblem extends Error {}
export class BailOut extends Error {}

export function analyzeModuleCode(code: string, moduleId: string, index: HmOptionIndex | null): ModuleReport {
  const report: ModuleReport = { unknown: [], options: [], enables: false, partial: false };
  const full = isFullModule(code);
  let src = code;
  let i = 0;

  if (full) {
    i = HEADER.exec(code)![0].length;
  } else {
    src = `${code}\n`;
  }
  const lineAt = (position: number) => {
    let line = 1;
    for (let k = 0; k < position; k++) if (src[k] === '\n') line++;
    return line;
  };
  const fail = (message: string, position = i): never => {
    throw new SyntaxProblem(`Línea ${lineAt(position)}: ${message}`);
  };

  const skipWs = () => {
    for (;;) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
      else if (c === '#') while (i < src.length && src[i] !== '\n') i++;
      else if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        if (end < 0) fail('comentario /* sin cerrar');
        i = end + 2;
      } else return;
    }
  };

  // Salta una cadena "..." o ''...'' (i está en la comilla de apertura).
  const skipString = () => {
    const start = i;
    if (src[i] === '"') {
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') i += 2;
        else if (src[i] === '$' && src[i + 1] === '{') skipInterpolation();
        else i++;
      }
      if (src[i] !== '"') fail('cadena sin cerrar', start);
      i++;
    } else {
      i += 2;
      for (;;) {
        if (i >= src.length) fail("cadena '' sin cerrar", start);
        if (src[i] === "'" && src[i + 1] === "'") {
          if (src[i + 2] === "'" || src[i + 2] === '$' || src[i + 2] === '\\') i += 3;
          else {
            i += 2;
            return;
          }
        } else if (src[i] === '$' && src[i + 1] === '{') skipInterpolation();
        else i++;
      }
    }
  };

  const skipInterpolation = () => {
    const start = i;
    i += 2;
    let depth = 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '"' || (c === "'" && src[i + 1] === "'")) skipString();
      else if (c === '{') {
        depth++;
        i++;
      } else if (c === '}') {
        depth--;
        i++;
      } else i++;
    }
    if (depth > 0) fail('${ sin cerrar', start);
  };

  // Salta un valor hasta el `;` que lo termina (lo consume). Controla (), [] y {} anidados.
  const skipValue = () => {
    const stack: Array<[string, number]> = [];
    let pending = 0; // "with x;" / "assert c;" aportan un ";" que no cierra el valor
    let lets = 0; // "let ... in" también contiene ";"
    const valueStart = i;
    const pairs: Record<string, string> = { '}': '{', ']': '[', ')': '(' };
    for (;;) {
      skipWs();
      if (i >= src.length) fail('falta un ";" al final de un valor');
      const c = src[i];
      if (c === '"' || (c === "'" && src[i + 1] === "'")) skipString();
      else if (c === '{' || c === '[' || c === '(') {
        stack.push([c, i]);
        i++;
      } else if (c === '}' || c === ']' || c === ')') {
        if (!stack.length) fail(`"${c}" inesperado (¿falta un ";" antes?)`);
        const [open, at] = stack.pop()!;
        if (open !== pairs[c]) fail(`"${c}" no coincide con "${open}" de la línea ${lineAt(at)}`);
        i++;
      } else if (c === '=' && !stack.length && lets === 0 && src[i + 1] !== '=' && !'!<>='.includes(src[i - 1])) {
        fail(`falta un ";" al final del valor que empieza en la línea ${lineAt(valueStart)}`);
      } else if (c === ';' && !stack.length) {
        i++;
        if (lets > 0) continue;
        if (pending > 0) {
          pending--;
          continue;
        }
        return;
      } else if (/[A-Za-z_]/.test(c) && src[i - 1] !== '.') {
        const word = /^[A-Za-z_][A-Za-z0-9_'-]*/.exec(src.slice(i, i + 100))![0];
        i += word.length;
        if (!stack.length) {
          if (word === 'with' || word === 'assert') pending++;
          else if (word === 'let') lets++;
          else if (word === 'in' && lets > 0) lets--;
        }
      } else i++;
    }
  };

  const readSegment = (): string | null => {
    const c = src[i];
    if (c === '"') {
      const start = i;
      skipString();
      const text = src.slice(start + 1, i - 1);
      return text.includes('${') ? '*' : text;
    }
    if (c === '$' && src[i + 1] === '{') {
      skipInterpolation();
      return '*';
    }
    const match = /^[A-Za-z_][A-Za-z0-9_'-]*/.exec(src.slice(i, i + 200));
    if (!match) return null;
    i += match[0].length;
    return match[0];
  };

  const suggest = (node: TrieNode, segment: string, prefix: string[]) => {
    const keys = [...node.children.keys()];
    const lower = segment.toLowerCase();
    return keys
      .map((key) => ({
        key,
        score: key.toLowerCase().startsWith(lower) || lower.startsWith(key.toLowerCase()) ? 0 : lintDistance(key.toLowerCase(), lower),
      }))
      .filter((entry) => entry.score <= 2)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((entry) => [...prefix, entry.key].join('.'));
  };

  const rootKeys = new Set(['imports', 'options', '_module', 'assertions', 'warnings']);

  const parseSet = (node: TrieNode, trail: string[], isRoot: boolean) => {
    for (;;) {
      skipWs();
      if (i >= src.length) {
        if (!isRoot || full) fail('falta una "}" de cierre');
        return;
      }
      if (src[i] === '}') {
        if (isRoot && !full) fail('"}" inesperada');
        i++;
        return;
      }

      const keyStart = i;
      const keyword = /^[a-z]+\b/.exec(src.slice(i, i + 20))?.[0];
      if (keyword === 'inherit') {
        skipValue();
        continue;
      }
      if (keyword && ['let', 'with', 'if', 'rec', 'import', 'assert'].includes(keyword)) {
        report.partial = true;
        throw new BailOut();
      }

      const segments: string[] = [];
      for (;;) {
        const segment = readSegment();
        if (segment === null) fail('se esperaba el nombre de una opción');
        segments.push(segment!);
        skipWs();
        if (src[i] === '.') {
          i++;
          skipWs();
        } else break;
      }
      if (src[i] !== '=') fail(`se esperaba "=" tras ${segments.join('.')}`);
      i++;
      skipWs();

      if (isRoot && trail.length === 0 && rootKeys.has(segments[0])) {
        skipValue();
        continue;
      }
      if (isRoot && segments.length === 1 && segments[0] === 'config' && src[i] === '{') {
        i++;
        parseSet(node, trail, false);
        skipWs();
        if (src[i] === ';') i++;
        continue;
      }
      if (!index) {
        // sin índice: solo estructura
        if (src[i] === '{') {
          i++;
          parseSet(node, [...trail, ...segments], false);
          skipWs();
          if (src[i] === ';') i++;
          else fail('falta ";" tras "}"');
        } else skipValue();
        continue;
      }

      // Resolver la ruta en el trie.
      let current = node;
      let resolved = true;
      let leaf = false;
      const used: string[] = [];
      for (const segment of segments) {
        if (current.option) {
          leaf = true;
          break;
        } // atributos libres dentro de una opción
        const next = current.children.get(segment) ?? current.wild;
        if (!next) {
          report.unknown.push({
            line: lineAt(keyStart),
            path: [...trail, ...segments].join('.'),
            suggestions: suggest(current, segment, [...trail, ...used]),
          });
          resolved = false;
          break;
        }
        used.push(segment);
        current = next;
      }

      if (!resolved) {
        skipValue();
        continue;
      }
      if (leaf || current.option) {
        report.options.push([...trail, ...used].join('.'));
        skipValue();
      } else if (src[i] === '{') {
        i++;
        parseSet(current, [...trail, ...used], false);
        skipWs();
        if (src[i] === ';') i++;
        else fail('falta ";" tras "}"');
      } else {
        report.partial = true; // p. ej. lib.mkMerge [...] o lib.mkIf cond { ... }
        skipValue();
      }
    }
  };

  try {
    if (full) {
      skipWs();
      if (src[i] !== '{') {
        report.partial = true;
      } else {
        i++;
        parseSet(index?.root ?? { children: new Map(), option: false }, [], true);
        skipWs();
        if (i < src.length) fail('hay texto después del cierre del módulo');
      }
    } else {
      parseSet(index?.root ?? { children: new Map(), option: false }, [], true);
    }
  } catch (error) {
    if (error instanceof BailOut) report.partial = true;
    else if (error instanceof SyntaxProblem) report.syntaxError = error.message;
    else throw error;
  }

  report.enables = report.options.some((path) => path === `${moduleId}.enable`);
  return report;
}

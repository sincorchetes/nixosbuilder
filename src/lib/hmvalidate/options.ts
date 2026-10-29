// Índice de opciones de Home Manager y búsqueda de módulos.

// Validación del código que el usuario pega en un módulo de Home Manager.
// No es un parser completo de Nix: recorre la estructura de atributos (a.b.c = valor;),
// comprueba cada ruta contra el índice de opciones (Appendix A) y se salta los valores.

import type { Channel } from '../generator';

export interface TrieNode {
  children: Map<string, TrieNode>;
  wild?: TrieNode;
  option: boolean;
}

export interface HmOptionIndex {
  names: string[];
  descriptions: string[];
  set: Set<string>;
  root: TrieNode;
}

export interface UnknownOption {
  line: number;
  path: string;
  suggestions: string[];
}

export interface ModuleReport {
  /** Error de sintaxis que impediría evaluar el archivo (bloqueante). */
  syntaxError?: string;
  unknown: UnknownOption[];
  /** Opciones reconocidas. */
  options: string[];
  /** El código activa el módulo (solo relevante si el usuario pega un módulo completo). */
  enables: boolean;
  /** La validación no cubre todo el archivo (let, with, funciones…). */
  partial: boolean;
}

export const isWildcard = (segment: string) => segment.startsWith('<') || segment === '*';

export function buildHmIndex(data: { names: string[]; descriptions: string[] }): HmOptionIndex {
  const root: TrieNode = { children: new Map(), option: false };
  for (const name of data.names) {
    let node = root;
    for (const segment of name.split('.')) {
      if (isWildcard(segment)) {
        node = node.wild ??= { children: new Map(), option: false };
      } else {
        let next = node.children.get(segment);
        if (!next) {
          next = { children: new Map(), option: false };
          node.children.set(segment, next);
        }
        node = next;
      }
    }
    node.option = true;
  }
  return { names: data.names, descriptions: data.descriptions, set: new Set(data.names), root };
}

export const cache = new Map<Channel, Promise<HmOptionIndex | null>>();

/** Vacía la caché de índices (para los tests). */
export const resetHmIndexCache = () => cache.clear();

export function loadHmIndex(channel: Channel, base: string): Promise<HmOptionIndex | null> {
  let pending = cache.get(channel);
  if (!pending) {
    pending = fetch(`${base}hm-options/${channel}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => (data?.names ? buildHmIndex(data) : null))
      .catch(() => null);
    cache.set(channel, pending);
  }
  return pending;
}

/** Sugerencias de módulos (`<ruta>.enable`) para el campo de módulo personalizado. */
export function searchModules(index: HmOptionIndex, query: string, limit = 8): string[] {
  const needle = query
    .trim()
    .toLowerCase()
    .replace(/\.enable$/, '');
  if (!needle) return [];
  const hits: string[] = [];
  for (const name of index.names) {
    if (!name.endsWith('.enable')) continue;
    const id = name.slice(0, -'.enable'.length);
    if (id.split('.').length < 2) continue;
    if (id.toLowerCase().includes(needle)) hits.push(id);
    if (hits.length >= limit * 4) break;
  }
  return hits
    .sort((a, b) => Number(b.toLowerCase().startsWith(needle)) - Number(a.toLowerCase().startsWith(needle)) || a.length - b.length)
    .slice(0, limit);
}

export interface ModuleHit {
  id: string;
  description: string;
}

/** Búsqueda en todos los módulos (`<ruta>.enable`) por nombre o descripción. */
export function searchModuleHits(index: HmOptionIndex, query: string, limit = 12): ModuleHit[] {
  const needle = query
    .trim()
    .toLowerCase()
    .replace(/\.enable$/, '');
  if (needle.length < 2) return [];
  const words = needle.split(/\s+/);
  const scored: Array<{ hit: ModuleHit; score: number }> = [];
  for (let i = 0; i < index.names.length; i++) {
    const name = index.names[i];
    if (!name.endsWith('.enable')) continue;
    const id = name.slice(0, -'.enable'.length);
    if (id.split('.').length < 2 || id.includes('<')) continue;
    const lowerId = id.toLowerCase();
    const description = (index.descriptions[i] ?? '').replace(/\s+/g, ' ').trim();
    const lowerDescription = description.toLowerCase();
    if (!words.every((word) => lowerId.includes(word) || lowerDescription.includes(word))) continue;
    const last = lowerId.slice(lowerId.lastIndexOf('.') + 1);
    const score = last === needle ? 0 : last.startsWith(needle) ? 1 : lowerId.includes(needle) ? 2 : 3;
    scored.push({ hit: { id, description }, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.hit.id.length - b.hit.id.length)
    .slice(0, limit)
    .map((item) => item.hit);
}

import type { Channel } from './generator';

// Índice estático de paquetes de nixpkgs (generado por scripts/gen-packages.mjs).
// Se descarga bajo demanda y se cachea en memoria por canal.

export interface PackageIndex {
  names: string[];
  versions: string[];
  descriptions: string[];
  /** Índices de paquetes con licencia no libre. */
  unfree: Set<number>;
  /** Atributos que existen en nixpkgs pero no figuran en packages.json. */
  extra: Set<string>;
  lookup: Map<string, number>;
}

export interface PackageHit {
  name: string;
  unfree: boolean;
  version: string;
  description: string;
}

const cache = new Map<Channel, Promise<PackageIndex | null>>();

/** Vacía la caché de índices (para los tests). */
export const resetIndexCache = () => cache.clear();

export function loadIndex(channel: Channel, base: string): Promise<PackageIndex | null> {
  let pending = cache.get(channel);
  if (!pending) {
    pending = fetch(`${base}packages/${channel}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.names) return null;
        return {
          ...data,
          unfree: new Set<number>(data.unfree ?? []),
          extra: new Set<string>(data.extra ?? []),
          lookup: new Map<string, number>(data.names.map((name: string, i: number) => [name, i])),
        };
      })
      .catch(() => null);
    cache.set(channel, pending);
  }
  return pending;
}

/** ¿Existe el atributo en este canal? (catalogado o solo como atributo) */
export const hasPackage = (index: PackageIndex, name: string) => index.lookup.has(name) || index.extra.has(name);

export function searchIndex(index: PackageIndex, query: string, limit = 8): PackageHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const prefix: number[] = [];
  const contains: number[] = [];
  for (let i = 0; i < index.names.length && prefix.length < limit; i++) {
    const name = index.names[i].toLowerCase();
    if (name.startsWith(needle)) prefix.push(i);
    else if (contains.length < limit && (name.includes(needle) || index.descriptions[i].toLowerCase().includes(needle))) {
      contains.push(i);
    }
  }
  return [...prefix, ...contains].slice(0, limit).map((i) => ({
    name: index.names[i],
    unfree: index.unfree.has(i),
    version: index.versions[i],
    description: index.descriptions[i],
  }));
}

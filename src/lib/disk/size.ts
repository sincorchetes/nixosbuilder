// Tamaños: lectura, formato y reparto en el disco.
import type { Partition } from './types';

/* -------------------------------- Tamaños -------------------------------- */

export const units: Record<string, number> = { B: 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 };

/** "476.9G" → bytes. Devuelve 0 si no se entiende. */
export function parseSize(value: string): number {
  const match = /^(\d+(?:[.,]\d+)?)\s*([BKMGTP])(?:i?B)?$/i.exec(value.trim());
  if (!match) return 0;
  return Math.round(Number.parseFloat(match[1].replace(',', '.')) * units[match[2].toUpperCase()]);
}

export function formatSize(bytes: number): string {
  if (!bytes) return '?';
  for (const unit of ['T', 'G', 'M', 'K'] as const) {
    if (bytes >= units[unit]) {
      const value = bytes / units[unit];
      return `${value >= 100 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)}${unit}`;
    }
  }
  return `${bytes}B`;
}

/** Tamaño de una partición en bytes; `100%` ocupa lo que quede en el disco. */
export function layoutBytes(parts: Partition[], diskBytes: number): number[] {
  const fixed = parts.map((part) => part.existing?.bytes ?? (part.size === '100%' ? 0 : parseSize(part.size)));
  const used = fixed.reduce((sum, bytes) => sum + bytes, 0);
  const rest = diskBytes > used ? diskBytes - used : Math.max(used * 0.25, units.G);
  return parts.map((part, i) => (!part.existing && part.size === '100%' ? rest : fixed[i]));
}

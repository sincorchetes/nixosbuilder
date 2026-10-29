// Piezas comunes a disko y al script.
import type { PartFs, Partition } from './types';

export const q = (value: string) => JSON.stringify(value);

export const gptType = (part: Partition) => {
  if (part.encrypt) return '8309';
  if (part.fs === 'vfat' && part.mountpoint === '/boot') return 'EF00';
  if (part.fs === 'swap') return '8200';
  return '8300';
};

export const dirOptions = (fs: PartFs, discard: boolean) => {
  if (fs === 'vfat') return ['umask=0077'];
  if (fs === 'btrfs') return ['compress=zstd', 'noatime', ...(discard ? ['discard=async'] : [])];
  if (fs === 'swap' || fs === 'none') return [];
  return ['noatime', ...(discard ? ['discard'] : [])];
};

export const nixOptions = (options: string[]) => `[ ${options.map(q).join(' ')} ]`;

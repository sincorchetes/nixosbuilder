// disko.nix a partir de un esquema propio.

import { dirOptions, gptType, nixOptions, q } from './shared';
import type { Partition } from './types';

export const pad = (text: string, spaces: number) =>
  text
    .split('\n')
    .map((line, i) => (i === 0 || !line ? line : ' '.repeat(spaces) + line))
    .join('\n');

export function diskoContent(part: Partition, discard: boolean): string {
  let inner = '';
  if (part.fs === 'swap') inner = `{\n  type = "swap";${discard ? '\n  discardPolicy = "both";' : ''}\n}`;
  else if (part.fs === 'btrfs') {
    inner = `{\n  type = "btrfs";\n  extraArgs = [ "-f" ];${part.mountpoint ? `\n  mountpoint = ${q(part.mountpoint)};` : ''}\n  mountOptions = ${nixOptions(dirOptions('btrfs', discard))};\n}`;
  } else if (part.fs !== 'none') {
    const options = dirOptions(part.fs, discard);
    inner = `{\n  type = "filesystem";\n  format = ${q(part.fs)};${part.mountpoint ? `\n  mountpoint = ${q(part.mountpoint)};` : ''}${options.length ? `\n  mountOptions = ${nixOptions(options)};` : ''}\n}`;
  }
  if (!inner) return '';
  if (!part.encrypt) return inner;
  return `{\n  type = "luks";\n  name = ${q(`crypt-${part.name}`)};${discard ? '\n  settings.allowDiscards = true;' : ''}\n  content = ${pad(inner, 2)};\n}`;
}

/** Fichero disko.nix a partir de un esquema personalizado. */
export function generateDiskoLayout(device: string, parts: Partition[], discard: boolean): string {
  const blocks = parts.map((part, i) => {
    const lines = [`${q(part.name)} = {`, `  size = ${q(part.size)};`, `  type = ${q(gptType(part))};`];
    if (part.size !== '100%') lines.push(`  priority = ${(i + 1) * 100};`);
    const content = diskoContent(part, discard);
    if (content) lines.push(`  content = ${pad(content, 2)};`);
    lines.push('};');
    return lines
      .join('\n')
      .split('\n')
      .map((line) => `          ${line}`)
      .join('\n');
  });
  return `{ ... }:
{
  disko.devices = {
    disk.main = {
      device = ${q(device)};
      type = "disk";
      content = {
        type = "gpt";
        partitions = {
${blocks.join('\n')}
        };
      };
    };
  };
}
`;
}

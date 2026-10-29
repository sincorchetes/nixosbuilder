// Sin disko: script de particionado y fileSystems.
import { t } from '../i18n';
import { dirOptions, gptType, nixOptions, q } from './shared';
import type { PartFs, Partition } from './types';

/* ------------------------- Sin disko: script + fileSystems ------------------------- */

export const rawDevice = (part: Partition) =>
  part.existing
    ? part.existing.uuid
      ? `/dev/disk/by-uuid/${part.existing.uuid}`
      : part.existing.device
    : `/dev/disk/by-partlabel/${part.name}`;

export const mappedDevice = (part: Partition) => (part.encrypt ? `/dev/mapper/crypt-${part.name}` : rawDevice(part));

export const mkfs: Record<Exclude<PartFs, 'none'>, (device: string, name: string) => string> = {
  vfat: (device) => `mkfs.fat -F 32 ${device}`,
  ext4: (device, name) => `mkfs.ext4 -L ${name} ${device}`,
  xfs: (device, name) => `mkfs.xfs -f -L ${name} ${device}`,
  btrfs: (device, name) => `mkfs.btrfs -f -L ${name} ${device}`,
  swap: (device, name) => `mkswap -L ${name} ${device}`,
};

/** Script bash que particiona, formatea y monta el esquema en /mnt. */
export function generatePartitionScript(device: string, parts: Partition[]): string {
  const fresh = parts.filter((part) => !part.existing);
  const lines = [
    '#!/usr/bin/env bash',
    t('# Generado por NixOSBuilder. REVÍSALO línea a línea antes de ejecutarlo como root:'),
    t('# crea particiones y formatea. Los datos de lo que formatees se perderán.'),
    'set -euo pipefail',
    '',
    `DISK=${device}`,
    '',
  ];
  if (fresh.length > 0) {
    lines.push(
      parts.some((part) => part.existing)
        ? t('# Se conservan las particiones existentes; las nuevas se crean en el espacio libre.')
        : t('# Borra la tabla de particiones y crea una GPT nueva.'),
    );
    if (!parts.some((part) => part.existing)) lines.push('sgdisk --zap-all "$DISK"');
    for (const part of fresh) {
      const end = part.size === '100%' ? '0' : `+${part.size}`;
      lines.push(`sgdisk -n 0:0:${end} -t 0:${gptType(part)} -c 0:${part.name} "$DISK"`);
    }
    lines.push('partprobe "$DISK"', 'udevadm settle', '');
  }

  const crypted = parts.filter((part) => part.encrypt);
  if (crypted.length > 0) {
    lines.push(t('# Cifrado LUKS (pedirá la contraseña)'));
    for (const part of crypted) {
      if (!part.existing) lines.push(`cryptsetup luksFormat ${rawDevice(part)}`);
      lines.push(`cryptsetup open ${rawDevice(part)} crypt-${part.name}`);
    }
    lines.push('');
  }

  const formatted = parts.filter((part) => !part.existing && part.fs !== 'none');
  if (formatted.length > 0) {
    lines.push(t('# Sistemas de archivos'));
    for (const part of formatted) lines.push(mkfs[part.fs as Exclude<PartFs, 'none'>](mappedDevice(part), part.name));
    lines.push('');
  }

  const mounted = parts
    .filter((part) => part.mountpoint && part.fs !== 'none' && part.fs !== 'swap')
    .sort((a, b) => a.mountpoint.split('/').length - b.mountpoint.split('/').length || a.mountpoint.length - b.mountpoint.length);
  lines.push(t('# Montaje en /mnt'));
  for (const part of mounted) {
    const target = part.mountpoint === '/' ? '/mnt' : `/mnt${part.mountpoint}`;
    lines.push(`mount --mkdir ${part.fs === 'vfat' ? '-o umask=0077 ' : ''}${mappedDevice(part)} ${target}`);
  }
  for (const part of parts.filter((item) => item.fs === 'swap')) lines.push(`swapon ${mappedDevice(part)}`);
  lines.push('');
  return lines.join('\n');
}

/** Fichero filesystems.nix (fileSystems, swapDevices y LUKS) para usar sin disko. */
export function generateFilesystemsNix(parts: Partition[], discard: boolean): string {
  const lines = ['{ ... }:', '{'];
  for (const part of parts.filter((item) => item.encrypt)) {
    lines.push(
      `  boot.initrd.luks.devices.${q(`crypt-${part.name}`)} = {`,
      `    device = ${q(rawDevice(part))};`,
      ...(discard ? ['    allowDiscards = true;'] : []),
      '  };',
    );
  }
  for (const part of parts.filter((item) => item.mountpoint && item.fs !== 'none' && item.fs !== 'swap')) {
    const options = dirOptions(part.fs, discard);
    lines.push(
      `  fileSystems.${q(part.mountpoint)} = {`,
      `    device = ${q(mappedDevice(part))};`,
      `    fsType = ${q(part.fs)};`,
      ...(options.length ? [`    options = ${nixOptions(options)};`] : []),
      '  };',
    );
  }
  const swaps = parts.filter((part) => part.fs === 'swap');
  if (swaps.length > 0) {
    lines.push('  swapDevices = [');
    for (const part of swaps) lines.push(`    { device = ${q(mappedDevice(part))}; }`);
    lines.push('  ];');
  }
  lines.push('}', '');
  return lines.join('\n');
}

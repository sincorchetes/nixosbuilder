// Lectura de lsblk y esquemas iniciales.

import { formatSize, parseSize } from './size';
import type { LsblkDisk, LsblkPartition, PartFs, Partition } from './types';

/* --------------------------------- lsblk --------------------------------- */

export const treePrefix = /^[\s│├└─|`'\\-]*/;
export const wholeDisk = /^(?:sd[a-z]+|vd[a-z]+|hd[a-z]+|xvd[a-z]+|nvme\d+n\d+|mmcblk\d+)$/;
export const knownFs = new Set([
  'vfat',
  'ext2',
  'ext3',
  'ext4',
  'xfs',
  'btrfs',
  'swap',
  'ntfs',
  'exfat',
  'f2fs',
  'zfs_member',
  'crypto_LUKS',
  'LVM2_member',
  'iso9660',
  'bcachefs',
  'linux_raid_member',
]);
export const ignoredTypes = new Set(['loop', 'rom']);

/**
 * Interpreta la salida de `lsblk`. Funciona por tipo de dato (tamaño, sistema de archivos,
 * punto de montaje…) y no por posición de columna, porque las celdas vacías mueven las demás.
 */
export function parseLsblk(text: string): LsblkDisk[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headerIndex = lines.findIndex((line) => /\bNAME\b/.test(line));
  const header = headerIndex >= 0 ? lines[headerIndex].trim().split(/\s+/) : [];
  const flagColumns = header.filter((name) => ['RM', 'RO', 'ROTA'].includes(name));
  const disks: LsblkDisk[] = [];
  let disk: LsblkDisk | undefined;
  let part: LsblkPartition | undefined;

  for (const line of lines.slice(headerIndex + 1)) {
    const name = line.replace(treePrefix, '').split(/\s+/)[0];
    if (!name) continue;
    const rest = line.replace(treePrefix, '').slice(name.length).trim();
    const tokens = rest ? rest.split(/\s+/) : [];

    let bytes = 0;
    let type = '';
    let fstype = '';
    let uuid = '';
    let mountpoint = '';
    const flags: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (/^\d+:\d+$/.test(token)) continue;
      if (!bytes && /^\d+(?:[.,]\d+)?[BKMGTP]$/i.test(token)) bytes = parseSize(token);
      else if (!type && /^(?:disk|part|crypt|lvm|loop|rom|raid\d*|md|dm|mpath)$/.test(token)) type = token;
      else if (knownFs.has(token)) fstype = token;
      else if (/^[01]$/.test(token)) flags.push(token);
      else if (!uuid && /^(?:[0-9A-F]{4}-[0-9A-F]{4}|[0-9a-f]{8}-[0-9a-f-]{27}|[0-9A-Fa-f]{16})$/.test(token)) uuid = token;
      else if (token.startsWith('/') || token === '[SWAP]') {
        const tail = tokens.slice(i);
        // Las columnas 0/1 (RM, RO, ROTA) que siguen al punto de montaje no forman parte de él.
        if (flagColumns.length && header[header.length - 1] === flagColumns[flagColumns.length - 1]) flags.push(tail.pop()!);
        mountpoint = tail.join(' ');
      }
      if (mountpoint) break;
    }
    if (!type) type = wholeDisk.test(name) ? 'disk' : disk && name.startsWith(disk.device.slice(5)) ? 'part' : '';
    if (!type || ignoredTypes.has(type) || name.startsWith('zram')) continue;
    if (mountpoint === '[SWAP]') mountpoint = 'swap';

    if (type === 'disk') {
      const rotaPosition = flagColumns.indexOf('ROTA');
      const rotational = rotaPosition >= 0 && flags.length === flagColumns.length ? flags[rotaPosition] === '1' : undefined;
      disk = { device: `/dev/${name}`, bytes, rotational, partitions: [] };
      disks.push(disk);
      part = undefined;
    } else if (type === 'part' && disk) {
      part = { device: `/dev/${name}`, bytes, fstype, uuid, label: '', mountpoint };
      disk.partitions.push(part);
    } else if (type === 'crypt' && part) {
      part.child = { fstype, mountpoint };
    }
  }
  return disks.filter((item) => item.bytes > 0 || item.partitions.length > 0);
}

/** Identificador local de una partición (no es un secreto; se usa solo como clave de lista). */
export const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, '0')).join('');

export const mapFs = (fstype: string): PartFs =>
  fstype === 'vfat' || fstype === 'ext4' || fstype === 'xfs' || fstype === 'btrfs' || fstype === 'swap' ? fstype : 'none';

/** Convierte las particiones leídas con lsblk en un esquema editable (todas existentes y sin formatear). */
export function layoutFromLsblk(disk: LsblkDisk): Partition[] {
  return disk.partitions.map((item, i) => {
    const encrypted = item.fstype === 'crypto_LUKS';
    const fstype = encrypted ? (item.child?.fstype ?? '') : item.fstype;
    const mountpoint = (encrypted ? item.child?.mountpoint : item.mountpoint) ?? '';
    const fs = mapFs(fstype);
    return {
      id: newId(),
      name: `${item.device.slice(5).replace(/[^a-zA-Z0-9_-]/g, '-')}`.slice(0, 36) || `part${i + 1}`,
      size: formatSize(item.bytes),
      fs,
      mountpoint: fs === 'none' || fs === 'swap' || !mountpoint.startsWith('/') ? '' : mountpoint,
      encrypt: encrypted,
      existing: { device: item.device, uuid: item.uuid || undefined, fstype: item.fstype || undefined, bytes: item.bytes },
    };
  });
}

export const newPartition = (preset: 'esp' | 'swap' | 'root' | 'home' | 'data', taken: string[] = []): Partition => {
  const base = { id: newId(), encrypt: false };
  const unique = (name: string) => {
    let candidate = name;
    for (let n = 2; taken.includes(candidate); n++) candidate = `${name}${n}`;
    return candidate;
  };
  switch (preset) {
    case 'esp':
      return { ...base, name: unique('esp'), size: '1G', fs: 'vfat', mountpoint: '/boot' };
    case 'swap':
      return { ...base, name: unique('swap'), size: '8G', fs: 'swap', mountpoint: '' };
    case 'root':
      return { ...base, name: unique('root'), size: '100%', fs: 'btrfs', mountpoint: '/' };
    case 'home':
      return { ...base, name: unique('home'), size: '100%', fs: 'ext4', mountpoint: '/home' };
    case 'data':
      return { ...base, name: unique('data'), size: '100G', fs: 'ext4', mountpoint: '/data' };
  }
};

export const defaultLayout = (): Partition[] => [newPartition('esp'), newPartition('root')];

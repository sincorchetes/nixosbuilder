// Tipos del esquema de particiones y patrones de validación.

export type PartFs = 'vfat' | 'ext4' | 'xfs' | 'btrfs' | 'swap' | 'none';

export interface ExistingPartition {
  /** Ruta del dispositivo, p. ej. /dev/nvme0n1p1. */
  device: string;
  uuid?: string;
  /** Sistema de archivos detectado (aunque NixOSBuilder no lo gestione). */
  fstype?: string;
  bytes: number;
}

export interface Partition {
  id: string;
  /** Etiqueta GPT (PARTLABEL). */
  name: string;
  /** `512M`, `1G`… o `100%` (el resto del disco, solo la última). */
  size: string;
  fs: PartFs;
  mountpoint: string;
  encrypt: boolean;
  /** Partición que ya existe en el disco: no se crea ni se formatea. */
  existing?: ExistingPartition;
}

export interface LsblkPartition {
  device: string;
  bytes: number;
  fstype: string;
  uuid: string;
  label: string;
  mountpoint: string;
  /** Hijo descifrado (crypt) si la partición es LUKS y está abierta. */
  child?: { fstype: string; mountpoint: string };
}

export interface LsblkDisk {
  device: string;
  bytes: number;
  rotational?: boolean;
  partitions: LsblkPartition[];
}

export const lsblkCommand = 'lsblk -o NAME,SIZE,TYPE,FSTYPE,UUID,MOUNTPOINTS,ROTA';

export const fsLabels: Record<PartFs, string> = {
  vfat: 'FAT32 (ESP)',
  ext4: 'ext4',
  xfs: 'XFS',
  btrfs: 'Btrfs',
  swap: 'swap',
  none: 'sin formato',
};

export const partNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,35}$/;
export const mountPattern = /^\/(?:[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*)?$/;
export const sizePattern = /^[1-9]\d{0,5}[KMGT]$/;
export const devicePattern = /^\/dev\/[a-zA-Z0-9/_-]+$/;

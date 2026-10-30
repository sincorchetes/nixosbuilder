// Validación del esquema de particiones.

import { formatSize, layoutBytes } from './size';
import { devicePattern, fsLabels, mountPattern, type Partition, partNamePattern, sizePattern } from './types';

/* ------------------------------- Validación ------------------------------- */

export function validateLayout(parts: Partition[], opts: { device: string; diskBytes: number; disko: boolean }) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!devicePattern.test(opts.device)) errors.push('El disco debe ser una ruta de dispositivo válida, como /dev/sda o /dev/nvme0n1.');
  if (parts.length === 0) errors.push('El esquema de particiones está vacío.');

  const names = new Set<string>();
  const mounts = new Set<string>();
  parts.forEach((part, i) => {
    const label = part.name || `#${i + 1}`;
    if (!part.existing) {
      if (!partNamePattern.test(part.name)) errors.push(`Nombre de partición no válido: «${label}» (letras, números, - y _).`);
      else if (names.has(part.name)) errors.push(`Nombre de partición repetido: ${part.name}.`);
      names.add(part.name);
      if (part.size !== '100%' && !sizePattern.test(part.size))
        errors.push(`Tamaño no válido en «${label}»: usa números enteros con K, M, G o T (512M, 20G) o 100%.`);
      if (part.size === '100%' && i !== parts.length - 1)
        errors.push(`Solo la última partición puede ocupar el resto del disco (100%): «${label}».`);
    } else if (part.name && names.has(part.name)) {
      errors.push(`Nombre de partición repetido: ${part.name}.`);
    } else names.add(part.name);

    if (part.fs === 'none' || part.fs === 'swap') {
      if (part.mountpoint) errors.push(`«${label}» (${fsLabels[part.fs]}) no puede tener punto de montaje.`);
    } else if (part.mountpoint) {
      if (!mountPattern.test(part.mountpoint)) errors.push(`Punto de montaje no válido en «${label}»: ${part.mountpoint}.`);
      else if (mounts.has(part.mountpoint)) errors.push(`Punto de montaje repetido: ${part.mountpoint}.`);
      mounts.add(part.mountpoint);
    }
    if (part.encrypt && part.fs === 'vfat')
      errors.push(`La partición ESP «${label}» (FAT32) no puede cifrarse: el firmware la necesita en claro.`);
    if (part.encrypt && part.fs === 'none') errors.push(`«${label}» está cifrada pero sin sistema de archivos: elige uno.`);
    if (part.fs !== 'none' && part.fs !== 'swap' && !part.mountpoint && !part.existing)
      warnings.push(`«${label}» tiene sistema de archivos pero no punto de montaje.`);
  });

  if (!mounts.has('/')) errors.push('Falta una partición montada en / (raíz).');
  const boot = parts.find((part) => part.mountpoint === '/boot');
  if (!boot) errors.push('Falta una partición en /boot: para arrancar con UEFI necesitas una ESP FAT32 montada en /boot.');
  else if (boot.fs !== 'vfat') warnings.push('/boot debería ser FAT32 (ESP) para arrancar con UEFI.');

  const used = layoutBytes(parts, 0);
  if (opts.diskBytes > 0) {
    const fixed = parts.reduce((sum, part, i) => sum + (part.size === '100%' && !part.existing ? 0 : used[i]), 0);
    if (fixed > opts.diskBytes)
      warnings.push(`Las particiones suman ${formatSize(fixed)}, más que el disco (${formatSize(opts.diskBytes)}).`);
  }
  if (opts.disko && parts.some((part) => part.existing)) {
    errors.push(
      'disko no puede conservar particiones existentes (recrea el disco entero). Quita las particiones existentes o desactiva disko para generar un script en su lugar.',
    );
  }
  return { errors, warnings };
}

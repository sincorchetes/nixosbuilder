// Utilidades para escribir Nix.
import type { Channel, NixBuilderConfig } from './types';

export const nixString = (value: string) => JSON.stringify(value).replaceAll('${', '\\${');
export const nixList = (values: string[]) => `[ ${values.map(nixString).join(' ')} ]`;

export const indent = (text: string, spaces: number) =>
  text
    .split('\n')
    .map((line) => (line ? ' '.repeat(spaces) + line : line))
    .join('\n');
export const indentTail = (text: string, spaces: number) =>
  text
    .split('\n')
    .map((line, i) => (i === 0 || !line ? line : ' '.repeat(spaces) + line))
    .join('\n');

export const packageNames = (value: string) => [
  ...new Set(
    value
      .split(/[\s,]+/)
      .map((name) => name.trim())
      .filter(Boolean),
  ),
];

/** Versión de lanzaboote (Secure Boot): como entrada del flake o descargada como tarball sin flakes. */
export const lanzabooteRef = 'v1.2.0';

export const stateVersion = (channel: Channel) => (channel === 'unstable' ? '26.05' : channel);

/** Identificador de 8 dígitos hexadecimales derivado del nombre del equipo (requerido por ZFS). */
export const hostId = (hostname: string) => {
  let hash = 0x811c9dc5;
  for (const char of hostname) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
};

export const usesZfs = (config: NixBuilderConfig) => config.disko && !config.customLayout && config.diskScheme === 'zfs';

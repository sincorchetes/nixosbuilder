import { strToU8, zipSync } from 'fflate';
import type { GeneratedFile } from './generator';

/** Empaqueta los archivos en un .zip y lo descarga desde el navegador. */
export function downloadZip(files: GeneratedFile[], hostname: string) {
  const data: Record<string, Uint8Array> = {};
  for (const file of files) data[`nixos-${hostname}/${file.path}`] = strToU8(file.content);
  const blob = new Blob([zipSync(data) as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `nixos-${hostname}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

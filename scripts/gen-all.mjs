// Genera todos los índices estáticos: paquetes, opciones de Home Manager y estado del catálogo de software.
import { spawnSync } from 'node:child_process';

for (const script of ['copy-legal.mjs', 'gen-packages.mjs', 'eval-software.ts']) {
  spawnSync(process.execPath, [new URL(script, import.meta.url).pathname, ...process.argv.slice(2).filter((arg) => arg !== '--')], {
    stdio: 'inherit',
  });
}

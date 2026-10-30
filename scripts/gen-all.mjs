// Genera todos los índices estáticos: paquetes, opciones de Home Manager y estado del catálogo de software.
// Si un script falla de verdad (error al arrancar o código de salida distinto de 0) se detiene todo, para
// no construir con índices antiguos. Lo que los scripts toleran a propósito (p. ej. sin `nix`) solo avisa.
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2).filter((arg) => arg !== '--');

for (const script of ['copy-legal.mjs', 'gen-packages.mjs', 'eval-software.ts']) {
  const result = spawnSync(process.execPath, [new URL(script, import.meta.url).pathname, ...args], { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`[gen-all] ${script} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status ?? result.signal})`}`);
    process.exit(result.status || 1);
  }
}

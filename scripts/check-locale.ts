// Verifica que los mapas de teclado de consola de src/lib/locale.ts existen en el paquete kbd de nixpkgs.
// Uso: bun scripts/check-locale.ts   (requiere nix)
import { execFileSync } from 'node:child_process';
import { keyboards } from '../src/lib/locale.ts';

const out = execFileSync('nix', ['build', '--no-link', '--print-out-paths', 'nixpkgs#kbd^out'], { encoding: 'utf8' }).trim().split('\n')[0];
const maps = new Set(
  execFileSync('find', [`${out}/share/keymaps`, '-name', '*.map.gz'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((file) => file.replace(/.*\//, '').replace(/\.map\.gz$/, '')),
);
const missing = keyboards.filter((keyboard) => !maps.has(keyboard.console));
for (const keyboard of missing) console.log(`MISSING  ${keyboard.id}: console map "${keyboard.console}"`);
console.log(missing.length ? `${missing.length} problems` : `keyboards OK (${keyboards.length})`);

// (Incluye también las opciones de Home Manager al final del archivo.)
// Genera un índice estático de paquetes de nixpkgs por canal en public/packages/.
// Fuente: https://channels.nixos.org/<canal>/packages.json.br (el mismo que usa search.nixos.org).
// Formato de salida: { names, versions, descriptions: string[], unfree: number[] (índices) } (columnar y ordenado).
// Nunca rompe el build: si no hay red y no existe un índice previo, la web avisa y no valida paquetes.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';

const channels = { 26.05: 'nixos-26.05', 25.11: 'nixos-25.11', unstable: 'nixos-unstable' };
const outDir = new URL('../public/packages/', import.meta.url);
const maxAgeMs = 3 * 24 * 3600 * 1000;
const force = process.argv.includes('--force');
mkdirSync(outDir, { recursive: true });

for (const [channel, source] of Object.entries(channels)) {
  const target = new URL(`${channel}.json`, outDir);
  if (!force && existsSync(target) && Date.now() - statSync(target).mtimeMs < maxAgeMs) {
    console.log(`[packages] ${channel}: index is recent, reusing it`);
    continue;
  }
  try {
    const response = await fetch(`https://channels.nixos.org/${source}/packages.json.br`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = Buffer.from(await response.arrayBuffer());
    // Según el runtime, fetch puede entregar ya descomprimido el contenido.
    const data = JSON.parse((raw[0] === 0x7b ? raw : brotliDecompressSync(raw)).toString());
    const rows = Object.entries(data.packages)
      .map(([name, pkg]) => [
        name,
        pkg.version ?? '',
        (pkg.meta?.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
        pkg.meta?.unfree ? 1 : 0,
      ])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    // packages.json.br puede estar incompleto (p. ej. nodejs en 25.11): se completa con los nombres de atributo reales.
    let extra = [];
    try {
      const attrs = JSON.parse(
        execFileSync(
          'nix',
          ['eval', '--json', '--apply', 'builtins.attrNames', `github:NixOS/nixpkgs/${source}#legacyPackages.x86_64-linux`],
          { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
        ),
      );
      const known = new Set(rows.map((row) => row[0]));
      extra = attrs.filter((name) => /^[A-Za-z0-9_][A-Za-z0-9_'+.-]*$/.test(name) && !known.has(name)).sort();
    } catch {
      console.warn(`[packages] ${channel}: no attribute list (nix not available)`);
    }
    writeFileSync(
      target,
      JSON.stringify({
        names: rows.map((row) => row[0]),
        versions: rows.map((row) => row[1]),
        descriptions: rows.map((row) => row[2]),
        unfree: rows.flatMap((row, i) => (row[3] ? [i] : [])),
        extra,
      }),
    );
    console.log(`[packages] ${channel}: ${rows.length} packages`);
  } catch (error) {
    console.warn(`[packages] ${channel}: could not generate (${error.message})`);
  }
}

// ---- Opciones de Home Manager (Appendix A) ----
// Se construye `docs-json` desde el flake de cada release y se guarda solo nombre + descripción corta.
// Requiere `nix` en el PATH; si no está disponible, se omite sin romper el build.
import { readFileSync } from 'node:fs';

const hmRefs = { 26.05: 'release-26.05', 25.11: 'release-25.11', unstable: 'master' };
const hmDir = new URL('../public/hm-options/', import.meta.url);
mkdirSync(hmDir, { recursive: true });

for (const [channel, ref] of Object.entries(hmRefs)) {
  const target = new URL(`${channel}.json`, hmDir);
  if (!force && existsSync(target) && Date.now() - statSync(target).mtimeMs < maxAgeMs) {
    console.log(`[hm-options] ${channel}: index is recent, reusing it`);
    continue;
  }
  try {
    const out = execFileSync('nix', ['build', '--no-link', '--print-out-paths', `github:nix-community/home-manager/${ref}#docs-json`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
      .trim()
      .split('\n')
      .pop();
    const options = JSON.parse(readFileSync(`${out}/share/doc/home-manager/options.json`, 'utf8'));
    const names = Object.keys(options)
      .filter((name) => !name.startsWith('_'))
      .sort();
    const descriptions = names.map((name) => {
      const text = options[name].description;
      const plain = typeof text === 'string' ? text : (text?.text ?? '');
      return plain.replace(/\s+/g, ' ').trim().slice(0, 90);
    });
    writeFileSync(target, JSON.stringify({ names, descriptions }));
    console.log(`[hm-options] ${channel}: ${names.length} options`);
  } catch (error) {
    console.warn(`[hm-options] ${channel}: could not generate (${error.message.split('\n')[0]})`);
  }
}

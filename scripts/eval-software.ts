// Evalúa cada paquete del catálogo en cada canal para detectar los rotos, inseguros o inexistentes
// y guarda el resultado en public/software-status.json ({ "25.11": ["docker", ...], ... }).
// Uso: bun scripts/eval-software.ts [--force]   (requiere nix; sin nix se omite sin romper el build)
import { execFileSync } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { allItems } from '../src/lib/software.ts';

const target = new URL('../public/software-status.json', import.meta.url);
if (!process.argv.includes('--force') && existsSync(target) && Date.now() - statSync(target).mtimeMs < 3 * 24 * 3600 * 1000) {
  console.log('[software] status is recent, reusing it');
  process.exit(0);
}

const attrs = [
  ...new Set(
    [...allItems.values()].flatMap((item) => [
      ...(item.packages ?? []),
      ...(item.requires ?? []),
      ...(item.versions?.map((v) => v.package) ?? []),
    ]),
  ),
].sort();

const expr = (channel: string) => `
  let
    pkgs = import (builtins.getFlake "github:NixOS/nixpkgs/${channel}") { system = "x86_64-linux"; config.allowUnfree = true; };
    attrs = builtins.fromJSON ''${JSON.stringify(attrs)}'';
    get = path: pkgs.lib.attrByPath (pkgs.lib.splitString "." path) null pkgs;
  in builtins.listToAttrs (map (a: {
    name = a;
    value = let r = builtins.tryEval (builtins.deepSeq (get a).drvPath true); in r.success;
  }) attrs)
`;

const status: Record<string, string[]> = {};
try {
  for (const [key, channel] of [
    ['25.11', 'nixos-25.11'],
    ['26.05', 'nixos-26.05'],
    ['unstable', 'nixos-unstable'],
  ]) {
    const result = JSON.parse(
      execFileSync('nix', ['eval', '--impure', '--json', '--expr', expr(channel)], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    ) as Record<string, boolean>;
    status[key] = Object.entries(result)
      .filter(([, ok]) => !ok)
      .map(([attr]) => attr)
      .sort();
    console.log(`[software] ${key}: ${status[key].length} unavailable packages ${status[key].join(', ')}`);
  }
  writeFileSync(target, JSON.stringify(status));
} catch (error) {
  console.warn(`[software] could not evaluate (${String((error as Error).message).split('\n')[0]})`);
}

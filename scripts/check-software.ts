// Verifica que los paquetes del catálogo de software existen en cada canal y que la marca `unfree` es correcta.
// Uso: bun scripts/check-software.ts   (requiere haber generado public/packages con `bun run packages`)
import { readFileSync } from 'node:fs';
import { allItems } from '../src/lib/software.ts';

let problems = 0;
for (const channel of ['25.11', '26.05', 'unstable']) {
  const data = JSON.parse(readFileSync(new URL(`../public/packages/${channel}.json`, import.meta.url), 'utf8'));
  const lookup = new Map<string, number>(data.names.map((name: string, i: number) => [name, i]));
  const unfree = new Set<number>(data.unfree);
  const extra = new Set<string>(data.extra);
  for (const item of allItems.values()) {
    const attrs = [...(item.packages ?? []), ...(item.versions?.map((v) => v.package) ?? [])];
    let isUnfree = false;
    for (const attr of attrs) {
      if (channel === 'unstable' && attr.startsWith('jetbrains.')) continue; // retirados de nixpkgs unstable
      const index = lookup.get(attr);
      if (index === undefined && extra.has(attr)) {
        isUnfree = Boolean(item.unfree);
        continue;
      }
      if (index === undefined) {
        console.log(`[${channel}] MISSING  ${item.id}: ${attr}`);
        problems++;
        continue;
      }
      if (unfree.has(index)) isUnfree = true;
    }
    if (attrs.length && Boolean(item.unfree) !== isUnfree && !item.nixos?.some((l) => l.includes('steam'))) {
      console.log(`[${channel}] UNFREE ${item.id}: catalog=${Boolean(item.unfree)} nixpkgs=${isUnfree}`);
      problems++;
    }
  }
}
console.log(problems ? `${problems} problems` : 'catalog OK on all 3 channels');

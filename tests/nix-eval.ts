// Evalúa con Nix las configuraciones generadas en cada canal (necesita `nix` instalado).
// Uso: bun tests/nix-eval.ts [canal ...]   (por defecto: 25.11 26.05 unstable)
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newPartition } from '../src/lib/disk';
import { type Channel, classicConfig, defaultConfig, generateFiles, type NixBuilderConfig, validateConfig } from '../src/lib/generator';
import { isItemAvailable, itemsFor, type Profile } from '../src/lib/software';

const root = join(import.meta.dir, '..');
const channels = (process.argv.slice(2).length ? process.argv.slice(2) : ['25.11', '26.05', 'unstable']) as Channel[];
const STUB_FS = '{ ... }:\n{\n  fileSystems."/" = { device = "/dev/sda1"; fsType = "ext4"; };\n}\n';
const EMPTY_HW = '{ ... }:\n{\n}\n';

const status: Record<string, string[]> = JSON.parse(readFileSync(join(root, 'public/software-status.json'), 'utf8'));
const index = (channel: Channel) => JSON.parse(readFileSync(join(root, `public/packages/${channel}.json`), 'utf8'));

/** Sin disko, esquema propio ni hardware-configuration.nix el generador pide definir el destino: se usa uno de prueba. */
const withTarget = (config: NixBuilderConfig): NixBuilderConfig =>
  config.disko || config.customLayout || config.hardwareConfiguration.trim() ? config : { ...config, hardwareConfiguration: STUB_FS };

interface Case {
  name: string;
  patch: Partial<NixBuilderConfig>;
}

function cases(channel: Channel): Case[] {
  const names = new Set<string>(index(channel).names.concat(index(channel).extra ?? []));
  const unavailable = new Set(status[channel] ?? []);
  const profileCase = (profile: Profile): Case => {
    const items = itemsFor(profile).filter((item) => isItemAvailable(item, unavailable));
    const versions = Object.fromEntries(
      items
        .filter((item) => item.versions)
        .map((item) => [item.id, (item.versions!.find((v) => names.has(v.package)) ?? item.versions![0]).value]),
    );
    return {
      name: `profile-${profile}`,
      patch: {
        profile,
        selected: items.map((item) => item.id),
        versions,
        desktop: profile === 'server' ? 'none' : 'gnome',
        homeManager: false,
        hardwareConfiguration: STUB_FS,
      },
    };
  };
  const desktops = ['gnome', 'kde', 'hyprland', 'xfce', 'cosmic', 'lxqt', 'cinnamon'] as const;
  return [
    ...desktops.map(
      (desktop): Case => ({ name: `desktop-${desktop}`, patch: { desktop, homeManager: false, hardwareConfiguration: STUB_FS } }),
    ),
    ...(['server', 'developer', 'devops', 'gamer'] as const).map(profileCase),
    {
      name: 'languages',
      patch: {
        locale: 'es_ES.UTF-8',
        extraLocales: ['en_US.UTF-8', 'fr_FR.UTF-8'],
        keyboard: 'es-cat',
        extraKeyboards: ['us', 'dvorak'],
        homeManager: false,
        hardwareConfiguration: STUB_FS,
      },
    },
    {
      name: 'firewall',
      patch: {
        firewall: {
          enable: true,
          rules: [
            { port: '8080', protocol: 'tcp' },
            { port: '5000-5010', protocol: 'udp' },
          ],
          allowPing: false,
          rejectPackets: true,
          logRefused: false,
        },
        homeManager: false,
        hardwareConfiguration: STUB_FS,
      },
    },
    {
      name: 'home-manager',
      patch: { homeManager: true, hmModules: ['programs.zsh', 'programs.git'], hmPackages: 'ripgrep', hardwareConfiguration: STUB_FS },
    },
    { name: 'secure-boot', patch: { secureBoot: true, homeManager: false, hardwareConfiguration: STUB_FS } },
    ...(['btrfs', 'ext4', 'xfs', 'lvm', 'zfs'] as const).map(
      (diskScheme): Case => ({
        name: `disko-${diskScheme}`,
        patch: { disko: true, diskScheme, encryption: diskScheme !== 'lvm', homeManager: false, hardwareConfiguration: EMPTY_HW },
      }),
    ),
    {
      name: 'custom-layout-disko',
      patch: {
        customLayout: true,
        disko: true,
        partitions: [newPartition('esp'), newPartition('swap'), { ...newPartition('root'), encrypt: true }],
        homeManager: false,
        hardwareConfiguration: EMPTY_HW,
      },
    },
    {
      name: 'custom-layout-script',
      patch: {
        customLayout: true,
        disko: false,
        partitions: [newPartition('esp'), { ...newPartition('root'), fs: 'ext4' }],
        homeManager: false,
        hardwareConfiguration: EMPTY_HW,
      },
    },
  ];
}

async function evaluate(dir: string): Promise<{ ok: boolean; log: string }> {
  const proc = Bun.spawn(['nix', 'eval', '--no-warn-dirty', '.#nixosConfigurations.nixos.config.system.build.toplevel.drvPath'], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  await proc.exited;
  return {
    ok: out.includes('/nix/store'),
    log: err
      .split('\n')
      .filter((line) => /error|undefined|does not exist|assertion/i.test(line))
      .slice(0, 4)
      .join('\n'),
  };
}

/** Modelo tradicional (vista simple): <nixpkgs/nixos> con los canales de nixpkgs y Home Manager. */
async function evaluateClassic(dir: string, channel: Channel): Promise<{ ok: boolean; log: string }> {
  const nixpkgs = `https://github.com/NixOS/nixpkgs/archive/${channel === 'unstable' ? 'nixos-unstable' : `nixos-${channel}`}.tar.gz`;
  const homeManager = `https://github.com/nix-community/home-manager/archive/${channel === 'unstable' ? 'master' : `release-${channel}`}.tar.gz`;
  const proc = Bun.spawn(
    [
      'nix-instantiate',
      '<nixpkgs/nixos>',
      '-A',
      'system',
      '-I',
      `nixpkgs=${nixpkgs}`,
      '-I',
      `home-manager=${homeManager}`,
      '-I',
      'nixos-config=./configuration.nix',
    ],
    { cwd: dir, stdout: 'pipe', stderr: 'pipe' },
  );
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  await proc.exited;
  return {
    ok: out.includes('/nix/store'),
    log: err
      .split('\n')
      .filter((line) => /error|undefined|does not exist|assertion/i.test(line))
      .slice(0, 4)
      .join('\n'),
  };
}

async function runClassic(channel: Channel, base: string) {
  const results: Array<{ name: string; ok: boolean; log: string }> = [];
  // Los casos de disko solo existen en la vista técnica.
  for (const { name, patch } of cases(channel).filter(({ patch }) => !patch.disko)) {
    const config = classicConfig(withTarget({ ...structuredClone(defaultConfig), channel, ...patch }));
    const errors = validateConfig(config);
    if (errors.length) {
      results.push({ name: `classic ${name}`, ok: false, log: `validation: ${errors.join(' ')}` });
      continue;
    }
    const dir = join(base, `${channel}-classic-${name}`);
    mkdirSync(join(dir, 'home'), { recursive: true });
    for (const file of generateFiles(config)) writeFileSync(join(dir, file.path), file.content);
    results.push({ name: `classic ${name}`, ...(await evaluateClassic(dir, channel)) });
  }
  return results;
}

async function runChannel(channel: Channel, base: string) {
  const results: Array<{ name: string; ok: boolean; log: string }> = [];
  let firstDir: string | undefined;
  for (const { name, patch } of cases(channel)) {
    const config = withTarget({ ...structuredClone(defaultConfig), channel, ...patch });
    const errors = validateConfig(config);
    if (errors.length) {
      results.push({ name, ok: false, log: `validation: ${errors.join(' ')}` });
      continue;
    }
    const dir = join(base, `${channel}-${name}`);
    mkdirSync(join(dir, 'home'), { recursive: true });
    for (const file of generateFiles(config)) writeFileSync(join(dir, file.path), file.content);
    // Se reutiliza el flake.lock del primer caso para no descargar las entradas una vez por caso.
    if (firstDir)
      try {
        writeFileSync(join(dir, 'flake.lock'), readFileSync(join(firstDir, 'flake.lock')));
      } catch {
        /* aún no existe */
      }
    firstDir ??= dir;
    results.push({ name, ...(await evaluate(dir)) });
  }
  return results;
}

const base = mkdtempSync(join(tmpdir(), 'nixosbuilder-eval-'));
const all = await Promise.all(
  channels.map(async (channel) => [channel, [...(await runChannel(channel, base)), ...(await runClassic(channel, base))]] as const),
);
let failed = 0;
for (const [channel, results] of all) {
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${channel} ${result.name}${result.ok ? '' : `\n${result.log.replace(/^/gm, '       ')}`}`);
    if (!result.ok) failed++;
  }
}
console.log(`\n${all.flatMap(([, r]) => r).length - failed} passed, ${failed} failed (files in ${base})`);
process.exit(failed ? 1 : 0);

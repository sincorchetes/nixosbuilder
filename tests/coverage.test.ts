import { afterEach, describe, expect, mock, test } from 'bun:test';
import { siteBase } from '../src/lib/base';
import { hmOptionsSearchUrl } from '../src/lib/catalog';
import { formatSize, generateDiskoLayout, generatePartitionScript, newPartition, validateLayout } from '../src/lib/disk';
import { downloadZip } from '../src/lib/download';
import { getWarnings, nextSteps, rebuildCommand, validateConfig } from '../src/lib/generator';
import { analyzeModuleCode, buildHmIndex, loadHmIndex, resetHmIndexCache } from '../src/lib/hmvalidate';
import { translate } from '../src/lib/i18n';
import { allTimeZones } from '../src/lib/locale';
import { loadIndex, resetIndexCache } from '../src/lib/packages';
import { buildWarnings } from '../src/lib/problems';
import { itemsFor } from '../src/lib/software';
import { fileMap, makeConfig } from './helpers';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  resetHmIndexCache();
  resetIndexCache();
});

describe('paths and small utilities', () => {
  test('hmOptionsSearchUrl encodes the query', () => {
    expect(hmOptionsSearchUrl('programs.zsh enable')).toBe('https://home-manager-options.extranix.com/?query=programs.zsh%20enable');
  });
  test('siteBase always ends with a slash', () => expect(siteBase.endsWith('/')).toBe(true));
  test('formatSize uses bytes for very small sizes', () => expect(formatSize(500)).toBe('500B'));
  test('allTimeZones returns UTC and system zones', () => {
    const zones = allTimeZones();
    expect(zones[0]).toBe('UTC');
    expect(zones).toContain('Europe/Madrid');
  });
  test('allTimeZones uses a fallback list if Intl does not support the query', () => {
    const original = (Intl as any).supportedValuesOf;
    (Intl as any).supportedValuesOf = () => {
      throw new Error('no soportado');
    };
    try {
      expect(allTimeZones()).toContain('Europe/Madrid');
    } finally {
      (Intl as any).supportedValuesOf = original;
    }
  });
});

describe('index loading (fetch)', () => {
  const respond = (body: unknown, ok = true) => {
    globalThis.fetch = mock(async () => ({ ok, json: async () => body })) as never;
  };

  test('package index: success', async () => {
    respond({ names: ['git'], versions: ['1'], descriptions: ['VCS'], unfree: [], extra: ['nodejs'] });
    const index = await loadIndex('25.11', '/');
    expect(index?.lookup.get('git')).toBe(0);
    expect(index?.extra.has('nodejs')).toBe(true);
  });
  test('package index: cached per channel', async () => {
    respond({ names: ['git'], versions: ['1'], descriptions: ['VCS'] });
    await loadIndex('25.11', '/');
    respond({ names: ['otra'], versions: [''], descriptions: [''] });
    expect((await loadIndex('25.11', '/'))?.names).toEqual(['git']);
  });
  test('package index: invalid response gives null', async () => {
    respond(null, false);
    expect(await loadIndex('26.05', '/')).toBeNull();
  });
  test('package index: network error gives null', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('sin red');
    }) as never;
    expect(await loadIndex('unstable', '/')).toBeNull();
  });

  test('Home Manager index: success, cached and failing', async () => {
    respond({ names: ['programs.zsh.enable'], descriptions: ['x'] });
    expect((await loadHmIndex('25.11', '/'))?.set.has('programs.zsh.enable')).toBe(true);
    respond({ names: [] });
    expect((await loadHmIndex('25.11', '/'))?.names).toEqual(['programs.zsh.enable']);
    respond({ sinNames: true });
    expect(await loadHmIndex('26.05', '/')).toBeNull();
    globalThis.fetch = mock(async () => {
      throw new Error('sin red');
    }) as never;
    expect(await loadHmIndex('unstable', '/')).toBeNull();
  });
});

describe('.zip download', () => {
  test('packs the files and triggers the download', () => {
    const clicked: string[] = [];
    const revoked: string[] = [];
    const originals = {
      URL: globalThis.URL.createObjectURL,
      revoke: globalThis.URL.revokeObjectURL,
      document: (globalThis as any).document,
    };
    globalThis.URL.createObjectURL = () => 'blob:prueba';
    globalThis.URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };
    (globalThis as any).document = {
      createElement: () => ({
        click() {
          clicked.push(this.download);
        },
        set href(_: string) {},
        download: '',
      }),
    };
    try {
      downloadZip([{ path: 'configuration.nix', content: '{ }' }], 'equipo');
    } finally {
      globalThis.URL.createObjectURL = originals.URL;
      globalThis.URL.revokeObjectURL = originals.revoke;
      (globalThis as any).document = originals.document;
    }
    expect(clicked).toEqual(['nixos-equipo.zip']);
    expect(revoked).toEqual(['blob:prueba']);
  });
});

describe('disk: uncommon branches', () => {
  test('newPartition("home")', () => expect(newPartition('home')).toMatchObject({ name: 'home', mountpoint: '/home', fs: 'ext4' }));
  test('XFS on an HDD adds no discard and swap has no options', () => {
    const parts = [{ ...newPartition('root'), fs: 'xfs' as const }];
    expect(generateDiskoLayout('/dev/sda', parts, false)).toContain('mountOptions = [ "noatime" ]');
    expect(generateDiskoLayout('/dev/sda', parts, true)).toContain('"discard"');
    expect(generateDiskoLayout('/dev/sda', [newPartition('swap'), ...parts], false)).toContain('type = "swap"');
  });
  test('an unformatted encrypted partition is rejected; a duplicate existing one too', () => {
    const none = { ...newPartition('data'), fs: 'none' as const, mountpoint: '', encrypt: true };
    expect(validateLayout([newPartition('root'), none], { device: '/dev/sda', diskBytes: 0, disko: false }).errors.join()).toMatch(
      /sin sistema de archivos/,
    );
    const existing = { ...newPartition('root'), existing: { device: '/dev/sda1', bytes: 1 } };
    const again = { ...existing, id: 'otro', mountpoint: '/home' };
    expect(validateLayout([existing, again], { device: '/dev/sda', diskBytes: 0, disko: false }).errors.join()).toMatch(/repetido: root/);
  });
  test('the script formats every filesystem type', () => {
    const parts = (['ext4', 'xfs', 'btrfs', 'swap'] as const).map((fs, i) => ({
      ...newPartition('data'),
      name: `p${i}`,
      size: '1G',
      fs,
      mountpoint: fs === 'swap' ? '' : `/m${i}`,
    }));
    const script = generatePartitionScript('/dev/vda', parts);
    for (const tool of ['mkfs.ext4', 'mkfs.xfs', 'mkfs.btrfs', 'mkswap']) expect(script).toContain(tool);
  });
});

describe('generator: uncommon branches', () => {
  test('GRUB with multiboot enables os-prober', () => {
    const nix = fileMap(makeConfig({ bootloader: 'grub', multiboot: true }))['configuration.nix'];
    expect(nix).toContain('boot.loader.grub');
    expect(nix).toContain('useOSProber = true');
  });
  test('keyboards with a variant generate xkb.variant', () => {
    const nix = fileMap(makeConfig({ keyboard: 'es-cat', extraKeyboards: ['us'] }))['configuration.nix'];
    expect(nix).toContain('services.xserver.xkb.variant');
  });
  test('Enlightenment generates its configuration even though validation blocks it', () => {
    expect(fileMap(makeConfig({ desktop: 'enlightenment', homeManager: false }))['configuration.nix']).toContain('enlightenment.enable');
  });
  test('an empty hardware-configuration.nix generates a minimal module', () => {
    expect(fileMap(makeConfig({ hardwareConfiguration: '' }))['hardware-configuration.nix']).toBe('{ ... }:\n{\n}\n');
  });
  test('Hyprland with Home Manager also enables it in home.nix', () => {
    expect(fileMap(makeConfig({ desktop: 'hyprland', homeManager: true }))['home.nix']).toContain('wayland.windowManager.hyprland.enable');
  });
  test('without flakes it applies with a plain nixos-rebuild switch', () => {
    expect(rebuildCommand(makeConfig({ flakes: false }))).toBe('sudo nixos-rebuild switch');
    expect(nextSteps(makeConfig({ flakes: false })).at(-1)!.command).toBe('sudo nixos-rebuild switch');
  });
  test('an invalid custom layout shows up in validation', () => {
    expect(validateConfig(makeConfig({ customLayout: true, partitions: [] })).join()).toMatch(/vacío/);
  });
});

describe('uncommon warnings', () => {
  const warnings = (patch: object) => getWarnings(makeConfig(patch as never)).join('\n');
  test('Secure Boot with multiboot', () => expect(warnings({ secureBoot: true, multiboot: true })).toMatch(/dual boot: el otro sistema/));
  test('unfree software chosen without NVIDIA', () => {
    const steam = itemsFor('gamer').find((item) => item.id === 'steam')!;
    expect(warnings({ profile: 'gamer', selected: [steam.id] })).toMatch(/software no libre seleccionado/);
  });
  test('custom layout: layout and script warnings', () => {
    const text = warnings({ customLayout: true, disko: false, partitions: [{ ...newPartition('root') }] });
    expect(text).toMatch(/partition\.sh formatea/);
    expect(validateConfig(makeConfig({ customLayout: true, disko: false, partitions: [{ ...newPartition('root') }] })).join()).toMatch(
      /\/boot/,
    );
  });
  test('encryption with disko, no flakes, Hyprland without Home Manager, GRUB with disko', () => {
    expect(warnings({ disko: true, encryption: true })).toMatch(/cifrado pedirá la contraseña/);
    expect(warnings({ flakes: false, disko: true })).toMatch(/Sin flakes/);
    expect(warnings({ flakes: false, homeManager: true })).not.toMatch(/Sin flakes/);
    expect(warnings({ desktop: 'hyprland', homeManager: false })).toMatch(/Hyprland funciona mejor/);
    expect(warnings({ bootloader: 'grub', disko: true })).toMatch(/GRUB y disko/);
  });
  test('Plasma without an X11 session on unstable', () => {
    expect(warnings({ desktop: 'kde', session: 'x11', channel: 'unstable' })).toMatch(/Plasma 6\.8/);
  });
});

describe('syntax error translation', () => {
  const cases: Array<[string, RegExp]> = [
    ['Línea 1: "}" inesperado (¿falta un ";" antes?)', /unexpected "\}" \(missing a ";" before it\?\)/],
    ['Línea 4: "}" no coincide con "{" de la línea 2', /does not match "\{" from line 2/],
    ['Línea 5: falta un ";" al final del valor que empieza en la línea 3', /starting on line 3/],
    ['Línea 2: se esperaba "=" tras programs.zsh', /expected "=" after programs\.zsh/],
    ['Línea 1: algo que no conocemos', /Line 1: algo que no conocemos/],
  ];
  test.each(cases)('case #%#', (message, expected) => expect(translate('en', message)).toMatch(expected));
});

describe('branches that used to share a line (disk and warnings)', () => {
  test('an existing partition without a UUID is mounted by its device path', () => {
    const existing = { ...newPartition('root'), existing: { device: '/dev/sda2', bytes: 1 } };
    expect(generatePartitionScript('/dev/sda', [existing])).toContain('mount --mkdir /dev/sda2 /mnt');
  });
  test('a filesystem without a mount point warns', () => {
    const data = { ...newPartition('data'), mountpoint: '' };
    const { warnings } = validateLayout([newPartition('root'), data], { device: '/dev/sda', diskBytes: 0, disko: false });
    expect(warnings.join()).toMatch(/tiene sistema de archivos pero no punto de montaje/);
  });
  test('an encrypted ESP is rejected', () => {
    const { errors } = validateLayout([{ ...newPartition('esp'), encrypt: true }, newPartition('root')], {
      device: '/dev/sda',
      diskBytes: 0,
      disko: false,
    });
    expect(errors.join()).toMatch(/no puede cifrarse/);
  });
  test('a full module that does not enable its module produces a warning', () => {
    const file = { id: 'programs.zsh', path: 'home/zsh.nix' };
    const index = buildHmIndex({ names: ['programs.zsh.enable', 'programs.zsh.enableCompletion'], descriptions: ['', ''] });
    const code = '{ ... }:\n{\n  programs.zsh.enableCompletion = true;\n}';
    const config = makeConfig({ homeManager: true, hmModuleCode: { 'programs.zsh': code } });
    const modules = [{ file, report: analyzeModuleCode(code, file.id, index) }];
    const warnings = buildWarnings(config, {
      unavailableChosen: [],
      missingSystem: [],
      missingHm: [],
      unknownModules: [],
      modules,
      hmIndexLoaded: true,
    });
    expect(warnings.join()).toMatch(/el módulo completo no activa programs\.zsh\.enable/);
  });
});

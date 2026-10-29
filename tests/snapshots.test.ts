import { describe, expect, test } from 'bun:test';
import { defaultLayout, newPartition } from '../src/lib/disk';
import { allItems, itemsFor } from '../src/lib/software';
import { fileMap, makeConfig } from './helpers';

// Instantáneas de la salida completa: cualquier cambio en los archivos generados se revisa a conciencia.
// Para aceptar un cambio intencionado: `bun test --update-snapshots`.

const render = (files: Record<string, string>) =>
  Object.keys(files)
    .sort()
    .map((path) => `===== ${path} =====\n${files[path]}`)
    .join('\n');

describe('snapshots', () => {
  test('default configuration', () => {
    expect(render(fileMap(makeConfig()))).toMatchSnapshot();
  });

  test('KDE with encrypted disko, Secure Boot and Home Manager', () => {
    const config = makeConfig({
      desktop: 'kde',
      session: 'wayland',
      disko: true,
      encryption: true,
      diskScheme: 'btrfs',
      secureBoot: true,
      homeManager: true,
      hmModules: ['programs.zsh', 'programs.git'],
      hmPackages: 'ripgrep',
      hmModuleCode: { 'programs.zsh': 'programs.zsh.enableCompletion = true;' },
    });
    expect(render(fileMap(config))).toMatchSnapshot();
  });

  test('server with services, firewall and ZFS', () => {
    const selected = itemsFor('server')
      .filter((item) => ['nginx', 'postgresql', 'docker', 'tailscale'].includes(item.id))
      .map((item) => item.id);
    const config = makeConfig({
      profile: 'server',
      selected,
      versions: { postgresql: '16' },
      desktop: 'none',
      openSsh: true,
      pipewire: false,
      bluetooth: false,
      disko: true,
      diskScheme: 'zfs',
      firewall: { enable: true, rules: [{ port: '8080', protocol: 'tcp' }], allowPing: false, rejectPackets: false, logRefused: true },
    });
    expect(selected).toHaveLength(4);
    expect(render(fileMap(config))).toMatchSnapshot();
  });

  test('custom layout without disko, with swap and LUKS', () => {
    const config = makeConfig({
      customLayout: true,
      disko: false,
      diskDevice: '/dev/nvme0n1',
      partitions: [...defaultLayout().slice(0, 1), newPartition('swap'), { ...newPartition('root'), encrypt: true }],
    });
    expect(render(fileMap(config))).toMatchSnapshot();
  });

  test('gamer profile with the whole available catalog', () => {
    const items = itemsFor('gamer')
      .filter((item) => allItems.has(item.id))
      .map((item) => item.id);
    expect(render(fileMap(makeConfig({ profile: 'gamer', selected: items, desktop: 'kde', allowUnfree: true })))).toMatchSnapshot();
  });
});

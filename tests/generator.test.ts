import { afterEach, describe, expect, test } from 'bun:test';
import {
  generateFiles,
  getWarnings,
  isFirewallCustomized,
  nextSteps,
  parsePort,
  passwordReminder,
  rebuildCommand,
  validateConfig,
} from '../src/lib/generator';
import { setLang } from '../src/lib/i18n';
import { fileMap, makeConfig } from './helpers';

afterEach(() => setLang('es'));

describe('generated files', () => {
  test('the default configuration is valid and generates the base files', () => {
    const config = makeConfig();
    expect(validateConfig(config)).toEqual([]);
    const paths = generateFiles(config).map((file) => file.path);
    expect(paths).toContain('flake.nix');
    expect(paths).toContain('configuration.nix');
    expect(paths).toContain('hardware-configuration.nix');
  });

  test('is deterministic: same answers, same files', () => {
    const config = makeConfig({ desktop: 'kde', disko: true, encryption: true });
    expect(generateFiles(config)).toEqual(generateFiles(structuredClone(config)));
  });

  test('without flakes there is no flake.nix and disko is imported as a channel', () => {
    const files = fileMap(makeConfig({ flakes: false, disko: true }));
    expect(files['flake.nix']).toBeUndefined();
    expect(files['configuration.nix']).toContain('<disko/module.nix>');
  });

  test('with flakes, disko and home-manager come in as modules', () => {
    const flake = fileMap(makeConfig({ disko: true, homeManager: true }))['flake.nix'];
    expect(flake).toContain('inputs.disko.nixosModules.disko');
    expect(flake).toContain('inputs.home-manager.nixosModules.home-manager');
  });

  const desktops: Array<[string, RegExp]> = [
    ['gnome', /gdm/],
    ['kde', /plasma6/],
    ['hyprland', /hyprland/],
    ['xfce', /xfce/],
    ['cosmic', /cosmic/],
    ['lxqt', /lxqt/],
    ['cinnamon', /cinnamon/],
  ];
  test.each(desktops)('the %s desktop enables its configuration', (desktop, pattern) => {
    const config = makeConfig({ desktop: desktop as never, homeManager: false });
    expect(fileMap(config)['configuration.nix']).toMatch(pattern);
  });

  test('without a desktop no display manager is enabled', () => {
    expect(fileMap(makeConfig({ desktop: 'none' }))['configuration.nix']).not.toMatch(/displayManager/);
  });

  test('language, keyboard and time zone', () => {
    const config = makeConfig({ locale: 'fr_FR.UTF-8', extraLocales: ['de_DE.UTF-8'], keyboard: 'es', timeZone: 'Atlantic/Canary' });
    const nix = fileMap(config)['configuration.nix'];
    expect(nix).toContain('i18n.defaultLocale = "fr_FR.UTF-8"');
    expect(nix).toContain('de_DE.UTF-8/UTF-8');
    expect(nix).toContain('time.timeZone = "Atlantic/Canary"');
    expect(nix).toContain('services.xserver.xkb.layout');
  });

  test('several keyboards add the Alt+Shift shortcut', () => {
    expect(fileMap(makeConfig({ extraKeyboards: ['us'] }))['configuration.nix']).toContain('grp:alt_shift_toggle');
  });

  test('Secure Boot uses lanzaboote and disables systemd-boot', () => {
    const nix = fileMap(makeConfig({ secureBoot: true }))['configuration.nix'];
    expect(nix).toContain('boot.lanzaboote');
    expect(nix).toContain('lib.mkForce false');
    expect(fileMap(makeConfig({ secureBoot: true }))['flake.nix']).toContain('lanzaboote');
  });

  test('bootspec is only enabled on stable channels (on unstable the option is an error)', () => {
    expect(fileMap(makeConfig({ secureBoot: true, channel: '26.05' }))['configuration.nix']).toContain('boot.bootspec.enable = true');
    expect(fileMap(makeConfig({ secureBoot: true, channel: 'unstable' }))['configuration.nix']).not.toContain('bootspec');
  });

  test('ZFS adds hostId and maintenance services', () => {
    const nix = fileMap(makeConfig({ disko: true, diskScheme: 'zfs' }))['configuration.nix'];
    expect(nix).toMatch(/networking\.hostId = "[0-9a-f]{8}"/);
    expect(nix).toContain('services.zfs.autoScrub.enable');
  });

  test('LUKS encryption shows up in disko.nix', () => {
    const disko = fileMap(makeConfig({ disko: true, encryption: true }))['disko.nix'];
    expect(disko).toContain('type = "luks"');
  });

  test('the preset layouts generate their filesystem', () => {
    for (const [scheme, text] of [
      ['btrfs', 'type = "btrfs"'],
      ['ext4', 'format = "ext4"'],
      ['xfs', 'format = "xfs"'],
      ['lvm', 'lvm_vg'],
      ['zfs', 'zpool'],
    ] as const) {
      expect(fileMap(makeConfig({ disko: true, diskScheme: scheme }))['disko.nix']).toContain(text);
    }
  });

  test('profile-apps.nix only appears if the profile brings applications', () => {
    expect(fileMap(makeConfig())['profile-apps.nix']).toBeUndefined();
    const files = fileMap(makeConfig({ extraApps: [{ name: 'gimp', unfree: false }] }));
    expect(files['profile-apps.nix']).toContain('gimp');
    expect(files['configuration.nix']).toContain('./profile-apps.nix');
  });

  test('Home Manager generates home.nix and one file per module', () => {
    const files = fileMap(
      makeConfig({
        homeManager: true,
        hmModules: ['programs.zsh'],
        hmModuleCode: { 'programs.zsh': 'programs.zsh.enableCompletion = true;' },
      }),
    );
    expect(files['home.nix']).toContain('./home/zsh.nix');
    expect(files['home/zsh.nix']).toContain('programs.zsh.enableCompletion = true;');
    expect(files['home/zsh.nix']).toContain('programs.zsh.enable = true;');
  });

  test('a pasted full module is not duplicated', () => {
    const code = '{ pkgs, ... }:\n{\n  programs.zsh.enable = true;\n}';
    const files = fileMap(makeConfig({ homeManager: true, hmModules: ['programs.zsh'], hmModuleCode: { 'programs.zsh': code } }));
    expect(files['home/zsh.nix'].match(/programs\.zsh\.enable/g)).toHaveLength(1);
  });

  test('allowUnfree is enabled with NVIDIA or unfree software', () => {
    expect(fileMap(makeConfig({ gpu: 'nvidia' }))['configuration.nix']).toContain('allowUnfree');
    expect(fileMap(makeConfig({ allowUnfree: true }))['configuration.nix']).toContain('allowUnfree');
  });
});

describe('firewall', () => {
  test('enabled by default and not considered customized', () => {
    const config = makeConfig();
    expect(config.firewall.enable).toBe(true);
    expect(isFirewallCustomized(config.firewall)).toBe(false);
  });

  test('rules are grouped by protocol and accept ranges', () => {
    const nix = fileMap(
      makeConfig({
        firewall: {
          enable: true,
          rules: [
            { port: '8080', protocol: 'tcp' },
            { port: '5000-5010', protocol: 'udp' },
            { port: '53', protocol: 'both' },
          ],
          allowPing: false,
          rejectPackets: true,
          logRefused: false,
        },
      }),
    )['configuration.nix'];
    expect(nix).toContain('allowedTCPPorts');
    expect(nix).toContain('from = 5000; to = 5010');
    expect(nix).toContain('allowPing = false');
    expect(nix).toContain('rejectPackets = true');
  });

  test('disabled writes enable = false', () => {
    const nix = fileMap(makeConfig({ firewall: { enable: false, rules: [], allowPing: true, rejectPackets: false, logRefused: true } }))[
      'configuration.nix'
    ];
    expect(nix).toContain('networking.firewall.enable = false');
  });

  test.each([
    ['80', 80, 80],
    ['8000-8100', 8000, 8100],
  ])('parsePort accepts %s', (text, from, to) => {
    expect(parsePort(text)).toEqual({ from, to });
  });
  test.each(['', 'abc', '70000', '100-', '-5', '1-2-3'])('parsePort rejects “%s”', (text) => {
    expect(parsePort(text)).toBeNull();
  });
});

describe('validation', () => {
  const errorsOf = (patch: object) => validateConfig(makeConfig(patch as never));

  test('hostname and username', () => {
    expect(errorsOf({ hostname: 'Mal Nombre!' }).join()).toMatch(/equipo/);
    expect(errorsOf({ username: 'Root User' }).join()).toMatch(/usuario/);
    expect(errorsOf({ fullName: '  ' }).join()).toMatch(/nombre visible/);
  });

  test('language, keyboard and time zone', () => {
    expect(errorsOf({ locale: 'espanol' }).join()).toMatch(/idioma principal/);
    expect(errorsOf({ extraLocales: ['xx'] }).join()).toMatch(/idioma adicional/);
    expect(errorsOf({ keyboard: 'klingon' }).join()).toMatch(/teclado/);
    expect(errorsOf({ timeZone: 'Madrid!' }).join()).toMatch(/zona horaria/);
  });

  test('invalid packages and modules', () => {
    expect(errorsOf({ packages: 'git bad!pkg' }).join()).toMatch(/Paquetes del sistema no válidos: bad!pkg/);
    expect(errorsOf({ homeManager: true, hmPackages: 'x y!' }).join()).toMatch(/Home Manager no válidos/);
    expect(errorsOf({ homeManager: true, hmModules: ['no-valido'] }).join()).toMatch(/Módulos de Home Manager no válidos/);
  });

  test('Secure Boot requires flakes and systemd-boot', () => {
    expect(errorsOf({ secureBoot: true, flakes: false }).join()).toMatch(/requiere activar flakes/);
    expect(errorsOf({ secureBoot: true, bootloader: 'grub' }).join()).toMatch(/GRUB/);
  });

  test('invalid firewall ports', () => {
    expect(
      errorsOf({
        firewall: { enable: true, rules: [{ port: 'x', protocol: 'tcp' }], allowPing: true, rejectPackets: false, logRefused: true },
      }).join(),
    ).toMatch(/Puertos no válidos/);
  });

  test('an invalid disk only matters with disko', () => {
    expect(errorsOf({ disko: true, diskDevice: 'sda' }).join()).toMatch(/ruta de dispositivo/);
    expect(errorsOf({ disko: false, diskDevice: 'sda' })).toEqual([]);
  });
});

describe('warnings', () => {
  const warningsOf = (patch: object) => getWarnings(makeConfig(patch as never)).join('\n');

  test('multiboot with disko', () => expect(warningsOf({ multiboot: true, disko: true })).toMatch(/dual boot/));
  test('NVIDIA requires unfree software', () => expect(warningsOf({ gpu: 'nvidia' })).toMatch(/allowUnfree/));
  test('firewall disabled', () => {
    expect(warningsOf({ firewall: { enable: false, rules: [], allowPing: true, rejectPackets: false, logRefused: true } })).toMatch(
      /firewall está desactivado/,
    );
  });
  test('disko erases the disk', () => expect(warningsOf({ disko: true })).toMatch(/borrará/));
  test('ZFS', () => expect(warningsOf({ disko: true, diskScheme: 'zfs' })).toMatch(/OpenZFS/));
  test('empty hardware-configuration', () => expect(warningsOf({ hardwareConfiguration: '' })).toMatch(/hardware-configuration/));
});

describe('final steps', () => {
  const stepsText = (patch: object) =>
    nextSteps(makeConfig(patch as never))
      .map((step) => `${step.text} ${step.command ?? ''}`)
      .join('\n');

  test('with disko, it installs writing temporary files and cache to the disk', () => {
    const text = stepsText({ disko: true });
    expect(text).toContain('nix run github:nix-community/disko');
    expect(text).toContain('TMPDIR=/mnt/tmp');
    expect(text).toContain('XDG_CACHE_HOME=/mnt/tmp/cache');
    expect(text).toContain('nixos-install --flake /mnt/etc/nixos#nixos');
    expect(text).not.toContain('nixos-rebuild');
  });

  test('a custom layout without disko runs partition.sh', () => {
    const text = stepsText({ customLayout: true, disko: false });
    expect(text).toContain('partition.sh');
    expect(text).toContain('nixos-generate-config --root /mnt');
  });

  test('without an install it only validates and applies', () => {
    const text = stepsText({});
    expect(text).toContain('nix flake check');
    expect(text).toContain(rebuildCommand(makeConfig()));
  });

  test('without flakes it does not use --flake', () => {
    expect(stepsText({ flakes: false, disko: true })).not.toContain('--flake /mnt');
  });

  test('Secure Boot adds sbctl', () => expect(stepsText({ secureBoot: true })).toContain('sbctl create-keys'));

  test('password reminder with the username', () => {
    const text = passwordReminder(makeConfig({ username: 'ana' }));
    expect(text).toContain('`passwd root`');
    expect(text).toContain('`passwd ana`');
  });
});

describe('language of the generated files', () => {
  test('comments come out in English with setLang("en")', () => {
    const config = makeConfig();
    setLang('en');
    const nix = generateFiles(config).find((file) => file.path === 'configuration.nix')!.content;
    expect(nix).toContain('Before rebooting');
    expect(nix).not.toContain('Antes de reiniciar');
  });
});

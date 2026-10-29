import { afterEach, describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { firewallPresets, hmModules } from '../src/lib/catalog';
import { fsLabels } from '../src/lib/disk';
import { en, patterns } from '../src/lib/en';
import { getLang, setLang, t, translate } from '../src/lib/i18n';
import { keyboards } from '../src/lib/locale';
import { allItems, brokenDesktops, profiles, profileTitle } from '../src/lib/software';
import { hub, wizardSteps } from '../src/lib/wizardSteps';

afterEach(() => setLang('es'));

const SRC = join(import.meta.dir, '..', 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/** Textos que el código pasa a t() / tt() como literales. */
const literalKeys = (): Map<string, string> => {
  const keys = new Map<string, string>();
  for (const file of walk(SRC).filter((path) => /\.(svelte|astro|ts)$/.test(path) && !path.includes('/lib/en/'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?<![\w.])tt?\('((?:[^'\\]|\\.)*)'\)/g)) {
      keys.set(match[1].replace(/\\'/g, "'").replace(/\\n/g, '\n'), file.replace(SRC, 'src'));
    }
  }
  return keys;
};

/** Textos de datos (catálogos, perfiles, teclados…) que se muestran traducidos. */
const dataKeys = (): string[] => [
  ...[...allItems.values()].flatMap((item) => [
    item.label,
    item.description,
    item.category,
    ...(item.versions ?? []).map((version) => version.label),
  ]),
  ...profiles.flatMap((profile) => [profile.label, profile.description]),
  ...Object.values(profileTitle).flatMap((title) => [title!.button, title!.dialog]),
  ...hmModules.flatMap((module) => [module.label, module.category]),
  ...firewallPresets.map((preset) => preset.label),
  ...keyboards.map((keyboard) => keyboard.label),
  ...Object.values(fsLabels),
  ...Object.values(brokenDesktops),
  ...hub.flatMap((group) => [group.title, ...group.spokes.map((spoke) => spoke.title)]),
  ...wizardSteps.map((step) => step.title),
];

/** Nombres propios, siglas y comandos que se escriben igual en inglés. */
const SAME_IN_ENGLISH = new Set<string>([
  'Nix',
  'Software',
  'Flakes',
  'Home Manager',
  'NetworkManager',
  'Bluetooth',
  'Firewall',
  'SSH',
  'HTTP',
  'HTTPS',
  'DNS',
  'TCP',
  'UDP',
  'LUKS',
  'ext4',
  'XFS',
  'LVM',
  'ZFS',
  'Btrfs',
  'SSD',
  'NVMe',
  'AMD',
  'Intel',
  'NVIDIA',
  'GNOME',
  'COSMIC',
  'LXQt',
  'KDE Plasma',
  'Cinnamon',
  'Hyprland',
  'unstable',
  'aarch64',
  'NixOS 26.05',
  'NixOS 25.11',
  'systemd-boot',
  'GRUB (UEFI)',
  'hardware-configuration.nix',
  'Appendix A',
  '/dev/nvme0n1',
  'bun run packages',
  'Wayland',
  'X11',
  'Syncthing',
  'KDE Connect',
  'Gamer',
  'DevOps',
  'NixOSBuilder',
  'Docker',
  'Podman',
  'NGINX',
  'Caddy',
  'PostgreSQL',
  'Redis',
  'Memcached',
  'Prometheus',
  'Fail2ban',
  'Tailscale',
  'Jellyfin',
  'Steam',
  'GameMode',
  'Gamescope',
  'Neovim',
  'Zed',
  'VSCodium',
  'Visual Studio Code',
  'IntelliJ IDEA',
  'JetBrains',
  'PyCharm',
  'CLion',
  'WebStorm',
  'GoLand',
  'RustRover',
  'PhpStorm',
  'Rider',
  'RubyMine',
  'DataGrip',
  'DataSpell',
  'Node.js',
  'Go',
  'Bun',
  'GitHub CLI',
  'gh',
  'lazygit',
  'DBeaver',
  'Postman',
  'Insomnia',
  'kubectl',
  'Kubernetes',
  'Helm',
  'k9s',
  'kind',
  'Minikube',
  'Kustomize',
  'OpenTofu',
  'Terraform',
  'Ansible',
  'Packer',
  'AWS CLI',
  'Azure CLI',
  'Google Cloud SDK',
  'lazydocker',
  'dive',
  'Trivy',
  'Heroic Games Launcher',
  'Lutris',
  'Bottles',
  'Prism Launcher',
  'Minecraft',
  'RetroArch',
  'Winetricks',
  'ProtonUp-Qt',
  'MangoHud',
  'GOverlay',
  'Discord',
  'OBS Studio',
  'Bash',
  'Shell',
  'Zsh',
  'Fish',
  'Nushell',
  'Starship (prompt)',
  'fzf',
  'direnv',
  'tmux',
  'Zellij',
  'bat',
  'eza',
  'ripgrep',
  'fd',
  'jq',
  'htop',
  'btop',
  'fastfetch',
  'Git',
  'Vim',
  'Helix',
  'Emacs',
  'VS Code',
  'GnuPG',
  'Alacritty',
  'kitty',
  'WezTerm',
  'foot',
  'Ghostty',
  'Firefox',
  'Chromium',
  'Thunderbird',
  'mpv',
  'Waybar',
  'rofi',
  'wofi',
  'Hyprlock',
  'gpg-agent',
  'ssh-agent',
  'Flameshot',
  'EasyEffects',
  'Hypridle',
  'playerctld',
  'Enlightenment',
  'XFCE',
  'Apache HTTP Server',
  'Apache Tomcat',
  'Apache NetBeans',
  'Eclipse (Java)',
  'MySQL / MariaDB',
  'MariaDB',
  'MySQL 8.4 LTS',
  'PostgreSQL 17',
  'PostgreSQL 16',
  'PostgreSQL 15',
  'PostgreSQL 14',
  'Python 3',
  'Rust (rustup)',
  'GCC + Make + CMake',
  'OpenJDK',
  '.NET SDK',
  'Argo CD (CLI)',
  'direnv + nix-direnv',
  'Wine (staging)',
  'systemd',
  'Servidor',
  'LUKS',
  'Español',
  'TRIM / discard',
  '+ ESP /boot',
  '+ swap',
  '+ /home',
  'Colemak (EE. UU.)',
  'Dvorak (EE. UU.)',
  'X11 (Xorg)',
  'swap',
  'devenv',
  'GitOps',
  'Audio (PipeWire)',
  'Amazon Web Services',
  'Microsoft Azure',
  'Google Cloud',
  'MPRIS proxy (Bluetooth)',
  'Secure Boot (lanzaboote)',
  'TCP+UDP',
  'x86_64',
  '512M',
  '20G',
  '1T',
  'o',
  '80 o 8000-8100',
  '× ',
  '×',
  '←',
  '+',
  'FAT32 (ESP)',
  '',
  'Resumen',
  'Nix y NixOS',
  'Python',
  'Rust',
]);

describe('translation', () => {
  test('in Spanish it returns the text unchanged', () => {
    setLang('es');
    expect(t('Descargar .zip ↓')).toBe('Descargar .zip ↓');
    expect(getLang()).toBe('es');
  });

  test('in English it translates, and leaves unknown text as is', () => {
    setLang('en');
    expect(t('Siguiente')).toBe('Next');
    expect(t('Texto que no existe en el diccionario')).toBe('Texto que no existe en el diccionario');
  });

  test('translate(lang, …) does not depend on the global language', () => {
    setLang('es');
    expect(translate('en', 'Idioma')).toBe('Language');
    expect(translate('es', 'Idioma')).toBe('Idioma');
  });

  test('the dictionary has no empty values', () => {
    expect(
      Object.entries(en)
        .filter(([, value]) => !value.trim())
        .map(([key]) => key),
    ).toEqual([]);
  });

  test('translations identical to the original are known proper names', () => {
    const same = Object.entries(en)
      .filter(([key, value]) => value === key && !SAME_IN_ENGLISH.has(key))
      .map(([key]) => key);
    expect(same).toEqual([]);
  });

  test('every text the code uses has a translation', () => {
    const missing = [...literalKeys()].filter(
      ([key]) => !(key in en) && !SAME_IN_ENGLISH.has(key) && !/^[^A-Za-zÀ-ÿ]*$/.test(key) && !/^NAME\s/.test(key),
    );
    expect(missing.map(([key, file]) => `${file}: ${key}`)).toEqual([]);
  });

  test('every catalog, profile and keyboard text has a translation', () => {
    const missing = [...new Set(dataKeys())].filter((key) => !(key in en) && !SAME_IN_ENGLISH.has(key));
    expect(missing).toEqual([]);
  });

  test('translations leave no unreplaced placeholders', () => {
    for (const value of Object.values(en)) expect(value).not.toMatch(/\{\{|\$\{|undefined/);
  });
});

describe('messages with variable data', () => {
  const samples: Array<[string, RegExp]> = [
    [
      'El escritorio enlightenment no está disponible: python-efl está roto en nixpkgs (no es compatible con el Python actual).',
      /^The enlightenment desktop is not available: python-efl is broken/,
    ],
    ['Paquetes del sistema no válidos: foo!.', /^Invalid system packages: foo!\.$/],
    ['Paquetes de Home Manager no válidos: a, b.', /^Invalid Home Manager packages: a, b\.$/],
    ['Módulos de Home Manager no válidos: x.', /^Invalid Home Manager modules: x\.$/],
    ['Puertos no válidos en el firewall: abc. Usa 1-65535 o rangos como 8000-8100.', /^Invalid firewall ports: abc\./],
    [
      'No disponible en nixpkgs 25.11 (roto o inseguro): docker. Quítalo de la selección o cambia de canal.',
      /^Not available in nixpkgs 25\.11/,
    ],
    ['Paquetes del sistema que no existen en nixpkgs 26.05: zzz.', /^System packages that do not exist in nixpkgs 26\.05: zzz\./],
    ['Paquetes de Home Manager que no existen en nixpkgs 25.11: yyy.', /^Home Manager packages that do not exist in nixpkgs 25\.11: yyy\./],
    ['Módulos que no existen en Home Manager unstable: programs.x.', /^Modules that do not exist in Home Manager unstable/],
    ['home/zsh.nix: 2 opción(es) no encontradas en Home Manager 26.05 (a, b).', /^home\/zsh\.nix: 2 option\(s\) not found/],
    ['home/zsh.nix: el módulo completo no activa programs.zsh.enable.', /does not enable programs\.zsh\.enable/],
    ['home/zsh.nix: Línea 3: falta un ";" al final de un valor', /^home\/zsh\.nix: Line 3: missing ";" at the end of a value$/],
    ['Línea 2: "}" no coincide con "{" de la línea 1', /^Line 2: "\}" does not match "\{" from line 1$/],
    ['Nombre de partición no válido: «a b» (letras, números, - y _).', /^Invalid partition name: “a b”/],
    ['Nombre de partición repetido: root.', /^Duplicate partition name: root\.$/],
    ['Tamaño no válido en «root»: usa números enteros con K, M, G o T (512M, 20G) o 100%.', /^Invalid size in “root”/],
    ['Solo la última partición puede ocupar el resto del disco (100%): «esp».', /^Only the last partition/],
    ['«swap» (swap) no puede tener punto de montaje.', /^“swap” \(swap\) cannot have a mount point\.$/],
    ['Punto de montaje no válido en «x»: abc.', /^Invalid mount point in “x”: abc\.$/],
    ['Punto de montaje repetido: /.', /^Duplicate mount point: \/\.$/],
    ['La partición ESP «esp» (FAT32) no puede cifrarse: el firmware la necesita en claro.', /cannot be encrypted/],
    ['«x» está cifrada pero sin sistema de archivos: elige uno.', /is encrypted but has no filesystem/],
    ['«x» tiene sistema de archivos pero no punto de montaje.', /has a filesystem but no mount point/],
    ['Las particiones suman 200G, más que el disco (100G).', /^The partitions add up to 200G, more than the disk \(100G\)\.$/],
    [
      "Si usas esta configuración, no olvides asignar la contraseña de root y la de tu usuario (ana): `passwd root` · `passwd ana`. Si instalas con `nixos-install`, te pedirá la de root; la de tu usuario hazla con `nixos-enter --root /mnt -c 'passwd ana'`.",
      /^If you use this configuration.*\(ana\).*`passwd ana`/,
    ],
  ];

  test.each(samples)('message #%#', (message, expected) => {
    expect(translate('en', message)).toMatch(expected);
  });

  test('every pattern has at least one sample that exercises it', () => {
    const unused = patterns.filter(([pattern]) => !samples.some(([message]) => pattern.test(message))).map(([pattern]) => String(pattern));
    expect(unused).toEqual([]);
  });
});

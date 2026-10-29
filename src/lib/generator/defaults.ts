// Configuración por defecto y reglas de sesión gráfica.
import { defaultLayout } from '../disk';
import type { Desktop, NixBuilderConfig, Session } from './types';

export const defaultConfig: NixBuilderConfig = {
  hostname: 'nixos',
  username: 'nixuser',
  fullName: 'NixOS User',
  channel: '26.05',
  architecture: 'x86_64-linux',
  flakes: true,
  homeManager: true,
  hmPackages: 'fastfetch',
  hmModules: ['programs.git', 'programs.bash'],
  hmModuleCode: {},
  profile: 'user',
  extraApps: [],
  selected: [],
  versions: {},
  allowUnfree: false,
  bootloader: 'systemd-boot',
  secureBoot: false,
  multiboot: false,
  gpu: 'none',
  desktop: 'gnome',
  session: 'wayland',
  networkManager: true,
  bluetooth: true,
  pipewire: true,
  openSsh: false,
  firewall: {
    enable: true,
    rules: [],
    allowPing: true,
    rejectPackets: false,
    logRefused: true,
  },
  timeZone: 'Europe/Madrid',
  locale: 'es_ES.UTF-8',
  extraLocales: [],
  keyboard: 'es',
  extraKeyboards: [],
  packages: 'git curl wget vim',
  disko: false,
  diskDevice: '/dev/sda',
  diskBytes: 0,
  customLayout: false,
  partitions: defaultLayout(),
  diskScheme: 'btrfs',
  lvmFilesystem: 'ext4',
  encryption: false,
  diskKind: 'ssd',
  discard: true,
  hardwareConfiguration: '',
};

/** Sesiones gráficas disponibles según el entorno. GNOME 49+ ya no ofrece sesión X11. */
export const availableSessions = (desktop: Desktop): Session[] => {
  if (desktop === 'kde') return ['wayland', 'x11'];
  if (desktop === 'xfce' || desktop === 'lxqt' || desktop === 'enlightenment' || desktop === 'cinnamon') return ['x11'];
  if (desktop === 'none') return [];
  return ['wayland'];
};

export const effectiveSession = (config: NixBuilderConfig): Session => {
  const sessions = availableSessions(config.desktop);
  return sessions.includes(config.session) ? config.session : (sessions[0] ?? 'wayland');
};

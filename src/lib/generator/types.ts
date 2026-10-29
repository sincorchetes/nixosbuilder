// Tipos de la configuración que recoge el formulario.
import type { Partition } from '../disk';
import type { Profile } from '../software';

export type Channel = '26.05' | '25.11' | 'unstable';
export type Architecture = 'x86_64-linux' | 'aarch64-linux';
export type Desktop = 'none' | 'gnome' | 'kde' | 'hyprland' | 'xfce' | 'cosmic' | 'lxqt' | 'enlightenment' | 'cinnamon';
export type Session = 'wayland' | 'x11';
export type Gpu = 'none' | 'intel' | 'amd' | 'nvidia';
export type Bootloader = 'systemd-boot' | 'grub';
export type DiskScheme = 'ext4' | 'btrfs' | 'xfs' | 'lvm' | 'zfs';
export type LvmFilesystem = 'ext4' | 'xfs' | 'btrfs';
export type DiskKind = 'hdd' | 'ssd' | 'nvme';
export type Protocol = 'tcp' | 'udp' | 'both';

export interface FirewallRule {
  port: string;
  protocol: Protocol;
}

export interface FirewallConfig {
  /** El firewall de NixOS viene activado por defecto. */
  enable: boolean;
  rules: FirewallRule[];
  allowPing: boolean;
  rejectPackets: boolean;
  logRefused: boolean;
}

export interface NixBuilderConfig {
  hostname: string;
  username: string;
  fullName: string;
  channel: Channel;
  architecture: Architecture;
  flakes: boolean;
  homeManager: boolean;
  hmPackages: string;
  hmModules: string[];
  /** Código pegado por el usuario para cada módulo (clave: id del módulo). */
  hmModuleCode: Record<string, string>;
  /** Perfil de partida y software elegido en su catálogo. */
  profile: Profile;
  /** Paquetes de nixpkgs añadidos desde el buscador del perfil (unfree: requiere allowUnfree). */
  extraApps: Array<{ name: string; unfree: boolean }>;
  selected: string[];
  /** Versión elegida para el software que la admite (clave: id). */
  versions: Record<string, string>;
  allowUnfree: boolean;
  bootloader: Bootloader;
  secureBoot: boolean;
  multiboot: boolean;
  gpu: Gpu;
  desktop: Desktop;
  session: Session;
  networkManager: boolean;
  bluetooth: boolean;
  pipewire: boolean;
  openSsh: boolean;
  firewall: FirewallConfig;
  timeZone: string;
  locale: string;
  /** Idiomas adicionales (i18n.extraLocales). */
  extraLocales: string[];
  /** Id del teclado principal (ver locale.ts) y teclados adicionales. */
  keyboard: string;
  extraKeyboards: string[];
  packages: string;
  disko: boolean;
  diskDevice: string;
  /** Tamaño del disco en bytes (0 si se desconoce); solo para dibujar y avisar. */
  diskBytes: number;
  /** Esquema de particiones propio (editor) en lugar de uno predefinido. */
  customLayout: boolean;
  partitions: Partition[];
  diskScheme: DiskScheme;
  lvmFilesystem: LvmFilesystem;
  encryption: boolean;
  diskKind: DiskKind;
  discard: boolean;
  hardwareConfiguration: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface NextStep {
  text: string;
  command?: string;
}

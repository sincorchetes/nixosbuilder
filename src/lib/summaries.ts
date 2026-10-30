// Resumen de una línea por paso para la pantalla final del asistente.

import { effectiveSession, type NixBuilderConfig, type Session } from './generator';
import { t } from './i18n';
import { keyboardById, languageLabel } from './locale';

const desktopLabels: Record<string, string> = {
  none: 'Sin entorno gráfico',
  gnome: 'GNOME',
  cosmic: 'COSMIC',
  lxqt: 'LXQt',
  enlightenment: 'Enlightenment',
  kde: 'KDE Plasma',
  cinnamon: 'Cinnamon',
  xfce: 'XFCE',
  hyprland: 'Hyprland',
};
const gpuLabels: Record<string, string> = { none: 'Gráfica genérica', intel: 'Intel', amd: 'AMD', nvidia: 'NVIDIA' };
const schemeLabels: Record<string, string> = { btrfs: 'Btrfs', ext4: 'ext4', xfs: 'XFS', lvm: 'LVM', zfs: 'ZFS' };

const withCount = (text: string, count: number) => text + (count ? ` +${count}` : '');

function diskSummary(config: NixBuilderConfig) {
  if (config.customLayout) {
    return `${t('Esquema propio')} · ${config.partitions.length} ${t('partición(es)')} ${t('en')} ${config.diskDevice} · ${config.disko ? 'disko' : 'script'}`;
  }
  if (config.disko) {
    return `${schemeLabels[config.diskScheme]}${config.encryption ? ` ${t('cifrado')}` : ''} ${t('en')} ${config.diskDevice}`;
  }
  return config.hardwareConfiguration.trim() ? t('Particiones existentes (sin disko)') : t('Sin definir');
}

export function buildSummaries(config: NixBuilderConfig, profileLabel: string, sessions: Session[]): Record<string, string> {
  const apps = config.selected.length + config.extraApps.length;
  return {
    language: withCount(languageLabel(config.locale), config.extraLocales.length),
    keyboard: withCount(t(keyboardById(config.keyboard)?.label ?? config.keyboard), config.extraKeyboards.length),
    time: config.timeZone,
    software: [t(profileLabel), apps > 0 ? `${apps} ${t('elemento(s)')}` : ''].filter(Boolean).join(' · '),
    desktop:
      t(desktopLabels[config.desktop]) +
      (config.desktop !== 'none' && sessions.length ? ` · ${effectiveSession(config) === 'wayland' ? 'Wayland' : 'X11'}` : ''),
    hardware: [t(gpuLabels[config.gpu]), config.pipewire ? t('audio PipeWire') : '', config.bluetooth ? 'Bluetooth' : '']
      .filter(Boolean)
      .join(' · '),
    disk: diskSummary(config),
    boot: `UEFI · ${config.secureBoot ? 'Secure Boot (lanzaboote)' : config.bootloader}${config.multiboot ? ' · multiboot' : ''}`,
    network: [
      config.hostname,
      config.networkManager ? 'NetworkManager' : '',
      config.openSsh ? 'SSH' : '',
      config.firewall.enable ? t('firewall activo') : t('firewall desactivado'),
    ]
      .filter(Boolean)
      .join(' · '),
    user: `${config.fullName} (${config.username})`,
  };
}

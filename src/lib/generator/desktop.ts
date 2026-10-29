// Entornos gráficos.
import { effectiveSession } from './defaults';
import { nixString } from './nix';
import type { NixBuilderConfig } from './types';

export const generateDesktop = (config: NixBuilderConfig): string[] => {
  const wayland = effectiveSession(config) === 'wayland';
  switch (config.desktop) {
    case 'gnome':
      return ['  services.displayManager.gdm.enable = true;', '  services.desktopManager.gnome.enable = true;', ''];
    case 'kde':
      return [
        ...(wayland ? [] : ['  services.xserver.enable = true;']),
        '  services.displayManager.sddm.enable = true;',
        `  services.displayManager.sddm.wayland.enable = ${wayland};`,
        '  services.desktopManager.plasma6.enable = true;',
        `  services.displayManager.defaultSession = ${nixString(wayland ? 'plasma' : 'plasmax11')};`,
        '',
      ];
    case 'xfce':
      return [
        '  services.xserver.enable = true;',
        '  services.xserver.desktopManager.xfce.enable = true;',
        '  services.displayManager.defaultSession = "xfce";',
        '',
      ];
    case 'hyprland':
      return [
        '  programs.hyprland.enable = true;',
        '  services.displayManager.sddm.enable = true;',
        '  services.displayManager.sddm.wayland.enable = true;',
        '',
      ];
    case 'cosmic':
      return ['  services.desktopManager.cosmic.enable = true;', '  services.displayManager.cosmic-greeter.enable = true;', ''];
    case 'lxqt':
      return ['  services.xserver.enable = true;', '  services.xserver.desktopManager.lxqt.enable = true;', ''];
    case 'enlightenment':
      return [
        '  services.xserver.enable = true;',
        '  services.xserver.desktopManager.enlightenment.enable = true;',
        '  services.acpid.enable = true;',
        '',
      ];
    case 'cinnamon':
      return ['  services.xserver.enable = true;', '  services.xserver.desktopManager.cinnamon.enable = true;', ''];
    default:
      return [];
  }
};

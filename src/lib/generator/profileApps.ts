// Software del perfil y su archivo aparte.
import { t } from '../i18n';
import { type AppGroup, profiles, resolveSoftware } from '../software';
import type { NixBuilderConfig } from './types';

export const selectedSoftware = (config: NixBuilderConfig) => {
  const software = resolveSoftware(config.profile, config.selected, config.versions);
  const extra = [...new Set(config.extraApps.map((app) => app.name))];
  if (extra.length > 0) software.apps.push({ category: 'Añadidos desde nixpkgs', packages: extra });
  if (config.extraApps.some((app) => app.unfree)) software.unfree = true;
  return software;
};

export const profileAppsFile = 'profile-apps.nix';

export const generateProfileApps = (config: NixBuilderConfig, apps: AppGroup[]) => {
  const label = profiles.find((profile) => profile.id === config.profile)?.label ?? config.profile;
  const lines = [
    `# ${t('Aplicaciones del perfil')} "${t(label)}" (${t('generado por NixOSBuilder')}).`,
    t('# Añade o quita paquetes aquí. Lo que necesita configuración de sistema'),
    t('# (Steam, Docker, servicios…) está en configuration.nix.'),
    '{ pkgs, ... }:',
    '{',
    '  environment.systemPackages = with pkgs; [',
  ];
  apps.forEach((group, index) => {
    if (index > 0) lines.push('');
    lines.push(`    # ${group.category}`, ...group.packages.map((name) => `    ${name}`));
  });
  lines.push('  ];', '}', '');
  return lines.join('\n');
};

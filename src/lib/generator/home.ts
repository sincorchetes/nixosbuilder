// Home Manager: home.nix y un archivo por módulo.

import { isFullModule } from '../hmvalidate';
import { t } from '../i18n';
import { indent, nixString, packageNames, stateVersion } from './nix';
import type { NixBuilderConfig } from './types';

export const normalizedModules = (config: NixBuilderConfig) => [
  ...new Set(config.hmModules.map((id) => id.trim().replace(/\.enable$/, '')).filter(Boolean)),
];

/** Ruta del archivo de cada módulo: home/<nombre>.nix (con la ruta completa si hay colisión). */
export const moduleFiles = (config: NixBuilderConfig) => {
  const ids = normalizedModules(config);
  const last = (id: string) => id.split('.').pop()!;
  return ids.map((id) => {
    const clash = ids.filter((other) => last(other) === last(id)).length > 1;
    const name = (clash ? id.replaceAll('.', '-') : last(id)).replace(/[^A-Za-z0-9_-]/g, '-');
    return { id, path: `home/${name}.nix` };
  });
};

export const generateModuleFile = (config: NixBuilderConfig, id: string) => {
  const code = (config.hmModuleCode[id] ?? '').trim();
  // Un módulo completo ({ pkgs, ... }: { ... }) se respeta tal cual.
  if (code && isFullModule(code)) return `${code}\n`;
  return [
    '{ config, lib, pkgs, ... }:',
    '{',
    `  ${id}.enable = true;`,
    '',
    code ? indent(code, 2) : `  # ${t('Pega aquí tu configuración de')} ${id} (${t('opciones de Home Manager')}).`,
    '}',
    '',
  ].join('\n');
};

export const generateHome = (config: NixBuilderConfig) => {
  const lines = [
    '{ pkgs, ... }:',
    '{',
    `  home.username = ${nixString(config.username)};`,
    `  home.homeDirectory = ${nixString(`/home/${config.username}`)};`,
    `  home.stateVersion = ${nixString(stateVersion(config.channel))};`,
    '',
    '  programs.home-manager.enable = true;',
  ];

  const packages = packageNames(config.hmPackages);
  if (packages.length > 0) {
    lines.push('', `  home.packages = with pkgs; [ ${packages.join(' ')} ];`);
  }

  const files = moduleFiles(config);
  if (files.length > 0) {
    lines.push('', '  imports = [', ...files.map((file) => `    ./${file.path}`), '  ];');
  }

  if (config.desktop === 'hyprland') {
    lines.push('', '  wayland.windowManager.hyprland.enable = true;');
  }

  lines.push('}', '');
  return lines.join('\n');
};

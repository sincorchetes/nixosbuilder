// configuration.nix.
import { t } from '../i18n';
import { type Keyboard, keyboardById } from '../locale';
import { generateDesktop } from './desktop';
import { generateFirewall } from './firewall';
import { hostId, lanzabooteRef, nixList, nixString, packageNames, stateVersion, usesZfs } from './nix';
import { profileAppsFile, selectedSoftware } from './profileApps';
import type { NixBuilderConfig } from './types';

export const generateConfiguration = (config: NixBuilderConfig) => {
  const imports = ['./hardware-configuration.nix'];
  if (config.disko) imports.push('./disko.nix');
  else if (config.customLayout) imports.push('./filesystems.nix');
  if (selectedSoftware(config).apps.length > 0) imports.push(`./${profileAppsFile}`);
  if (!config.flakes && config.homeManager) imports.push('<home-manager/nixos>');
  if (!config.flakes && config.disko) imports.push('<disko/module.nix>');
  // Sin flakes, lanzaboote se importa desde su default.nix (descarga el tarball de la versión indicada).
  const classicLanzaboote = config.secureBoot && !config.flakes;
  if (classicLanzaboote) imports.push('lanzaboote.nixosModules.lanzaboote');

  const args = ['config', ...(config.secureBoot ? ['lib'] : []), 'pkgs', '...'];
  const lines = [
    t('# ⚠ Antes de reiniciar: asigna una contraseña a root y a tu usuario'),
    `#   (passwd root · passwd ${config.username}) ${t('o no podrás iniciar sesión.')}`,
    `{ ${args.join(', ')} }:`,
    ...(classicLanzaboote
      ? [
          'let',
          `  lanzaboote = import (builtins.fetchTarball ${nixString(`https://github.com/nix-community/lanzaboote/archive/${lanzabooteRef}.tar.gz`)}) { };`,
          'in',
        ]
      : []),
    '{',
    '  imports = [',
    ...imports.map((path) => `    ${path}`),
    '  ];',
    '',
  ];

  if (config.secureBoot) {
    lines.push(
      t('  # Secure Boot con lanzaboote (sustituye a systemd-boot).'),
      // bootspec siempre se genera desde unstable y la opción pasó a ser un error.
      ...(config.channel === 'unstable' ? [] : ['  boot.bootspec.enable = true;']),
      '  boot.loader.systemd-boot.enable = lib.mkForce false;',
      '  boot.lanzaboote = {',
      '    enable = true;',
      '    pkiBundle = "/var/lib/sbctl";',
      '  };',
    );
  } else if (config.bootloader === 'systemd-boot') {
    lines.push('  boot.loader.systemd-boot.enable = true;');
  } else {
    lines.push(
      '  boot.loader.grub = {',
      '    enable = true;',
      '    efiSupport = true;',
      '    device = "nodev";',
      ...(config.multiboot ? ['    useOSProber = true;'] : []),
      '  };',
    );
  }
  lines.push('  boot.loader.efi.canTouchEfiVariables = true;', '');

  if (usesZfs(config)) {
    lines.push(
      '  # ZFS',
      `  networking.hostId = ${nixString(hostId(config.hostname))};`,
      '  boot.supportedFilesystems = [ "zfs" ];',
      '  boot.zfs.forceImportRoot = false;',
      ...(config.encryption ? ['  boot.zfs.requestEncryptionCredentials = true;'] : []),
      '  services.zfs.autoScrub.enable = true;',
      ...(config.discard ? ['  services.zfs.trim.enable = true;'] : []),
      '',
    );
  } else if (!config.disko && config.discard) {
    lines.push('  services.fstrim.enable = true;', '');
  }

  lines.push(`  networking.hostName = ${nixString(config.hostname)};`);
  if (config.networkManager) lines.push('  networking.networkmanager.enable = true;');
  lines.push('', `  time.timeZone = ${nixString(config.timeZone)};`, `  i18n.defaultLocale = ${nixString(config.locale)};`);
  const extraLocales = [...new Set(config.extraLocales)].filter((locale) => locale !== config.locale);
  if (extraLocales.length > 0) {
    lines.push(`  i18n.extraLocales = ${nixList(extraLocales.map((locale) => `${locale}/UTF-8`))};`);
  }
  const keyboards = [config.keyboard, ...config.extraKeyboards]
    .filter((id, index, all) => all.indexOf(id) === index)
    .map(keyboardById)
    .filter((keyboard): keyboard is Keyboard => !!keyboard);
  const primary = keyboards[0];
  lines.push(`  console.keyMap = ${nixString(primary?.console ?? 'us')};`);
  if (config.desktop !== 'none' && primary) {
    lines.push(`  services.xserver.xkb.layout = ${nixString(keyboards.map((keyboard) => keyboard.layout).join(','))};`);
    if (keyboards.some((keyboard) => keyboard.variant)) {
      lines.push(`  services.xserver.xkb.variant = ${nixString(keyboards.map((keyboard) => keyboard.variant ?? '').join(','))};`);
    }
    if (keyboards.length > 1) lines.push('  services.xserver.xkb.options = "grp:alt_shift_toggle";');
  }
  lines.push('');

  if (config.gpu !== 'none') {
    lines.push('  hardware.graphics.enable = true;');
  }
  if (config.gpu === 'nvidia') {
    lines.push(
      '  services.xserver.videoDrivers = [ "nvidia" ];',
      '  hardware.nvidia = {',
      '    modesetting.enable = true;',
      '    open = true;',
      '    package = config.boot.kernelPackages.nvidiaPackages.stable;',
      '  };',
    );
  }
  if (config.bluetooth) lines.push('  hardware.bluetooth.enable = true;');
  if (config.gpu !== 'none' || config.bluetooth) lines.push('');

  lines.push(...generateDesktop(config));

  if (config.pipewire) {
    lines.push(
      '  security.rtkit.enable = true;',
      '  services.pipewire = {',
      '    enable = true;',
      '    alsa.enable = true;',
      '    alsa.support32Bit = true;',
      '    pulse.enable = true;',
      '  };',
      '',
    );
  }

  if (config.openSsh) {
    lines.push('  services.openssh.enable = true;', '');
  }

  const software = selectedSoftware(config);
  if (software.nixos.length > 0) {
    lines.push(...software.nixos.map((line) => `  ${line}`), '');
  }

  lines.push(...generateFirewall(config));

  const groups = ['wheel', ...software.groups];
  if (config.networkManager) groups.push('networkmanager');
  lines.push(
    `  users.users.${config.username} = {`,
    '    isNormalUser = true;',
    `    description = ${nixString(config.fullName)};`,
    `    extraGroups = [ ${groups.map(nixString).join(' ')} ];`,
    '  };',
    '',
  );

  const packages = [...packageNames(config.packages), ...software.packages, ...(config.secureBoot ? ['sbctl'] : [])];
  if (packages.length > 0) {
    lines.push(`  environment.systemPackages = with pkgs; [ ${[...new Set(packages)].join(' ')} ];`, '');
  }

  if (config.allowUnfree || config.gpu === 'nvidia' || software.unfree) {
    lines.push('  nixpkgs.config.allowUnfree = true;', '');
  }

  if (config.flakes) {
    lines.push('  nix.settings.experimental-features = [ "nix-command" "flakes" ];', '');
  }

  if (config.homeManager) {
    lines.push(
      '  home-manager.useGlobalPkgs = true;',
      '  home-manager.useUserPackages = true;',
      `  home-manager.users.${config.username} = import ./home.nix;`,
      '  home-manager.backupFileExtension = "backup";',
      '',
    );
  }

  lines.push(`  system.stateVersion = ${nixString(stateVersion(config.channel))};`, '}', '');
  return lines.join('\n');
};

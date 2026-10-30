// Pasos finales y recordatorios.
import type { NextStep, NixBuilderConfig } from './types';

/** URL del canal de Home Manager que corresponde al canal de NixOS elegido. */
export const homeManagerChannelUrl = (config: NixBuilderConfig) =>
  `https://github.com/nix-community/home-manager/archive/${config.channel === 'unstable' ? 'master' : `release-${config.channel}`}.tar.gz`;

export function nextSteps(config: NixBuilderConfig): NextStep[] {
  const steps: NextStep[] = [];
  const installing = config.disko || config.customLayout;

  if (config.customLayout && !config.disko) {
    steps.push({
      text: 'Revisa y ejecuta el script de particionado (¡formatea!); monta todo en /mnt:',
      command: 'sudo bash ./partition.sh',
    });
    steps.push({
      text: 'Genera hardware-configuration.nix para esa máquina si aún no lo tienes:',
      command: 'sudo nixos-generate-config --root /mnt --no-filesystems',
    });
  }
  if (config.disko) {
    steps.push({
      text: 'Particiona y monta el disco con disko (¡destruye los datos del disco!):',
      command: config.flakes
        ? `sudo nix run github:nix-community/disko/latest -- --mode destroy,format,mount --flake .#${config.hostname}`
        : 'sudo nix run github:nix-community/disko/latest -- --mode destroy,format,mount ./disko.nix',
    });
  }
  if (!config.flakes && config.homeManager) {
    steps.push({
      text: 'Añade el canal de Home Manager (se aplica junto con el sistema en cada nixos-rebuild, sin cerrar sesión):',
      command: `sudo nix-channel --add ${homeManagerChannelUrl(config)} home-manager && sudo nix-channel --update`,
    });
  }
  if (installing) {
    // En la ISO en vivo /tmp y /nix/store viven en RAM: con el disco ya montado, Nix debe escribir en él.
    steps.push({
      text: 'Con el disco ya montado, copia la configuración a él. La ISO en vivo guarda /tmp y /nix/store en RAM (tmpfs) y una descarga grande podría agotarla: a partir de aquí todo se escribe en /mnt.',
      command: 'sudo mkdir -p /mnt/etc/nixos /mnt/tmp && sudo cp -r ./. /mnt/etc/nixos/',
    });
    steps.push({
      text: 'Instala el sistema indicando a Nix que use el disco para archivos temporales y caché:',
      command: config.flakes
        ? `sudo env TMPDIR=/mnt/tmp XDG_CACHE_HOME=/mnt/tmp/cache nixos-install --flake /mnt/etc/nixos#${config.hostname}`
        : 'sudo env TMPDIR=/mnt/tmp XDG_CACHE_HOME=/mnt/tmp/cache nixos-install',
    });
  }
  if (config.secureBoot) {
    steps.push({
      text: 'Secure Boot: antes de activarlo, crea las claves, aplica la configuración y enrólalas (con el firmware en modo setup):',
      command: 'sudo sbctl create-keys && sudo sbctl enroll-keys --microsoft',
    });
  }
  if (installing) {
    steps.push({ text: 'Reinicia y retira el medio de instalación:', command: 'sudo reboot' });
  } else {
    steps.push({
      text: 'Valida sin aplicar cambios:',
      command: config.flakes ? 'nix flake check' : 'sudo nixos-rebuild dry-build',
    });
    steps.push({ text: 'Aplica la configuración:', command: rebuildCommand(config) });
  }
  return steps;
}

export const passwordReminder = (config: NixBuilderConfig) =>
  `Si usas esta configuración, no olvides asignar la contraseña de root y la de tu usuario (${config.username}): \`passwd root\` · \`passwd ${config.username}\`. Si instalas con \`nixos-install\`, te pedirá la de root; la de tu usuario hazla con \`nixos-enter --root /mnt -c 'passwd ${config.username}'\`.`;

export const rebuildCommand = (config: NixBuilderConfig) =>
  config.flakes ? `sudo nixos-rebuild switch --flake .#${config.hostname}` : 'sudo nixos-rebuild switch';

// Validación de errores y avisos.
import { validateLayout } from '../disk';
import { keyboardById, localePattern } from '../locale';
import { effectiveSession } from './defaults';
import { parsePort } from './firewall';
import { packageNames, usesZfs } from './nix';
import { selectedSoftware } from './profileApps';
import type { NixBuilderConfig } from './types';

/* ---------------------------- Validación y avisos ---------------------------- */

export const packagePattern = /^[a-zA-Z0-9_][a-zA-Z0-9+_.'-]*$/;
export const modulePattern = /^[a-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$/;

export const isValidPackageName = (name: string) => packagePattern.test(name);
export const isValidModuleId = (id: string) => modulePattern.test(id.replace(/\.enable$/, ''));

export function validateConfig(config: NixBuilderConfig): string[] {
  const errors: string[] = [];
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$/.test(config.hostname)) {
    errors.push('El nombre del equipo solo puede contener letras, números y guiones.');
  }
  if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(config.username)) {
    errors.push('El usuario debe empezar por letra minúscula o guion bajo y tener un máximo de 32 caracteres.');
  }
  if (!config.fullName.trim()) errors.push('Indica el nombre visible del usuario.');
  if (!localePattern.test(config.locale)) errors.push('El idioma principal no es válido (formato es_ES.UTF-8).');
  if (config.extraLocales.some((locale) => !localePattern.test(locale))) errors.push('Algún idioma adicional no es válido.');
  if (!keyboardById(config.keyboard)) errors.push('El teclado principal no es válido.');
  if (!/^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/.test(config.timeZone)) errors.push('La zona horaria no es válida (p. ej. Europe/Madrid).');

  const invalidPackages = packageNames(config.packages).filter((name) => !isValidPackageName(name));
  if (invalidPackages.length > 0) errors.push(`Paquetes del sistema no válidos: ${invalidPackages.join(', ')}.`);
  if (config.homeManager) {
    const invalidHm = packageNames(config.hmPackages).filter((name) => !isValidPackageName(name));
    if (invalidHm.length > 0) errors.push(`Paquetes de Home Manager no válidos: ${invalidHm.join(', ')}.`);
    const invalidModules = config.hmModules.filter((id) => !isValidModuleId(id));
    if (invalidModules.length > 0) errors.push(`Módulos de Home Manager no válidos: ${invalidModules.join(', ')}.`);
  }

  if (config.customLayout) {
    errors.push(
      ...validateLayout(config.partitions, { device: config.diskDevice, diskBytes: config.diskBytes, disko: config.disko }).errors,
    );
  } else if (config.disko && !/^\/dev\/[a-zA-Z0-9/_-]+$/.test(config.diskDevice)) {
    errors.push('El disco debe ser una ruta de dispositivo válida, como /dev/sda o /dev/nvme0n1.');
  }
  if (config.secureBoot) {
    if (!config.flakes) errors.push('Secure Boot con lanzaboote requiere activar flakes.');
    if (config.bootloader !== 'systemd-boot')
      errors.push('Secure Boot con lanzaboote sustituye a systemd-boot; no es compatible con GRUB.');
  }
  const invalidPorts = config.firewall.rules.filter((rule) => !parsePort(rule.port));
  if (invalidPorts.length > 0) {
    errors.push(
      `Puertos no válidos en el firewall: ${invalidPorts.map((rule) => rule.port || '(vacío)').join(', ')}. Usa 1-65535 o rangos como 8000-8100.`,
    );
  }
  return errors;
}

export function getWarnings(config: NixBuilderConfig): string[] {
  const list: string[] = [];
  if (config.multiboot && config.disko) {
    list.push(
      'Con dual boot (multiboot) no uses disko: formatearía el disco entero y borraría el otro sistema. Particiona a mano con comandos (fdisk/parted) y monta las particiones antes de instalar.',
    );
  }
  if (config.multiboot && config.bootloader === 'systemd-boot' && !config.secureBoot) {
    list.push(
      'Con systemd-boot, el otro sistema solo aparece si comparte la partición ESP. Si usa otro disco, considera GRUB, que activará os-prober.',
    );
  }
  if (config.multiboot && config.secureBoot) {
    list.push('Secure Boot con lanzaboote y dual boot: el otro sistema debe ser compatible con las claves que enrolles.');
  }
  if (config.gpu === 'nvidia') list.push('NVIDIA requiere software no libre: se activará allowUnfree.');
  if (selectedSoftware(config).unfree && config.gpu !== 'nvidia') {
    list.push('Hay software no libre seleccionado (Steam, JetBrains, VS Code…): se activará allowUnfree.');
  }
  if (config.disko) {
    list.push('disko borrará todo el contenido del disco indicado al aplicarse. Revisa el dispositivo.');
  }
  if (config.customLayout) {
    list.push(
      ...validateLayout(config.partitions, { device: config.diskDevice, diskBytes: config.diskBytes, disko: config.disko }).warnings,
    );
    if (!config.disko) list.push('partition.sh formatea y modifica discos: léelo entero y ejecútalo solo si estás seguro del dispositivo.');
  }
  if (config.disko && !config.customLayout && config.encryption) {
    list.push('El cifrado pedirá la contraseña de forma interactiva al formatear con disko y en cada arranque.');
  }
  if (usesZfs(config)) {
    list.push('ZFS: comprueba que el kernel por defecto del canal elegido sea compatible con OpenZFS.');
  }
  if (!config.flakes && (config.homeManager || config.disko)) {
    list.push('Sin flakes tendrás que añadir los canales de home-manager y/o disko manualmente.');
  }
  if (config.desktop === 'hyprland' && !config.homeManager) {
    list.push('Hyprland funciona mejor con Home Manager para gestionar su configuración.');
  }
  if (config.desktop === 'kde' && effectiveSession(config) === 'x11') {
    list.push('Plasma 6.8 elimina la sesión X11: con canales recientes (unstable) puede no estar disponible.');
  }
  if (config.bootloader === 'grub' && config.disko) {
    list.push('Con GRUB y disko, revisa que boot.loader.grub.device encaje con tu esquema de particiones.');
  }
  if (!config.firewall.enable) {
    list.push('El firewall está desactivado: todos los puertos quedarán accesibles.');
  }
  if (!config.hardwareConfiguration.trim()) {
    list.push('hardware-configuration.nix está vacío: pega el tuyo (nixos-generate-config) antes de aplicar.');
  }
  return list;
}

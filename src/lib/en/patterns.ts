// Mensajes con datos variables: expresión anclada + constructor de la traducción.
import { en } from './dictionary';

const E = (text: string) => en[text] ?? text;

export const patterns: Array<[RegExp, (...args: string[]) => string]> = [
  [
    /^Si usas esta configuración, no olvides asignar la contraseña de root y la de tu usuario \((.+)\): `passwd root` · `passwd (.+)`\. Si instalas con `nixos-install`, te pedirá la de root; la de tu usuario hazla con `nixos-enter --root \/mnt -c 'passwd (.+)'`\.$/,
    (user, user2, user3) =>
      `If you use this configuration, don't forget to set the password for root and for your user (${user}): \`passwd root\` · \`passwd ${user2}\`. If you install with \`nixos-install\`, it will ask for root's; set your user's with \`nixos-enter --root /mnt -c 'passwd ${user3}'\`.`,
  ],
  [/^Paquetes del sistema no válidos: (.+)\.$/, (x) => `Invalid system packages: ${x}.`],
  [/^Paquetes de Home Manager no válidos: (.+)\.$/, (x) => `Invalid Home Manager packages: ${x}.`],
  [/^Módulos de Home Manager no válidos: (.+)\.$/, (x) => `Invalid Home Manager modules: ${x}.`],
  [
    /^Puertos no válidos en el firewall: (.+)\. Usa 1-65535 o rangos como 8000-8100\.$/,
    (x) => `Invalid firewall ports: ${x}. Use 1-65535 or ranges like 8000-8100.`,
  ],
  [/^El escritorio (.+) no está disponible: (.+)\.$/, (de, why) => `The ${de} desktop is not available: ${E(why)}.`],
  [
    /^No disponible en nixpkgs (.+) \(roto o inseguro\): (.+)\. Quítalo de la selección o cambia de canal\.$/,
    (ch, x) => `Not available in nixpkgs ${ch} (broken or insecure): ${x}. Remove it from the selection or change channel.`,
  ],
  [/^Paquetes del sistema que no existen en nixpkgs (.+): (.+)\.$/, (ch, x) => `System packages that do not exist in nixpkgs ${ch}: ${x}.`],
  [
    /^Paquetes de Home Manager que no existen en nixpkgs (.+): (.+)\.$/,
    (ch, x) => `Home Manager packages that do not exist in nixpkgs ${ch}: ${x}.`,
  ],
  [/^Módulos que no existen en Home Manager (.+): (.+)\.$/, (ch, x) => `Modules that do not exist in Home Manager ${ch}: ${x}.`],
  [
    /^(.+): (\d+) opción\(es\) no encontradas en Home Manager (.+) \((.+)\)\.$/,
    (file, n, ch, x) => `${file}: ${n} option(s) not found in Home Manager ${ch} (${x}).`,
  ],
  [/^(.+): el módulo completo no activa (.+)\.$/, (file, id) => `${file}: the full module does not enable ${id}.`],
  [/^(.*?)Línea (\d+): (.+)$/, (prefix, n, msg) => `${prefix}Line ${n}: ${hmMessage(msg)}`],
  [
    /^Nombre de partición no válido: «(.*)» \(letras, números, - y _\)\.$/,
    (x) => `Invalid partition name: “${x}” (letters, numbers, - and _).`,
  ],
  [/^Nombre de partición repetido: (.+)\.$/, (x) => `Duplicate partition name: ${x}.`],
  [
    /^Tamaño no válido en «(.*)»: usa números enteros con K, M, G o T \(512M, 20G\) o 100%\.$/,
    (x) => `Invalid size in “${x}”: use whole numbers with K, M, G or T (512M, 20G) or 100%.`,
  ],
  [
    /^Solo la última partición puede ocupar el resto del disco \(100%\): «(.*)»\.$/,
    (x) => `Only the last partition can take the rest of the disk (100%): “${x}”.`,
  ],
  [/^«(.*)» \((.+)\) no puede tener punto de montaje\.$/, (x, fs) => `“${x}” (${E(fs)}) cannot have a mount point.`],
  [/^Punto de montaje no válido en «(.*)»: (.*)\.$/, (x, m) => `Invalid mount point in “${x}”: ${m}.`],
  [/^Punto de montaje repetido: (.+)\.$/, (x) => `Duplicate mount point: ${x}.`],
  [
    /^La partición ESP «(.*)» \(FAT32\) no puede cifrarse: el firmware la necesita en claro\.$/,
    (x) => `The ESP partition “${x}” (FAT32) cannot be encrypted: the firmware needs it unencrypted.`,
  ],
  [/^«(.*)» está cifrada pero sin sistema de archivos: elige uno\.$/, (x) => `“${x}” is encrypted but has no filesystem: pick one.`],
  [/^«(.*)» tiene sistema de archivos pero no punto de montaje\.$/, (x) => `“${x}” has a filesystem but no mount point.`],
  [/^Las particiones suman (.+), más que el disco \((.+)\)\.$/, (a, b) => `The partitions add up to ${a}, more than the disk (${b}).`],
];

const hmSyntaxPatterns: Array<[RegExp, (...args: string[]) => string]> = [
  [/^"(.)" inesperado \(¿falta un ";" antes\?\)$/, (c) => `unexpected "${c}" (missing a ";" before it?)`],
  [/^"(.)" no coincide con "(.)" de la línea (\d+)$/, (c, open, line) => `"${c}" does not match "${open}" from line ${line}`],
  [
    /^falta un ";" al final del valor que empieza en la línea (\d+)$/,
    (line) => `missing ";" at the end of the value starting on line ${line}`,
  ],
  [/^se esperaba "=" tras (.+)$/, (name) => `expected "=" after ${name}`],
];

/** Mensajes del analizador de módulos de Home Manager. */
function hmMessage(msg: string): string {
  const fixed: Record<string, string> = {
    'comentario /* sin cerrar': 'unclosed /* comment',
    'cadena sin cerrar': 'unclosed string',
    "cadena '' sin cerrar": "unclosed '' string",
    '${ sin cerrar': 'unclosed ${',
    'falta un ";" al final de un valor': 'missing ";" at the end of a value',
    'falta una "}" de cierre': 'missing closing "}"',
    '"}" inesperada': 'unexpected "}"',
    'se esperaba el nombre de una opción': 'expected an option name',
    'falta ";" tras "}"': 'missing ";" after "}"',
    'hay texto después del cierre del módulo': 'there is text after the end of the module',
  };
  if (fixed[msg]) return fixed[msg];
  for (const [pattern, build] of hmSyntaxPatterns) {
    const match = pattern.exec(msg);
    if (match) return build(...match.slice(1));
  }
  return msg;
}

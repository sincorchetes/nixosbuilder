// Catálogos de software por perfil. Cada elemento aporta paquetes de nixpkgs y/o configuración de NixOS.
// scripts/check-software.ts verifica estos nombres contra el índice real de cada canal.

import type { Protocol } from './generator';

export type Profile = 'custom' | 'server' | 'user' | 'developer' | 'devops' | 'gamer';

export interface SoftwareVersion {
  value: string;
  label: string;
  /** Atributo de nixpkgs de esta versión (sustituye a {{package}}). */
  package: string;
}

export interface SoftwareItem {
  id: string;
  label: string;
  description: string;
  category: string;
  /** Aparece destacado como sugerencia popular. */
  popular?: boolean;
  /** Paquetes cuya disponibilidad condiciona este elemento aunque no se instalen directamente. */
  requires?: string[];
  /** Paquetes de nixpkgs que se añaden a environment.systemPackages. */
  packages?: string[];
  /** Líneas de configuración de NixOS. `{{package}}` se sustituye por la versión elegida. */
  nixos?: string[];
  /** Puertos que el servicio necesita abiertos en el firewall. */
  ports?: Array<{ port: string; protocol: Protocol }>;
  /** Grupos adicionales del usuario (p. ej. docker). */
  groups?: string[];
  /** Requiere permitir software no libre. */
  unfree?: boolean;
  versions?: SoftwareVersion[];
}

const web = (port: string): SoftwareItem['ports'] => [{ port, protocol: 'tcp' }];
const pg = (n: number): SoftwareVersion => ({ value: String(n), label: `PostgreSQL ${n}`, package: `postgresql_${n}` });

const docker: SoftwareItem = {
  id: 'docker',
  label: 'Docker',
  description: 'Motor de contenedores (añade tu usuario al grupo docker)',
  category: 'Contenedores',
  popular: true,
  requires: ['docker'],
  nixos: ['virtualisation.docker.enable = true;'],
  groups: ['docker'],
};
const podman: SoftwareItem = {
  id: 'podman',
  label: 'Podman',
  description: 'Contenedores sin demonio',
  category: 'Contenedores',
  requires: ['podman'],
  nixos: ['virtualisation.podman.enable = true;'],
};

const pkg = (
  id: string,
  label: string,
  description: string,
  category: string,
  attr: string,
  extra: Partial<SoftwareItem> = {},
): SoftwareItem => ({ id, label, description, category, packages: [attr], ...extra });

export const serverCatalog: SoftwareItem[] = [
  {
    id: 'nginx',
    label: 'NGINX',
    description: 'Servidor web y proxy inverso',
    category: 'Servidores web',
    popular: true,
    nixos: ['services.nginx.enable = true;'],
    ports: [...web('80')!, ...web('443')!],
  },
  {
    id: 'httpd',
    label: 'Apache HTTP Server',
    description: 'Servidor web Apache (httpd)',
    category: 'Servidores web',
    popular: true,
    nixos: ['services.httpd.enable = true;', 'services.httpd.adminAddr = "webmaster@localhost";'],
    ports: [...web('80')!, ...web('443')!],
  },
  {
    id: 'tomcat',
    label: 'Apache Tomcat',
    description: 'Contenedor de servlets Java',
    category: 'Servidores web',
    nixos: ['services.tomcat.enable = true;'],
    ports: web('8080'),
  },
  {
    id: 'caddy',
    label: 'Caddy',
    description: 'Servidor web con HTTPS automático',
    category: 'Servidores web',
    nixos: ['services.caddy.enable = true;'],
    ports: [...web('80')!, ...web('443')!],
  },
  {
    id: 'postgresql',
    label: 'PostgreSQL',
    description: 'Base de datos relacional',
    category: 'Bases de datos',
    popular: true,
    nixos: ['services.postgresql.enable = true;', 'services.postgresql.package = {{package}};'],
    versions: [17, 16, 15, 14].map(pg),
  },
  {
    id: 'mysql',
    label: 'MySQL / MariaDB',
    description: 'Base de datos relacional',
    category: 'Bases de datos',
    popular: true,
    nixos: ['services.mysql.enable = true;', 'services.mysql.package = {{package}};'],
    versions: [
      { value: 'mariadb', label: 'MariaDB', package: 'mariadb' },
      { value: 'mysql84', label: 'MySQL 8.4 LTS', package: 'mysql84' },
    ],
  },
  {
    id: 'redis',
    label: 'Redis',
    description: 'Almacén clave-valor en memoria',
    category: 'Bases de datos',
    nixos: ['services.redis.servers.main.enable = true;'],
  },
  {
    id: 'memcached',
    label: 'Memcached',
    description: 'Caché distribuida en memoria',
    category: 'Bases de datos',
    nixos: ['services.memcached.enable = true;'],
  },
  docker,
  podman,
  {
    id: 'prometheus',
    label: 'Prometheus',
    description: 'Monitorización y alertas',
    category: 'Observabilidad',
    nixos: ['services.prometheus.enable = true;'],
    ports: web('9090'),
  },
  {
    id: 'fail2ban',
    label: 'Fail2ban',
    description: 'Bloqueo de IPs tras intentos fallidos',
    category: 'Seguridad',
    nixos: ['services.fail2ban.enable = true;'],
  },
  {
    id: 'tailscale',
    label: 'Tailscale',
    description: 'VPN en malla basada en WireGuard',
    category: 'Red',
    nixos: ['services.tailscale.enable = true;'],
    ports: [{ port: '41641', protocol: 'udp' }],
  },
  {
    id: 'jellyfin',
    label: 'Jellyfin',
    description: 'Servidor multimedia',
    category: 'Otros',
    nixos: ['services.jellyfin.enable = true;', 'services.jellyfin.openFirewall = true;'],
  },
];

const jetbrains = (id: string, label: string, attr: string): SoftwareItem =>
  pkg(id, label, 'JetBrains', 'JetBrains', attr, { unfree: true });

export const developerCatalog: SoftwareItem[] = [
  pkg('vscode', 'Visual Studio Code', 'Editor de Microsoft', 'Editores e IDEs', 'vscode', { popular: true, unfree: true }),
  pkg('vscodium', 'VSCodium', 'VS Code sin telemetría', 'Editores e IDEs', 'vscodium'),
  pkg('netbeans', 'Apache NetBeans', 'IDE para Java y más', 'Editores e IDEs', 'netbeans'),
  pkg('eclipse', 'Eclipse (Java)', 'IDE Eclipse para Java', 'Editores e IDEs', 'eclipses.eclipse-java'),
  pkg('neovim', 'Neovim', 'Editor modal extensible', 'Editores e IDEs', 'neovim'),
  pkg('zed', 'Zed', 'Editor de alto rendimiento', 'Editores e IDEs', 'zed-editor'),
  jetbrains('jb-idea', 'IntelliJ IDEA', 'jetbrains.idea'),
  jetbrains('jb-pycharm', 'PyCharm', 'jetbrains.pycharm'),
  jetbrains('jb-clion', 'CLion', 'jetbrains.clion'),
  jetbrains('jb-webstorm', 'WebStorm', 'jetbrains.webstorm'),
  jetbrains('jb-goland', 'GoLand', 'jetbrains.goland'),
  jetbrains('jb-rustrover', 'RustRover', 'jetbrains.rust-rover'),
  jetbrains('jb-phpstorm', 'PhpStorm', 'jetbrains.phpstorm'),
  jetbrains('jb-rider', 'Rider', 'jetbrains.rider'),
  jetbrains('jb-rubymine', 'RubyMine', 'jetbrains.ruby-mine'),
  jetbrains('jb-datagrip', 'DataGrip', 'jetbrains.datagrip'),
  jetbrains('jb-dataspell', 'DataSpell', 'jetbrains.dataspell'),
  pkg('nodejs', 'Node.js', 'Entorno JavaScript', 'Lenguajes', 'nodejs', { popular: true }),
  pkg('python', 'Python 3', 'Intérprete de Python', 'Lenguajes', 'python3', { popular: true }),
  pkg('go', 'Go', 'Compilador de Go', 'Lenguajes', 'go'),
  pkg('rustup', 'Rust (rustup)', 'Toolchain de Rust', 'Lenguajes', 'rustup'),
  pkg('gcc', 'GCC + Make + CMake', 'Toolchain de C/C++', 'Lenguajes', 'gcc', { packages: ['gcc', 'gnumake', 'cmake'] }),
  pkg('jdk', 'OpenJDK', 'Kit de desarrollo Java', 'Lenguajes', 'jdk'),
  pkg('dotnet', '.NET SDK', 'SDK de .NET', 'Lenguajes', 'dotnet-sdk'),
  pkg('bun', 'Bun', 'Runtime JavaScript', 'Lenguajes', 'bun'),
  pkg('gh', 'GitHub CLI', 'gh', 'Herramientas', 'gh', { popular: true }),
  pkg('lazygit', 'lazygit', 'Interfaz de terminal para Git', 'Herramientas', 'lazygit'),
  pkg('dbeaver', 'DBeaver', 'Cliente de bases de datos', 'Herramientas', 'dbeaver-bin'),
  pkg('postman', 'Postman', 'Cliente de APIs', 'Herramientas', 'postman', { unfree: true }),
  pkg('insomnia', 'Insomnia', 'Cliente de APIs', 'Herramientas', 'insomnia'),
  pkg('devenv', 'devenv', 'Entornos de desarrollo reproducibles con Nix', 'Herramientas', 'devenv', { popular: true }),
  pkg('direnv', 'direnv + nix-direnv', 'Entornos por directorio', 'Herramientas', 'direnv', { packages: ['direnv', 'nix-direnv'] }),
  docker,
];

export const devopsCatalog: SoftwareItem[] = [
  docker,
  podman,
  pkg('kubectl', 'kubectl', 'Cliente de Kubernetes', 'Kubernetes', 'kubectl', { popular: true }),
  pkg('helm', 'Helm', 'Gestor de paquetes de Kubernetes', 'Kubernetes', 'kubernetes-helm', { popular: true }),
  pkg('k9s', 'k9s', 'Interfaz de terminal para Kubernetes', 'Kubernetes', 'k9s'),
  pkg('kind', 'kind', 'Kubernetes en Docker', 'Kubernetes', 'kind'),
  pkg('minikube', 'Minikube', 'Kubernetes local', 'Kubernetes', 'minikube'),
  pkg('kustomize', 'Kustomize', 'Personalización de manifiestos', 'Kubernetes', 'kustomize'),
  pkg('argocd', 'Argo CD (CLI)', 'GitOps', 'Kubernetes', 'argocd'),
  pkg('opentofu', 'OpenTofu', 'Infraestructura como código', 'Infraestructura', 'opentofu', { popular: true }),
  pkg('terraform', 'Terraform', 'Infraestructura como código (BSL)', 'Infraestructura', 'terraform', { unfree: true }),
  pkg('ansible', 'Ansible', 'Automatización de configuración', 'Infraestructura', 'ansible', { popular: true }),
  pkg('packer', 'Packer', 'Imágenes de máquina', 'Infraestructura', 'packer', { unfree: true }),
  pkg('awscli', 'AWS CLI', 'Amazon Web Services', 'Nube', 'awscli2', { popular: true }),
  pkg('azure', 'Azure CLI', 'Microsoft Azure', 'Nube', 'azure-cli'),
  pkg('gcloud', 'Google Cloud SDK', 'Google Cloud', 'Nube', 'google-cloud-sdk'),
  pkg('lazydocker', 'lazydocker', 'Interfaz de terminal para Docker', 'Herramientas', 'lazydocker'),
  pkg('dive', 'dive', 'Explorar capas de imágenes', 'Herramientas', 'dive'),
  pkg('trivy', 'Trivy', 'Escáner de vulnerabilidades', 'Herramientas', 'trivy'),
  pkg('gh', 'GitHub CLI', 'gh', 'Herramientas', 'gh'),
  {
    id: 'tailscale',
    label: 'Tailscale',
    description: 'VPN en malla',
    category: 'Red',
    nixos: ['services.tailscale.enable = true;'],
    ports: [{ port: '41641', protocol: 'udp' }],
  },
];

export const gamerCatalog: SoftwareItem[] = [
  {
    id: 'steam',
    label: 'Steam',
    description: 'Plataforma de juegos (con Proton)',
    category: 'Plataformas',
    popular: true,
    unfree: true,
    nixos: ['programs.steam.enable = true;', 'programs.steam.remotePlay.openFirewall = true;'],
  },
  pkg('heroic', 'Heroic Games Launcher', 'Epic, GOG y Amazon Games', 'Plataformas', 'heroic', { popular: true }),
  pkg('lutris', 'Lutris', 'Gestor de juegos de todas las fuentes', 'Plataformas', 'lutris', { popular: true }),
  pkg('bottles', 'Bottles', 'Prefijos de Wine gestionados', 'Plataformas', 'bottles'),
  pkg('prismlauncher', 'Prism Launcher', 'Minecraft', 'Plataformas', 'prismlauncher'),
  pkg('retroarch', 'RetroArch', 'Emulación', 'Plataformas', 'retroarch'),
  pkg('wine', 'Wine (staging)', 'Capa de compatibilidad con Windows', 'Compatibilidad', 'wine-staging', { popular: true }),
  pkg('winetricks', 'Winetricks', 'Dependencias de Wine', 'Compatibilidad', 'winetricks'),
  pkg('protonup', 'ProtonUp-Qt', 'Gestor de Proton-GE', 'Compatibilidad', 'protonup-qt'),
  {
    id: 'gamemode',
    label: 'GameMode',
    description: 'Optimizaciones del sistema al jugar',
    category: 'Rendimiento',
    popular: true,
    nixos: ['programs.gamemode.enable = true;'],
  },
  {
    id: 'gamescope',
    label: 'Gamescope',
    description: 'Micro-compositor para juegos',
    category: 'Rendimiento',
    nixos: ['programs.gamescope.enable = true;'],
  },
  pkg('mangohud', 'MangoHud', 'Overlay de rendimiento', 'Rendimiento', 'mangohud'),
  pkg('goverlay', 'GOverlay', 'Configurador de MangoHud', 'Rendimiento', 'goverlay'),
  pkg('discord', 'Discord', 'Chat de voz y texto', 'Comunidad', 'discord', { unfree: true }),
  pkg('obs', 'OBS Studio', 'Grabación y streaming', 'Comunidad', 'obs-studio'),
];

export const catalogs: Partial<Record<Profile, SoftwareItem[]>> = {
  server: serverCatalog,
  developer: developerCatalog,
  devops: devopsCatalog,
  gamer: gamerCatalog,
};

export const profiles: Array<{ id: Profile; label: string; description: string }> = [
  { id: 'custom', label: 'Personalizado', description: 'Empieza de cero y ajusta todo tú' },
  { id: 'user', label: 'Usuario final', description: 'Un escritorio listo para el día a día' },
  { id: 'server', label: 'Servidor', description: 'Servicios sin escritorio (opcional)' },
  { id: 'developer', label: 'Programador', description: 'IDEs, lenguajes y herramientas' },
  { id: 'devops', label: 'DevOps', description: 'Contenedores, Kubernetes e IaC' },
  { id: 'gamer', label: 'Gamer', description: 'Steam, Wine y rendimiento' },
];

export const profileTitle: Partial<Record<Profile, { button: string; dialog: string }>> = {
  custom: { button: 'Añadir aplicaciones', dialog: 'Aplicaciones' },
  user: { button: 'Añadir aplicaciones', dialog: 'Aplicaciones' },
  server: { button: 'Elegir servicios', dialog: 'Servicios del servidor' },
  developer: { button: 'Elegir herramientas', dialog: 'Herramientas de desarrollo' },
  devops: { button: 'Elegir herramientas', dialog: 'Herramientas DevOps' },
  gamer: { button: 'Elegir software', dialog: 'Software para jugar' },
};

export const itemsFor = (profile: Profile) => catalogs[profile] ?? [];

/** Todos los elementos de todos los catálogos, por id (los repetidos comparten definición). */
export const allItems = new Map<string, SoftwareItem>(
  Object.values(catalogs).flatMap((items) => items!.map((item) => [item.id, item] as const)),
);

export interface AppGroup {
  category: string;
  packages: string[];
}

export interface ResolvedSoftware {
  /** Paquetes sueltos del perfil (sin configuración de sistema): van a profile-apps.nix. */
  apps: AppGroup[];
  /** Paquetes de elementos que además necesitan configuración de NixOS. */
  packages: string[];
  nixos: string[];
  groups: string[];
  ports: Array<{ port: string; protocol: Protocol }>;
  unfree: boolean;
}

export function resolveSoftware(profile: Profile, selected: string[], versions: Record<string, string>): ResolvedSoftware {
  const result: ResolvedSoftware = { apps: [], packages: [], nixos: [], groups: [], ports: [], unfree: false };
  const available = new Map(itemsFor(profile).map((item) => [item.id, item]));
  for (const id of selected) {
    const item = available.get(id);
    if (!item) continue;
    if (item.nixos) {
      result.packages.push(...(item.packages ?? []));
    } else if (item.packages?.length) {
      let group = result.apps.find((candidate) => candidate.category === item.category);
      if (!group) {
        group = { category: item.category, packages: [] };
        result.apps.push(group);
      }
      const known = group.packages;
      group.packages.push(...item.packages.filter((name) => !known.includes(name)));
    }
    result.groups.push(...(item.groups ?? []));
    result.ports.push(...(item.ports ?? []));
    if (item.unfree) result.unfree = true;
    if (item.nixos) {
      const version = item.versions?.find((candidate) => candidate.value === versions[id]) ?? item.versions?.[0];
      result.nixos.push(...item.nixos.map((line) => line.replaceAll('{{package}}', `pkgs.${version?.package ?? ''}`)));
    }
  }
  return {
    ...result,
    packages: [...new Set(result.packages)],
    groups: [...new Set(result.groups)],
  };
}

/** Escritorios que hoy no evalúan en ningún canal (verificado con nix eval). */
export const brokenDesktops: Record<string, string> = {
  enlightenment: 'python-efl está roto en nixpkgs (no es compatible con el Python actual)',
};

/** Atributos que condicionan la disponibilidad de un elemento (sin contar las versiones). */
const baseAttrs = (item: SoftwareItem) => [...(item.packages ?? []), ...(item.requires ?? [])];

export const isItemAvailable = (item: SoftwareItem, unavailable: ReadonlySet<string>) =>
  baseAttrs(item).every((attr) => !unavailable.has(attr)) &&
  (!item.versions || item.versions.some((version) => !unavailable.has(version.package)));

export const isVersionAvailable = (version: SoftwareVersion, unavailable: ReadonlySet<string>) => !unavailable.has(version.package);

/** Valor inicial por perfil. */
export const profileDefaults: Record<Profile, { selected: string[]; desktop?: 'none' | 'gnome' | 'kde'; openSsh?: boolean }> = {
  custom: { selected: [] },
  user: { selected: [], desktop: 'gnome' },
  server: { selected: [], desktop: 'none', openSsh: true },
  developer: { selected: [], desktop: 'gnome' },
  devops: { selected: [], desktop: 'gnome' },
  gamer: { selected: ['steam', 'gamemode'], desktop: 'kde' },
};

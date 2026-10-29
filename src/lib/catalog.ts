// Catálogo curado de módulos de Home Manager (Appendix A del manual).
// Cada entrada genera `<id>.enable = true;`. Los módulos que no estén aquí
// se pueden añadir a mano; la interfaz avisa y enlaza al buscador de opciones.

export interface HmModule {
  id: string;
  label: string;
  category: string;
}

const programs = (category: string, items: Array<[string, string]>): HmModule[] =>
  items.map(([name, label]) => ({ id: `programs.${name}`, label, category }));

const services = (category: string, items: Array<[string, string]>): HmModule[] =>
  items.map(([name, label]) => ({ id: `services.${name}`, label, category }));

export const hmModules: HmModule[] = [
  ...programs('Shell', [
    ['bash', 'Bash'],
    ['zsh', 'Zsh'],
    ['fish', 'Fish'],
    ['nushell', 'Nushell'],
    ['starship', 'Starship (prompt)'],
    ['zoxide', 'zoxide (cd inteligente)'],
    ['fzf', 'fzf'],
    ['atuin', 'Atuin (historial)'],
    ['direnv', 'direnv'],
    ['tmux', 'tmux'],
    ['zellij', 'Zellij'],
  ]),
  ...programs('Utilidades de terminal', [
    ['bat', 'bat'],
    ['eza', 'eza'],
    ['ripgrep', 'ripgrep'],
    ['fd', 'fd'],
    ['jq', 'jq'],
    ['htop', 'htop'],
    ['btop', 'btop'],
    ['fastfetch', 'fastfetch'],
    ['yazi', 'yazi (gestor de archivos)'],
    ['lazygit', 'lazygit'],
  ]),
  ...programs('Desarrollo', [
    ['git', 'Git'],
    ['gh', 'GitHub CLI'],
    ['neovim', 'Neovim'],
    ['vim', 'Vim'],
    ['helix', 'Helix'],
    ['emacs', 'Emacs'],
    ['vscode', 'VS Code'],
    ['gpg', 'GnuPG'],
    ['ssh', 'Cliente SSH'],
  ]),
  ...programs('Terminales', [
    ['alacritty', 'Alacritty'],
    ['kitty', 'kitty'],
    ['wezterm', 'WezTerm'],
    ['foot', 'foot'],
    ['ghostty', 'Ghostty'],
  ]),
  ...programs('Aplicaciones', [
    ['firefox', 'Firefox'],
    ['chromium', 'Chromium'],
    ['thunderbird', 'Thunderbird'],
    ['mpv', 'mpv'],
    ['obs-studio', 'OBS Studio'],
  ]),
  ...programs('Escritorio Wayland', [
    ['waybar', 'Waybar'],
    ['rofi', 'rofi'],
    ['wofi', 'wofi'],
    ['hyprlock', 'Hyprlock'],
  ]),
  ...services('Servicios', [
    ['gpg-agent', 'gpg-agent'],
    ['ssh-agent', 'ssh-agent'],
    ['syncthing', 'Syncthing'],
    ['dunst', 'dunst (notificaciones)'],
    ['mako', 'mako (notificaciones)'],
    ['udiskie', 'udiskie (automontaje)'],
    ['kdeconnect', 'KDE Connect'],
    ['mpris-proxy', 'MPRIS proxy (Bluetooth)'],
    ['playerctld', 'playerctld'],
    ['cliphist', 'cliphist (portapapeles)'],
    ['flameshot', 'Flameshot'],
    ['easyeffects', 'EasyEffects'],
    ['hypridle', 'Hypridle'],
  ]),
];

export const hmModuleIds = new Set(hmModules.map((module) => module.id));

export const hmOptionsSearchUrl = (query: string) => `https://home-manager-options.extranix.com/?query=${encodeURIComponent(query)}`;

export interface FirewallPreset {
  label: string;
  port: string;
  protocol: 'tcp' | 'udp' | 'both';
}

export const firewallPresets: FirewallPreset[] = [
  { label: 'HTTP', port: '80', protocol: 'tcp' },
  { label: 'HTTPS', port: '443', protocol: 'tcp' },
  { label: 'SSH', port: '22', protocol: 'tcp' },
  { label: 'DNS', port: '53', protocol: 'both' },
  { label: 'Syncthing', port: '22000', protocol: 'both' },
  { label: 'KDE Connect', port: '1714-1764', protocol: 'both' },
];

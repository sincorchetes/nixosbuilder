// Pasos del asistente, agrupación de secciones, iconos y relación error → paso.

export interface Step {
  id: string;
  title: string;
  icon: string;
  group: string;
}

/** Mismo orden y agrupación en el asistente y en la vista técnica. */
export const hub = [
  {
    title: 'Localización',
    spokes: [
      { id: 'language', title: 'Idioma', icon: 'globe' },
      { id: 'keyboard', title: 'Teclado', icon: 'keyboard' },
      { id: 'time', title: 'Hora y fecha', icon: 'clock' },
    ],
  },
  {
    title: 'Software',
    spokes: [
      { id: 'software', title: 'Perfil y aplicaciones', icon: 'package' },
      { id: 'desktop', title: 'Entorno gráfico', icon: 'monitor' },
    ],
  },
  {
    title: 'Sistema',
    spokes: [
      { id: 'hardware', title: 'Gráficos y audio', icon: 'cpu' },
      { id: 'disk', title: 'Destino de instalación', icon: 'drive' },
      { id: 'boot', title: 'Arranque', icon: 'power' },
      { id: 'network', title: 'Red y firewall', icon: 'server' },
    ],
  },
  { title: 'Usuario', spokes: [{ id: 'user', title: 'Usuario', icon: 'user' }] },
];

/** Bienvenida, las secciones en orden y resumen final. */
export const wizardSteps: Step[] = [
  { id: 'welcome', title: 'Bienvenida', icon: 'home', group: '' },
  ...hub.flatMap((group) => group.spokes.map((item) => ({ ...item, group: group.title }))),
  { id: 'summary', title: 'Resumen', icon: 'check', group: '' },
];

/** Asocia cada error de validación (en español) con el paso que lo causa. */
const issuePatterns: Record<string, RegExp> = {
  language: /idioma/i,
  keyboard: /teclado/i,
  time: /zona horaria/i,
  software: /paquete|nixpkgs|módulo|Home Manager/i,
  desktop: /escritorio/i,
  disk: /disco|dispositivo/i,
  boot: /Secure Boot|lanzaboote/i,
  network: /equipo|firewall|puertos/i,
  user: /usuario|visible/i,
};

export const issuesByStep = (errors: string[]): Record<string, string | undefined> =>
  Object.fromEntries(Object.entries(issuePatterns).map(([id, pattern]) => [id, errors.find((error) => pattern.test(error))]));

// Iconos de trazo (Feather, MIT).
export const icons: Record<string, string> = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  package:
    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
  drive:
    '<line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  server:
    '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
};

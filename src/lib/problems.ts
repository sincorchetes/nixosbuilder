// Errores y avisos de la configuración, incluidos los que dependen de índices cargados en el navegador.

import { getWarnings, type NixBuilderConfig, validateConfig } from './generator';
import { isFullModule, type ModuleReport } from './hmvalidate';
import { brokenDesktops } from './software';

export interface ModuleDiagnostic {
  file: { id: string; path: string };
  report: ModuleReport;
}

export interface ProblemContext {
  unavailableChosen: string[];
  missingSystem: string[];
  missingHm: string[];
  unknownModules: string[];
  modules: ModuleDiagnostic[];
  hmIndexLoaded: boolean;
}

export function buildErrors(config: NixBuilderConfig, ctx: ProblemContext): string[] {
  const { channel } = config;
  return [
    ...validateConfig(config),
    ...(config.desktop in brokenDesktops ? [`El escritorio ${config.desktop} no está disponible: ${brokenDesktops[config.desktop]}.`] : []),
    ...(ctx.unavailableChosen.length
      ? [
          `No disponible en nixpkgs ${channel} (roto o inseguro): ${ctx.unavailableChosen.join(', ')}. Quítalo de la selección o cambia de canal.`,
        ]
      : []),
    ...(ctx.missingSystem.length ? [`Paquetes del sistema que no existen en nixpkgs ${channel}: ${ctx.missingSystem.join(', ')}.`] : []),
    ...(config.homeManager && ctx.missingHm.length
      ? [`Paquetes de Home Manager que no existen en nixpkgs ${channel}: ${ctx.missingHm.join(', ')}.`]
      : []),
    ...(ctx.unknownModules.length ? [`Módulos que no existen en Home Manager ${channel}: ${ctx.unknownModules.join(', ')}.`] : []),
    ...ctx.modules.filter(({ report }) => report.syntaxError).map(({ file, report }) => `${file.path}: ${report.syntaxError}`),
  ];
}

export function buildWarnings(config: NixBuilderConfig, ctx: ProblemContext): string[] {
  const moduleWarnings = ctx.modules.flatMap(({ file, report }) => {
    const list: string[] = [];
    if (report.unknown.length) {
      list.push(
        `${file.path}: ${report.unknown.length} opción(es) no encontradas en Home Manager ${config.channel} (${report.unknown.map((item) => item.path).join(', ')}).`,
      );
    }
    if (isFullModule(config.hmModuleCode[file.id] ?? '') && !report.enables)
      list.push(`${file.path}: el módulo completo no activa ${file.id}.enable.`);
    return list;
  });
  return [
    ...getWarnings(config),
    ...moduleWarnings,
    ...(config.homeManager && !ctx.hmIndexLoaded && ctx.modules.length
      ? ['Índice de Home Manager no disponible: no se puede validar el código de los módulos.']
      : []),
  ];
}

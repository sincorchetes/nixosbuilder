import { defaultConfig, generateFiles, type NixBuilderConfig } from '../src/lib/generator';
import { setLang } from '../src/lib/i18n';

/** Configuración por defecto con cambios; siempre en español. */
export const makeConfig = (patch: Partial<NixBuilderConfig> = {}): NixBuilderConfig => {
  setLang('es');
  return { ...structuredClone(defaultConfig), hardwareConfiguration: '{ ... }:\n{\n}\n', ...patch };
};

export const fileMap = (config: NixBuilderConfig): Record<string, string> =>
  Object.fromEntries(generateFiles(config).map((file) => [file.path, file.content]));

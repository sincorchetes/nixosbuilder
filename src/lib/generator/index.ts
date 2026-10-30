// API pública del generador (se importa como '../lib/generator').

export { classicConfig } from './classic';
export { availableSessions, defaultConfig, effectiveSession } from './defaults';
export { generateFiles } from './files';
export { isFirewallCustomized, parsePort } from './firewall';
export { moduleFiles, normalizedModules } from './home';
export { packageNames } from './nix';
export { profileAppsFile, selectedSoftware } from './profileApps';
export { nextSteps, passwordReminder, rebuildCommand } from './steps';
export type {
  Architecture,
  Bootloader,
  Channel,
  Desktop,
  DiskKind,
  DiskScheme,
  FirewallConfig,
  FirewallRule,
  GeneratedFile,
  Gpu,
  LvmFilesystem,
  NextStep,
  NixBuilderConfig,
  Protocol,
  Session,
} from './types';
export { getWarnings, isValidModuleId, isValidPackageName, validateConfig } from './validate';

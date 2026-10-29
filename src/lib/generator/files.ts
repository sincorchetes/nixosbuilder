// Conjunto de archivos generados.
import { generateDiskoLayout, generateFilesystemsNix, generatePartitionScript } from '../disk';
import { generateConfiguration } from './configuration';
import { generateDisko } from './disko';
import { generateFlake } from './flake';
import { generateHome, generateModuleFile, moduleFiles } from './home';
import { generateProfileApps, profileAppsFile, selectedSoftware } from './profileApps';
import type { GeneratedFile, NixBuilderConfig } from './types';

export const generateHardware = (config: NixBuilderConfig) =>
  config.hardwareConfiguration.trim() ? `${config.hardwareConfiguration.trim()}\n` : `{ ... }:\n{\n}\n`;

export function generateFiles(config: NixBuilderConfig): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  if (config.flakes) files.push({ path: 'flake.nix', content: generateFlake(config) });
  files.push({ path: 'configuration.nix', content: generateConfiguration(config) });
  files.push({ path: 'hardware-configuration.nix', content: generateHardware(config) });
  const apps = selectedSoftware(config).apps;
  if (apps.length > 0) files.push({ path: profileAppsFile, content: generateProfileApps(config, apps) });
  if (config.homeManager) {
    files.push({ path: 'home.nix', content: generateHome(config) });
    for (const file of moduleFiles(config)) files.push({ path: file.path, content: generateModuleFile(config, file.id) });
  }
  if (config.disko) {
    files.push({
      path: 'disko.nix',
      content: config.customLayout ? generateDiskoLayout(config.diskDevice, config.partitions, config.discard) : generateDisko(config),
    });
  } else if (config.customLayout) {
    files.push({ path: 'filesystems.nix', content: generateFilesystemsNix(config.partitions, config.discard) });
    files.push({ path: 'partition.sh', content: generatePartitionScript(config.diskDevice, config.partitions) });
  }
  return files;
}

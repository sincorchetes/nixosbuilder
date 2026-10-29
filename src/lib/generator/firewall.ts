// Firewall: puertos y bloque de configuración.
import { selectedSoftware } from './profileApps';
import type { FirewallConfig, FirewallRule, NixBuilderConfig } from './types';

/* ------------------------------ Firewall ------------------------------ */

export const portPattern = /^(\d{1,5})(?:-(\d{1,5}))?$/;

export const parsePort = (value: string): { from: number; to: number } | null => {
  const match = portPattern.exec(value.trim());
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] === undefined ? from : Number(match[2]);
  if (from < 1 || to > 65535 || from > to) return null;
  return { from, to };
};

export const portsFor = (rules: FirewallRule[], protocol: 'tcp' | 'udp') => {
  const singles: number[] = [];
  const ranges: Array<{ from: number; to: number }> = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (rule.protocol !== protocol && rule.protocol !== 'both') continue;
    const parsed = parsePort(rule.port);
    if (!parsed) continue;
    const key = `${parsed.from}-${parsed.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (parsed.from === parsed.to) singles.push(parsed.from);
    else ranges.push(parsed);
  }
  return { singles, ranges };
};

/** ¿Se aparta el firewall del comportamiento por defecto de NixOS? */
export const isFirewallCustomized = (fw: FirewallConfig) =>
  !fw.enable || fw.rules.length > 0 || !fw.allowPing || fw.rejectPackets || !fw.logRefused;

/** Software elegido en el perfil (servicios, paquetes, grupos y puertos). */

export const generateFirewall = (config: NixBuilderConfig): string[] => {
  const fw = config.firewall;
  const servicePorts = selectedSoftware(config).ports;
  const custom = isFirewallCustomized(fw);
  if (!custom && servicePorts.length === 0) return [];
  if (!fw.enable) return ['  networking.firewall.enable = false;', ''];

  const rules = [...fw.rules, ...servicePorts];
  const lines = ['  networking.firewall = {', '    enable = true;'];
  for (const [protocol, label] of [
    ['tcp', 'TCP'],
    ['udp', 'UDP'],
  ] as const) {
    const { singles, ranges } = portsFor(rules, protocol);
    if (singles.length) lines.push(`    allowed${label}Ports = [ ${singles.join(' ')} ];`);
    if (ranges.length) {
      lines.push(
        `    allowed${label}PortRanges = [`,
        ...ranges.map((range) => `      { from = ${range.from}; to = ${range.to}; }`),
        '    ];',
      );
    }
  }
  if (!fw.allowPing) lines.push('    allowPing = false;');
  if (fw.rejectPackets) lines.push('    rejectPackets = true;');
  if (!fw.logRefused) lines.push('    logRefusedConnections = false;');
  lines.push('  };', '');
  return lines;
};

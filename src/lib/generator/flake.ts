// flake.nix.
import { lanzabooteRef, nixString } from './nix';
import type { NixBuilderConfig } from './types';

export const generateFlake = (config: NixBuilderConfig) => {
  const nixpkgsBranch = config.channel === 'unstable' ? 'nixos-unstable' : `nixos-${config.channel}`;
  const homeBranch = config.channel === 'unstable' ? 'master' : `release-${config.channel}`;
  const lines = [
    '{',
    '  description = "Configuración de NixOS generada con NixOSBuilder";',
    '',
    '  inputs = {',
    `    nixpkgs.url = ${nixString(`github:NixOS/nixpkgs/${nixpkgsBranch}`)};`,
  ];

  if (config.homeManager) {
    lines.push(
      '    home-manager = {',
      `      url = ${nixString(`github:nix-community/home-manager/${homeBranch}`)};`,
      '      inputs.nixpkgs.follows = "nixpkgs";',
      '    };',
    );
  }
  if (config.disko) {
    lines.push('    disko = {', '      url = "github:nix-community/disko/latest";', '      inputs.nixpkgs.follows = "nixpkgs";', '    };');
  }
  if (config.secureBoot) {
    lines.push(
      '    lanzaboote = {',
      `      url = ${nixString(`github:nix-community/lanzaboote/${lanzabooteRef}`)};`,
      '      inputs.nixpkgs.follows = "nixpkgs";',
      '    };',
    );
  }

  lines.push(
    '  };',
    '',
    '  outputs = inputs@{ nixpkgs, ... }: {',
    `    nixosConfigurations.${config.hostname} = nixpkgs.lib.nixosSystem {`,
    `      system = ${nixString(config.architecture)};`,
    '      specialArgs = { inherit inputs; };',
    '      modules = [',
    '        ./configuration.nix',
  );
  if (config.disko) lines.push('        inputs.disko.nixosModules.disko');
  if (config.homeManager) lines.push('        inputs.home-manager.nixosModules.home-manager');
  if (config.secureBoot) lines.push('        inputs.lanzaboote.nixosModules.lanzaboote');
  lines.push('      ];', '    };', '  };', '}', '');
  return lines.join('\n');
};

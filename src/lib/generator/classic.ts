// Modelo tradicional de Nix (canales + configuration.nix) que usa la vista simple.
import type { NixBuilderConfig } from './types';

/**
 * La vista simple solo genera el modelo tradicional: sin flakes y sin disko. Home Manager entra como módulo de NixOS desde su canal,
 * así que `nixos-rebuild switch` aplica también la configuración del usuario sin cerrar sesión.
 * Los flakes y disko solo existen en la vista técnica; Secure Boot funciona en ambos modelos.
 */
export const classicConfig = (config: NixBuilderConfig): NixBuilderConfig => ({
  ...config,
  flakes: false,
  disko: false,
});

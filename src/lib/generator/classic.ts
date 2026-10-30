// Modelo tradicional de Nix (canales + configuration.nix) que usa la vista simple.
import type { NixBuilderConfig } from './types';

/**
 * La vista simple solo genera el modelo tradicional: sin flakes, sin disko y sin Secure Boot
 * (lanzaboote se distribuye como flake). Home Manager entra como módulo de NixOS desde su canal,
 * así que `nixos-rebuild switch` aplica también la configuración del usuario sin cerrar sesión.
 * Esas opciones solo existen en la vista técnica.
 */
export const classicConfig = (config: NixBuilderConfig): NixBuilderConfig => ({
  ...config,
  flakes: false,
  disko: false,
  secureBoot: false,
});

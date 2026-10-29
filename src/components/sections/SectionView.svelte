<script lang="ts">
  import SectionLanguage from './SectionLanguage.svelte';
  import SectionKeyboard from './SectionKeyboard.svelte';
  import SectionTime from './SectionTime.svelte';
  import SectionSoftware from './SectionSoftware.svelte';
  import SectionDesktop from './SectionDesktop.svelte';
  import SectionHardware from './SectionHardware.svelte';
  import SectionDisk from './SectionDisk.svelte';
  import SectionBoot from './SectionBoot.svelte';
  import SectionNetwork from './SectionNetwork.svelte';
  import SectionUser from './SectionUser.svelte';
  import SectionBasePackages from './SectionBasePackages.svelte';
  import SectionHomeManager from './SectionHomeManager.svelte';
  import SectionNix from './SectionNix.svelte';
  import type { NixBuilderConfig } from '../../lib/generator';
  import type { HomeManagerState } from '../../lib/homeManager.svelte';

  /** Datos compartidos que necesitan algunas secciones. */
  export interface SectionContext {
    /** Paquetes que no existen en nixpkgs según el selector. */
    diagnostics: { missingSystem: string[]; missingHm: string[] };
    hm: HomeManagerState;
    unavailable: ReadonlySet<string>;
    openTechnical: () => void;
  }

  let { id, config = $bindable(), ctx, technical = false }: {
    id: string;
    config: NixBuilderConfig;
    ctx: SectionContext;
    technical?: boolean;
  } = $props();
</script>

{#if id === 'language'}<SectionLanguage bind:config />
{:else if id === 'keyboard'}<SectionKeyboard bind:config />
{:else if id === 'time'}<SectionTime bind:config />
{:else if id === 'software'}<SectionSoftware bind:config unavailable={ctx.unavailable} />
{:else if id === 'desktop'}<SectionDesktop bind:config />
{:else if id === 'hardware'}<SectionHardware bind:config />
{:else if id === 'disk'}<SectionDisk bind:config {technical} />
{:else if id === 'boot'}<SectionBoot bind:config {technical} />
{:else if id === 'network'}<SectionNetwork bind:config {technical} onTechnical={ctx.openTechnical} />
{:else if id === 'user'}<SectionUser bind:config />
{:else if id === 'basePackages'}<SectionBasePackages bind:config bind:missing={ctx.diagnostics.missingSystem} />
{:else if id === 'homeManager'}<SectionHomeManager bind:config bind:missing={ctx.diagnostics.missingHm} hm={ctx.hm} />
{:else if id === 'nix'}<SectionNix bind:config />
{/if}

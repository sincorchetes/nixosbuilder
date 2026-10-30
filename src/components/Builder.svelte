<script lang="ts">
  import { tick } from 'svelte';
  import ModeTabs, { type View } from './ModeTabs.svelte';
  import OutputPanel from './OutputPanel.svelte';
  import TechnicalView from './TechnicalView.svelte';
  import WizardView from './WizardView.svelte';
  import type { SectionContext } from './sections/SectionView.svelte';
  import { siteBase } from '../lib/base';
  import { downloadZip } from '../lib/download';
  import { HomeManagerState } from '../lib/homeManager.svelte';
  import { setLang, type Lang } from '../lib/i18n';
  import { allItems, isItemAvailable, profiles } from '../lib/software';
  import { buildErrors, buildWarnings } from '../lib/problems';
  import { buildSummaries } from '../lib/summaries';
  import { issuesByStep } from '../lib/wizardSteps';
  import {
    availableSessions,
    classicConfig,
    defaultConfig,
    generateFiles,
    nextSteps,
    type NixBuilderConfig,
  } from '../lib/generator';

  let { lang = 'es' }: { lang?: Lang } = $props();
  // El idioma es fijo por página: se establece antes de calcular ningún texto.
  setLang(lang);

  let config = $state<NixBuilderConfig>(
    structuredClone(lang === 'en' ? { ...defaultConfig, locale: 'en_US.UTF-8', keyboard: 'us', timeZone: 'UTC' } : defaultConfig),
  );
  let view = $state<View>('simple');
  let softwareStatus = $state<Record<string, string[]>>({});
  const diagnostics = $state({ missingSystem: [] as string[], missingHm: [] as string[] });
  const hm = new HomeManagerState(() => config, siteBase);

  $effect(() => {
    fetch(`${siteBase}software-status.json`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => (softwareStatus = data))
      .catch(() => {});
  });

  // Mantener la configuración coherente cuando una opción limita a otra.
  const sessions = $derived(availableSessions(config.desktop));
  $effect(() => {
    if (sessions.length && !sessions.includes(config.session)) config.session = sessions[0];
  });
  $effect(() => {
    if (config.secureBoot && config.bootloader !== 'systemd-boot') config.bootloader = 'systemd-boot';
  });

  // La vista simple genera el modelo tradicional (sin flakes ni disko); la técnica, lo que se haya elegido.
  const effective = $derived(view === 'technical' ? config : classicConfig(config));

  const unavailable = $derived(new Set(softwareStatus[config.channel] ?? []));
  const unavailableChosen = $derived(
    config.selected
      .map((id) => allItems.get(id))
      .filter((item) => !!item && !isItemAvailable(item, unavailable))
      .map((item) => item!.label),
  );
  const problemContext = $derived({
    unavailableChosen,
    missingSystem: diagnostics.missingSystem,
    missingHm: diagnostics.missingHm,
    unknownModules: hm.unknownModules,
    modules: hm.diagnostics,
    hmIndexLoaded: !!hm.index,
  });
  const errors = $derived(buildErrors(effective, problemContext));
  const warnings = $derived(buildWarnings(effective, problemContext));
  const files = $derived(errors.length === 0 ? generateFiles(effective) : []);
  const steps = $derived(nextSteps(effective));
  const issues = $derived(issuesByStep(errors));
  const summaries = $derived(buildSummaries(effective, profiles.find((profile) => profile.id === config.profile)!.label, sessions));

  // Al cambiar de vista el contenido se reemplaza y la página se acorta un instante: el navegador
  // te lleva arriba. Se compensa para que las pestañas queden donde estaban en pantalla.
  async function setView(next: View) {
    if (next === view) return;
    const tabsTop = () => document.querySelector('.mode-tabs')?.getBoundingClientRect().top ?? 0;
    const before = tabsTop();
    view = next;
    await tick();
    window.scrollBy(0, tabsTop() - before);
  }

  const ctx: SectionContext = {
    diagnostics,
    hm,
    get unavailable() { return unavailable; },
    openTechnical: () => setView('technical'),
  };
</script>

{#snippet output()}
  <OutputPanel config={effective} {errors} {warnings} {files} {steps} />
{/snippet}

{#if view === 'technical'}
  <TechnicalView bind:config {ctx} onView={setView} {output} />
{:else}
  <WizardView
    bind:config
    {ctx}
    {summaries}
    {issues}
    canDownload={errors.length === 0}
    onView={setView}
    onDownload={() => downloadZip(files, config.hostname)}
    {output}
  />
{/if}

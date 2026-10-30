<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Snippet } from 'svelte';
  import ModeTabs, { type View } from './ModeTabs.svelte';
  import SectionView, { type SectionContext } from './sections/SectionView.svelte';
  import ConfirmDialog from './wizard/ConfirmDialog.svelte';
  import WizardSidebar from './wizard/WizardSidebar.svelte';
  import WizardSummary from './wizard/WizardSummary.svelte';
  import WizardWelcome from './wizard/WizardWelcome.svelte';
  import { t } from '../lib/i18n';
  import { icons, pendingSteps, wizardSteps } from '../lib/wizardSteps';
  import type { NixBuilderConfig } from '../lib/generator';

  let { config = $bindable(), ctx, summaries, issues, canDownload, onView, onDownload, output }: {
    config: NixBuilderConfig;
    ctx: SectionContext;
    summaries: Record<string, string>;
    issues: Record<string, string | undefined>;
    canDownload: boolean;
    onView: (view: View) => void;
    onDownload: () => void;
    output: Snippet;
  } = $props();

  const lastStep = wizardSteps.length - 1;
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let stepIndex = $state(0);
  let direction = $state(1);
  let visited = $state<boolean[]>([true]);

  const currentStep = $derived(wizardSteps[stepIndex]);
  // Hasta que todos los pasos previos estén revisados y sin errores no se puede ver el resumen.
  const pending = $derived(pendingSteps(visited, stepIndex, issues));
  const allGreen = $derived(pending.length === 0);
  const summaryLocked = $derived(stepIndex !== lastStep && !allGreen);
  // Un paso con errores (p. ej. sin elegir el destino de instalación) no se puede abandonar hacia delante.
  const blocked = $derived(!!issues[currentStep.id]);
  // Sin entorno gráfico se pide confirmación al salir de ese paso.
  let askNoDesktop = $state(false);
  let desktopConfirmed = $state(false);
  let target = 0;

  $effect(() => {
    if (config.desktop !== 'none') desktopConfirmed = false;
  });

  function goTo(index: number) {
    const next = Math.min(Math.max(index, 0), lastStep);
    if (next > stepIndex && blocked) return;
    if (next === lastStep && summaryLocked) return;
    if (next > stepIndex && currentStep.id === 'desktop' && config.desktop === 'none' && !desktopConfirmed) {
      target = next;
      askNoDesktop = true;
      return;
    }
    direction = next >= stepIndex ? 1 : -1;
    stepIndex = next;
    visited[next] = true;
  }
</script>

<div class="wizard">
  <ModeTabs view="simple" onChange={onView} />
  <div class="wizard-window">
    <WizardSidebar current={stepIndex} {visited} {issues} {summaryLocked} {blocked} onGo={goTo} />

    <div class="wizard-main">
      <div class="wizard-stage">
        {#key stepIndex}
          <section class="slide" in:fly={{ x: reducedMotion ? 0 : direction * 48, duration: reducedMotion ? 0 : 260 }} aria-labelledby="slide-title">
            <header class="slide-head">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{@html icons[currentStep.icon]}</svg>
              <div>
                {#if currentStep.group}<small>{t(currentStep.group)}</small>{/if}
                <h3 id="slide-title">{t(currentStep.title)}</h3>
              </div>
            </header>

            {#if currentStep.id === 'welcome'}
              <WizardWelcome onTechnical={() => onView('technical')} />
            {:else if currentStep.id === 'summary'}
              <WizardSummary {summaries} {issues} onGo={goTo} />
              <div class="wizard-output">{@render output()}</div>
            {:else}
              <form class="builder-form" onsubmit={(event) => event.preventDefault()}>
                <SectionView id={currentStep.id} bind:config {ctx} />
              </form>
            {/if}
          </section>
        {/key}
      </div>

      <footer class="wizard-nav">
        <button type="button" class="secondary-button" disabled={stepIndex === 0} onclick={() => goTo(stepIndex - 1)}>{t('← Atrás')}</button>
        <span class="progress" class:pending={blocked || (summaryLocked && stepIndex >= lastStep - 1)}>
          {#if blocked}
            ⚠ {t(issues[currentStep.id]!)}
          {:else if summaryLocked && stepIndex >= lastStep - 1}
            {t('Falta completar:')} {pending.map((step) => t(step.title)).join(', ')}
          {:else}
            {t('Paso')} {stepIndex + 1} {t('de')} {wizardSteps.length}
          {/if}
        </span>
        {#if allGreen && stepIndex < lastStep}
          <button type="button" class="secondary-button to-summary" onclick={() => goTo(lastStep)}>{t('Ir al resumen ⏭')}</button>
        {/if}
        {#if stepIndex < lastStep}
          <button type="button" class="primary-button" disabled={blocked || (stepIndex === lastStep - 1 && summaryLocked)} onclick={() => goTo(stepIndex + 1)}>
            {stepIndex === 0 ? t('Empezar') : stepIndex === lastStep - 1 ? t('Ver resumen') : t('Siguiente')} →
          </button>
        {:else}
          <button type="button" class="primary-button" disabled={!canDownload} onclick={onDownload}>{t('Descargar .zip ↓')}</button>
        {/if}
      </footer>
    </div>
  </div>
</div>

<ConfirmDialog
  bind:open={askNoDesktop}
  message={t('¿Seguro que quieres instalar el sistema sin entorno gráfico? Solo tendrás la línea de comandos.')}
  onConfirm={() => {
    desktopConfirmed = true;
    goTo(target);
  }}
/>

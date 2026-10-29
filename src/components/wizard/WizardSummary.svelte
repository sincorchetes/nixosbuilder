<script lang="ts">
  import { t } from '../../lib/i18n';
  import { icons, wizardSteps } from '../../lib/wizardSteps';

  let { summaries, issues, onGo }: {
    summaries: Record<string, string>;
    issues: Record<string, string | undefined>;
    onGo: (index: number) => void;
  } = $props();
</script>

<div class="hub">
  <p class="field-note">{t('Revisa el resumen; pulsa una tarjeta para cambiar ese paso.')}</p>
  <div class="hub-grid">
    {#each wizardSteps.filter((step) => summaries[step.id]) as item (item.id)}
      <button type="button" class="spoke" class:warn={!!issues[item.id]} onclick={() => onGo(wizardSteps.findIndex((step) => step.id === item.id))}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{@html icons[item.icon]}</svg>
        <span class="spoke-text">
          <strong>{t(item.title)}</strong>
          <small>{summaries[item.id]}</small>
          {#if issues[item.id]}<em>⚠ {t(issues[item.id]!)}</em>{/if}
        </span>
      </button>
    {/each}
  </div>
</div>

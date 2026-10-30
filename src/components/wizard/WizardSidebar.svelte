<script lang="ts">
  import { t } from '../../lib/i18n';
  import { wizardSteps } from '../../lib/wizardSteps';

  let { current, visited, issues, summaryLocked = false, blocked = false, onGo }: {
    current: number;
    visited: boolean[];
    issues: Record<string, string | undefined>;
    summaryLocked?: boolean;
    /** El paso actual tiene errores: no se puede avanzar hasta corregirlos. */
    blocked?: boolean;
    onGo: (index: number) => void;
  } = $props();
</script>

<nav class="wizard-steps" aria-label={t('Pasos de la instalación')}>
  <ol>
    {#each wizardSteps as step, i (step.id)}
      <li>
        <button
          type="button"
          class:current={i === current}
          class:done={i !== current && !!visited[i] && !issues[step.id]}
          class:warn={!!issues[step.id] && !!visited[i] && i !== current}
          disabled={(step.id === 'summary' && summaryLocked) || (blocked && i > current)}
          aria-current={i === current ? 'step' : undefined}
          onclick={() => onGo(i)}
        >
          <span class="dot">{#if issues[step.id] && visited[i] && i !== current}!{:else if i !== current && visited[i]}✓{:else}{i + 1}{/if}</span>
          <span class="label">{t(step.title)}</span>
        </button>
      </li>
    {/each}
  </ol>
</nav>

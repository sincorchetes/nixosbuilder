<script lang="ts">
  import { t } from '../lib/i18n';

  export type View = 'simple' | 'technical';
  let { view, onChange }: { view: View; onChange: (view: View) => void } = $props();
</script>

<div class="mode-tabs" role="tablist" aria-label={t('Tipo de vista')}>
  <button type="button" role="tab" aria-selected={view === 'simple'} class:active={view === 'simple'} onclick={() => onChange('simple')}>{t('Asistente')}</button>
  <button type="button" role="tab" aria-selected={view === 'technical'} class:active={view === 'technical'} onclick={() => onChange('technical')}>{t('Vista técnica')}</button>
</div>

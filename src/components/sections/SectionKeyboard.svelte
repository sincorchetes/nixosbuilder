<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';
  import { keyboardById, keyboards } from '../../lib/locale';

  let { config = $bindable() }: { config: NixBuilderConfig } = $props();

  function addKeyboard(id: string) {
    if (id && !config.extraKeyboards.includes(id)) config.extraKeyboards = [...config.extraKeyboards, id];
  }
</script>

<fieldset>
  <legend>{t('Teclado')}</legend>
  <label>{t('Distribución principal')}
    <select bind:value={config.keyboard}>
      {#each keyboards as keyboard}
        <option value={keyboard.id}>{t(keyboard.label)}</option>
      {/each}
    </select>
  </label>
  <label>{t('Distribuciones adicionales (opcional)')}
    <select value="" onchange={(event) => { addKeyboard(event.currentTarget.value); event.currentTarget.value = ''; }}>
      <option value="">{t('Añadir distribución…')}</option>
      {#each keyboards.filter((keyboard) => keyboard.id !== config.keyboard && !config.extraKeyboards.includes(keyboard.id)) as keyboard}
        <option value={keyboard.id}>{t(keyboard.label)}</option>
      {/each}
    </select>
  </label>
  {#if config.extraKeyboards.length > 0}
    <div class="profile-chips">
      {#each config.extraKeyboards as id (id)}
        <span class="chip">
          {keyboardById(id)?.label ?? id}
          <button type="button" aria-label={t('Quitar') + ' ' + t(keyboardById(id)?.label ?? id)} onclick={() => (config.extraKeyboards = config.extraKeyboards.filter((item) => item !== id))}>{t('×')}</button>
        </span>
      {/each}
    </div>
    <p class="field-note">{t('Cambia de distribución con Alt+Shift en el entorno gráfico.')}</p>
  {/if}
</fieldset>
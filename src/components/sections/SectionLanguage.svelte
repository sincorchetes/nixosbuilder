<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';
  import { languageLabel, languages } from '../../lib/locale';

  let { config = $bindable() }: { config: NixBuilderConfig } = $props();

  function addLocale(locale: string) {
    if (locale && !config.extraLocales.includes(locale)) config.extraLocales = [...config.extraLocales, locale];
  }
</script>

<fieldset>
  <legend>{t('Idioma')}</legend>
  <label>{t('Idioma principal')}
    <select bind:value={config.locale}>
      {#each languages as language}
        <option value={language.locale}>{language.label} · {language.locale}</option>
      {/each}
    </select>
  </label>
  <label>{t('Idiomas adicionales (opcional)')}
    <select value="" onchange={(event) => { addLocale(event.currentTarget.value); event.currentTarget.value = ''; }}>
      <option value="">{t('Añadir idioma…')}</option>
      {#each languages.filter((language) => language.locale !== config.locale && !config.extraLocales.includes(language.locale)) as language}
        <option value={language.locale}>{language.label}</option>
      {/each}
    </select>
  </label>
  {#if config.extraLocales.length > 0}
    <div class="profile-chips">
      {#each config.extraLocales as locale (locale)}
        <span class="chip">
          {languageLabel(locale)}
          <button type="button" aria-label={t('Quitar') + ' ' + languageLabel(locale)} onclick={() => (config.extraLocales = config.extraLocales.filter((item) => item !== locale))}>{t('×')}</button>
        </span>
      {/each}
    </div>
  {/if}
  <p class="field-note">{t('Se generan con codificación UTF-8. Los adicionales quedan instalados para poder elegirlos al iniciar sesión.')}</p>
</fieldset>
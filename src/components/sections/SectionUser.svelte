<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';

  let { config = $bindable() }: { config: NixBuilderConfig } = $props();
</script>

<fieldset>
  <legend>{t('Usuario')}</legend>
  <label>{t('Usuario')}<input bind:value={config.username} autocomplete="off" /></label>
  <label>{t('Nombre visible')}<input bind:value={config.fullName} autocomplete="off" /></label>
  <p class="field-note">{t('La contraseña de root y la de tu usuario se asignan al instalar (te lo recordamos en los pasos finales).')}</p>
</fieldset>
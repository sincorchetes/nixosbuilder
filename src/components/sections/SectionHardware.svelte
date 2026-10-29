<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';

  let { config = $bindable() }: { config: NixBuilderConfig } = $props();
</script>

<fieldset>
  <legend>{t('Gráficos y audio')}</legend>
  <label>{t('Gráfica')}
    <select bind:value={config.gpu}>
      <option value="none">{t('Ninguna / genérica')}</option>
      <option value="intel">{t('Intel')}</option>
      <option value="amd">{t('AMD')}</option>
      <option value="nvidia">{t('NVIDIA')}</option>
    </select>
  </label>
  <label class="check"><input type="checkbox" bind:checked={config.pipewire} /> {t('Audio (PipeWire)')}</label>
  <label class="check"><input type="checkbox" bind:checked={config.bluetooth} /> {t('Bluetooth')}</label>
</fieldset>
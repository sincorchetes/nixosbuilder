<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';

  let { config = $bindable() }: { config: NixBuilderConfig } = $props();
</script>

<fieldset>
  <legend>{t('Nix y NixOS')}</legend>
  <label>{t('Canal')}
    <select bind:value={config.channel}>
      <option value="26.05">{t('NixOS 26.05')}</option>
      <option value="25.11">{t('NixOS 25.11')}</option>
      <option value="unstable">{t('unstable')}</option>
    </select>
  </label>
  <label>{t('Arquitectura')}
    <select bind:value={config.architecture}>
      <option value="x86_64-linux">{t('x86_64')}</option>
      <option value="aarch64-linux">{t('aarch64')}</option>
    </select>
  </label>
  <label class="check"><input type="checkbox" bind:checked={config.flakes} /> {t('Flakes')}</label>
  <label class="check"><input type="checkbox" bind:checked={config.allowUnfree} /> {t('Permitir software no libre')}</label>
</fieldset>
<fieldset>
  <legend>{t('hardware-configuration.nix')}</legend>
  <label>{t('Opcional')}
    <textarea rows="4" bind:value={config.hardwareConfiguration} placeholder={t('Pega aquí la salida de nixos-generate-config')}></textarea>
  </label>
</fieldset>
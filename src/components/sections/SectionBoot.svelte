<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';

  let { config = $bindable(), technical = false }: { config: NixBuilderConfig; technical?: boolean } = $props();
</script>

<fieldset>
  <legend>{t('Arranque')}</legend>
  <p class="field-note">{t('Arranque UEFI.')}</p>
  {#if technical}
    <label>{t('Gestor de arranque')}
      <select bind:value={config.bootloader} disabled={config.secureBoot}>
        <option value="systemd-boot">{t('systemd-boot')}</option>
        <option value="grub">{t('GRUB (UEFI)')}</option>
      </select>
    </label>
  {/if}
  <label class="check">
    <input type="checkbox" bind:checked={config.secureBoot} disabled={!config.flakes} />
    {t('Secure Boot (lanzaboote)')}
  </label>
  {#if !config.flakes}
    <p class="field-note">{t('Secure Boot requiere flakes (actívalos en la vista técnica).')}</p>
  {:else if config.secureBoot}
    <p class="field-note">{t('Deberás crear y enrolar las claves con sbctl; te indicamos los comandos en los pasos finales.')}</p>
  {/if}
  <label class="check"><input type="checkbox" bind:checked={config.multiboot} /> {t('Multiboot (dual boot con otro sistema)')}</label>
</fieldset>
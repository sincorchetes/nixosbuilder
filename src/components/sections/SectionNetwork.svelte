<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';
  import { firewallPresets } from '../../lib/catalog';

  let { config = $bindable(), technical = false, onTechnical }: { config: NixBuilderConfig; technical?: boolean; onTechnical: () => void } = $props();

  function addRule(port = '', protocol: 'tcp' | 'udp' | 'both' = 'tcp') {
    config.firewall.rules = [...config.firewall.rules, { port, protocol }];
  }

  function removeRule(index: number) {
    config.firewall.rules = config.firewall.rules.filter((_, i) => i !== index);
  }
</script>

{#snippet firewallRules()}
<div class="rules">
  {#each config.firewall.rules as rule, i}
    <div class="rule">
      <input bind:value={rule.port} placeholder={t('80 o 8000-8100')} aria-label={t('Puerto o rango')} inputmode="numeric" />
      <select bind:value={rule.protocol} aria-label={t('Protocolo')}>
        <option value="tcp">{t('TCP')}</option>
        <option value="udp">{t('UDP')}</option>
        <option value="both">{t('TCP+UDP')}</option>
      </select>
      <button type="button" class="icon-button" aria-label={t('Quitar regla')} onclick={() => removeRule(i)}>{t('×')}</button>
    </div>
  {/each}
  <button type="button" class="ghost-button" onclick={() => addRule()}>{t('+ Abrir puerto')}</button>
</div>
<div class="presets" aria-label={t('Puertos habituales')}>
  {#each firewallPresets as preset}
    <button type="button" onclick={() => addRule(preset.port, preset.protocol)}>{t(preset.label)} {preset.port}</button>
  {/each}
</div>
<label class="check"><input type="checkbox" bind:checked={config.firewall.allowPing} /> {t('Permitir ping (ICMP echo)')}</label>
<label class="check"><input type="checkbox" bind:checked={config.firewall.rejectPackets} /> {t('Responder con rechazo (reject) en vez de descartar')}</label>
<label class="check"><input type="checkbox" bind:checked={config.firewall.logRefused} /> {t('Registrar conexiones rechazadas')}</label>
{/snippet}

<fieldset>
  <legend>{t('Red')}</legend>
  <label>{t('Nombre del equipo')}<input bind:value={config.hostname} autocomplete="off" /></label>
  <label class="check"><input type="checkbox" bind:checked={config.networkManager} /> {t('NetworkManager')}</label>
  <label class="check"><input type="checkbox" bind:checked={config.openSsh} /> {t('Servidor SSH')}</label>
</fieldset>
<fieldset>
  <legend>{t('Firewall')}</legend>
  <label class="check"><input type="checkbox" bind:checked={config.firewall.enable} /> {t('Firewall habilitado')}</label>
  {#if config.firewall.enable}
    {#if technical}
      {@render firewallRules()}
    {:else}
      <p class="field-note">
        {t('Solo se abren los puertos de los servicios que elijas. Para abrir más o bloquear ping, usa la')}
        <button type="button" class="link-button" onclick={() => onTechnical()}>{t('vista técnica')}</button>.
      </p>
    {/if}
  {:else}
    <p class="field-note">{t('Con el firewall desactivado todos los puertos quedan accesibles.')}</p>
  {/if}
</fieldset>
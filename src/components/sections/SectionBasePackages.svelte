<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';
  import PackagePicker from '../PackagePicker.svelte';
  import { siteBase } from '../../lib/base';

  let { config = $bindable(), missing = $bindable() }: { config: NixBuilderConfig; missing: string[] } = $props();
</script>

<fieldset>
  <legend>{t('Paquetes base del sistema')}</legend>
  <PackagePicker bind:value={config.packages} bind:missing channel={config.channel} base={siteBase} label={t('Se instalan en todo el sistema (configuration.nix)')} />
</fieldset>
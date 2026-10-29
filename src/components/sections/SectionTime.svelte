<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';
  import { allTimeZones } from '../../lib/locale';

  let { config = $bindable() }: { config: NixBuilderConfig } = $props();

  // Las zonas horarias solo se conocen en el navegador: se rellenan tras montar el componente.
  let timeZones = $state<string[]>([config.timeZone]);
  $effect(() => {
    timeZones = allTimeZones();
  });
  const timeZoneGroups = $derived.by(() => {
    const zones = timeZones.includes(config.timeZone) ? timeZones : [config.timeZone, ...timeZones];
    const groups = new Map<string, string[]>();
    for (const zone of zones) {
      const region = zone.includes('/') ? zone.split('/')[0] : 'General';
      groups.set(region, [...(groups.get(region) ?? []), zone]);
    }
    return [...groups].map(([region, list]) => ({ region, zones: list }));
  });
  const zoneName = (zone: string) => (zone.includes('/') ? zone.split('/').slice(1).join(' / ') : zone).replaceAll('_', ' ');
</script>

<fieldset>
  <legend>{t('Hora y fecha')}</legend>
  <label>{t('Zona horaria')}
    <select bind:value={config.timeZone}>
      {#each timeZoneGroups as group (group.region)}
        <optgroup label={group.region}>
          {#each group.zones as zone (zone)}
            <option value={zone}>{zoneName(zone)}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </label>
</fieldset>
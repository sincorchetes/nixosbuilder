<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';
  import SoftwareDialog from '../SoftwareDialog.svelte';
  import { siteBase } from '../../lib/base';
  import { loadIndex, type PackageIndex } from '../../lib/packages';
  import { allItems, itemsFor, profileDefaults, profileTitle, profiles, type Profile } from '../../lib/software';

  let { config = $bindable(), unavailable }: { config: NixBuilderConfig; unavailable: ReadonlySet<string> } = $props();

  let showSoftware = $state(false);
  let pkgIndex = $state<PackageIndex | null>(null);

  $effect(() => {
    const channel = config.channel;
    pkgIndex = null;
    void loadIndex(channel, siteBase).then((loaded) => {
      if (channel === config.channel) pkgIndex = loaded;
    });
  });

  const profileItems = $derived(itemsFor(config.profile));
  const profileInfo = $derived(profiles.find((profile) => profile.id === config.profile)!);
  const chosenItems = $derived(config.selected.map((id) => allItems.get(id)).filter((item) => !!item));

  function applyProfile(profile: Profile) {
    const preset = profileDefaults[profile];
    config.profile = profile;
    config.selected = [...preset.selected];
    config.extraApps = [];
    config.versions = {};
    if (preset.desktop === 'none') config.desktop = 'none';
    else if (preset.desktop && config.desktop === 'none') config.desktop = preset.desktop;
    if (preset.openSsh) config.openSsh = true;
    if (profile === 'server') {
      config.pipewire = false;
      config.bluetooth = false;
    } else if (profile !== 'custom') {
      config.pipewire = true;
      config.bluetooth = true;
    }
  }

  function removeSelected(id: string) {
    config.selected = config.selected.filter((item) => item !== id);
  }
</script>

<fieldset>
  <legend>{t('Perfil y aplicaciones')}</legend>
  <label>{t('¿Para qué lo vas a usar?')}
    <select value={config.profile} onchange={(event) => applyProfile(event.currentTarget.value as Profile)}>
      {#each profiles as profile}
        <option value={profile.id}>{t(profile.label)}</option>
      {/each}
    </select>
  </label>
  <p class="field-note">{t(profileInfo.description)}.</p>
  {#if profileTitle[config.profile]}
    <button type="button" class="ghost-button" onclick={() => (showSoftware = true)}>
      {t(profileTitle[config.profile]!.button)} ({config.selected.length + config.extraApps.length})
    </button>
    {#if chosenItems.length > 0 || config.extraApps.length > 0}
      <div class="profile-chips">
        {#each chosenItems as item (item.id)}
          <span class="chip">
            {item.versions?.find((version) => version.value === config.versions[item.id])?.label ?? item.label}
            <button type="button" aria-label={t('Quitar') + ' ' + item.label} onclick={() => removeSelected(item.id)}>{t('×')}</button>
          </span>
        {/each}
        {#each config.extraApps as app (app.name)}
          <span class="chip">
            {app.name}
            <button type="button" aria-label={t('Quitar') + ' ' + app.name} onclick={() => (config.extraApps = config.extraApps.filter((item) => item.name !== app.name))}>{t('×')}</button>
          </span>
        {/each}
      </div>
    {/if}
  {/if}
</fieldset>
{#if profileTitle[config.profile]}
  <SoftwareDialog
    bind:open={showSoftware}
    title={profileTitle[config.profile]!.dialog}
    items={profileItems}
    bind:selected={config.selected}
    bind:versions={config.versions}
    bind:extraApps={config.extraApps}
    index={pkgIndex}
    {unavailable}
    channel={config.channel}
  />
{/if}

<script lang="ts">
  import { t } from '../lib/i18n';
  import { hasPackage, searchIndex, type PackageIndex } from '../lib/packages';
  import {
    isItemAvailable,
    isVersionAvailable,
    type SoftwareItem,
  } from '../lib/software';

  let {
    open = $bindable(false),
    title,
    items,
    selected = $bindable(),
    versions = $bindable(),
    extraApps = $bindable(),
    index,
    unavailable,
    channel,
  }: {
    open: boolean;
    title: string;
    items: SoftwareItem[];
    selected: string[];
    versions: Record<string, string>;
    extraApps: Array<{ name: string; unfree: boolean }>;
    index: PackageIndex | null;
    unavailable: ReadonlySet<string>;
    channel: string;
  } = $props();

  let dialog: HTMLDialogElement;
  let query = $state('');

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  const matches = $derived(
    items.filter((item) =>
      `${item.label} ${item.description} ${item.category} ${(item.packages ?? []).join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ),
  );
  const popular = $derived(query.trim() ? [] : matches.filter((item) => item.popular));
  const categories = $derived([...new Set(matches.map((item) => item.category))]);

  // Búsqueda en el índice de nixpkgs del canal (más allá del catálogo del perfil).
  const catalogAttrs = $derived(new Set(items.flatMap((item) => item.packages ?? [])));
  const hits = $derived.by(() => {
    const text = query.trim();
    if (!index || text.length < 2) return [];
    const found = searchIndex(index, text, 14).filter((hit) => !catalogAttrs.has(hit.name));
    if (!found.some((hit) => hit.name === text) && hasPackage(index, text) && !catalogAttrs.has(text)) {
      found.unshift({ name: text, unfree: false, version: '', description: 'Atributo de nixpkgs' });
    }
    return found;
  });
  const isAdded = (name: string) => extraApps.some((app) => app.name === name);
  const toggleApp = (name: string, unfree: boolean) => {
    extraApps = isAdded(name) ? extraApps.filter((app) => app.name !== name) : [...extraApps, { name, unfree }];
  };

  function toggle(item: SoftwareItem, checked: boolean) {
    selected = checked ? [...new Set([...selected, item.id])] : selected.filter((id) => id !== item.id);
    if (checked && item.versions && !versions[item.id]) {
      const first = item.versions.find((version) => isVersionAvailable(version, unavailable)) ?? item.versions[0];
      versions[item.id] = first.value;
    }
  }
</script>

{#snippet row(item: SoftwareItem)}
  {@const available = isItemAvailable(item, unavailable)}
  <div class="sw-row" class:off={!available}>
    <label class="sw-main">
      <input
        type="checkbox"
        checked={selected.includes(item.id)}
        disabled={!available}
        onchange={(event) => toggle(item, event.currentTarget.checked)}
      />
      <span class="sw-text">
        <strong>{t(item.label)}</strong>
        <small>{t(item.description)}</small>
      </span>
    </label>
    <span class="sw-badges">
      {#if !available}<em class="badge bad" title="Roto o inseguro en nixpkgs {channel}">no disponible en {channel}</em>{/if}
      {#if item.unfree}<em class="badge">{t('no libre')}</em>{/if}
    </span>
    {#if item.versions && selected.includes(item.id)}
      <select
        aria-label={t('Versión de') + ' ' + item.label}
        value={versions[item.id] ?? item.versions[0].value}
        onchange={(event) => (versions[item.id] = event.currentTarget.value)}
      >
        {#each item.versions as version}
          <option value={version.value} disabled={!isVersionAvailable(version, unavailable)}>
            {version.label}{isVersionAvailable(version, unavailable) ? '' : ' ' + t('(no disponible)')}
          </option>
        {/each}
      </select>
    {/if}
  </div>
{/snippet}

<dialog
  bind:this={dialog}
  class="sw-dialog"
  onclose={() => (open = false)}
  onclick={(event) => { if (event.target === dialog) open = false; }}
>
  <div class="sw-card">
    <header>
      <h3>{t(title)}</h3>
      <button type="button" class="icon-button" aria-label={t('Cerrar')} onclick={() => (open = false)}>{t('×')}</button>
    </header>
    <input type="search" class="sw-search" bind:value={query} placeholder={t('Busca en el catálogo y en todo nixpkgs…')} aria-label={t('Buscar')} />

    <div class="sw-list">
      {#if extraApps.length > 0}
        <section>
          <h4>{t('Añadidos desde nixpkgs')}</h4>
          <div class="profile-chips">
            {#each extraApps as app (app.name)}
              <span class="chip">{app.name}<button type="button" aria-label={t('Quitar') + ' ' + app.name} onclick={() => toggleApp(app.name, app.unfree)}>{t('×')}</button></span>
            {/each}
          </div>
        </section>
      {/if}
      {#if popular.length > 0}
        <section>
          <h4>{t('Populares')}</h4>
          {#each popular as item (item.id)}{@render row(item)}{/each}
        </section>
      {/if}
      {#each categories as category}
        <section>
          <h4>{t(category)}</h4>
          {#each matches.filter((item) => item.category === category) as item (item.id)}{@render row(item)}{/each}
        </section>
      {/each}
      {#if query.trim().length >= 2}
        <section>
          <h4>{t('Resultados en nixpkgs')} {channel}</h4>
          {#if !index}
            <p class="field-note">{t('Índice de paquetes no disponible. Ejecuta')} <code>{t('bun run packages')}</code>.</p>
          {:else if hits.length === 0}
            <p class="field-note">{t('Sin coincidencias en nixpkgs para')} «{query}».</p>
          {/if}
          {#each hits as hit (hit.name)}
            <div class="sw-row">
              <label class="sw-main">
                <input type="checkbox" checked={isAdded(hit.name)} onchange={() => toggleApp(hit.name, hit.unfree)} />
                <span class="sw-text">
                  <strong>{hit.name} <small>{hit.version}</small></strong>
                  <small>{hit.description}</small>
                </span>
              </label>
              <span class="sw-badges">{#if hit.unfree}<em class="badge">{t('no libre')}</em>{/if}</span>
            </div>
          {/each}
          <a class="field-note" href={`https://search.nixos.org/packages?channel=${channel}&query=${encodeURIComponent(query.trim())}`} target="_blank" rel="noreferrer">{t('Buscar también en search.nixos.org ↗')}</a>
        </section>
      {:else if matches.length === 0 && items.length > 0}
        <p class="field-note">{t('Nada coincide con')} «{query}».</p>
      {:else if items.length === 0 && extraApps.length === 0}
        <p class="field-note">{t('Escribe el nombre de una aplicación (p. ej. firefox, gimp, htop) para buscarla en nixpkgs')} {channel}.</p>
      {/if}
    </div>

    <footer>
      <span>{selected.length + extraApps.length} {t('seleccionado(s)')}</span>
      <button type="button" class="primary-button" onclick={() => (open = false)}>{t('Listo')}</button>
    </footer>
  </div>
</dialog>

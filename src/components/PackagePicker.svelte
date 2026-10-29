<script lang="ts">
  import { t } from '../lib/i18n';
  import { isValidPackageName, packageNames, type Channel } from '../lib/generator';
  import { hasPackage, loadIndex, searchIndex, type PackageIndex } from '../lib/packages';

  let {
    value = $bindable(),
    missing = $bindable([]),
    channel,
    base,
    label,
  }: { value: string; missing?: string[]; channel: Channel; base: string; label: string } = $props();

  let index = $state<PackageIndex | null>(null);
  let status = $state<'loading' | 'ready' | 'missing'>('loading');
  let query = $state('');
  let open = $state(false);
  let highlighted = $state(0);

  $effect(() => {
    const current = channel;
    status = 'loading';
    void loadIndex(current, base).then((loaded) => {
      if (current !== channel) return;
      index = loaded;
      status = loaded ? 'ready' : 'missing';
    });
  });

  const names = $derived(packageNames(value));
  const suggestions = $derived(index && query.trim() ? searchIndex(index, query) : []);

  const stateOf = (name: string) => {
    if (!isValidPackageName(name)) return 'invalid';
    if (status !== 'ready' || !index) return 'unknown';
    if (hasPackage(index, name)) return 'ok';
    // Los atributos anidados (python3Packages.x) no están en el índice: no se pueden verificar.
    return name.includes('.') ? 'unknown' : 'missing';
  };

  const searchUrl = (name: string) =>
    `https://search.nixos.org/packages?channel=${channel === 'unstable' ? 'unstable' : channel}&query=${encodeURIComponent(name)}`;

  function add(name: string) {
    const clean = name.trim().replace(/,$/, '');
    if (!clean) return;
    if (!names.includes(clean)) value = [...names, clean].join(' ');
    query = '';
    highlighted = 0;
  }

  function remove(name: string) {
    value = names.filter((item) => item !== name).join(' ');
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      highlighted = (highlighted + 1) % suggestions.length;
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      highlighted = (highlighted - 1 + suggestions.length) % suggestions.length;
    } else if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault();
      const picked = event.key === 'Enter' && open && suggestions[highlighted];
      add(picked ? picked.name : query);
    } else if (event.key === 'Backspace' && !query && names.length) {
      remove(names[names.length - 1]);
    } else if (event.key === 'Escape') {
      open = false;
    }
  }

  const unresolved = $derived(names.filter((name) => stateOf(name) === 'missing' || stateOf(name) === 'invalid'));
  $effect(() => {
    const next = names.filter((name) => stateOf(name) === 'missing');
    if (next.join() !== missing.join()) missing = next;
  });
</script>

<div class="picker">
  <span class="picker-label">{label}</span>
  <div class="picker-box">
    {#each names as name (name)}
      {@const state = stateOf(name)}
      <span class="chip {state}">
        {#if state === 'missing'}
          <a href={searchUrl(name)} target="_blank" rel="noreferrer" title={t('No existe en') + ' ' + channel + '. ' + t('Buscar en search.nixos.org')}>{name}</a>
        {:else}
          {name}
        {/if}
        <button type="button" aria-label={t('Quitar') + ' ' + name} onclick={() => remove(name)}>{t('×')}</button>
      </span>
    {/each}
    <input
      bind:value={query}
      {onkeydown}
      onfocus={() => (open = true)}
      onblur={() => setTimeout(() => (open = false), 120)}
      oninput={() => { open = true; highlighted = 0; }}
      placeholder={names.length ? '' : t('Busca un paquete (p. ej. firefox)…')}
      autocomplete="off"
      role="combobox"
      aria-expanded={open && suggestions.length > 0}
      aria-label={label}
    />
  </div>

  {#if open && suggestions.length > 0}
    <ul class="suggestions" role="listbox">
      {#each suggestions as hit, i (hit.name)}
        <li role="option" aria-selected={i === highlighted} class:active={i === highlighted}>
          <button type="button" onmousedown={(event) => { event.preventDefault(); add(hit.name); }}>
            <strong>{hit.name}</strong>
            <small>{hit.version}</small>
            <span>{hit.description}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="picker-status">
    {#if status === 'loading'}
      {t('Cargando índice de paquetes de')} {channel}…
    {:else if status === 'missing'}
      {t('Índice de paquetes no disponible: no se puede comprobar que existan. Ejecuta')} <code>{t('bun run packages')}</code>.
    {:else if unresolved.length > 0}
      <span class="bad">{t('No encontrados en nixpkgs')} {channel}: {unresolved.join(', ')}.</span>
    {:else}
      ✓ {names.length} {names.length === 1 ? t('paquete verificado') : t('paquetes verificados')} {t('en nixpkgs')} {channel}.
    {/if}
  </p>
</div>

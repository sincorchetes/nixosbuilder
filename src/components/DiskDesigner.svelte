<script lang="ts">
  import { t } from '../lib/i18n';
  import {
    formatSize,
    fsLabels,
    layoutBytes,
    layoutFromLsblk,
    lsblkCommand,
    newPartition,
    parseLsblk,
    type LsblkDisk,
    type PartFs,
  } from '../lib/disk';
  import type { NixBuilderConfig } from '../lib/generator';

  let { config = $bindable() }: { config: NixBuilderConfig } = $props();

  let pasted = $state('');
  let copied = $state(false);
  const disks = $derived<LsblkDisk[]>(pasted.trim() ? parseLsblk(pasted) : []);
  const current = $derived(disks.find((disk) => disk.device === config.diskDevice));

  const colors: Record<string, string> = {
    vfat: 'var(--seg-esp)',
    ext4: 'var(--seg-linux)',
    xfs: 'var(--seg-linux)',
    btrfs: 'var(--seg-btrfs)',
    swap: 'var(--seg-swap)',
    none: 'var(--seg-none)',
  };

  const sizes = $derived(layoutBytes(config.partitions, config.diskBytes));
  const total = $derived(Math.max(sizes.reduce((sum, bytes) => sum + bytes, 0), 1));
  const segments = $derived(
    (() => {
      const raw = sizes.map((bytes) => Math.max(bytes / total, 0.07));
      const sum = raw.reduce((a, b) => a + b, 0);
      return raw.map((value) => (value / sum) * 100);
    })(),
  );

  function pickDisk(disk: LsblkDisk) {
    config.diskDevice = disk.device;
    config.diskBytes = disk.bytes;
    const kind = disk.device.startsWith('/dev/nvme') ? 'nvme' : disk.rotational === false ? 'ssd' : disk.rotational === true ? 'hdd' : config.diskKind;
    config.diskKind = kind;
    config.discard = kind !== 'hdd';
  }

  function keepExisting() {
    if (current) config.partitions = layoutFromLsblk(current);
  }

  function add(preset: Parameters<typeof newPartition>[0]) {
    const taken = config.partitions.map((part) => part.name);
    const part = newPartition(preset, taken);
    // Solo la última puede ser "100%": las anteriores pasan a un tamaño fijo.
    config.partitions = [
      ...config.partitions.map((item) => (!item.existing && item.size === '100%' ? { ...item, size: '50G' } : item)),
      part,
    ];
  }

  function remove(id: string) {
    config.partitions = config.partitions.filter((part) => part.id !== id);
  }

  function move(index: number, delta: number) {
    const next = [...config.partitions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    config.partitions = next;
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(lsblkCommand);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* sin portapapeles */
    }
  }

  const label = (part: NixBuilderConfig['partitions'][number]) =>
    [part.existing?.fstype && part.fs === 'none' ? part.existing.fstype : t(fsLabels[part.fs]), part.encrypt ? 'LUKS' : '', part.mountpoint]
      .filter(Boolean).join(' · ');
</script>

<div class="disk-designer">
  <div class="lsblk">
    <span class="picker-label">{t('1 · Lee tu disco (opcional)')}</span>
    <p class="field-note">
      {t('Ejecuta esto en tu máquina (o en el live ISO) y pega aquí el resultado para dibujar tus discos:')}
    </p>
    <div class="cmd">
      <code>{lsblkCommand}</code>
      <button type="button" class="ghost-button" onclick={copyCommand}>{copied ? 'Copiado' : 'Copiar'}</button>
    </div>
    <textarea
      rows="6"
      spellcheck="false"
      aria-label={t('Salida de lsblk')}
      wrap="off"
      placeholder={t('NAME        SIZE TYPE FSTYPE UUID MOUNTPOINTS ROTA\nnvme0n1    476.9G disk                         0\n├─nvme0n1p1  512M part vfat   ABCD-1234 /boot     0\n└─nvme0n1p2 476.4G part ext4   …')}
      bind:value={pasted}
    ></textarea>
    {#if pasted.trim() && disks.length === 0}
      <p class="diag warn">{t('No he reconocido ningún disco en el texto. Pega la salida completa de lsblk, con la cabecera.')}</p>
    {/if}
    {#if disks.length > 0}
      <div class="disk-choices" role="radiogroup" aria-label={t('Disco de destino')}>
        {#each disks as disk (disk.device)}
          <button type="button" class="disk-choice" class:active={config.diskDevice === disk.device} onclick={() => pickDisk(disk)}>
            <strong>{disk.device}</strong> · {formatSize(disk.bytes)}
            <span>{disk.partitions.length} {t('partición(es)')}</span>
          </button>
        {/each}
      </div>
    {/if}
    {#if current}
      <span class="picker-label">{t('Disco actual:')} {current.device}</span>
      <div class="bar" role="img" aria-label="Particiones actuales de {current.device}">
        {#each current.partitions as part (part.device)}
          {@const share = Math.max((part.bytes / Math.max(current.bytes, 1)) * 100, 7)}
          <div class="seg" style="flex: {share} 1 0; background: {colors[part.fstype === 'crypto_LUKS' ? 'ext4' : part.fstype] ?? colors.none}" title="{part.device} · {formatSize(part.bytes)}">
            <b>{part.device.slice(5)}</b>
            <span>{formatSize(part.bytes)} · {part.fstype || 'sin formato'}{part.mountpoint ? ' · ' + part.mountpoint : ''}</span>
          </div>
        {/each}
      </div>
      <div class="row-actions">
        <button type="button" class="ghost-button" onclick={keepExisting}>{t('Conservar estas particiones y añadir las nuevas')}</button>
      </div>
    {/if}
  </div>

  <label>{t('2 · Dispositivo de destino')}
    <input bind:value={config.diskDevice} placeholder={t('/dev/nvme0n1')} />
  </label>

  <span class="picker-label">Esquema resultante {config.diskBytes ? `· ${t('disco de')} ${formatSize(config.diskBytes)}` : ''}</span>
  <div class="bar" role="img" aria-label={t('Esquema de particiones')}>
    {#each config.partitions as part, i (part.id)}
      <div class="seg" class:existing={!!part.existing} style="flex: {segments[i]} 1 0; background: {colors[part.fs]}" title="{part.name} · {part.size}">
        <b>{part.name || '?'}</b>
        <span>{part.size === '100%' ? `${t('resto')} (${formatSize(sizes[i])})` : formatSize(sizes[i])}</span>
        <span>{label(part)}</span>
      </div>
    {:else}
      <div class="seg empty">{t('Sin particiones')}</div>
    {/each}
  </div>

  <div class="part-table">
    {#each config.partitions as part, i (part.id)}
      <div class="part-row" class:existing={!!part.existing}>
        <input class="p-name" bind:value={part.name} aria-label={t('Nombre de la partición') + ' ' + (i + 1)} placeholder={t('nombre')} />
        {#if part.existing}
          <span class="p-size" title={t('Partición existente: no se modifica')}>{part.size} · {t('existente')}</span>
        {:else}
          <input class="p-size" bind:value={part.size} aria-label={t('Tamaño de') + ' ' + part.name} placeholder={t('20G o 100%')} />
        {/if}
        <select class="p-fs" bind:value={part.fs} aria-label={t('Sistema de archivos de') + ' ' + part.name}>
          {#each Object.entries(fsLabels) as [value, text]}
            <option {value}>{t(text)}</option>
          {/each}
        </select>
        <input
          class="p-mount"
          bind:value={part.mountpoint}
          disabled={part.fs === 'swap' || part.fs === 'none'}
          aria-label={t('Punto de montaje de') + ' ' + part.name}
          placeholder={part.fs === 'swap' || part.fs === 'none' ? '—' : t('/ruta')}
        />
        <label class="check small p-crypt">
          <input type="checkbox" bind:checked={part.encrypt} disabled={part.fs === 'vfat'} /> {t('LUKS')}
        </label>
        <span class="p-buttons">
          <button type="button" class="icon-button" aria-label={t('Subir') + ' ' + part.name} disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
          <button type="button" class="icon-button" aria-label={t('Bajar') + ' ' + part.name} disabled={i === config.partitions.length - 1} onclick={() => move(i, 1)}>↓</button>
          <button type="button" class="icon-button" aria-label={t('Quitar') + ' ' + part.name} onclick={() => remove(part.id)}>{t('×')}</button>
        </span>
      </div>
    {/each}
  </div>

  <div class="presets" aria-label={t('Añadir partición')}>
    <button type="button" onclick={() => add('esp')}>{t('+ ESP /boot')}</button>
    <button type="button" onclick={() => add('swap')}>{t('+ swap')}</button>
    <button type="button" onclick={() => add('root')}>{t('+ raíz /')}</button>
    <button type="button" onclick={() => add('home')}>{t('+ /home')}</button>
    <button type="button" onclick={() => add('data')}>{t('+ datos')}</button>
  </div>
  <p class="field-note">
    {t('Tamaños:')} <code>{t('512M')}</code>, <code>{t('20G')}</code>, <code>{t('1T')}</code> {t('o')} <code>100%</code> {t('(el resto; solo la última). LUKS cifra la partición y pedirá contraseña al arrancar.')}
  </p>
</div>

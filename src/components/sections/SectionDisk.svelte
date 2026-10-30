<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';
  import DiskDesigner from '../DiskDesigner.svelte';
  import type { DiskKind } from '../../lib/generator';

  let { config = $bindable(), technical = false }: { config: NixBuilderConfig; technical?: boolean } = $props();

  function setDiskKind(kind: DiskKind) {
    config.diskKind = kind;
    config.discard = kind !== 'hdd';
  }
</script>

<fieldset>
  <legend>{t('Destino de instalación')}</legend>
  <label class="check"><input type="checkbox" bind:checked={config.customLayout} /> {t('Diseñar mi propio esquema de particiones')}</label>
  {#if config.customLayout}
    <DiskDesigner bind:config />
    {#if technical}
      <label class="check"><input type="checkbox" bind:checked={config.disko} /> {t('Aplicarlo con disko')}</label>
    {/if}
    <p class="field-note">
      {technical && config.disko
        ? t('Se genera disko.nix. disko recrea el disco entero: no sirve para conservar particiones ni para dual boot.')
        : t('Se generan partition.sh (particiona, formatea y monta en /mnt) y filesystems.nix (fileSystems, swap y LUKS). Puedes conservar particiones existentes.')}
      {#if !technical}{t('Para usar disko, cambia a la vista técnica.')}{/if}
    </p>
  {:else}
  {#if technical}
  <label class="check"><input type="checkbox" bind:checked={config.disko} /> {t('Particionar el disco con disko')}</label>
  {:else}
  <label>{t('hardware-configuration.nix')}
    <textarea rows="6" bind:value={config.hardwareConfiguration} placeholder={t('Pega aquí la salida de nixos-generate-config')}></textarea>
  </label>
  <p class="field-note">{t('Escoge una opción: marca el esquema personalizado o pega aquí tu hardware-configuration.nix.')}</p>
  {/if}
  {#if technical && config.disko}
    <label>{t('Dispositivo')}<input bind:value={config.diskDevice} placeholder={t('/dev/nvme0n1')} /></label>
    <label>{t('Esquema')}
      <select bind:value={config.diskScheme}>
        <option value="btrfs">{t('Btrfs (subvolúmenes)')}</option>
        <option value="ext4">{t('ext4')}</option>
        <option value="xfs">{t('XFS')}</option>
        <option value="lvm">{t('LVM')}</option>
        <option value="zfs">{t('ZFS')}</option>
      </select>
    </label>
    {#if config.diskScheme === 'lvm'}
      <label>{t('Sistema de archivos dentro de LVM')}
        <select bind:value={config.lvmFilesystem}>
          <option value="ext4">{t('ext4')}</option>
          <option value="xfs">{t('XFS')}</option>
          <option value="btrfs">{t('Btrfs')}</option>
        </select>
      </label>
    {/if}
    <label class="check">
      <input type="checkbox" bind:checked={config.encryption} />
      {t('Cifrar')} {config.diskScheme === 'zfs' ? t('(cifrado nativo de ZFS)') : '(LUKS)'}
    </label>
  {:else if technical}
    <p class="field-note">{t('Sin disko usarás las particiones que ya tengas (hardware-configuration.nix).')}</p>
  {/if}
  {/if}
  {#if config.customLayout || technical}
    <label>{t('Tipo de unidad')}
      <select value={config.diskKind} onchange={(event) => setDiskKind(event.currentTarget.value as DiskKind)}>
        <option value="hdd">{t('Disco duro (HDD)')}</option>
        <option value="ssd">{t('SSD')}</option>
        <option value="nvme">{t('NVMe')}</option>
      </select>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={config.discard} />
      {technical && config.disko ? 'TRIM / discard' : t('TRIM periódico (fstrim)')}
    </label>
  {/if}
</fieldset>
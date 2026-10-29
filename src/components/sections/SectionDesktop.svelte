<script lang="ts">
  import { t } from '../../lib/i18n';
  import { availableSessions, type NixBuilderConfig } from '../../lib/generator';

  let { config = $bindable() }: { config: NixBuilderConfig } = $props();

  const sessions = $derived(availableSessions(config.desktop));
</script>

<fieldset>
  <legend>{t('Entorno gráfico')}</legend>
  {#if config.profile === 'server'}
    <label class="check">
      <input
        type="checkbox"
        checked={config.desktop !== 'none'}
        onchange={(event) => (config.desktop = event.currentTarget.checked ? 'gnome' : 'none')}
      />
      {t('Incluir entorno gráfico')}
    </label>
  {/if}
  {#if config.profile !== 'server' || config.desktop !== 'none'}
    <label>{t('Entorno')}
      <select bind:value={config.desktop}>
        <option value="none">{t('Ninguno (sin entorno gráfico)')}</option>
        <option value="gnome">{t('GNOME')}</option>
        <option value="cosmic">{t('COSMIC')}</option>
        <option value="lxqt">{t('LXQt')}</option>
        <option value="enlightenment" disabled>{t('Enlightenment (roto en nixpkgs)')}</option>
        <option value="kde">{t('KDE Plasma')}</option>
        <option value="cinnamon">{t('Cinnamon')}</option>
        <option value="xfce">{t('XFCE')}</option>
        <option value="hyprland">{t('Hyprland')}</option>
      </select>
    </label>
    {#if sessions.length > 1}
      <div class="radio-row" role="radiogroup" aria-label={t('Sesión gráfica')}>
        <label class="check"><input type="radio" bind:group={config.session} value="wayland" /> {t('Wayland por defecto')}</label>
        <label class="check"><input type="radio" bind:group={config.session} value="x11" /> {t('X11 (Xorg)')}</label>
      </div>
    {:else if sessions.length === 1}
      <p class="field-note">{t('Sesión:')} {sessions[0] === 'wayland' ? t('solo Wayland (sin X)') : t('solo X11')}.</p>
    {/if}
  {/if}
</fieldset>
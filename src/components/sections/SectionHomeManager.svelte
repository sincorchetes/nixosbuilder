<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { NixBuilderConfig } from '../../lib/generator';
  import PackagePicker from '../PackagePicker.svelte';
  import { siteBase } from '../../lib/base';
  import { hmOptionsSearchUrl } from '../../lib/catalog';
  import type { HomeManagerState } from '../../lib/homeManager.svelte';

  let { config = $bindable(), missing = $bindable(), hm }: { config: NixBuilderConfig; missing: string[]; hm: HomeManagerState } = $props();
</script>

<fieldset>
  <legend>{t('Home Manager')}</legend>
  <label class="check"><input type="checkbox" bind:checked={config.homeManager} /> {t('Usar Home Manager')}</label>
  {#if config.homeManager}
      <PackagePicker bind:value={config.hmPackages} bind:missing={missing} channel={config.channel} base={siteBase} label={t('Paquetes del usuario')} />

      <div class="modules">
        <span class="picker-label">{t('Módulos')}</span>
        <input type="search" bind:value={hm.moduleFilter} placeholder={t('Buscar módulos de Home Manager (zsh, git, syncthing, firefox…)')} aria-label={t('Buscar módulos')} />
        {#each hm.categories as category}
          {@const items = hm.filteredModules.filter((module) => module.category === category)}
          {#if items.length > 0}
            <div class="module-group">
              <strong>{t(category)}</strong>
              <div class="module-list">
                {#each items as module (module.id)}
                  <label class="check small">
                    <input
                      type="checkbox"
                      checked={config.hmModules.includes(module.id)}
                      onchange={(event) => hm.toggleModule(module.id, event.currentTarget.checked)}
                    />
                    {t(module.label)}
                  </label>
                {/each}
              </div>
            </div>
          {/if}
        {/each}

        {#if hm.moduleFilter.trim().length >= 2}
          <div class="module-results" aria-label={t('Resultados de Home Manager')}>
            <strong>{hm.index ? t('En todo Home Manager') : t('Índice de Home Manager no disponible')}</strong>
            {#each hm.hits as hit (hit.id)}
              <div class="module-hit">
                <div>
                  <code>{hit.id}</code>
                  <small>{hit.description}</small>
                </div>
                {#if config.hmModules.includes(hit.id)}
                  <button type="button" class="ghost-button" onclick={() => hm.toggleModule(hit.id, false)}>{t('Quitar')}</button>
                {:else}
                  <button type="button" class="ghost-button" onclick={() => hm.toggleModule(hit.id, true)}>{t('Añadir')}</button>
                {/if}
              </div>
            {:else}
              {#if hm.index}<p class="field-note">{t('Sin más resultados fuera de los sugeridos.')}</p>{/if}
            {/each}
          </div>
        {/if}
        {#each hm.customModules as id}
          <div class="custom-chip">
            <code>{id}.enable</code>
            <a href={hmOptionsSearchUrl(id)} target="_blank" rel="noreferrer">{t('comprobar')}</a>
            <button type="button" class="icon-button" aria-label={t('Quitar') + ' ' + id} onclick={() => hm.toggleModule(id, false)}>{t('×')}</button>
          </div>
        {/each}
        {#if hm.moduleList.length > 0}
          <div class="module-files">
            <span class="picker-label">{t('Archivos de módulo (se generan en home/)')}</span>
            {#each hm.moduleList as file (file.id)}
              {@const report = hm.reports[file.id]}
              {@const code = config.hmModuleCode[file.id] ?? ''}
              <details class="module-file">
                <summary>
                  <code>{file.path}</code>
                  <span class="status" class:bad={!!report.syntaxError} class:warn={!report.syntaxError && report.unknown.length > 0}>
                    {#if report.syntaxError}{t('error de sintaxis')}
                    {:else if report.unknown.length}{report.unknown.length} {t('desconocida(s)')}
                    {:else if code.trim()}✓ {report.options.length} {t('opciones válidas')}
                    {:else}{t('vacío')}{/if}
                  </span>
                </summary>
                <textarea
                  rows="8"
                  spellcheck="false"
                  aria-label={t('Código de') + ' ' + file.path}
                  placeholder={t('Pega aquí tu configuración de') + ' ' + file.id + '.\n' + t('Ejemplo:') + '  programs.zsh.enableCompletion = true;\n' + t('O un módulo completo:') + ' { pkgs, ... }: { ... }'}
                  value={code}
                  oninput={(event) => (config.hmModuleCode[file.id] = event.currentTarget.value)}
                ></textarea>
                {#if report.syntaxError}
                  <p class="diag bad">{t(report.syntaxError)}</p>
                {/if}
                {#each report.unknown as item}
                  <p class="diag warn">
                    {t('Línea')} {item.line}: <code>{item.path}</code> {t('no existe en Home Manager')} {config.channel}.
                    {#if item.suggestions.length}{t('¿Quisiste decir')} {#each item.suggestions as suggestion, n}{n ? ', ' : ''}<code>{suggestion}</code>{/each}?{/if}
                    <a href={hmOptionsSearchUrl(item.path)} target="_blank" rel="noreferrer">{t('buscar')}</a>
                  </p>
                {/each}
                {#if report.partial}
                  <p class="field-note">{t('Validación parcial: hay construcciones (let, with, mkIf…) que no se comprueban.')}</p>
                {/if}
              </details>
            {/each}
          </div>
        {/if}
        <p class="field-note">
          {t('Catálogo basado en el')}
          <a href="https://nix-community.github.io/home-manager/options.xhtml" target="_blank" rel="noreferrer">{t('Appendix A')}</a>
          {t('de Home Manager.')}
        </p>
      </div>
  {/if}
</fieldset>
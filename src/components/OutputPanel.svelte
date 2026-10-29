<script lang="ts">
  import RichText from './RichText.svelte';
  import { t } from '../lib/i18n';
  import { passwordReminder, type GeneratedFile, type NextStep, type NixBuilderConfig } from '../lib/generator';
  import { downloadZip } from '../lib/download';

  let { config, errors, warnings, files, steps }: {
    config: NixBuilderConfig;
    errors: string[];
    warnings: string[];
    files: GeneratedFile[];
    steps: NextStep[];
  } = $props();

  let activePath = $state('configuration.nix');
  let copied = $state(false);
  const activeFile = $derived(files.find((file) => file.path === activePath) ?? files[0]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      copied = false;
    }
  }
</script>

  <div class="password-note" role="note">
    <strong>{t('🔑 Contraseñas')}</strong>
    <p><RichText text={passwordReminder(config)} /></p>
  </div>

  {#if errors.length > 0}
    <ul class="messages errors" role="alert">
      {#each errors as error}<li><RichText text={error} /></li>{/each}
    </ul>
  {:else}
    {#if warnings.length > 0}
      <ul class="messages warnings">
        {#each warnings as warning}<li><RichText text={warning} /></li>{/each}
      </ul>
    {/if}

    <div class="tabs" role="tablist">
      {#each files as file}
        <button
          type="button"
          role="tab"
          aria-selected={file.path === activeFile?.path}
          class:active={file.path === activeFile?.path}
          onclick={() => (activePath = file.path)}
        >{file.path}</button>
      {/each}
    </div>
    <pre class="code"><code>{activeFile?.content}</code></pre>

    <div class="actions">
      <button type="button" class="primary-button" onclick={() => downloadZip(files, config.hostname)}>{t('Descargar .zip ↓')}</button>
      <button type="button" class="secondary-button" onclick={() => activeFile && copy(activeFile.content)}>{copied ? t('Copiado ✓') : t('Copiar archivo')}</button>
    </div>

    <ol class="steps">
      {#each steps as step}
        <li>
          <RichText text={step.text} />
          {#if step.command}<code>{step.command}</code>{/if}
        </li>
      {/each}
    </ol>
  {/if}

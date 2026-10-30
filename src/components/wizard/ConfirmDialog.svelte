<script lang="ts">
  import { t } from '../../lib/i18n';

  let { open = $bindable(false), message, onConfirm }: { open: boolean; message: string; onConfirm: () => void } = $props();

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} class="sw-dialog confirm-dialog" onclose={() => (open = false)} aria-labelledby="confirm-message">
  <div class="sw-card">
    <p id="confirm-message">{message}</p>
    <footer>
      <button type="button" class="secondary-button" onclick={() => (open = false)}>{t('Cancelar')}</button>
      <button
        type="button"
        class="primary-button"
        onclick={() => {
          open = false;
          onConfirm();
        }}
      >{t('Continuar')}</button>
    </footer>
  </div>
</dialog>

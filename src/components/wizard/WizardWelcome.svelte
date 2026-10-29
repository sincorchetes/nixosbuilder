<script lang="ts">
  import { t } from '../../lib/i18n';

  let { onTechnical }: { onTechnical: () => void } = $props();
</script>

<div class="welcome">
  <p>{t('Vamos a crear tu configuración de NixOS paso a paso. Responde a cada pantalla y al final descargarás los archivos listos para usar.')}</p>
  <ul>
    <li>{t('Todo ocurre en tu navegador: no se envía nada a ningún servidor.')}</li>
    <li>{t('Puedes volver a cualquier paso desde el menú lateral.')}</li>
    <li>{t('Los valores por defecto sirven para un equipo de escritorio típico.')}</li>
  </ul>
  <p class="field-note">
    {t('¿Prefieres un formulario con todas las opciones a la vez? Usa la')}
    <button type="button" class="link-button" onclick={onTechnical}>{t('vista técnica')}</button>.
  </p>
</div>

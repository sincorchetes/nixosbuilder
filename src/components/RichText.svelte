<script lang="ts">
  import { t } from '../lib/i18n';
  import { richParts } from '../lib/richText';

  let { text }: { text: string } = $props();
</script>

{#each richParts(t(text)) as part}{#if part.code}<code class="inline">{part.text}</code>{:else}{part.text}{/if}{/each}

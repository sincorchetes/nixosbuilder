<script lang="ts">
  import ModeTabs, { type View } from './ModeTabs.svelte';
  import SectionView, { type SectionContext } from './sections/SectionView.svelte';
  import { t } from '../lib/i18n';
  import type { NixBuilderConfig } from '../lib/generator';
  import type { Snippet } from 'svelte';

  let { config = $bindable(), ctx, onView, output }: {
    config: NixBuilderConfig;
    ctx: SectionContext;
    onView: (view: View) => void;
    output: Snippet;
  } = $props();

  const groups = [
    { title: 'Localización', sections: ['language', 'keyboard', 'time'] },
    { title: 'Software', sections: ['software', 'desktop', 'basePackages', 'homeManager'] },
    { title: 'Sistema', sections: ['hardware', 'disk', 'boot', 'network'] },
    { title: 'Usuario', sections: ['user'] },
    { title: 'Nix', sections: ['nix'] },
  ];
</script>

<div class="builder">
  <div class="builder-left">
    <ModeTabs view="technical" onChange={onView} />
    <form class="builder-form" onsubmit={(event) => event.preventDefault()}>
      {#each groups as group (group.title)}
        <h3 class="form-group">{t(group.title)}</h3>
        {#each group.sections as id (id)}
          <SectionView {id} bind:config {ctx} technical />
        {/each}
      {/each}
    </form>
  </div>
  <div class="builder-output">
    {@render output()}
  </div>
</div>

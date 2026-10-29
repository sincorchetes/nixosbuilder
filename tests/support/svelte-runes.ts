// Permite probar módulos `.svelte.ts` (runas $state/$derived/$effect) con `bun test`:
// los compila con el compilador de Svelte en modo cliente, igual que hace Vite en el navegador.
import { plugin } from 'bun';
import { compileModule } from 'svelte/compiler';

plugin({
  name: 'svelte-runes',
  setup(build) {
    build.onLoad({ filter: /\.svelte(\.test)?\.ts$/ }, async ({ path }) => {
      const typescript = await Bun.file(path).text();
      const javascript = new Bun.Transpiler({ loader: 'ts' }).transformSync(typescript);
      const { js } = compileModule(javascript, { filename: path, generate: 'client' });
      return { contents: js.code, loader: 'js' };
    });
  },
});

// Estado reactivo de Home Manager: índice de opciones, módulos elegidos y su análisis.
import { hmModuleIds, hmModules } from './catalog';
import { moduleFiles, type NixBuilderConfig, normalizedModules } from './generator';
import { analyzeModuleCode, type HmOptionIndex, loadHmIndex, searchModuleHits } from './hmvalidate';

export class HomeManagerState {
  moduleFilter = $state('');
  index = $state<HmOptionIndex | null>(null);

  readonly categories = [...new Set(hmModules.map((module) => module.category))];

  #getConfig: () => NixBuilderConfig;

  get #config() {
    return this.#getConfig();
  }

  filteredModules = $derived(
    hmModules.filter((module) => `${module.id} ${module.label}`.toLowerCase().includes(this.moduleFilter.trim().toLowerCase())),
  );
  customModules = $derived(normalizedModules(this.#config).filter((id) => !hmModuleIds.has(id)));
  moduleList = $derived(this.#config.homeManager ? moduleFiles(this.#config) : []);
  reports = $derived(
    Object.fromEntries(
      this.moduleList.map((file) => [file.id, analyzeModuleCode(this.#config.hmModuleCode[file.id] ?? '', file.id, this.index)]),
    ),
  );
  diagnostics = $derived(this.moduleList.map((file) => ({ file, report: this.reports[file.id] })));
  hits = $derived(this.index ? searchModuleHits(this.index, this.moduleFilter).filter((hit) => !hmModuleIds.has(hit.id)) : []);
  unknownModules = $derived(
    this.index ? this.moduleList.filter((file) => !this.index!.set.has(`${file.id}.enable`)).map((file) => file.id) : [],
  );

  constructor(config: () => NixBuilderConfig, base: string) {
    this.#getConfig = config;
    // Se recarga al cambiar de canal; la respuesta tardía de un canal anterior se descarta.
    $effect(() => {
      const channel = config().channel;
      this.index = null;
      void loadHmIndex(channel, base).then((loaded) => {
        if (channel === config().channel) this.index = loaded;
      });
    });
  }

  toggleModule(id: string, checked: boolean) {
    const config = this.#config;
    config.hmModules = checked ? [...new Set([...config.hmModules, id])] : config.hmModules.filter((item) => item !== id);
  }
}

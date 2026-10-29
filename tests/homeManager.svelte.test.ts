import { afterEach, describe, expect, mock, test } from 'bun:test';
import { resetHmIndexCache } from '../src/lib/hmvalidate';
import { HomeManagerState } from '../src/lib/homeManager.svelte';
import { makeConfig } from './helpers';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  resetHmIndexCache();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const respond = (names: string[]) => {
  globalThis.fetch = mock(async () => ({
    ok: true,
    json: async () => ({ names, descriptions: names.map(() => 'Whether to enable it.') }),
  })) as never;
};

describe('HomeManagerState', () => {
  test('loads the channel index, lists modules and filters', async () => {
    respond(['programs.zsh.enable', 'programs.zsh.enableCompletion', 'programs.urxvt.enable']);
    const config = makeConfig({ homeManager: true, hmModules: ['programs.zsh', 'programs.custom'], channel: '25.11' });
    let state!: HomeManagerState;
    const cleanup = $effect.root(() => {
      state = new HomeManagerState(() => config, '/');
    });
    await settle();

    expect(state.index?.set.has('programs.zsh.enable')).toBe(true);
    expect(state.categories).toContain('Shell');
    expect(state.moduleList.map((file) => file.id)).toEqual(['programs.zsh', 'programs.custom']);
    expect(state.customModules).toEqual(['programs.custom']);
    expect(state.unknownModules).toEqual(['programs.custom']);
    expect(state.diagnostics).toHaveLength(2);
    expect(state.reports['programs.zsh'].syntaxError).toBeUndefined();

    state.moduleFilter = 'urxvt';
    expect(state.filteredModules.every((module) => /urxvt/i.test(module.id + module.label))).toBe(true);
    expect(state.hits.map((hit) => hit.id)).toEqual(['programs.urxvt']);
    cleanup();
  });

  test('toggleModule adds without duplicating and removes', async () => {
    respond([]);
    const config = makeConfig({ homeManager: true, hmModules: ['programs.git'], channel: '26.05' });
    let state!: HomeManagerState;
    const cleanup = $effect.root(() => {
      state = new HomeManagerState(() => config, '/');
    });
    state.toggleModule('programs.zsh', true);
    state.toggleModule('programs.zsh', true);
    expect(config.hmModules).toEqual(['programs.git', 'programs.zsh']);
    state.toggleModule('programs.git', false);
    expect(config.hmModules).toEqual(['programs.zsh']);
    cleanup();
  });

  test('without Home Manager there are no modules to analyze', async () => {
    respond([]);
    const config = makeConfig({ homeManager: false, hmModules: ['programs.zsh'], channel: 'unstable' });
    let state!: HomeManagerState;
    const cleanup = $effect.root(() => {
      state = new HomeManagerState(() => config, '/');
    });
    await settle();
    expect(state.moduleList).toEqual([]);
    expect(state.unknownModules).toEqual([]);
    expect(state.hits).toEqual([]);
    cleanup();
  });
});

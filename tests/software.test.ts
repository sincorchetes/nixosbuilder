import { describe, expect, test } from 'bun:test';
import { firewallPresets, hmModuleIds, hmModules } from '../src/lib/catalog';
import { parsePort } from '../src/lib/generator';
import { keyboardById, keyboards, languages, localePattern } from '../src/lib/locale';
import {
  allItems,
  brokenDesktops,
  catalogs,
  isItemAvailable,
  isVersionAvailable,
  itemsFor,
  type Profile,
  profileDefaults,
  profiles,
  profileTitle,
  resolveSoftware,
} from '../src/lib/software';

const profileIds = profiles.map((profile) => profile.id);

describe('software catalogs', () => {
  test('profiles have defaults, and those with a catalog have button and dialog texts', () => {
    for (const id of profileIds) expect(profileDefaults[id]).toBeDefined();
    for (const id of Object.keys(catalogs)) expect(profileTitle[id as Profile]).toBeDefined();
  });

  test('unique ids within each catalog', () => {
    for (const [profile, items] of Object.entries(catalogs)) {
      const ids = items!.map((item) => item.id);
      expect(new Set(ids).size, profile).toBe(ids.length);
    }
  });

  test('every item contributes packages or configuration and has texts', () => {
    for (const item of allItems.values()) {
      expect(item.label, item.id).toBeTruthy();
      expect(item.description, item.id).toBeTruthy();
      expect(item.category, item.id).toBeTruthy();
      const contributes = (item.packages?.length ?? 0) + (item.nixos?.length ?? 0) + (item.versions?.length ?? 0);
      expect(contributes, item.id).toBeGreaterThan(0);
    }
  });

  test('items with versions define a package per version', () => {
    for (const item of allItems.values()) {
      for (const version of item.versions ?? []) {
        expect(version.value && version.label && version.package, item.id).toBeTruthy();
      }
    }
  });

  test('service ports are valid', () => {
    for (const item of allItems.values()) for (const port of item.ports ?? []) expect(parsePort(port.port), item.id).not.toBeNull();
  });

  test("each profile's preselected items exist in its catalog", () => {
    for (const id of profileIds) {
      const ids = new Set(itemsFor(id).map((item) => item.id));
      for (const selected of profileDefaults[id].selected) expect(ids.has(selected), `${id}:${selected}`).toBe(true);
    }
  });

  test('devenv is in the Developer profile', () => {
    const devenv = itemsFor('developer').find((item) => item.id === 'devenv');
    expect(devenv?.packages).toContain('devenv');
  });

  test('the Server profile has no desktop and opens SSH; Gamer brings Steam and KDE', () => {
    expect(profileDefaults.server).toMatchObject({ desktop: 'none', openSsh: true });
    expect(profileDefaults.gamer.selected).toContain('steam');
    expect(profileDefaults.gamer.desktop).toBe('kde');
  });
});

describe('resolveSoftware', () => {
  test('separates applications (profile-apps.nix) from system configuration', () => {
    const resolved = resolveSoftware('gamer', ['steam', 'lutris'], {});
    expect(resolved.nixos.join('\n')).toMatch(/steam/);
    expect(resolved.apps.flatMap((group) => group.packages)).toContain('lutris');
    expect(resolved.unfree).toBe(true);
  });
  test('services open their ports and add groups', () => {
    const resolved = resolveSoftware('server', ['nginx', 'docker'], {});
    expect(resolved.ports.some((port) => port.port === '80')).toBe(true);
    expect(resolved.groups).toContain('docker');
  });
  test('the chosen version replaces {{package}}', () => {
    const resolved = resolveSoftware('server', ['postgresql'], { postgresql: '16' });
    expect(resolved.nixos.join('\n')).toContain('postgresql_16');
    expect(resolved.nixos.join('\n')).not.toContain('{{package}}');
  });
  test('with no selection there is nothing', () => {
    const resolved = resolveSoftware('developer', [], {});
    expect(resolved.apps).toEqual([]);
    expect(resolved.nixos).toEqual([]);
  });
  test('unknown ids are ignored', () => {
    expect(() => resolveSoftware('server', ['no-existe'], {})).not.toThrow();
  });
});

describe('availability per channel', () => {
  test('an unavailable item is detected through its packages', () => {
    const docker = allItems.get('docker')!;
    expect(isItemAvailable(docker, new Set())).toBe(true);
    expect(isItemAvailable(docker, new Set(['docker']))).toBe(false);
  });
  test('an unavailable version is detected through its package', () => {
    const version = allItems.get('postgresql')!.versions![0];
    expect(isVersionAvailable(version, new Set([version.package]))).toBe(false);
  });
  test('Enlightenment is listed as broken', () => expect(brokenDesktops.enlightenment).toBeTruthy());
});

describe('Home Manager modules and firewall', () => {
  test('module ids are unique and shaped programs.* or services.*', () => {
    expect(hmModuleIds.size).toBe(hmModules.length);
    for (const module of hmModules) expect(module.id).toMatch(/^(programs|services)\.[a-z0-9-]+$/);
  });
  test('firewall presets are valid ports', () => {
    for (const preset of firewallPresets) expect(parsePort(preset.port), preset.label).not.toBeNull();
  });
});

describe('languages and keyboards', () => {
  test('every language matches the pattern and none repeat', () => {
    for (const language of languages) expect(language.locale).toMatch(localePattern);
    expect(new Set(languages.map((language) => language.locale)).size).toBe(languages.length);
  });
  test('keyboards have a unique id, an xkb layout and a console map', () => {
    expect(new Set(keyboards.map((keyboard) => keyboard.id)).size).toBe(keyboards.length);
    for (const keyboard of keyboards) {
      expect(keyboard.layout, keyboard.id).toBeTruthy();
      expect(keyboard.console, keyboard.id).toBeTruthy();
    }
  });
  test('keyboardById', () => {
    expect(keyboardById('es')?.layout).toBe('es');
    expect(keyboardById('no-existe')).toBeUndefined();
  });
});

describe('resolveSoftware with several items of the same category', () => {
  test('groups the packages without repeating them', () => {
    const editors = itemsFor('developer').filter(
      (item) => item.category === 'Editores e IDEs' && item.packages?.length && !item.nixos?.length,
    );
    expect(editors.length).toBeGreaterThan(1);
    const resolved = resolveSoftware('developer', [editors[0].id, editors[1].id, editors[0].id], {});
    const group = resolved.apps.find((candidate) => candidate.category === 'Editores e IDEs')!;
    expect(new Set(group.packages).size).toBe(group.packages.length);
    expect(group.packages).toEqual(expect.arrayContaining([...editors[0].packages!, ...editors[1].packages!]));
  });
});

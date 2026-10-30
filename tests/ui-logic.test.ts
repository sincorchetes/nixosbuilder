import { describe, expect, test } from 'bun:test';
import { analyzeModuleCode, buildHmIndex } from '../src/lib/hmvalidate';
import { setLang } from '../src/lib/i18n';
import { hasPackage, type PackageIndex, searchIndex } from '../src/lib/packages';
import { buildErrors, buildWarnings, type ProblemContext } from '../src/lib/problems';
import { richParts } from '../src/lib/richText';
import { buildSummaries } from '../src/lib/summaries';
import { hub, icons, issuesByStep, pendingSteps, wizardSteps } from '../src/lib/wizardSteps';
import { makeConfig } from './helpers';

const emptyContext: ProblemContext = {
  unavailableChosen: [],
  missingSystem: [],
  missingHm: [],
  unknownModules: [],
  modules: [],
  hmIndexLoaded: true,
};

describe('richParts', () => {
  test('highlights commands between backticks', () => {
    expect(richParts('Usa `passwd root` ya')).toEqual([
      { text: 'Usa ', code: false },
      { text: 'passwd root', code: true },
      { text: ' ya', code: false },
    ]);
  });
  test('highlights files, device paths and nixos-* tools', () => {
    const code = richParts('Edita configuration.nix en /dev/sda con nixos-install')
      .filter((part) => part.code)
      .map((part) => part.text);
    expect(code).toEqual(['configuration.nix', '/dev/sda', 'nixos-install']);
  });
  test('text without code stays intact', () => {
    expect(richParts('Hola mundo')).toEqual([{ text: 'Hola mundo', code: false }]);
    expect(richParts('')).toEqual([]);
  });
  test('rebuilds the original text (without the backticks)', () => {
    const text = 'Ejecuta `sudo bash ./partition.sh` y luego /dev/nvme0n1.';
    expect(
      richParts(text)
        .map((part) => part.text)
        .join(''),
    ).toBe(text.replaceAll('`', ''));
  });
});

describe('wizard steps', () => {
  test('welcome first, summary last, unique ids, each with an icon', () => {
    expect(wizardSteps[0].id).toBe('welcome');
    expect(wizardSteps.at(-1)!.id).toBe('summary');
    expect(new Set(wizardSteps.map((step) => step.id)).size).toBe(wizardSteps.length);
    for (const step of wizardSteps) expect(icons[step.icon], step.id).toBeTruthy();
  });
  test('the wizard covers every hub section, in order', () => {
    const sections = hub.flatMap((group) => group.spokes.map((spoke) => spoke.id));
    expect(wizardSteps.slice(1, -1).map((step) => step.id)).toEqual(sections);
  });
  test('each error is assigned to the step that causes it', () => {
    const issues = issuesByStep([
      'El nombre del equipo solo puede contener letras, números y guiones.',
      'La zona horaria no es válida (p. ej. Europe/Madrid).',
      'El disco debe ser una ruta de dispositivo válida, como /dev/sda o /dev/nvme0n1.',
      'Secure Boot con lanzaboote requiere activar flakes.',
    ]);
    expect(issues.network).toMatch(/equipo/);
    expect(issues.time).toMatch(/zona horaria/);
    expect(issues.disk).toMatch(/disco/);
    expect(issues.boot).toMatch(/Secure Boot/);
    expect(issues.language).toBeUndefined();
  });
  test('partition layout errors are assigned to the disk step', () => {
    for (const error of [
      'Falta una partición montada en / (raíz).',
      'Falta definir el destino de instalación: diseña un esquema de particiones del disco o pega tu hardware-configuration.nix.',
      'Punto de montaje repetido: /.',
    ])
      expect(issuesByStep([error]).disk, error).toBe(error);
  });
  test('the summary stays locked while steps are unvisited or have errors', () => {
    const none = Object.fromEntries(wizardSteps.map((step) => [step.id, undefined]));
    const all = wizardSteps.map(() => true);
    expect(pendingSteps(all, 3, none)).toEqual([]);
    expect(pendingSteps([true], 0, none).length).toBe(wizardSteps.length - 2);
    expect(pendingSteps([true], 1, none).map((step) => step.id)).not.toContain(wizardSteps[1].id);
    expect(pendingSteps(all, 3, { ...none, disk: 'x' }).map((step) => step.id)).toEqual(['disk']);
  });
  test('with no errors there are no issues', () => {
    expect(Object.values(issuesByStep([])).every((issue) => issue === undefined)).toBe(true);
  });
});

describe('summaries', () => {
  const summaries = (patch = {}) => buildSummaries(makeConfig(patch), 'Usuario final', ['wayland']);

  test('one summary per wizard section', () => {
    const result = summaries();
    for (const step of wizardSteps.slice(1, -1)) expect(result[step.id], step.id).toBeTruthy();
  });
  test('language and keyboard say how many extras there are', () => {
    const result = summaries({ extraLocales: ['en_US.UTF-8', 'fr_FR.UTF-8'], extraKeyboards: ['us'] });
    expect(result.language).toMatch(/\+2$/);
    expect(result.keyboard).toMatch(/\+1$/);
  });
  test('disk: preset, custom layout and no disko', () => {
    expect(summaries({ disko: true, diskScheme: 'zfs', encryption: true }).disk).toBe('ZFS cifrado en /dev/sda');
    expect(summaries({ customLayout: true }).disk).toMatch(/^Esquema propio · 2 partición\(es\) en \/dev\/sda · script$/);
    expect(summaries({}).disk).toBe('Particiones existentes (sin disko)');
    expect(summaries({ hardwareConfiguration: '' }).disk).toBe('Sin definir');
  });
  test('boot reflects Secure Boot and multiboot', () => {
    expect(summaries({ secureBoot: true, multiboot: true }).boot).toBe('UEFI · Secure Boot (lanzaboote) · multiboot');
  });
  test('network reflects the firewall state', () => {
    expect(summaries().network).toContain('firewall activo');
    expect(
      summaries({ firewall: { enable: false, rules: [], allowPing: true, rejectPackets: false, logRefused: true } }).network,
    ).toContain('firewall desactivado');
  });
  test('in English the fixed texts come out translated', () => {
    const config = makeConfig();
    setLang('en');
    try {
      expect(buildSummaries(config, 'Usuario final', ['wayland']).network).toContain('firewall on');
    } finally {
      setLang('es');
    }
  });
});

describe('combined errors and warnings', () => {
  test('with no problems there are no messages', () => {
    expect(buildErrors(makeConfig(), emptyContext)).toEqual([]);
  });
  test('nonexistent packages and unavailable software', () => {
    const errors = buildErrors(makeConfig({ homeManager: true }), {
      ...emptyContext,
      unavailableChosen: ['Docker'],
      missingSystem: ['foo'],
      missingHm: ['bar'],
    }).join('\n');
    expect(errors).toMatch(/No disponible en nixpkgs 26\.05.*Docker/);
    expect(errors).toMatch(/Paquetes del sistema que no existen.*foo/);
    expect(errors).toMatch(/Paquetes de Home Manager que no existen.*bar/);
  });
  test('Home Manager packages only count if Home Manager is enabled', () => {
    expect(buildErrors(makeConfig({ homeManager: false }), { ...emptyContext, missingHm: ['bar'] })).toEqual([]);
  });
  test('Enlightenment blocks generation', () => {
    expect(buildErrors(makeConfig({ desktop: 'enlightenment' }), emptyContext).join()).toMatch(/enlightenment no está disponible/);
  });
  test('a syntax error in a module is an error; unknown options are warnings', () => {
    const index = buildHmIndex({ names: ['programs.zsh.enable'], descriptions: [''] });
    const file = { id: 'programs.zsh', path: 'home/zsh.nix' };
    const broken = { file, report: analyzeModuleCode('programs.zsh.enable = true', file.id, index) };
    const unknown = { file, report: analyzeModuleCode('programs.zsh.nada = true;', file.id, index) };
    const config = makeConfig({ homeManager: true });
    expect(buildErrors(config, { ...emptyContext, modules: [broken] }).join()).toMatch(/home\/zsh\.nix: Línea/);
    expect(buildErrors(config, { ...emptyContext, modules: [unknown] })).toEqual([]);
    expect(buildWarnings(config, { ...emptyContext, modules: [unknown] }).join()).toMatch(/1 opción\(es\) no encontradas/);
  });
  test('warns if there is no Home Manager index and there are modules', () => {
    const file = { id: 'programs.zsh', path: 'home/zsh.nix' };
    const warnings = buildWarnings(makeConfig({ homeManager: true }), {
      ...emptyContext,
      hmIndexLoaded: false,
      modules: [{ file, report: analyzeModuleCode('', file.id, null) }],
    });
    expect(warnings.join()).toMatch(/Índice de Home Manager no disponible/);
  });
});

describe('package index', () => {
  const names = ['firefox', 'firefox-esr', 'git', 'gimp'];
  const index: PackageIndex = {
    names,
    versions: ['1', '2', '3', '4'],
    descriptions: ['Web browser', 'ESR browser', 'Version control', 'Image editor'],
    unfree: new Set([2]),
    extra: new Set(['nodejs']),
    lookup: new Map(names.map((name, i) => [name, i])),
  };
  test('hasPackage knows the cataloged ones and the extra attributes', () => {
    expect(hasPackage(index, 'git')).toBe(true);
    expect(hasPackage(index, 'nodejs')).toBe(true);
    expect(hasPackage(index, 'nope')).toBe(false);
  });
  test('searchIndex prioritizes prefixes and searches descriptions', () => {
    expect(searchIndex(index, 'fire').map((hit) => hit.name)).toEqual(['firefox', 'firefox-esr']);
    expect(searchIndex(index, 'editor').map((hit) => hit.name)).toEqual(['gimp']);
    expect(searchIndex(index, '   ')).toEqual([]);
  });
  test('searchIndex flags unfree packages and respects the limit', () => {
    expect(searchIndex(index, 'git')[0].unfree).toBe(true);
    expect(searchIndex(index, 'i', 2)).toHaveLength(2);
  });
});

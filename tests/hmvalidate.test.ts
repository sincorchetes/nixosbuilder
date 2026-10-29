import { describe, expect, test } from 'bun:test';
import { analyzeModuleCode, buildHmIndex, isFullModule, searchModuleHits, searchModules } from '../src/lib/hmvalidate';

const index = buildHmIndex({
  names: [
    'programs.zsh.enable',
    'programs.zsh.enableCompletion',
    'programs.zsh.shellAliases',
    'programs.zsh.oh-my-zsh.enable',
    'programs.git.enable',
    'programs.git.userName',
    'programs.git.extraConfig',
    'programs.ssh.enable',
    'programs.ssh.matchBlocks.<name>.hostname',
    'services.syncthing.enable',
    'services.syncthing.tray.enable',
    'programs.terminator.enable',
    'programs.urxvt.enable',
  ],
  descriptions: [
    'Whether to enable Zsh.',
    'Enable zsh completion.',
    'Aliases.',
    'Whether to enable oh-my-zsh.',
    'Whether to enable Git.',
    'Default user name.',
    'Extra config.',
    'Whether to enable SSH.',
    'Hostname.',
    'Whether to enable Syncthing.',
    'Whether to enable a syncthing tray service.',
    'Whether to enable the Terminator terminal emulator.',
    'Whether to enable urxvt terminal emulator.',
  ],
});

const analyze = (code: string, id = 'programs.zsh') => analyzeModuleCode(code, id, index);

describe('module analysis', () => {
  test('valid code', () => {
    const report = analyze('programs.zsh.enableCompletion = true;\nprograms.zsh.shellAliases = { ll = "ls -l"; };');
    expect(report.syntaxError).toBeUndefined();
    expect(report.unknown).toEqual([]);
    expect(report.options).toContain('programs.zsh.enableCompletion');
  });
  test('unknown option with a suggestion and line', () => {
    const report = analyze('programs.zsh.enableCompletio = true;');
    expect(report.unknown).toHaveLength(1);
    expect(report.unknown[0]).toMatchObject({ line: 1, path: 'programs.zsh.enableCompletio' });
    expect(report.unknown[0].suggestions).toContain('programs.zsh.enableCompletion');
  });
  test('options with a <name> wildcard', () => {
    expect(analyze('programs.ssh.matchBlocks.work.hostname = "x";', 'programs.ssh').unknown).toEqual([]);
  });
  test('nested attributes with braces', () => {
    expect(analyze('programs.zsh = { enableCompletion = true; oh-my-zsh.enable = true; };').unknown).toEqual([]);
  });
  test('ignores strings, comments and interpolations', () => {
    const code = '# programs.nada = 1;\n/* programs.otro = 2; */\nprograms.zsh.shellAliases = { a = "programs.fake = 1; ${x}"; };';
    expect(analyze(code).unknown).toEqual([]);
  });
  test.each([
    ['falta punto y coma', 'programs.zsh.enableCompletion = true'],
    ['llave sin cerrar', 'programs.zsh = { enableCompletion = true;'],
    ['cadena sin cerrar', 'programs.zsh.shellAliases = { a = "x; };'],
    ['llave inesperada', 'programs.zsh.enableCompletion = true; }'],
  ])('syntax error: %s', (_name, code) => {
    expect(analyze(code).syntaxError).toBeTruthy();
  });
  test('syntax is checked even without an index', () => {
    expect(analyzeModuleCode('a = ;;;', 'programs.zsh', null).unknown).toEqual([]);
  });
  test('full module: detects the header and whether it enables the module', () => {
    const full = '{ pkgs, ... }:\n{\n  programs.zsh.enable = true;\n}';
    expect(isFullModule(full)).toBe(true);
    expect(isFullModule('programs.zsh.enable = true;')).toBe(false);
    expect(analyze(full).enables).toBe(true);
    expect(analyze('{ ... }:\n{\n  programs.zsh.enableCompletion = true;\n}').enables).toBe(false);
  });
  test('lib.mkIf / mkMerge mark partial validation', () => {
    expect(analyze('programs.zsh = lib.mkIf true { enableCompletion = true; };').partial).toBe(true);
  });
  test('module-level let/with mark partial validation', () => {
    expect(analyze('let x = 1; in { programs.zsh.enableCompletion = true; }').partial).toBe(true);
  });
  test('a plain value is not partial', () => {
    expect(analyze('programs.zsh.shellAliases = with pkgs; { a = "b"; };').partial).toBe(false);
  });
});

describe('module search', () => {
  test('by name, prioritizing exact matches', () => {
    expect(searchModuleHits(index, 'git')[0].id).toBe('programs.git');
  });
  test('by description', () => {
    const ids = searchModuleHits(index, 'terminal emulator').map((hit) => hit.id);
    expect(ids).toContain('programs.terminator');
    expect(ids).toContain('programs.urxvt');
  });
  test('multi-word descriptions (all words must appear)', () => {
    expect(searchModuleHits(index, 'syncthing tray').map((hit) => hit.id)).toEqual(['services.syncthing.tray']);
  });
  test('very short queries return nothing', () => {
    expect(searchModuleHits(index, 'g')).toEqual([]);
    expect(searchModuleHits(index, '')).toEqual([]);
  });
  test('searchModules suggests paths', () => expect(searchModules(index, 'zsh')).toContain('programs.zsh'));
  test('does not include paths with wildcards', () => {
    expect(searchModuleHits(index, 'matchBlocks').every((hit) => !hit.id.includes('<'))).toBe(true);
  });
});

describe('analyzer: less common constructs', () => {
  const parse = (code: string) => analyzeModuleCode(code, 'programs.zsh', index);

  test("indented '' … '' strings with escapes and interpolation", () => {
    const code = "programs.zsh.shellAliases = { a = ''\n  echo ''${HOME} ''$x '''\n  ${toString 1}\n''; };";
    const report = parse(code);
    expect(report.syntaxError).toBeUndefined();
    expect(report.unknown).toEqual([]);
  });
  test("unclosed '' string", () => expect(parse("programs.zsh.shellAliases = { a = ''hola; };").syntaxError).toMatch(/sin cerrar/));
  test('quoted and dynamic attribute names', () => {
    expect(parse('programs.zsh."oh-my-zsh".enable = true;').unknown).toEqual([]);
    expect(parse('programs.zsh."${name}".enable = true;').partial).toBeDefined();
  });
  test('config = { … } inside a full module', () => {
    const report = parse('{ ... }:\n{\n  config = { programs.zsh.enableCompletion = true; };\n}');
    expect(report.syntaxError).toBeUndefined();
    expect(report.options).toContain('programs.zsh.enableCompletion');
  });
  test('missing semicolon after a closing brace', () => {
    expect(parse('programs.zsh = { enableCompletion = true; }\nprograms.git.enable = true;').syntaxError).toMatch(/falta ";" tras "}"/);
  });
  test('missing semicolon at the end of a multiline value', () => {
    expect(parse('programs.zsh.shellAliases = foo\nprograms.git.enable = true;').syntaxError).toMatch(/falta un ";"/);
  });
  test('a full module that does not return a set is partial', () => {
    expect(parse('{ lib, ... }: lib.mkMerge [ ]').partial).toBe(true);
  });
  test('unexpected errors propagate', () => {
    expect(() =>
      analyzeModuleCode('a.b = 1;', 'programs.zsh', {
        names: [],
        descriptions: [],
        set: new Set(),
        root: { children: null, option: false },
      } as never),
    ).toThrow();
  });
});

describe('analyzer: branches that used to share a line', () => {
  const parse = (code: string, withIndex = true) => analyzeModuleCode(code, 'programs.zsh', withIndex ? index : null);

  test('nested braces inside an interpolation', () => {
    expect(parse('programs.zsh.shellAliases = { a = "x ${ { b = 1; }.b } y"; };').syntaxError).toBeUndefined();
  });
  test('dynamic attribute name (${…})', () => {
    expect(parse('programs.zsh.${name} = true;').syntaxError).toBeUndefined();
  });
  test('inherit inside a set', () => {
    expect(parse('programs.zsh = { inherit foo; enableCompletion = true; };').unknown).toEqual([]);
  });
  test('full-module keys (imports, options…) are skipped', () => {
    const report = parse('{ ... }:\n{\n  imports = [ ./otro.nix ];\n  options.mi.cosa = 1;\n  programs.zsh.enableCompletion = true;\n}');
    expect(report.unknown).toEqual([]);
    expect(report.options).toContain('programs.zsh.enableCompletion');
  });
  test('without an index only the structure is checked, also with nested sets', () => {
    expect(parse('programs.zsh = { enableCompletion = true; };', false).syntaxError).toBeUndefined();
    expect(parse('programs.zsh = { enableCompletion = true; }\nx = 1;', false).syntaxError).toMatch(/falta ";" tras "}"/);
  });
  test('free attributes inside an option (shellAliases.ll)', () => {
    expect(parse('programs.zsh.shellAliases.ll = "ls -l";').unknown).toEqual([]);
  });
});

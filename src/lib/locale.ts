// Idiomas, teclados y zonas horarias. Los mapas de consola se verifican con scripts/check-locale.ts.

export interface Language {
  locale: string;
  label: string;
}

const lang = (code: string, label: string): Language => ({ locale: `${code}.UTF-8`, label });

export const languages: Language[] = [
  lang('es_ES', 'Español (España)'),
  lang('es_MX', 'Español (México)'),
  lang('es_AR', 'Español (Argentina)'),
  lang('es_CO', 'Español (Colombia)'),
  lang('es_CL', 'Español (Chile)'),
  lang('ca_ES', 'Català'),
  lang('gl_ES', 'Galego'),
  lang('eu_ES', 'Euskara'),
  lang('en_US', 'English (United States)'),
  lang('en_GB', 'English (United Kingdom)'),
  lang('en_CA', 'English (Canada)'),
  lang('en_AU', 'English (Australia)'),
  lang('fr_FR', 'Français (France)'),
  lang('fr_CA', 'Français (Canada)'),
  lang('de_DE', 'Deutsch (Deutschland)'),
  lang('de_CH', 'Deutsch (Schweiz)'),
  lang('it_IT', 'Italiano'),
  lang('pt_PT', 'Português (Portugal)'),
  lang('pt_BR', 'Português (Brasil)'),
  lang('nl_NL', 'Nederlands'),
  lang('pl_PL', 'Polski'),
  lang('cs_CZ', 'Čeština'),
  lang('sk_SK', 'Slovenčina'),
  lang('hu_HU', 'Magyar'),
  lang('ro_RO', 'Română'),
  lang('bg_BG', 'Български'),
  lang('ru_RU', 'Русский'),
  lang('uk_UA', 'Українська'),
  lang('el_GR', 'Ελληνικά'),
  lang('tr_TR', 'Türkçe'),
  lang('sv_SE', 'Svenska'),
  lang('nb_NO', 'Norsk bokmål'),
  lang('da_DK', 'Dansk'),
  lang('fi_FI', 'Suomi'),
  lang('he_IL', 'עברית'),
  lang('ar_SA', 'العربية'),
  lang('hi_IN', 'हिन्दी'),
  lang('ja_JP', '日本語'),
  lang('ko_KR', '한국어'),
  lang('zh_CN', '中文 (简体)'),
  lang('zh_TW', '中文 (繁體)'),
  lang('vi_VN', 'Tiếng Việt'),
  lang('th_TH', 'ไทย'),
  lang('id_ID', 'Bahasa Indonesia'),
];

export const localePattern = /^[a-z]{2,3}_[A-Z]{2}\.UTF-8$/;

export interface Keyboard {
  id: string;
  label: string;
  /** Disposición de X11/Wayland (xkb). */
  layout: string;
  variant?: string;
  /** Mapa de la consola virtual (kbd). */
  console: string;
}

const kb = (id: string, label: string, layout: string, console: string, variant?: string): Keyboard => ({
  id,
  label,
  layout,
  console,
  variant,
});

export const keyboards: Keyboard[] = [
  kb('es', 'Español (España)', 'es', 'es'),
  kb('es-cat', 'Catalán (España)', 'es', 'es', 'cat'),
  kb('latam', 'Español (Latinoamérica)', 'latam', 'la-latin1'),
  kb('us', 'Inglés (EE. UU.)', 'us', 'us'),
  kb('us-intl', 'Inglés (EE. UU., internacional)', 'us', 'us-acentos', 'intl'),
  kb('gb', 'Inglés (Reino Unido)', 'gb', 'uk'),
  kb('de', 'Alemán', 'de', 'de-latin1'),
  kb('fr', 'Francés', 'fr', 'fr'),
  kb('it', 'Italiano', 'it', 'it'),
  kb('pt', 'Portugués', 'pt', 'pt-latin1'),
  kb('br', 'Portugués (Brasil)', 'br', 'br-abnt2'),
  kb('nl', 'Neerlandés', 'nl', 'nl'),
  kb('be', 'Belga', 'be', 'be-latin1'),
  kb('ch', 'Suizo (alemán)', 'ch', 'sg'),
  kb('dk', 'Danés', 'dk', 'dk-latin1'),
  kb('no', 'Noruego', 'no', 'no-latin1'),
  kb('se', 'Sueco', 'se', 'sv-latin1'),
  kb('fi', 'Finlandés', 'fi', 'fi'),
  kb('pl', 'Polaco', 'pl', 'pl2'),
  kb('cz', 'Checo', 'cz', 'cz-lat2'),
  kb('sk', 'Eslovaco', 'sk', 'sk-qwerty'),
  kb('hu', 'Húngaro', 'hu', 'hu'),
  kb('gr', 'Griego', 'gr', 'gr'),
  kb('tr', 'Turco', 'tr', 'trq'),
  kb('ru', 'Ruso', 'ru', 'ru'),
  kb('ua', 'Ucraniano', 'ua', 'ua'),
  kb('il', 'Hebreo', 'il', 'il'),
  kb('jp', 'Japonés', 'jp', 'jp106'),
  kb('dvorak', 'Dvorak (EE. UU.)', 'us', 'dvorak', 'dvorak'),
  kb('colemak', 'Colemak (EE. UU.)', 'us', 'colemak', 'colemak'),
];

export const keyboardById = (id: string) => keyboards.find((keyboard) => keyboard.id === id);

/** Zonas horarias del navegador (IANA); en el servidor solo se conoce la actual. */
export const allTimeZones = (): string[] => {
  try {
    const zones = (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf('timeZone');
    return [...new Set(['UTC', ...zones])];
  } catch {
    return [
      'UTC',
      'Europe/Madrid',
      'Europe/London',
      'America/New_York',
      'America/Mexico_City',
      'America/Argentina/Buenos_Aires',
      'Asia/Tokyo',
    ];
  }
};

export const languageLabel = (locale: string) => languages.find((language) => language.locale === locale)?.label ?? locale;

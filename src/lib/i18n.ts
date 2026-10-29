import { en, patterns } from './en';

// Internacionalización sin dependencias: el texto fuente está en español y `en.ts` lo traduce.
// Cada página fija su idioma (/ = español, /en/ = inglés), así que no hace falta reactividad.

export type Lang = 'es' | 'en';

let current: Lang = 'es';
export const setLang = (lang: Lang) => {
  current = lang;
};
export const getLang = () => current;

export function translate(lang: Lang, text: string): string {
  if (lang === 'es') return text;
  const direct = en[text];
  if (direct !== undefined) return direct;
  for (const [pattern, build] of patterns) {
    const match = pattern.exec(text);
    if (match) return build(...match.slice(1));
  }
  return text;
}

export const t = (text: string) => translate(current, text);

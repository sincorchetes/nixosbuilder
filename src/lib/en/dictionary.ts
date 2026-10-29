import { catalog } from './catalog';
import { landing } from './landing';
import { messages } from './messages';
import { ui } from './ui';

/** Traducciones al inglés: la clave es el texto original en español. */
export const en: Record<string, string> = { ...landing, ...ui, ...catalog, ...messages };

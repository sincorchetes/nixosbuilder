/** Ruta base del sitio (termina siempre en `/`). */
export const siteBase = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');

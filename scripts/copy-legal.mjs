// Publica la licencia y los créditos junto al sitio (como texto plano, para que el navegador los muestre).
import { copyFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
mkdirSync(new URL('public/', root), { recursive: true });
copyFileSync(new URL('LICENSE', root), new URL('public/LICENSE.txt', root));
copyFileSync(new URL('CREDITS.md', root), new URL('public/CREDITS.txt', root));

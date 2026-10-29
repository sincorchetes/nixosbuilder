# Reglas de flujo de trabajo tras completar cambios

`main` está protegida: no se hace push directo. Cada cambio entra por una rama corta y un pull request.
El sitio se publica solo (GitHub Pages) al fusionar en `main`; las versiones se marcan con tags `v*`.

> **Estado actual:** este directorio todavía no es un repositorio git. Hasta que se cree (`git init`, remoto,
> protección de `main`, *Settings → Pages → Source: GitHub Actions*), los pasos de rama, commit, PR y tag
> no se pueden ejecutar: se hace igualmente el paso 2 y el 3.

Siempre que se terminen de implementar cambios en el proyecto, seguir rigurosamente este ciclo completo:

1. **Rama**:
   - Trabajar en una rama corta creada desde `main` actualizada: `git switch -c <tipo>/<descripcion>` (`feat/`, `fix/`, `ci/`, `docs/`...).
2. **Preformateo**:
   - Ejecutar el formateador y linter con arreglos seguros: `devenv shell -- fix` (Biome: `biome check --write .`).
   - Comprobar que queda limpio: `devenv shell -- lint`.
3. **Generar tests**:
   - Ejecutar lint, tipos y la suite con la compuerta de cobertura (100 % de líneas): `devenv test`.
   - Si cambia lo que se genera (archivos `.nix`, esquemas de disco, opciones de NixOS): `devenv shell -- nix-eval` (necesita Nix; también admite un canal: `nix-eval unstable`).
   - Si cambia la interfaz: `devenv shell -- site-build && devenv shell -- e2e` (necesita Chrome).
   - Si cambia la salida generada **a propósito**, aceptar las instantáneas con `bun test --update-snapshots` y revisar la diferencia.
4. **Commit**:
   - Crear el commit con mensaje convencional (`feat:`, `fix:`, `perf:`, `ci:`, `docs:`, etc.).
   - Si Claude ha colaborado en el cambio, el mensaje termina con la atribución (línea en blanco antes):
     `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
5. **Push y pull request**:
   - Subir la rama: `git push -u origin <rama>`.
   - La descripción del PR termina con `🤖 Generated with [Claude Code](https://claude.com/claude-code)` si Claude ha colaborado.
   - Abrir el PR hacia `main` (`gh pr create`) y esperar a que pasen los checks requeridos (`CI passed`, `CodeQL`, `Secret scan`).
   - Fusionar con *squash* y borrar la rama. Al fusionar, `deploy.yml` publica en GitHub Pages.
6. **Tag versión n+** (solo cuando haya que marcar una versión):
   - Actualizar `main` y obtener la última versión (`git tag -l "v*" --sort=-v:refname | head -n 1`).
   - Crear el tag siguiente `v0.0.<n+1>` y subirlo a origin: `git tag v0.0.<n+1> && git push origin v0.0.<n+1>`. Los tags `v*` no se pueden mover ni borrar.
   - El tag lanza el workflow *Release*, que ejecuta la CI y crea la GitHub Release con el sitio empaquetado y notas automáticas.
   - Para probar el empaquetado sin publicar, lanzar a mano el workflow *Release* (Run workflow) sobre `main`.

## Convenciones del proyecto

- **Todo pasa por devenv**: la CI ejecuta los mismos scripts que en local (`devenv shell -- <script>`). Scripts: `dev`, `check` (tsc), `lint`, `fix`, `unit`, `nix-eval`, `e2e`, `site-build`, `packages`, `secrets`, `sonar`. Se definen en `devenv.nix`.
- **Bun para todo** (instalar, ejecutar, tests); no usar `npm`.
- **Idiomas**: la interfaz y lo que se genera existen en español (texto fuente) e inglés. Cada texto nuevo lleva su traducción en `src/lib/en/`; un test falla si falta. La documentación del repositorio (`README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CREDITS.md`) está en inglés americano; este archivo, los comentarios y el código están en español.
- **Salida de herramientas en inglés**: lo que imprimen los scripts, `devenv test`, la CI y los títulos de los tests (`describe`/`test`) va en inglés, igual que los mensajes de `devenv.nix`.
- **Archivos cortos**, con una sola responsabilidad (hoy ninguno supera ~270 líneas); sin duplicar datos entre catálogos.
- **Cobertura**: 100 % de líneas en `src/lib` (la compuerta está en `bunfig.toml`). Un test nuevo por cada rama nueva.
- **Proyecto no oficial y hecho con ayuda de IA**: mantener esos avisos (pie de la web, `README.md`, `CREDITS.md`). Licencia GPL v3.0 o posterior.
- **Secretos**: nunca en el repositorio. Las credenciales locales van en `.env` (ignorado) y en CI como secretos o variables del repositorio. `sonar-project.properties` está ignorado: la configuración de Sonar vive en `devenv.nix`.
- **Despliegue en GitHub Pages con GitHub Actions** (no desde una rama): el sitio vive bajo `/<repositorio>/`; las rutas deben usar la base (`siteBase` / `import.meta.env.BASE_URL`), nunca `/` a pelo.

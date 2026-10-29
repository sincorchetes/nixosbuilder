{ pkgs, lib, ... }:

let
  # SonarQube settings live here (not in sonar-project.properties, which is git-ignored) so that
  # local runs and CI use exactly the same configuration. The server URL and the token come from
  # SONAR_HOST_URL and SONAR_TOKEN (.env locally, repository secrets in CI).
  sonarProperties = [
    "sonar.projectKey=nixosbuilder"
    "sonar.projectName=nixosbuilder"
    "sonar.sources=src"
    "sonar.tests=tests"
    "sonar.sourceEncoding=UTF-8"
    "sonar.inclusions=**/*.ts,**/*.js,**/*.mjs,**/*.svelte,**/*.astro,**/*.css"
    "sonar.exclusions=**/node_modules/**,dist/**,.astro/**,.devenv/**,coverage/**,public/packages/**,public/hm-options/**"
    "sonar.test.inclusions=tests/**/*.test.ts"
    "sonar.scm.disabled=true"
    # Data tables (dictionaries, catalogs, icons) repeat the same row shape: not duplicated code
    "sonar.cpd.exclusions=src/lib/en/**,src/lib/catalog.ts,src/lib/wizardSteps.ts"
    "sonar.typescript.tsconfigPaths=tsconfig.json"
    # Compiled by Svelte, so line coverage cannot be mapped back to the source (its tests do run)
    "sonar.coverage.exclusions=src/lib/homeManager.svelte.ts"
    "sonar.javascript.lcov.reportPaths=coverage/lcov.info"
    "sonar.typescript.lcov.reportPaths=coverage/lcov.info"
  ];
in
{
  languages.javascript = {
    enable = true;
    bun = {
      enable = true;
      install.enable = true;
    };
  };

  languages.typescript.enable = true;

  # Local variables (e.g. SONAR_TOKEN) come from .env, which is never committed
  dotenv.enable = true;

  packages = [
    pkgs.nil
    pkgs.nixfmt
    pkgs.git
    pkgs.curl
    pkgs.biome
    pkgs.gitleaks
    pkgs.sonar-scanner-cli
    pkgs.openjdk
  ];

  # Every pipeline step is a script, so CI runs exactly what developers run locally:
  #   devenv shell -- <script>
  scripts = {
    # Development
    dev.exec = "bun run dev --host";
    build.exec = "bun run build";
    preview.exec = "bun run build && bun run preview --host";
    packages.exec = "bun run packages -- --force";

    # Pipeline
    check.exec = "bun run check";
    lint.exec = "biome check .";
    fix.exec = "biome check --write .";
    secrets.exec = ''
      # Secret scan: full history in a git checkout (CI), current files otherwise
      if [ -d .git ]; then gitleaks git --redact --no-banner .; else gitleaks dir --redact --no-banner .; fi
    '';
    unit.exec = "bun run test:coverage";
    site-build.exec = "bun scripts/copy-legal.mjs && bunx astro build";
    nix-eval.exec = ''bun tests/nix-eval.ts "$@"'';
    e2e.exec = ''
      # Serve the built site on a spare port, run the browser tests, always stop the server
      bunx astro preview --port 4399 > "''${TMPDIR:-/tmp}/nixosbuilder-preview.log" 2>&1 &
      server=$!
      trap 'kill "$server" 2>/dev/null' EXIT
      for _ in $(seq 1 60); do curl -sf http://localhost:4399/ > /dev/null && break; sleep 0.5; done
      bun tests/e2e/browser.ts http://localhost:4399/
    '';
    # Coverage + SonarQube analysis. Uses the environment's Node because the one Sonar embeds
    # cannot run on NixOS.
    sonar.exec = ''
      bun run test:coverage
      sonar-scanner -Dsonar.nodejs.executable="$(command -v node)" ${lib.concatMapStringsSep " " (property: "-D${lib.escapeShellArg property}") sonarProperties}
    '';
  };

  processes.web.exec = "bun run dev --host";

  # `devenv test`: the quick part of the pipeline (lint + types + unit tests with the 100% coverage gate)
  enterTest = ''
    set -euo pipefail
    lint
    check
    unit
  '';

  enterShell = ''
    echo "nixosbuilder · bun $(bun --version)"
    echo "  dev        development server (http://localhost:4321)"
    echo "  build      build to dist/"
    echo "  preview    build and serve the result"
    echo "  packages   regenerate the nixpkgs package index"
    echo "  check      type-check (tsc)"
    echo "  lint       format + lint check (Biome); fix applies the safe fixes"
    echo "  secrets    scan for leaked secrets (gitleaks)"
    echo "  unit       unit tests with the 100% line-coverage gate"
    echo "  nix-eval   evaluate generated configurations with Nix (optional: channel)"
    echo "  e2e        browser tests against the built site"
    echo "  sonar      coverage + SonarQube analysis"

    # Point the SonarQube scanner at the Nix JDK (avoids the dynamically linked executable error)
    export SONAR_SCANNER_JAVA_EXE_PATH="${pkgs.openjdk}/bin/java"
    export JAVA_HOME="${pkgs.openjdk}"

    # bun add -g @sonar/scan, into a bun global install inside the project (leaves the system
    # untouched). First time only; skipped in CI.
    export BUN_INSTALL="$DEVENV_STATE/bun"
    export PATH="$PATH:$BUN_INSTALL/bin"
    if [ -z "$CI" ] && [ ! -d "$BUN_INSTALL/install/global/node_modules/@sonar/scan" ]; then
      echo "installing @sonar/scan (bun add -g)…"
      bun add -g @sonar/scan --silent || echo "  could not install @sonar/scan (offline?); will retry on the next shell entry"
    fi
  '';
}

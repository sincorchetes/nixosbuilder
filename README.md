# NixOSBuilder

A **deterministic** NixOS configuration generator: answer a wizard (or a technical form) and download
`flake.nix`, `configuration.nix`, `hardware-configuration.nix`, `home.nix`, `disko.nix`… ready to use.
Everything happens in the browser: no backend, no accounts, no data sent anywhere.

> **Unofficial project.** It is not affiliated with or endorsed by the NixOS project or the NixOS Foundation.
> **Built with the help of AI** (Claude, by Anthropic). The generator uses no AI at runtime; always review
> the files before applying them. Details in [CREDITS.md](CREDITS.md).

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)

## What's included

- A step-by-step wizard (installer style) and a technical view, in Spanish and English (`/` and `/en/`).
- Profiles (server, end user, developer, DevOps, gamer) with catalogs and search across all of nixpkgs.
- Desktops, GPU, audio, an interactive firewall, Secure Boot (lanzaboote), ZFS/LVM/LUKS, TRIM.
- A partition designer: paste the output of `lsblk`, edit the layout, and generate `disko.nix` or a script.
- Home Manager with one file per module, validated against the real options of each release.
- NixOS channels 25.11, 26.05 and unstable.

## Development

Everything runs through [devenv](https://devenv.sh); CI runs exactly the same scripts.

```sh
devenv shell          # enter the environment (installs dependencies with bun)
dev                   # development server at http://localhost:4321
lint / fix            # format and lint with Biome (fix applies the safe fixes)
check                 # types (tsc)
unit                  # unit tests with a coverage gate (100% of lines)
secrets               # scan for leaked secrets (gitleaks)
nix-eval [channel]    # evaluate the generated configurations with Nix (needs Nix)
e2e                   # browser tests against the built site (needs Chrome)
sonar                 # coverage + SonarQube analysis (needs SONAR_TOKEN and SONAR_HOST_URL in .env)
packages              # regenerate the nixpkgs and Home Manager indexes
```

`devenv test` runs the quick part (lint, types, and tests with the coverage gate). The working rules
(branches, PRs, tags) are in [AGENTS.md](AGENTS.md).

## Pipeline (GitHub Actions)

| Workflow | When | What it does |
| --- | --- | --- |
| `ci.yml` | PRs and branches | lint, types, tests with a coverage gate, indexes, build, Nix evaluation on all 3 channels, browser tests, SonarQube (optional) |
| `deploy.yml` | push to `main`, Mondays, manual | runs CI and publishes to **GitHub Pages** (source: *GitHub Actions*) |
| `canary.yml` | daily | evaluates the configurations against current NixOS channels and opens an issue if something breaks |
| `secret-scan.yml` | PRs and `main` | scans the whole history for secrets (gitleaks) |
| `release.yml` | `v*` tag or manual | runs CI and creates the GitHub Release with the packaged site (manual runs only package it) |
| `codeql.yml`, `dependency-review.yml`, Dependabot | PRs and weekly | security and dependencies |

To publish: *Settings → Pages → Build and deployment → Source: GitHub Actions*. Optional repository
variables: `PAGES_SITE`, `PAGES_BASE` (custom domain) and `SONAR_HOST_URL` (plus the `SONAR_TOKEN` secret).
In the branch protection rules for `main`, require the **CI passed**, **CodeQL** and **Secret scan** checks.

## License

[GNU General Public License v3.0 or later](LICENSE). Copyright © 2026 [sincorchetes](https://sincorchetes.tech). Credits and
third-party software in [CREDITS.md](CREDITS.md).

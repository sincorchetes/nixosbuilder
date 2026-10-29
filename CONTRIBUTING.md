# Contributing

1. Run `devenv shell`, then `dev`, to work locally.
2. Before opening a PR, run `lint`, `check` and `unit`. Also run `nix-eval` if what gets generated changes, and `e2e` if the interface changes.
3. New user-facing text needs its translation in `src/lib/en/`; a test fails if one is missing.
4. If you change the generated output on purpose, accept the snapshots with `bun test --update-snapshots` and review the diff.
5. Keep files short and focused on a single responsibility, and don't duplicate data across catalogs.

By contributing, you agree to license your work under the GPL v3.0 or later, like the rest of the project.
If you used AI to write it, say so in the PR.

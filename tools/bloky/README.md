# Bloky tools

- `brand/` — the Bloky brand kit (flat logo SVGs, toolbar icons, colour/type tokens, Inter and
  JetBrains Mono fonts). The extension's design layer lives in
  `host/adblock/adblock-betafish/bloky/` (`bloky.css` tokens and controls, `popup.css`,
  `options.css`) and is loaded after the stock AdBlock styles.
- `bloky-strings.mjs` — Bloky's own English and Russian texts for the redesigned pages
  (`node tools/bloky/bloky-strings.mjs`, safe to run again).
- `mirror-filters.mjs`, `filter-releases.txt` — filter-update mirror for GitHub Pages
  (run by `.github/workflows/filters.yml`).
- `art/` — `make_icons.py` (Pillow) writes every icon the extension uses from the brand kit;
  `promo.html` + `render-promo.mjs` — README banner, GitHub social preview and store images.
- `dev/` — local build in Docker on Windows (`build.ps1`, output in `_build/`) and an
  automated check in a real Chrome (`check.mjs`: loads the build, checks blocking,
  filter updates, Premium unlock, pause, allowlisting, one light look even with a dark system
  theme; saves screenshots of every screen) and `scenarios.mjs` (update from the previous
  release with saved settings, real clicks on every button of the settings and the popup,
  narrow window).

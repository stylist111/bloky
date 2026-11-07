# Bloky tools

- `mirror-filters.mjs`, `filter-releases.txt` — filter-update mirror for GitHub Pages
  (run by `.github/workflows/filters.yml`).
- `art/` — logo source and scripts that generate every icon and replace AdBlock's
  logo in illustrations: `make_icons.py`, `fix_cards.py`, `make_illustrations.py` (Pillow, svgpathtools).
  `promo.html` + `render-promo.mjs` — README banner, GitHub social preview and store images.
- `dev/` — local build in Docker on Windows (`build.ps1`, output in `_build/`) and an
  automated check in a real Chrome (`check.mjs`: loads the build, checks blocking,
  filter updates, Premium unlock, pause, allowlisting, themes; saves screenshots).

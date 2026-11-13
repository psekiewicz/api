# api

Static APIs served from GitHub Pages at `https://psekiewicz.github.io/api/`.
No database, no server: every push to `main` rebuilds and publishes.

## Przewodnik

The audio guide reads `https://psekiewicz.github.io/api/przewodnik/content.json`
and the files it lists under `https://psekiewicz.github.io/api/przewodnik/files/`.

Sources in `przewodnik/`:

- `miasta.json` - cities (`id`, `name`, `latitude`, `longitude`, `zoom`).
- `atrakcje/<id>/atrakcja.json` - one folder per place, with its photo,
  optional marker and mp3 files next to it. The folder name is the id.
  Optional `practical`: the "Na miejscu" lines, each `kind` (`listen` or
  `entry`), `text` and an optional `link` (`label`, `url`).
- `trasy/<id>.json` - routes: `stops` are attraction ids, `legs` one fewer.
- `wyjazdy.json` - trips the app's start screen lists (`id`, `title`,
  `subtitle`, `locations` = city ids, `offerUrl`, optional `cover` =
  attraction id). A city with no attractions yet shows as "w przygotowaniu".
- `ustawienia.json` - `minAppVersionCode`.

### Adding a place

1. Copy any folder in `przewodnik/atrakcje/`, rename it (e.g. `colosseo`).
2. Put in `photo.jpg` and the mp3 files, edit `atrakcja.json`
   (`city` must be an id from `miasta.json`).
3. Commit and push. The workflow checks everything, hashes the files,
   bumps `contentVersion` and publishes. If something does not add up,
   the run fails and lists what to fix.

Check locally first: `node tools/build-przewodnik.mjs _site/przewodnik 1`.

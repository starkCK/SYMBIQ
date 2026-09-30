# Vendored font: Inter (variable, Latin subset)

- `inter-latin-wght-normal.woff2` (~47 KB) — weight axis 100–900, upright
- `inter-latin-wght-italic.woff2` (~51 KB) — weight axis 100–900, italic

Source: `@fontsource-variable/inter@5.2.6` (jsDelivr), which repackages the
canonical Inter release by Rasmus Andersson. Latin-only subset, weight axis
only — the site uses 400 / 700 / 800 and English text.

Licence: SIL Open Font License 1.1 — full text in `inter-OFL.txt`.
Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter).

Wired in `style.css` via two `@font-face` blocks (family name `InterVariable`),
`font-display: swap`. `InterVariable` leads the body font stack, ahead of a
locally-installed `Inter` and the system fallback.

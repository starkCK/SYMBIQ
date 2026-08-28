---
name: SymbiQ
description: "A backlit measuring instrument for the loop between AI and quantum computing — dark by default, violet/teal/amber semantics, every widget a real instrument where the mathematics does the judging."
colors:
  canvas: "#0b0f1a"
  surface: "#131a2b"
  ink: "#e8ecf6"
  ink-muted: "#9aa5bd"
  hairline: "#232d45"
  violet-accent: "#a78bfa"
  teal-accent: "#2dd4bf"
  link: "#2dd4bf"
  amber: "#facc15"
  green: "#4ade80"
  red: "#f87171"
  surface-2: "#182134"
  surface-3: "#1e293f"
  h1-ramp-a: "#e8ecf6"
  h1-ramp-b: "#a78bfa"
  h1-ramp-c: "#2dd4bf"
  glow-violet: "rgba(139, 92, 246, 0.14)"
  glow-teal: "rgba(45, 212, 191, 0.10)"
  lattice-dot: "rgba(167, 139, 250, 0.07)"
  row-hover: "rgba(148, 163, 184, 0.06)"
typography:
  display:
    fontFamily: "InterVariable, Inter, 'Segoe UI', -apple-system, system-ui, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  display-vivid:
    fontFamily: "InterVariable, Inter, 'Segoe UI', -apple-system, system-ui, sans-serif"
    fontSize: "clamp(2.05rem, 1.3rem + 3.4vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "InterVariable, Inter, 'Segoe UI', -apple-system, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "InterVariable, Inter, 'Segoe UI', -apple-system, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "InterVariable, Inter, 'Segoe UI', -apple-system, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
    fontFeature: "'cv05' 1, 'cv08' 1, 'ss03' 1"
  body-sm:
    fontFamily: "InterVariable, Inter, 'Segoe UI', -apple-system, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "InterVariable, Inter, 'Segoe UI', -apple-system, system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.12em"
  numeric:
    fontFamily: "InterVariable, Inter, 'Segoe UI', -apple-system, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
    fontFeature: "tnum"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  card: "12px"
  control: "8px"
  pill: "999px"
spacing:
  sp-1: "4px"
  sp-2: "8px"
  sp-3: "12px"
  sp-4: "16px"
  sp-5: "20px"
  sp-6: "28px"
  sp-7: "40px"
  section: "36px"
components:
  button-primary:
    backgroundColor: "{colors.teal-accent}"
    textColor: "#04211d"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.teal-accent}"
    textColor: "#04211d"
    rounded: "{rounded.pill}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
    height: "44px"
  button-secondary-on:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.teal-accent}"
    rounded: "{rounded.control}"
  chip-tier:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "20px 22px"
  input-field:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  nav-link:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "0 0 2px 0"
---

# Design System: SymbiQ

## Overview

**Creative North Star: "The Instrument"**

SymbiQ is a precise measuring instrument that happens to be alive. Its whole promise is that *the mathematics does the judging* — every game par is an optimum found by exhaustive search, every probability on screen is computed rather than chosen, every claim carries a date and a falsification condition. The visual system exists to make that trustworthy: the chrome recedes, the reading is what you look at, and the one thing that moves on its own is a faint generative lattice behind everything — the same object the site is about, actually behaving like one.

The surface is dark by default (`#0b0f1a`, a near-black with a blue cast) with a fully realised light theme that swaps in measured, contrast-locked values rather than naive inversions. Two accent hues carry meaning, not decoration: a lattice lavender for the quantum/theoretical half of every topic, an electric mint for the AI/operations-research/shipping half, and a signal amber reserved for "check your own systems." Depth is tonal and hairline-drawn, not shadowed. Type is a single Inter voice from the gradient-clipped hero line down to 0.7rem uppercase labels. Motion is almost entirely feedback — a press, a toggle, a section header drawing itself in — plus one ambient layer held deliberately below the threshold of notice.

The deliberate anti-references: no springy or bouncing motion (a site whose thesis is "the mathematics does the judging" should not have springy furniture); no oversized or pulsing primary CTA (three rounds of feedback each asked that control to be quieter); no photographic imagery anywhere (the generative lattice is the honest substitute); no accent used purely to look designed.

**Key Characteristics:**
- **Dark-first, dual-theme.** Every token has a measured light-mode value; the light theme is a real design, not an inversion.
- **Semantic two-hue accent** — lavender = quantum/theory, mint = AI/real/OR, amber = security. The colour tells you which half of the argument you are reading.
- **Tonal depth.** A two-step surface ladder plus 1px hairlines carry hierarchy; shadow is a response to state, never a decoration.
- **One Inter voice** from the 1.9rem hero to the 0.7rem label; hierarchy comes from weight, size and colour, not from a second family.
- **Motion is feedback plus one ambient layer.** Nothing bounces; the only self-starting motion is a sub-threshold lattice and a slow background breath.
- **Layered stylesheets.** `style.css` is the shared 24-page base; `motion.css`, `rails.css` and `vivid.css` are opt-in, separately cache-busted layers.

## Colors

A near-monochrome dark ground carrying exactly two chromatic accents plus one reserved warning hue. Every value below is the **dark-theme (canonical)** token; the light theme redefines the same names inside `@media (prefers-color-scheme: light)` with the measured values noted in each entry.

### Primary

- **Electric Mint** (`#2dd4bf`, light `#0f766e`): the AI / operations-research / "shipping now" / "real" half of every topic. Carries links (`--link`, same value), the active nav underline, focus rings, the primary CTA fill, and every "verified / feasible / pass" state. In light mode it darkens to teal-700 so it clears 4.5:1 as body text; the brand accent and the link token are split so a future brightening of the accent can never silently break link contrast.
- **Lattice Lavender** (`#a78bfa`, light `#7c3aed`): the quantum / theoretical / "still ahead" half. Carries the brand mark, the h1 gradient's middle stop, the h2 accent bar's top, the ambient background glow, and "split decision / interpretive" verdict states.

### Tertiary

- **Signal Amber** (`#facc15`, light `#b45309`): reserved for "check *your* system" — the security surface's hero border, its eyebrows, and the 🟡 intermediate tier. Amber reads as *inspect this*, distinct from mint's *explore this*.

### Neutral

- **Void** (`#0b0f1a`, light `#f8fafc`): the page canvas. Near-black with a blue cast; never pure `#000`.
- **Slate Panel** (`#131a2b`, light `#ffffff`): surface-1 — every card, hero, collapsible, HUD and input sits on this one step up from canvas.
- **Slate Panel +2 / +3** (`#182134` / `#1e293f`, light `#f1f5fb` / `#e9eff8`): the two deeper ladder steps for a surface that sits *on* a panel — `code` chips and `.formula` blocks are the first two consumers. Additive, in the spirit of the `--sp` / `--r` scales: a named step to reach for, not forced onto anything.
- **Hairline** (`#232d45`, light `#dbe2ef`): the 1px border on every card, input and divider. Hierarchy is drawn, not shadowed.
- **Ink** (`#e8ecf6`, light `#0f172a`): body and heading text.
- **Ink Muted** (`#9aa5bd`, light `#526180`): taglines, captions, eyebrows, table headers, secondary metadata. Measured to clear 4.5:1 in both themes.

### Semantic

- **Verdict Green** (`#4ade80`, light `#15803d`) / **Fault Red** (`#f87171`, light `#b91c1c`): the 🟢 beginner and 🔴 expert tiers, and pass/fail verdict banners. Both light values are measured contrast-locked.

### Named Rules

**The Colour Law.** Mint means AI / real / OR / shipping. Lavender means quantum / theory / ahead. Amber means "check your own system." Muted grey is scaffolding. A colour on this site is a claim about *which half of the argument* you are looking at; if a new element's colour does not answer that question, it should be muted.

**The Contrast Lock.** In light mode, `ink`, `ink-muted`, `teal-accent`, `link`, `green`, `amber` and `red` are the exact values a full per-node sweep proved clear 4.5:1. They are never brightened "for vibrancy" — a wrong colour still renders, passes every test, and is only caught by measuring. Enrich decorative tokens (glows, dot grid, gradient stops) instead.

**The Two-Value Rule.** Every colour token is defined once unconditionally (that value *is* the dark theme) and once inside `@media (prefers-color-scheme: light)`. A scoped override layer must redeclare the *full* set in its own light block, or an unconditional `[data-*]` selector (specificity 0,2,0) leaks its dark value past the base `@media light :root` (0,1,0).

## Typography

**Display / Body / Label Font:** Inter, **self-hosted** as a Latin-subset, weight-axis (100–900) variable woff2 — family name `InterVariable`, upright + a real italic cut, `font-display: swap`, ~98KB total, vendored in `fonts/` under SIL OFL 1.1. The stack is `InterVariable, Inter, "Segoe UI", -apple-system, system-ui, sans-serif` — the self-hosted file, then a locally-installed Inter, then the system fallback. One family, everywhere.

**Character:** Neutral, technical, unshowy — the type of a lab instrument's readout, not a magazine. Confidence comes from weight and tight leading on headings against generous 1.65 body leading, and from a gradient-clipped hero line that is the single expressive typographic moment on the page. `body` sets `font-feature-settings: "cv05" 1, "cv08" 1, "ss03" 1` — Inter's tailed lowercase `l`, serifed uppercase `I`, and round quotes — so `l` / `I` / `1` stop colliding in a page this dense with notation. Now that Inter is self-hosted these actually render for every visitor.

### Hierarchy

- **Display / h1** (700, `1.9rem`, line-height `1.25`): one per page. Filled with a 95° gradient from Ink through Lavender to Mint, `background-clip: text`. Enters once with a 10px rise (`fadeUp`).
- **Display (vivid)** (800, `clamp(2.05rem, 1.3rem + 3.4vw, 3rem)`, `-0.022em`): the enlarged hero used only on the six `body[data-vivid]` pages. Same gradient ramp, tighter tracking, a dark-mode-only violet drop-shadow bloom.
- **Headline / h2** (700, `1.25rem`): section headers. Always preceded by a 3px vertical accent bar (`::before`, Lavender→Mint) that draws itself in with `growbar` the first time it enters view.
- **Title / h3** (700, `1.05rem`): card and sub-section headings.
- **Body** (400, `1rem`, line-height `1.65`): running prose. No explicit max-width beyond the `.wrap` container (see Layout).
- **Body small** (400, `0.9rem`, line-height `1.5`): captions, honest-model notes, secondary UI.
- **Label / eyebrow** (700, `0.7rem`, `letter-spacing: 0.12–0.14em`, uppercase, Ink Muted): section kickers, HUD labels, table headers, tags. The one place tracking opens up rather than tightening.
- **Numeric** (700, `tabular-nums`): scoreboards, timers, live figures in widgets (`.hud-score` and kin). Numbers that change must not reflow.

### Named Rules

**The One Voice Rule.** Inter carries display through label. Hierarchy is weight (400 body / 700 heading / 800 vivid hero), size, and colour — never a second family. Code samples are the only exception and use the platform monospace stack.

**The Gradient Belongs to h1.** The Ink→Lavender→Mint `background-clip: text` ramp is the hero line's alone. h2 gets the same ramp as a 3px bar, not as text. No other text is gradient-filled.

**Tracking Tightens With Size.** The vivid hero runs `-0.022em`; labels run `+0.12em`; body runs `0`. If a new display size is added, its tracking is negative and scales with the size.

## Layout

**Container.** Everything sits inside `.wrap`: `max-width: 780px` with `0 20px` side padding and `80px` bottom padding, widening to `880px` at `≥1024px` and `1040px` at `≥1440px`. Reading measure never exceeds ~1040px; the two step-ups let wide grids, tables and figures use the room without stretching prose lines.

**Spacing rhythm.** A `--sp-1..7` scale (`4 / 8 / 12 / 16 / 20 / 28 / 40px`); h2 sections open with `36px` top margin. New shared components use the scale; the ~700 pre-scale ad-hoc values in `style.css` are left alone (refactoring them is a 24-page blast radius for no reader-visible gain).

**Breakpoints.** `460`, `480`, `560`, `720` (the main phone/desktop split — nav goes sticky here), `1024`, `1440` (peripheral rails appear in the gutters). High-variance grids collapse to a single column below `560–720px`.

**Peripheral rails.** At `≥1440px`, `rails.css`/`rails.js` fill the empty gutters with a section index, the curriculum-ladder marker and a progress readout. Below that width they build nothing.

## Elevation & Depth

Flat at rest. Depth is carried by a **two-step tonal ladder** — canvas (`#0b0f1a`) → surface (`#131a2b`) — and a 1px hairline border on every raised element. There is no ambient shadow on a resting card.

Shadow is a **response to state**. It appears on `:hover` and `:focus`, tinted to the accent rather than to black, and (in the `vivid` layer) as a hue-tinted bloom that reads as the element lifting toward a light source. The atmosphere layer adds one more depth cue: a pointer-tracked sheen that follows the cursor across a card when `body[data-motion]` is set.

### Shadow Vocabulary

- **Rest** (`--elev-1`, `0 1px 2px var(--shadow)`): all but invisible; used only where a single hairline reads as ambiguous.
- **Lift** (`--elev-2`, `0 10px 28px var(--shadow)`): the card/hero `:hover` state, paired with `translateY(-3px)` and a border shift toward Mint.
- **Bloom** (vivid only, `0 0 26px -6px` accent-tinted): a soft outer glow added on `.card:hover`, never at rest.

### Named Rules

**The Flat-By-Default Rule.** A surface at rest has a hairline and nothing else. If you reach for `box-shadow`, it is a hover, focus or drag response — state, not decoration — and it is tinted to the accent, never pure black.

**The Tonal-Ladder Rule.** Nesting depth is expressed by stepping the surface ladder, not by stacking shadows. Canvas (`--bg`) holds surface-1 (`--panel`). A surface sitting *on* a panel steps up to `--surface-2` / `--surface-3` (`code`, `.formula`); a deep inset *well* steps the other way, back down to `--bg` (inputs, figure frames, `.hud`). Either direction, one step, no shadow.

## Shapes

One radius vocabulary: `6 / 10 / 14px` on the `--r-*` scale, with `8px` and `12px` still in wide use from before the scale existed. Cards and heroes are `12–16px`, controls (`.preset`, `.cta`, inputs) are `8px`, chips and pills are fully round (`999px`).

The one shape that carries meaning is the **full pill**, used exclusively for the primary CTA (`.bigplay`) and tier chips. Nothing else on the site is pill-shaped, so the silhouette alone marks "this is the primary action" — which is how that control stays prominent without being enlarged.

Borders are always `1px`, always the Hairline token or an accent-tinted mix of it. Section heroes (`.orhero` family) add a single `3px` top border in their governing semantic colour (Mint for OR, Lavender for games, Amber for security).

## Components

### Buttons

- **Shape:** primary is a full pill (`999px`); everything else is `8px`.
- **Primary** (`.bigplay`): a `135°` Mint→deep-teal gradient, near-black text (`#04211d`), `min-height: 44px`, `padding: 8px 18px`, `0.88rem/700`. Hover is `filter: brightness(1.04)` plus a slightly deeper accent-tinted shadow. **No lift, no scale, no pulse.** Light mode swaps to a `#0f766e → #115e59` gradient with white text (measured 5.5–7.6:1).
- **Secondary / toggle** (`.preset`): Slate Panel fill, 1px hairline, `8px`, `padding: 6px 12px`, explicit `min-height: 44px; min-width: 44px`. Hover shifts the border to Mint and lifts `1px`. The selected state (`.on`) turns the border and label Mint at weight 700.
- **Inline call-to-action** (`.cta`, `.card > a`): not a filled button — Mint text with a trailing `→`, `min-height: 44px` for the target. Used at the foot of cards and as whole-paragraph links.

### Chips

- **Tier chip** (`.tier`): inline, `0.8rem/600`, `padding: 2px 10px`, `999px`, 1px border. Three variants tinted to the semantic colour at low alpha — 🟢 green, 🟡 amber, 🔴 red — fill `~8%`, border `~30%` (the `vivid` layer raises these to `~15%` / `~50%`). Text colour is the contrast-locked semantic value.

### Cards / Containers

- **Corner:** `12px` (`14–16px` for heroes and collapsibles).
- **Background:** Slate Panel at rest; the `vivid` layer adds a sub-1% Lavender wash from the top edge.
- **Border:** 1px Hairline, shifting toward Mint (`~45%`) on hover; `vivid` tints the resting border toward Indigo.
- **Shadow:** none at rest. `--elev-2` + `translateY(-3px)` on hover (see Elevation).
- **Padding:** `20–22px` (`--sp-5` to `--sp-6`).

### Inputs / Fields

- **Style** (`.sqform input, textarea`): filled with the page **canvas** colour (a well *below* the surface it sits on), 1px Hairline, `8px`, `padding: 10px 12px`, `0.95rem`. Range inputs are forced to `44px` tall with `accent-color: var(--teal)`.
- **Focus:** border shifts to Mint; the default outline is removed and replaced by that border change (buttons and links keep a `2px` Mint `:focus-visible` outline).
- **Submit:** styled as the primary gradient button, not a flat fill.

### Navigation

- **Structure:** brand mark + a "Menu" trigger that opens a full-width category panel + a persistent "The Solver's Path" link + an account disclosure.
- **Style:** transparent over canvas; **sticky with `backdrop-filter: blur(10px)` and an 82%-opacity canvas fill at `≥720px`**. Links are `0.92rem` Ink Muted, going to Ink on hover; the active link is Ink with a `2px` Mint bottom border. Every link carries an invisible `44px` hit band via `::after` so the target clears the minimum without the text box growing.
- **Mobile:** one row, ~68px tall; optional label words drop out below `460px`.

### Signature Components

- **The interactive widget kit** (`.hud`, `.verdict`, `.dot`, `.preset` rows): a shared game-UI language every playable/tool reuses — a tabular-numeric scoreboard, colour-coded verdict banners (Mint good / Red bad / Lavender split), and 10-dot result rows. New widgets compose these rather than inventing their own chrome.
- **Section heroes** (`.orhero` / `.gamehero` / `.pqhero`): a panel with two radial corner glows, a `3px` semantic top border, and (in `vivid`) a 26s alternating aurora drift on the glows.
- **Collapsibles** (`.foldsec`, `.gamerules`): `14px` rounded, a faint Mint→Lavender gradient wash, a custom `+`/`×` toggle glyph that rotates `180°` on open. One visual language for "there is more here."
- **Inline-SVG figures** (`.figcard` / `.figscroll`): diagrams ship as HTML SVG, never JS-rendered, inside a horizontally-scrollable frame with a `470px` min-width so labels never shrink below legibility on a phone. Figure colour obeys the Colour Law: mint = AI/real, violet = quantum/theory, yellow = look-here, muted = scaffolding.
- **The Lattice** (`atmosphere.js`, `#mo-lattice`): a generative canvas of drifting, coupling nodes behind everything — the brand mark behaving like itself. Themed from `--violet`/`--teal`, pointer-reactive, one static frame under reduced motion.
- **The vivid layer** (`vivid.css`, `body[data-vivid]`): an opt-in structural richening on the six landing/pillar pages. The **palette stays within a hair of the base** (dialled back on 2026-08-28) — `--bg` a shade deeper, `--violet`/`--teal` a shade more saturated, nothing else. What "vivid" means here is structure: a larger 800-weight hero, the h1/`h2::before` spectral three-stop ramp (the site's own violet through a soft indigo to its own teal), a top-light sheen and hue-tinted shadow on cards, and an ambient motion set (breathing background, aurora heroes, a bottom scroll-progress line). `.bigplay` is untouched. Reversible by removing one attribute.

## Do's and Don'ts

### Do:

- **Do** answer the Colour Law with every new element: mint = AI/real/OR, lavender = quantum/theory, amber = check-your-system, muted = scaffolding. If the colour makes no such claim, use muted.
- **Do** carry depth with the tonal ladder and a 1px hairline. Reach for `box-shadow` only as a hover/focus/drag response, and tint it to the accent.
- **Do** give every control an explicit `min-height: 44px` (and `min-width` for icon-width buttons). A control that clears 44px by accident of its label does not clear it.
- **Do** keep the primary action a full pill at its current size. If it needs to be more noticeable, reach for the pill silhouette or the gradient — never size, weight, lift or pulse.
- **Do** define every new colour token in both the unconditional block *and* the `@media (prefers-color-scheme: light)` block, with the light value measured to 4.5:1 for anything that renders as text.
- **Do** ship new motion or heavy visual layers as their own separately cache-busted stylesheet (`motion.css` / `rails.css` / `vivid.css`). Editing `style.css` is a 24-page deploy.
- **Do** let exactly one atmospheric moment run per section — one glow, one wash. Ambient loops run `≥8s` (`--dur-amble`) at under ~5% amplitude and must never draw the eye.
- **Do** render diagrams as inline SVG in the HTML, inside `.figscroll`, so they are crawlable, survive JS-off, and stay legible at 375px.

### Don't:

- **Don't** add springy, bouncing or overshooting easing. Motion decelerates and settles (`--ease-out-quint`, `cubic-bezier(0.22, 1, 0.36, 1)`); nothing rebounds.
- **Don't** enlarge, animate, lift or pulse the primary CTA. Three separate rounds of feedback removed exactly those; re-adding one silently reverses a settled decision.
- **Don't** gradient-fill any text except the h1. h2 gets the ramp as a bar.
- **Don't** brighten a contrast-locked light-mode colour for visual punch. Enrich the glow, dot-grid and gradient-stop tokens instead, and re-measure the rendered element.
- **Don't** introduce a second type family for hierarchy. Weight, size and colour do that job. The vendored `InterVariable` is a **Latin-only** subset — non-Latin text falls through to the system stack, which is acceptable for an English-only site but is the reason not to lean on Inter-specific glyph rendering for anything user-generated.
- **Don't** add a second scroll-reveal mechanism — `nav.js` owns `.reveal` and is the only thing that may add that class, so a script failure leaves the page fully visible. Extend its selector instead.
- **Don't** ship a photographic image. The generative lattice and inline SVG are the house substitutes; the site has never shipped a photographic byte.
- **Don't** run `git add -A` in the site repo, and don't edit `style.css` for a change that only touches a handful of pages.

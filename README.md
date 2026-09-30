# SymbiQ

Learn quantum computing at your depth, prove it in games with proven answers, and see every big claim scored in public.

Live at **https://starkck.github.io/SYMBIQ/**

---

## What this is

A static site about quantum computing and its overlap with AI and operations research. No accounts, no sign-up: your progress lives in your own browser.

Pages teach at three depths, and you pick yours:

- **Plain** — no maths, no jargon
- **Working** — real terms, light maths
- **Formal** — the actual formalism, with citations

## The rule this project runs on

**Every number is checked before it ships.** AI drafts parts of the site. Scripts then check the arithmetic, the counts and the links, AI referee passes try to break each page, and a person reads it before it goes live. [How we check](how-we-check.html) says exactly what each of those does and does not catch. Where something is unproven, the page says so. Each claim carries an evidence tier:

| Tier | Meaning |
|---|---|
| ⟦Proven⟧ | A theorem, or a measured result with a citation |
| ⟦Heuristic⟧ | Works in practice, no guarantee |
| ⟦Inspired⟧ | A faithful analogy, not the real mechanism |
| ⟦Frontier⟧ | Open question — nobody knows yet |

Interactive pieces are held to the same standard. Every par, probability and threshold in the games was computed offline (usually by exhaustive search or simulation), then re-verified against an independent reimplementation running in the browser. Anything too large to prove is labelled "best known".

Found an error? Tell us on the [Corrections](corrections.html) page. A correction runs with more prominence than the original mistake, and credits you by name if you want that.

## What's in here

| | |
|---|---|
| `index.html` | Home |
| `basics.html` | Start here: no maths |
| `journey.html` | **The Solver's Path** — the narrative game: map, missions, mentors, saved progress |
| `play.html` | **The Arcade** — the games, free play, no story |
| `formalism.html` · `feasible.html` | **The Machinery** and **The Feasible Region**, the two full courses |
| `quantum-mechanics · qec · logical-qubit · ai · bitcoin · compare` | The explainers |
| `race.html` | Who is actually ahead, and the desk's own forecasts |
| `ledger.html` | Every big claim, scored when its deadline passes |
| `corrections.html` | Where we were wrong |
| `games.js` | The game engines, defined once, mounted in both the Path and the Arcade |
| `nav.js` · `save.js` · `style.css` | Navigation, local progress store, styling |

## Running it locally

No build step, no dependencies: it is plain HTML, CSS and JavaScript.

```bash
python -m http.server 8642
```

Then open http://localhost:8642.

## Licence

Content © SymbiQ. Cited sources belong to their authors.

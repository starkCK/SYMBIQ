# SymbiQ

**Two broken geniuses, fixing each other.**

AI is fixing quantum computing's errors. Quantum will supercharge AI. SymbiQ tracks that loop — daily, at three levels, as a game.

Live at **https://starkck.github.io/symbiq/**

---

## What this is

A static site about the symbiosis between AI and quantum computing — the loop most coverage misses, because it sits between two beats that are usually reported separately.

Everything is written at three levels, and you pick your own:

- 🟢 **Basics** — no math, no jargon
- 🟡 **Concepts** — real terms, light math
- 🔴 **Deep** — actual formalism, with citations

## The rule this project runs on

**Every quantitative claim is verified before it ships**, and the verification is adversarial: a fresh reader tries to break it. Where something is unproven, the page says so — each claim carries an evidence tier:

| Tier | Meaning |
|---|---|
| ⟦Proven⟧ | A theorem, or a measured result with a citation |
| ⟦Heuristic⟧ | Works in practice, no guarantee |
| ⟦Inspired⟧ | A faithful analogy, not the real mechanism |
| ⟦Frontier⟧ | Open question — nobody knows yet |

Interactive pieces are held to the same standard. Every par, probability and threshold in the games was computed offline (usually by exhaustive search or simulation), then re-verified against an independent reimplementation running in the browser. Nothing here is a designer's guess.

Found an error? That pays the biggest reward we offer — see the [Corrections](corrections.html) page. A reader who checks our work is worth more than a reader who trusts it.

## What's in here

| | |
|---|---|
| `index.html` | Home, plus the Daily Question |
| `journey.html` | **The Solver's Path** — the narrative game: map, missions, mentors, saved progress |
| `play.html` | **The Arcade** — the same five games, free play, no story |
| `basics · concepts · deep` | The three tiers |
| `quantum-mechanics · qec · logical-qubit · ai · bitcoin · compare` | The six explainers |
| `race.html` | Who is actually ahead, and our own prediction record |
| `corrections.html` | Where we were wrong |
| `games.js` | All five game engines, defined once, mounted in both the Path and the Arcade |
| `nav.js` · `save.js` · `style.css` | Navigation, local progress store, styling |

## The games

All five are real, not decorative:

- **Circuit Golf** — reach a target qubit state in as few gates as possible. Every par is a *proven minimum*, found by breadth-first search over all gate words.
- **Grover's Escape** — the exit's odds are exactly sin²((2k+1)θ). Over-amplify and they fall again, because Grover is a rotation, not a ratchet.
- **Max-Cut** — NP-hard (Karp 1972); pars brute-forced. District 5 is a deliberate local-optimum trap where no single move helps.
- **The Annealing Volcano** — you play the *cooling schedule*. Scored on 500 replays of your schedule, not the one run you got lucky on.
- **Quantum Tic-Tac-Toe** — Goff's game (*Am. J. Phys.* **74**, 962, 2006). Collapse engine verified on thousands of random entanglement tangles.

## Running it locally

No build step, no dependencies — it is plain HTML, CSS and JavaScript.

```bash
python -m http.server 8642
```

Then open http://localhost:8642.

## Licence

Content © SymbiQ. Cited sources belong to their authors.

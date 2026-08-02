/* SymbiQ — MISSIONS (Phase 1 of outputs/14_GAME_REDESIGN.md §8)
 *
 * A mission is not a widget with a paragraph above it. It is a scene with four
 * beats — ARRIVAL, THE ASK, THE WORK, THE CONSEQUENCE — and the character's
 * flaw is the mechanic, not a sentence in a Cast panel.
 *
 * This file composes two things it does not own:
 *   games.js   the verified engine. Its physics, pars and scoring are untouched.
 *   scene.js   the world layer, the portraits, the sound, the share card.
 *
 * THE RULE (14_ §9): the scene wraps the mount and never reaches inside it.
 * One clarification, because this file gets close to the line. A mission may
 * DRIVE the engine through the same controls a player uses — a framed choice
 * that dispatches a click on the engine's own Amplify or Measure button is
 * input, exactly as a finger is. What it must never do is write engine state,
 * read a threshold, or change what counts as a win. It does none of those. The
 * engine talks back through `onState`, which is strictly outbound.
 *
 * API:  SymbiQ.missions.list              -> metadata
 *       SymbiQ.missions.mount(id, el, o)  -> run one; o.onExit fires on leave
 */
(function () {
  'use strict';
  window.SymbiQ = window.SymbiQ || {};
  var M = {};

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function node(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  /* ==================================================================== *
   *  ACT II — RUE — GROVER'S ESCAPE                                      *
   *                                                                      *
   *  Rue wants to be FAST, and speed past the peak loses the answer.     *
   *  Over-rotation is real: after k steps the exit sits at exactly       *
   *  sin²((2k+1)θ), which climbs to a peak near k ≈ (π/4)√N and then     *
   *  FALLS. So at the top she says "one more and it's a certainty" and   *
   *  she is wrong, and obeying her is the failure.                       *
   *                                                                      *
   *  The only branch that turns her arc is the one where you tell her    *
   *  she is wrong — which you can only know by understanding the curve.  *
   *  THE PHYSICS GATES THE EMOTION. That is the whole design.            *
   * ==================================================================== */
  M.grover = {
    id: 'grover', engine: 'grover', world: 'corridor', mentor: 'Rue',
    act: 'Act II', place: 'The Locked Corridor',
    title: "Grover's Escape",
    blurb: 'A corridor of identical doors, a way to tilt them all toward the exit — and a mentor who will tell you to go one step too far.',

    run: function (C) {
      var told = false, defied = false, peakShown = false, done = false;
      var last = { n: 4, k: 0, par: 1, p: 0, best: 0 };
      var rue = null, meter = null;

      /* ---- BEAT 1 — ARRIVAL ------------------------------------------
         You are somewhere and something is wrong. One line, no text wall. */
      function arrival(panel, next) {
        C.scene.titleCard(C.host, {
          act: C.mission.act, word: 'THE LOCKED CORRIDOR',
          line: 'Sixty-four doors. One of them is the way out, and it is the one you must not open yet.',
          ms: 4200
        });
        panel.appendChild(node(
          '<div class="ms-arrive">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<blockquote class="ms-line">Sixty-four doors. I checked thirty of them by hand once.' +
            '<br>I was fast, and it still cost me everything.</blockquote>' +
            '<div class="ms-who">Rue · <span>she has been here before</span></div>' +
            '<button type="button" class="preset ms-go" data-r="go">Go on &#9656;</button>' +
          '</div>'));
        rue = C.scene.portrait(panel.querySelector('[data-r=face]'), 'rue');
        rue.el.classList.add('scene-face--lg');
        rue.mood('troubled', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      /* ---- BEAT 2 — THE ASK ------------------------------------------
         The character wants something and cannot get it herself. The arc
         lives here: Rue is impatient, she is likeable for it, and her
         advice is about to be wrong. */
      function ask(panel, next) {
        panel.appendChild(node(
          '<div class="ms-ask">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<div class="ms-say">' +
              '<p>I built you an <strong>Amplifier</strong>. One pass tilts the whole corridor toward the way out — ' +
              'the right door brightens, every other one dims. It is the closest thing to cheating that is still true.</p>' +
              '<p>Use it. Use it <em>a lot</em>. Then look.</p>' +
            '</div>' +
            '<p class="ms-cost">Looking is a measurement, and a measurement is not free. ' +
            'Every time you open a door you spend <strong>coherence</strong> — so you can always look, and looking is exactly what you cannot afford.</p>' +
            '<button type="button" class="preset ms-go" data-r="go">Take the Amplifier &#9656;</button>' +
          '</div>'));
        rue = C.scene.portrait(panel.querySelector('[data-r=face]'), 'rue');
        rue.el.classList.add('scene-face--lg');
        rue.mood('eager', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      /* ---- BEAT 3 — THE WORK -----------------------------------------
         The verified mechanic, unchanged in physics. What changes: it costs
         something, and the world responds continuously rather than only at
         the win — the corridor's exit glow is bound to the real probability,
         so when you over-rotate you WATCH the light physically dim. */
      function work(panel, next) {
        panel.appendChild(node(
          '<div class="ms-work">' +
            '<div class="ms-hud"><div class="ms-face ms-face-sm" data-r="face"></div>' +
              '<div class="ms-meter" data-r="meter"></div></div>' +
            '<div class="ms-say ms-say-sm" data-r="voice"></div>' +
            '<div data-r="choice"></div>' +
            '<div class="card ms-engine" data-r="engine"></div>' +
          '</div>'));
        rue = C.scene.portrait(panel.querySelector('[data-r=face]'), 'rue');
        rue.mood('eager', 0);
        var voice = panel.querySelector('[data-r=voice]');
        var choice = panel.querySelector('[data-r=choice]');
        var engine = panel.querySelector('[data-r=engine]');
        voice.innerHTML = '<p>Tilt it. I will tell you when to look.</p>';
        if (C.coherence) meter = C.coherence.mountMeter(panel.querySelector('[data-r=meter]'));

        /* Start her in the SIXTY-FOUR-door corridor, because that is the one
           beats 1 and 2 describe. The engine opens on N=4 — fine for the
           Arcade, wrong here twice over: the fiction said sixty-four, and at
           N=4 Grover reaches exactly 100% in one pass, so Rue's "one more and
           it's a certainty" lands on a number that is already certain. At
           N=64 the peak is 99.7% and the next pass drops it to 90.7%, which is
           the fall this whole scene exists to show. Driven by clicking the
           corridor's own chip — input, not a write. */
        setTimeout(function () {
          var chips = engine.querySelectorAll('[data-r=corr] .hole');
          if (chips.length >= 5) chips[4].click();
        }, 0);

        C.games.mount(C.mission.engine, engine, {
          mode: 'mission',
          onWin: function () { /* scoring stays entirely the engine's business */ },
          onState: function (s) {
            last = s;
            // the world reads the same number the game reads
            C.bg.set({ a: s.p, b: s.level / Math.max(1, s.levels - 1) });
            if (s.phase === 'render') {
              C.tone(s.p);
              if (s.k === s.par && !s.measured && !peakShown && !defied) { peakShown = true; peak(); }
              if (s.k !== s.par || s.measured) { choice.innerHTML = ''; }
              if (s.k > s.par && defied) rue.mood('troubled');
            }
            if (s.phase === 'measured' && !done) {
              done = true;
              choice.innerHTML = '';
              if (C.coherence) C.coherence.spend(8, 'You looked — a measurement is never free');
              C.outcome = { escaped: s.escaped, k: s.k, par: s.par, n: s.n, p: s.p,
                            told: told, defied: defied };
              setTimeout(next, 900);
            }
          }
        });

        /* THE MOMENT SHE IS WRONG. Three ways out, and the game must not
           punish the one where you trust her — failure teaches, and a player
           who learns the curve the hard way has still learned it. */
        function peak() {
          rue.mood('eager');
          /* Never claim "one more and it's a certainty" about a number that
             already reads as certain — at N=4 the peak is exactly 100% and the
             line was absurd. She is wrong in both phrasings; only one of them
             is worth reading. */
          var pk = last.p * 100;
          voice.innerHTML = pk >= 99.5
            ? '<p><strong>There.</strong> ' + pk.toFixed(1) + '%. That is as good as open — ' +
              'so one more pass and the corridor is <em>ours</em>.</p>'
            : '<p><strong>There.</strong> Look at it — ' + pk.toFixed(1) +
              '%. One more pass and it is a <em>certainty</em>.</p>';
          choice.innerHTML =
            '<div class="ms-choice">' +
              '<div class="ms-choice-h">She is waiting.</div>' +
              '<button type="button" class="ms-opt" data-o="amp">Amplify once more<span>do as she says</span></button>' +
              '<button type="button" class="ms-opt" data-o="look">Look now<span>stop at the peak</span></button>' +
              '<button type="button" class="ms-opt ms-opt-key" data-o="tell">&ldquo;Rue — it peaks. Look now, or lose it.&rdquo;<span>tell her she is wrong</span></button>' +
            '</div>';
          choice.querySelector('[data-o=amp]').addEventListener('click', function () {
            defied = true; C.click();
            voice.innerHTML = '<p class="ms-quiet">&hellip;</p>';
            rue.mood('troubled');
            drive('[data-a=amp]');
            setTimeout(function () {
              voice.innerHTML = '<p>It went <em>down</em>. It went down. I have never watched that happen.</p>';
            }, 700);
          });
          choice.querySelector('[data-o=look]').addEventListener('click', function () { C.click(); drive('[data-a=measure]'); });
          choice.querySelector('[data-o=tell]').addEventListener('click', function () {
            told = true; C.click();
            rue.mood('narrowed');
            voice.innerHTML = '<p class="ms-quiet">She stops.</p>';
            setTimeout(function () { drive('[data-a=measure]'); }, 620);
          });
        }
        // input, exactly as a finger is — never a write into engine state
        function drive(sel) { var b = engine.querySelector(sel); if (b) b.click(); }
      }

      /* ---- BEAT 4 — THE CONSEQUENCE ----------------------------------
         Something changes and stays changed, and she says a thing she could
         not have said in beat 2. Only the third branch turns the arc. */
      function consequence(panel) {
        var o = C.outcome || { escaped: false, k: 0, par: 1, n: 4, p: 0 };
        var head, body, mood, tag = '';

        if (o.escaped && o.told) {
          mood = 'softened';
          head = 'The corridor opens.';
          body = '<p class="ms-duo">&ldquo;&hellip;how did you know where it stops.&rdquo;</p>' +
                 '<p class="ms-duo">&ldquo;You are the first one who ever told me to stop.&rdquo;</p>';
          tag  = '<div class="ms-codex">Codex entry unlocked — <strong>The Turning Point</strong> ' +
                 '<span class="tier">&#10214;Proven&#10215;</span><br>' +
                 '<span>Amplitude amplification is a <em>rotation</em>, not a ratchet. ' +
                 'After k passes the exit sits at exactly sin&sup2;((2k+1)&theta;) with sin&thinsp;&theta; = 1/&radic;N. ' +
                 'It peaks near k &asymp; (&pi;/4)&radic;N and then falls. Certainty is not reachable, and trying harder is how you lose it.</span></div>';
        } else if (o.escaped && o.defied) {
          mood = 'troubled';
          head = 'Out — but not because she was right.';
          body = '<p>You rotated past the peak and the draw covered for you. Rue saw the number fall and has gone very quiet.</p>' +
                 '<p class="ms-note">The exit was at <strong>' + (o.p * 100).toFixed(1) + '%</strong> when you looked. ' +
                 'At the peak it was higher. The corridor does not care how fast you are.</p>';
        } else if (o.escaped) {
          mood = 'eager';
          head = 'Out, and cleanly.';
          body = '<p>You stopped where the curve stops. Rue is delighted and has not yet noticed what that implies about her own advice.</p>';
        } else if (o.defied) {
          mood = 'troubled';
          head = 'Wrong door.';
          body = '<p>You amplified past the peak and the odds fell to <strong>' + (o.p * 100).toFixed(1) + '%</strong> before you looked.</p>' +
                 '<p class="ms-note">Nothing is lost. This is the lesson the corridor exists to teach, and you have now watched it happen ' +
                 'rather than read it: <strong>one more pass can make it worse.</strong></p>';
        } else {
          mood = 'troubled';
          head = 'Wrong door.';
          body = '<p>Even at the peak a measurement is a weighted draw. You had <strong>' + (o.p * 100).toFixed(1) +
                 '%</strong> and drew the other side of it.</p>' +
                 '<p class="ms-note">That is the physics, not the game being unfair — which is exactly why you load the dice before you roll them.</p>';
        }

        panel.appendChild(node(
          '<div class="ms-end">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<h3 class="ms-endh">' + head + '</h3>' +
            '<div class="ms-say">' + body + '</div>' + tag +
            '<div data-r="share"></div>' +
            '<p class="ms-again"><button type="button" class="preset" data-r="again">Walk it again</button> ' +
            '<button type="button" class="preset" data-r="exit">Leave the corridor</button></p>' +
          '</div>'));
        rue = C.scene.portrait(panel.querySelector('[data-r=face]'), 'rue');
        rue.el.classList.add('scene-face--lg');
        rue.mood(mood, 0);
        if (C.coherence && o.escaped) C.coherence.restore(18, 'Insight — you learned where the curve turns');

        // the frame worth keeping: score, seed, evidence tier and URL burned in
        C.scene.shareCard({
          eyebrow: 'Act II · The Locked Corridor',
          title: o.escaped ? "I found the exit in " + o.k + " " + (o.k === 1 ? 'pass' : 'passes')
                           : "The corridor kept its door",
          stat: (o.p * 100).toFixed(1) + '%',
          statNote: o.k === o.par
            ? 'the exit at the peak of sin²((2k+1)θ) — one more pass and it falls'
            : 'where I chose to look. The peak was at pass ' + o.par + '.',
          line: o.told ? '"You are the first one who ever told me to stop."' : null,
          tier: '⟦Proven⟧', seed: 'N=' + o.n, file: 'symbiq-grover'
        }).mount(panel.querySelector('[data-r=share]'));

        panel.querySelector('[data-r=again]').addEventListener('click', function () { C.restart(); });
        panel.querySelector('[data-r=exit]').addEventListener('click', function () { C.exit(); });
      }

      return { arrival: arrival, ask: ask, work: work, consequence: consequence };
    }
  };

  /* -------------------------------------------------------------------- */
  window.SymbiQ.missions = {
    all: M,
    list: ['grover'].map(function (k) {
      return { id: k, title: M[k].title, act: M[k].act, place: M[k].place,
               mentor: M[k].mentor, blurb: M[k].blurb };
    }),
    get: function (id) { return M[id]; },

    mount: function (id, host, opts) {
      var m = M[id], S = window.SymbiQ.scene, GS = window.SymbiQ.games;
      if (!m || !host || !S || !GS) return false;
      opts = opts || {};

      host.className = 'scene-host mission-scene';
      host.innerHTML = '';
      var bg = S.background(host, m.world, { seed: m.id, a: 0 });
      S.bindCoherence();

      var C = {
        mission: m, host: host, scene: S, games: GS, bg: bg,
        coherence: window.SymbiQ.coherence || null,
        outcome: null,
        click: function () { S.audio.click(); },
        // Grover hears its own mistake: the pitch rises with the amplitude and
        // FALLS on over-rotation, so you hear the error before you read it.
        tone: function (p) { S.audio.tone(220 + 520 * Math.max(0, Math.min(1, p)), 190); },
        exit: function () {
          try { bg.destroy(); } catch (e) {}
          host.innerHTML = ''; host.className = '';
          if (typeof opts.onExit === 'function') opts.onExit(id);
        },
        restart: function () { window.SymbiQ.missions.mount(id, host, opts); }
      };

      var beats = m.run(C);
      var seq = S.sequence(host, beats, { onEnd: function () {} });
      seq.start();

      // a sound toggle, off until asked, parked where it does not shout
      var bar = document.createElement('div');
      bar.className = 'ms-bar';
      host.appendChild(bar);
      S.audio.mountToggle(bar);
      return true;
    }
  };
})();

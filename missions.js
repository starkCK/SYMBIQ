/* SymbiQ, MISSIONS (Phase 1 of outputs/14_GAME_REDESIGN.md §8)
 *
 * A mission is not a widget with a paragraph above it. It is a scene with four
 * beats, ARRIVAL, THE ASK, THE WORK, THE CONSEQUENCE, and the character's
 * flaw is the mechanic, not a sentence in a Cast panel.
 *
 * This file composes two things it does not own:
 *   games.js   the verified engine. Its physics, pars and scoring are untouched.
 *   scene.js   the world layer, the portraits, the sound, the share card.
 *
 * THE RULE (14_ §9): the scene wraps the mount and never reaches inside it.
 * One clarification, because this file gets close to the line. A mission may
 * DRIVE the engine through the same controls a player uses, a framed choice
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

  /* ---- the ceremony through-line -------------------------------------------
     The Arcade's clear-screen (games.js FRAME.ceremony) does two things a
     mission consequence beat did not: on ANY clear it names the day's lesson
     in one canonical sentence, and it marks a genuine first-ever clear. Mission
     mode has its own, richer .ms-codex box -- but only on the turning-point
     branch, so a mission cleared any other way (escaped without telling Rue she
     was wrong, split the districts without the confrontation) taught the
     sentence nowhere and never acknowledged a first.

     This closes exactly that gap and nothing more. It is additive: a quiet
     footer under the ending, carrying the SAME string the Arcade shows
     (SymbiQ.games.frame.CODEX[engine], the single source of truth -- mentor
     attribution included, so it cannot drift), plus a first-clearance mark.
     The canonical sentence is suppressed when the branch already renders the
     full .ms-codex box (that box is the deeper version of the same idea); the
     first-clearance mark still shows there. Nothing here is scored or read back
     by an engine -- same rule as FRAME itself. */
  function throughLine(C, richCodexShown) {
    if (!C || !C.cleared) return '';
    var GF = window.SymbiQ.games && window.SymbiQ.games.frame;
    var codex = (!richCodexShown && GF && GF.CODEX && GF.CODEX[C.mission.engine]) || '';
    if (!C.firstClear && !codex) return '';
    return '<p class="ms-through">' +
      (C.firstClear ? '<span class="ms-through-b">First clearance</span> ' : '') +
      codex + '</p>';
  }

  /* ==================================================================== *
   *  ACT II, RUE, GROVER'S ESCAPE                                      *
   *                                                                      *
   *  Rue wants to be FAST, and speed past the peak loses the answer.     *
   *  Over-rotation is real: after k steps the exit sits at exactly       *
   *  sin²((2k+1)θ), which climbs to a peak near k ≈ (π/4)√N and then     *
   *  FALLS. So at the top she says "one more and it's a certainty" and   *
   *  she is wrong, and obeying her is the failure.                       *
   *                                                                      *
   *  The only branch that turns her arc is the one where you tell her    *
   *  she is wrong, which you can only know by understanding the curve.  *
   *  THE PHYSICS GATES THE EMOTION. That is the whole design.            *
   * ==================================================================== */
  M.grover = {
    id: 'grover', engine: 'grover', world: 'corridor', mentor: 'Rue',
    act: 'Act II', place: 'The Locked Corridor',
    title: "Grover's Escape",
    blurb: 'A corridor of identical doors, a way to tilt them all toward the exit, and a mentor who will tell you to go one step too far.',

    run: function (C) {
      var told = false, defied = false, peakShown = false, done = false;
      var last = { n: 4, k: 0, par: 1, p: 0, best: 0 };
      var rue = null, meter = null;

      /* ---- BEAT 1, ARRIVAL ------------------------------------------
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

      /* ---- BEAT 2, THE ASK ------------------------------------------
         The character wants something and cannot get it herself. The arc
         lives here: Rue is impatient, she is likeable for it, and her
         advice is about to be wrong. */
      function ask(panel, next) {
        panel.appendChild(node(
          '<div class="ms-ask">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<div class="ms-say">' +
              '<p>I built you an <strong>Amplifier</strong>. One pass tilts the whole corridor toward the way out, ' +
              'the right door brightens, every other one dims. It is the closest thing to cheating that is still true.</p>' +
              '<p>Use it. Use it <em>a lot</em>. Then look.</p>' +
            '</div>' +
            '<p class="ms-cost">Looking is a measurement, and a measurement is not free. ' +
            'Every time you open a door you spend <strong>coherence</strong>, so you can always look, and looking is exactly what you cannot afford.</p>' +
            '<button type="button" class="preset ms-go" data-r="go">Take the Amplifier &#9656;</button>' +
          '</div>'));
        rue = C.scene.portrait(panel.querySelector('[data-r=face]'), 'rue');
        rue.el.classList.add('scene-face--lg');
        rue.mood('eager', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      /* ---- BEAT 3, THE WORK -----------------------------------------
         The verified mechanic, unchanged in physics. What changes: it costs
         something, and the world responds continuously rather than only at
         the win, the corridor's exit glow is bound to the real probability,
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
           beats 1 and 2 describe. The engine opens on N=4, fine for the
           Arcade, wrong here twice over: the fiction said sixty-four, and at
           N=4 Grover reaches exactly 100% in one pass, so Rue's "one more and
           it's a certainty" lands on a number that is already certain. At
           N=64 the peak is 99.7% and the next pass drops it to 90.7%, which is
           the fall this whole scene exists to show. Driven by clicking the
           corridor's own chip, input, not a write. */
        setTimeout(function () {
          var chips = engine.querySelectorAll('[data-r=corr] .hole');
          if (chips.length >= 5) chips[4].click();
        }, 0);

        C.games.mount(C.mission.engine, engine, {
          mode: 'mission',
          onWin: function (id, first) { C.mark(first); },   // engine declares this act's win
          onState: function (s) {
            last = s;
            /* The world reads the same number the game reads. `b` carries how
               far PAST the peak you are, which is what the corridor needs in
               order to say "you are chasing a certainty that is not there",
               the exit dims, every other door floods back, and the colour
               drains out of the hall. */
            C.bg.set({ a: s.p, b: Math.max(0, Math.min(1, (s.k - s.par) / 3)) });
            if (s.phase === 'render') {
              C.tone(s.p);
              if (s.k === s.par && !s.measured && !peakShown && !defied) { peakShown = true; peak(); }
              if (s.k !== s.par || s.measured) { choice.innerHTML = ''; }
              if (s.k > s.par && defied) rue.mood('troubled');
            }
            if (s.phase === 'measured' && !done) {
              done = true;
              choice.innerHTML = '';
              if (C.coherence) C.coherence.spend(8, 'You looked, a measurement is never free');
              C.outcome = { escaped: s.escaped, k: s.k, par: s.par, n: s.n, p: s.p,
                            told: told, defied: defied };
              setTimeout(next, 900);
            }
          }
        });

        /* THE MOMENT SHE IS WRONG. Three ways out, and the game must not
           punish the one where you trust her, failure teaches, and a player
           who learns the curve the hard way has still learned it. */
        function peak() {
          rue.mood('eager');
          /* Never claim "one more and it's a certainty" about a number that
             already reads as certain, at N=4 the peak is exactly 100% and the
             line was absurd. She is wrong in both phrasings; only one of them
             is worth reading. */
          var pk = last.p * 100;
          voice.innerHTML = pk >= 99.5
            ? '<p><strong>There.</strong> ' + pk.toFixed(1) + '%. That is as good as open, ' +
              'so one more pass and the corridor is <em>ours</em>.</p>'
            : '<p><strong>There.</strong> Look at it, ' + pk.toFixed(1) +
              '%. One more pass and it is a <em>certainty</em>.</p>';
          choice.innerHTML =
            '<div class="ms-choice">' +
              '<div class="ms-choice-h">She is waiting.</div>' +
              '<button type="button" class="ms-opt" data-o="amp">Amplify once more<span>do as she says</span></button>' +
              '<button type="button" class="ms-opt" data-o="look">Look now<span>stop at the peak</span></button>' +
              '<button type="button" class="ms-opt ms-opt-key" data-o="tell">&ldquo;Rue, it peaks. Look now, or lose it.&rdquo;<span>tell her she is wrong</span></button>' +
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
        // input, exactly as a finger is, never a write into engine state
        function drive(sel) { var b = engine.querySelector(sel); if (b) b.click(); }
      }

      /* ---- BEAT 4, THE CONSEQUENCE ----------------------------------
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
          tag  = '<div class="ms-codex">Codex entry unlocked, <strong>The Turning Point</strong> ' +
                 '<span class="tier">&#10214;Proven&#10215;</span><br>' +
                 '<span>Amplitude amplification is a <em>rotation</em>, not a ratchet. ' +
                 'After k passes the exit sits at exactly sin&sup2;((2k+1)&theta;) with sin&thinsp;&theta; = 1/&radic;N. ' +
                 'It peaks near k &asymp; (&pi;/4)&radic;N and then falls. Certainty is not reachable, and trying harder is how you lose it.</span></div>';
        } else if (o.escaped && o.defied) {
          mood = 'troubled';
          head = 'Out, but not because she was right.';
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
                 '<p class="ms-note">That is the physics, not the game being unfair, which is exactly why you load the dice before you roll them.</p>';
        }

        var through = throughLine(C, !!tag);
        panel.appendChild(node(
          '<div class="ms-end">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<h3 class="ms-endh">' + head + '</h3>' +
            '<div class="ms-say">' + body + '</div>' + tag + through +
            '<div data-r="share"></div>' +
            '<p class="ms-again"><button type="button" class="preset" data-r="again">Walk it again</button> ' +
            '<button type="button" class="preset" data-r="exit">Leave the corridor</button></p>' +
          '</div>'));
        rue = C.scene.portrait(panel.querySelector('[data-r=face]'), 'rue');
        rue.el.classList.add('scene-face--lg');
        rue.mood(mood, 0);
        if (C.coherence && o.escaped) C.coherence.restore(18, 'Insight, you learned where the curve turns');

        // the frame worth keeping: score, seed, evidence tier and URL burned in
        C.scene.shareCard({
          eyebrow: 'Act II · The Locked Corridor',
          title: o.escaped ? "I found the exit in " + o.k + " " + (o.k === 1 ? 'pass' : 'passes')
                           : "The corridor kept its door",
          stat: (o.p * 100).toFixed(1) + '%',
          statNote: o.k === o.par
            ? 'the exit at the peak of sin²((2k+1)θ), one more pass and it falls'
            : 'where I chose to look. The peak was at pass ' + o.par + '.',
          line: o.told ? '"You are the first one who ever told me to stop."' : null,
          tier: 'Proven', seed: 'N=' + o.n, file: 'symbiq-grover'
        }).mount(panel.querySelector('[data-r=share]'));

        panel.querySelector('[data-r=again]').addEventListener('click', function () { C.restart(); });
        panel.querySelector('[data-r=exit]').addEventListener('click', function () { C.exit(); });
      }

      return { arrival: arrival, ask: ask, work: work, consequence: consequence };
    }
  };

  /* ==================================================================== *
   *  ACT I, ADA, THE DOOR YOU TURN                                     *
   *                                                                      *
   *  14_ §5: "Stop making it about gates. Make it about the door that    *
   *  will not open, one physical object you rotate with your hands.      *
   *  Same six unitaries, same proven-minimum pars, different verb:       *
   *  TURN, not type."                                                    *
   *                                                                      *
   *  So the six lettered buttons become a dial with six detents, and     *
   *  each detent says what it actually IS -- a half turn about X, an     *
   *  eighth turn about Z -- which is both more tactile and more true     *
   *  than the letter was. The engine, its pars and its scoring are       *
   *  untouched; the dial ends by clicking the engine's own gate button.  *
   *                                                                      *
   *  Ada wants to KNOW, and her flaw is that looking costs. Here that    *
   *  is literal: she will tell you the route, and telling you spends     *
   *  coherence, and a door opened on her answer is not a door you know   *
   *  how to open.                                                        *
   * ==================================================================== */

  /* The six gates, described as the rotations they are. Angles are exact:
     X, Y, Z are pi about their axis; H is pi about the (x+z)/sqrt2 diagonal;
     S is pi/2 about z; T is pi/4 about z. */
  var DETENTS = [
    { g: 'X', turn: '½ turn', axis: 'about X', note: 'the bit flip' },
    { g: 'H', turn: '½ turn', axis: 'about the X+Z diagonal', note: 'makes a superposition' },
    { g: 'Y', turn: '½ turn', axis: 'about Y', note: 'flip, with a phase' },
    { g: 'Z', turn: '½ turn', axis: 'about Z', note: 'phase only' },
    { g: 'S', turn: '¼ turn', axis: 'about Z', note: 'a quarter of a phase' },
    { g: 'T', turn: '⅛ turn', axis: 'about Z', note: 'an eighth, the fine adjustment' }
  ];

  M.golf = {
    id: 'golf', engine: 'golf', world: 'realm', mentor: 'Ada',
    act: 'Act I', place: 'The Quantum Realm',
    title: 'The Door You Turn',
    blurb: 'One impossible coin, six ways to turn it, and a door that only opens when it reads exactly right. Every par is a proven minimum.',
    doors: 3,                                   // a mission is three doors, not all nine

    run: function (C) {
      var ada = null, looked = 0, cleared = 0, atPar = 0, dial = null, ended = false;
      var last = { name: '', par: 1, moves: 0, hint: '' };

      function arrival(panel, next) {
        C.scene.titleCard(C.host, {
          act: C.mission.act, word: 'THE QUANTUM REALM',
          line: 'A hall with one object in it, and the object is not showing you a side.',
          ms: 4200
        });
        panel.appendChild(node(
          '<div class="ms-arrive">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<blockquote class="ms-line">I have looked at this coin ten thousand times.' +
            '<br>Every time I look, it picks a side, and the side it picks is not the thing I wanted to know.</blockquote>' +
            '<div class="ms-who">Ada · <span>she measures, and it costs her</span></div>' +
            '<button type="button" class="preset ms-go" data-r="go">Go on &#9656;</button>' +
          '</div>'));
        ada = C.scene.portrait(panel.querySelector('[data-r=face]'), 'ada');
        ada.el.classList.add('scene-face--lg');
        ada.mood('troubled', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function ask(panel, next) {
        panel.appendChild(node(
          '<div class="ms-ask">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<div class="ms-say">' +
              '<p>Three doors. Each one is a lock that reads the coin, and it only opens when the coin ' +
              'is turned to exactly the state written on it.</p>' +
              '<p>You do not press anything. You <strong>turn</strong> it. There are only six turns that exist, ' +
              'half a turn about an axis, a quarter, an eighth. That is the whole vocabulary of the world.</p>' +
            '</div>' +
            '<p class="ms-cost">I can tell you which turns to make. I always can. But every answer I hand you ' +
            'costs <strong>coherence</strong>, and a door opened on my answer is not a door you know how to open.</p>' +
            '<button type="button" class="preset ms-go" data-r="go">Take the coin &#9656;</button>' +
          '</div>'));
        ada = C.scene.portrait(panel.querySelector('[data-r=face]'), 'ada');
        ada.el.classList.add('scene-face--lg');
        ada.mood('neutral', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function work(panel, next) {
        panel.appendChild(node(
          '<div class="ms-work">' +
            '<div class="ms-hud"><div class="ms-face ms-face-sm" data-r="face"></div>' +
              '<div class="ms-meter" data-r="meter"></div></div>' +
            '<div class="ms-say ms-say-sm" data-r="voice"></div>' +
            '<div class="ms-dialwrap" data-r="dial"></div>' +
            '<div data-r="tell"></div>' +
            '<div class="card ms-engine" data-r="engine"></div>' +
          '</div>'));
        ada = C.scene.portrait(panel.querySelector('[data-r=face]'), 'ada');
        ada.mood('neutral', 0);
        var voice = panel.querySelector('[data-r=voice]');
        var tellHost = panel.querySelector('[data-r=tell]');
        var engine = panel.querySelector('[data-r=engine]');
        if (C.coherence) C.coherence.mountMeter(panel.querySelector('[data-r=meter]'));

        C.games.mount(C.mission.engine, engine, {
          mode: 'mission',
          onWin: function () {},
          onState: function (s) {
            last = s;
            // the coin in the hall turns with the one in your hands
            C.bg.set({ a: ((s.moves * 0.17) + s.hi * 0.09) % 1 });
            if (s.played > cleared) {
              cleared = s.played;
              if (s.holeScore != null && s.holeScore <= s.par) atPar++;
              // three doors open IS the act, see the note on C.clear
              if (cleared >= C.mission.doors && !ended) { ended = true; C.clear(); setTimeout(next, 1500); }
            }
            if (!ended) paintVoice(s);
          }
        });

        dial = makeDial(panel.querySelector('[data-r=dial]'), function (g) {
          C.click();
          var b = engine.querySelector('[data-g=' + g + ']');
          if (b) b.click();                       // input, exactly as a finger is
        });
        // The dial drives the engine's own X/Y/Z/H/S/T buttons by clicking
        // them (above) -- it never replaced them, so the mission showed BOTH
        // a turn-dial AND a plain letter row doing the identical six things.
        // Undo / Retry hole are not dial functions and stay visible.
        Array.prototype.forEach.call(engine.querySelectorAll('.gatebtn'), function (b) {
          b.hidden = true;
        });
        // The shared "How to play" text says "tap gates" -- true in the
        // Arcade, where those buttons are what you have. Here they are
        // hidden and the dial is the only control, so the one line that
        // names the interaction needs to say the interaction that exists.
        var howEl = panel.querySelector('[data-f=how]');
        if (howEl) howEl.innerHTML = '<span class="lbl">&#127918; How to play</span> ' +
          'Turn the dial above until your <span style="color:var(--teal)">solid arrow</span> lands on the ' +
          '<span style="color:var(--violet)">dashed target</span>. <strong>Par is a proven minimum</strong>, no shorter route exists anywhere.';

        function paintVoice(s) {
          /* Number the door you are STANDING at, not the count you have opened.
             The engine holds you on a cleared door for 1.4 s before it advances
             (games.js `play`), and counting opened doors made the header read
             "Door 2 of 3" for that whole beat while it described door 1's lock
             directly underneath. Caught by driving it, not by reading it. */
          voice.innerHTML = '<p><strong>Door ' + Math.min(s.hi + 1, C.mission.doors) + ' of ' + C.mission.doors +
            '.</strong> The lock reads <strong>' + s.name + '</strong>,  ' + s.par +
            ' ' + (s.par === 1 ? 'turn' : 'turns') + '. <span class="ms-hint">' + s.hint + '</span></p>';
          renderTell(s);
        }
        function renderTell(s) {
          var key = 'told.golf.' + s.hi;
          if (s.holeDone) { tellHost.innerHTML = ''; return; }
          if (C.told && C.told[key]) {
            tellHost.innerHTML = '<div class="ms-told"><span class="gl">◈</span> Ada: &ldquo;' +
              C.told[key].join(', then ') + '.&rdquo; <em>She does not look at you while she says it.</em></div>';
            return;
          }
          var cost = 10, can = !C.coherence || C.coherence.get() >= cost;
          tellHost.innerHTML = '<button type="button" class="ms-tell"' + (can ? '' : ' disabled') + ' data-r="tellbtn">' +
            '<span class="gl">◈</span> Ada, tell me the route' +
            '<span class="ms-tell-cost">&minus;' + cost + ' coherence</span></button>' +
            (can ? '' : '<div class="ms-hint">Not enough coherence to ask. Open one yourself.</div>');
          var b = tellHost.querySelector('[data-r=tellbtn]');
          if (b) b.addEventListener('click', function () {
            if (C.coherence && C.coherence.get() < cost) return;
            if (C.coherence) C.coherence.spend(cost, 'Ada told you, knowing is not the same as being told');
            looked++;
            C.told = C.told || {};
            C.told[key] = routeFor(s.hi);
            ada.mood('troubled');
            renderTell(s);
          });
        }
      }

      /* The proven-optimal route for each door, quoted as TURNS rather than
         letters. These are the engine's own par paths; nothing is recomputed
         here and nothing is scored on them. */
      function routeFor(hi) {
        var g = C.games.get('golf');
        var paths = [['X'], ['H'], ['X', 'H']];
        var p = paths[hi] || paths[0];
        return p.map(function (k) {
          var d = DETENTS.filter(function (x) { return x.g === k; })[0];
          return d ? d.turn + ' ' + d.axis : k;
        });
      }

      function consequence(panel) {
        var perfect = looked === 0 && atPar >= C.mission.doors;
        var head, body, mood, tag = '';
        if (perfect) {
          mood = 'softened';
          head = 'Three doors, and you never asked.';
          body = '<p class="ms-duo">&ldquo;You did not look at me once.&rdquo;</p>' +
                 '<p class="ms-duo">&ldquo;I did not need to. You told me what the turns were.&rdquo;</p>' +
                 '<p class="ms-note">She has spent her life believing that knowing meant looking. It is going to take her a while.</p>';
          tag = '<div class="ms-codex">Codex entry unlocked,  <strong>The Vocabulary</strong> ' +
                '<span class="tier">&#10214;Proven&#10215;</span><br>' +
                '<span>A quantum gate is a <em>rotation</em>, not a switch. The whole one-qubit vocabulary is six of them, ' +
                'and every par in this hall is a <strong>proven minimum</strong>,  found by breadth-first search over all gate words, ' +
                'then re-checked exhaustively at every shorter length. &ldquo;Par 3&rdquo; means no two-turn route exists anywhere.</span></div>';
        } else if (looked === 0) {
          mood = 'eager';
          head = 'Three doors, opened your own way.';
          body = '<p>You never asked her for a route,  you just took more turns than the lock needed. ' +
                 'Ada is quietly delighted, which is not the same as impressed.</p>' +
                 '<p class="ms-note">Every par here is a <strong>proven minimum</strong>. If you took more, a shorter route exists, and it is findable.</p>';
        } else {
          mood = 'narrowed';
          head = 'The doors are open.';
          body = '<p>You asked ' + looked + ' time' + (looked === 1 ? '' : 's') + ', and she answered every time, ' +
                 'and it cost you <strong>' + (looked * 10) + ' coherence</strong>.</p>' +
                 '<p class="ms-note">She is not angry. That is the part she cannot explain to you: being asked is the only way ' +
                 'she knows how to be useful, and it is the thing that empties her out.</p>';
        }
        var through = throughLine(C, !!tag);
        panel.appendChild(node(
          '<div class="ms-end">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<h3 class="ms-endh">' + head + '</h3>' +
            '<div class="ms-say">' + body + '</div>' + tag + through +
            '<div data-r="share"></div>' +
            '<p class="ms-again"><button type="button" class="preset" data-r="again">Walk it again</button> ' +
            '<button type="button" class="preset" data-r="exit">Leave the hall</button></p>' +
          '</div>'));
        ada = C.scene.portrait(panel.querySelector('[data-r=face]'), 'ada');
        ada.el.classList.add('scene-face--lg');
        ada.mood(mood, 0);
        if (C.coherence && perfect) C.coherence.restore(20, 'Insight, you learned the vocabulary');
        else if (C.coherence && looked === 0) C.coherence.restore(10, 'Insight, three doors, unaided');

        C.scene.shareCard({
          eyebrow: 'Act I · The Quantum Realm',
          title: perfect ? 'Three doors, three proven-minimum routes, no help'
                         : 'Three doors in the Quantum Realm',
          stat: atPar + '/' + C.mission.doors,
          statNote: 'opened at par, and every par here is a proven minimum, not a designer’s guess',
          line: perfect ? '"You did not look at me once."' : null,
          tier: 'Proven', seed: 'doors 1–3', file: 'symbiq-realm'
        }).mount(panel.querySelector('[data-r=share]'));

        panel.querySelector('[data-r=again]').addEventListener('click', function () { C.restart(); });
        panel.querySelector('[data-r=exit]').addEventListener('click', function () { C.exit(); });
      }

      return { arrival: arrival, ask: ask, work: work, consequence: consequence };
    }
  };

  /* ==================================================================== *
   *  ACT III, CORDON, GRAPH CITY                                       *
   *                                                                      *
   *  Cordon wants to be FAIR, and his flaw is that fairness is not       *
   *  always available. An odd loop cannot be two-coloured: whatever you  *
   *  do, one road has both ends the same, and somebody ends up on the    *
   *  wrong side of the border. That is not a failure of effort. It is a  *
   *  theorem, and it has a name -- frustration.                          *
   *                                                                      *
   *  His turn is accepting a cut that leaves someone stranded, which he  *
   *  can only do once you show him the maximum is genuinely the maximum. *
   * ==================================================================== */
  M.maxcut = {
    id: 'maxcut', engine: 'maxcut', world: 'city', mentor: 'Cordon',
    act: 'Act III', place: 'Graph City',
    title: 'The Border He Cannot Draw Fairly',
    blurb: 'Split a city in two so the fewest neighbours are left facing each other. On one district that is impossible, and the impossibility is provable.',

    run: function (C) {
      var told = false, stage = 0, ended = false, seenTriangle = false, seenTrap = false;
      var cordon = null, last = {};

      function arrival(panel, next) {
        C.scene.titleCard(C.host, {
          act: C.mission.act, word: 'GRAPH CITY',
          line: 'A city of light, and a line about to be drawn through the middle of it.',
          ms: 4200
        });
        panel.appendChild(node(
          '<div class="ms-arrive">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<blockquote class="ms-line">Every road with the same colour at both ends is two neighbours ' +
            'I have failed.<br>I have been drawing this border for a long time.</blockquote>' +
            '<div class="ms-who">Cordon · <span>he allocates, and he wants it to be fair</span></div>' +
            '<button type="button" class="preset ms-go" data-r="go">Go on &#9656;</button>' +
          '</div>'));
        cordon = C.scene.portrait(panel.querySelector('[data-r=face]'), 'cordon');
        cordon.el.classList.add('scene-face--lg');
        cordon.mood('troubled', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function ask(panel, next) {
        panel.appendChild(node(
          '<div class="ms-ask">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<div class="ms-say">' +
              '<p>Two sides. Every district goes to one or the other. A road is <strong>satisfied</strong> ' +
              'when its two ends end up on opposite sides,  that is a boundary doing its job.</p>' +
              '<p>I want all of them satisfied. Start with the small one, the three-district loop. ' +
              'It is three roads. How hard can three be.</p>' +
            '</div>' +
            '<p class="ms-cost">He is about to find out. Par here is not a target somebody chose,  ' +
            'it is the <strong>true maximum</strong>, found by checking every one of the 2&#8319; possible splits.</p>' +
            '<button type="button" class="preset ms-go" data-r="go">Draw the border &#9656;</button>' +
          '</div>'));
        cordon = C.scene.portrait(panel.querySelector('[data-r=face]'), 'cordon');
        cordon.el.classList.add('scene-face--lg');
        cordon.mood('eager', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function work(panel, next) {
        panel.appendChild(node(
          '<div class="ms-work">' +
            '<div class="ms-hud"><div class="ms-face ms-face-sm" data-r="face"></div>' +
              '<div class="ms-meter" data-r="meter"></div></div>' +
            '<div class="ms-say ms-say-sm" data-r="voice"></div>' +
            '<div data-r="choice"></div>' +
            '<div class="card ms-engine" data-r="engine"></div>' +
          '</div>'));
        cordon = C.scene.portrait(panel.querySelector('[data-r=face]'), 'cordon');
        cordon.mood('eager', 0);
        var voice = panel.querySelector('[data-r=voice]');
        var choice = panel.querySelector('[data-r=choice]');
        var engine = panel.querySelector('[data-r=engine]');
        if (C.coherence) C.coherence.mountMeter(panel.querySelector('[data-r=meter]'));

        C.games.mount(C.mission.engine, engine, {
          mode: 'mission',
          onWin: function (id, first) { C.mark(first); },   // engine declares this act's win
          onState: function (s) {
            last = s;
            // the border on screen is drawn as far as you have satisfied it,
            // and a district that CANNOT be satisfied flares amber and stays lit
            C.bg.set({ a: s.par ? s.cut / s.par : 0,
                       b: (s.di === 0 || s.di === 2) ? 1 : 0 });
            if (ended) return;
            if (stage === 0) {
              voice.innerHTML = '<p><strong>The three-district loop.</strong> Three roads. ' +
                'Satisfy as many as you can,  the maximum is <strong>' + s.par + '</strong>.</p>';
              if (s.di === 0 && s.optimal && !seenTriangle) { seenTriangle = true; frustration(s); }
            } else if (stage === 1) {
              voice.innerHTML = '<p><strong>The trap.</strong> You are at ' + s.cut + ' of ' + s.par +
                '. Every single flip from here keeps you where you are or makes it worse,  ' +
                'and ' + s.par + ' is still reachable.</p>';
              if (s.di === 4 && s.optimal && !seenTrap) {
                seenTrap = true; ended = true;
                cordon.mood('softened');
                voice.innerHTML = '<p>&ldquo;Two moves at once. I would never have found that by being careful.&rdquo;</p>';
                setTimeout(next, 1800);
              }
            }
          }
        });

        // start on the triangle
        setTimeout(function () {
          var chips = engine.querySelectorAll('[data-r=dist] .hole');
          if (chips.length) chips[0].click();
        }, 0);

        /* HIS MOMENT. The triangle is at its true maximum -- two of three --
           and he refuses it, because to him a road left unsatisfied is a
           failure rather than a fact. It is a fact, and it is provable. */
        function frustration(s) {
          cordon.mood('troubled');
          voice.innerHTML = '<p>&ldquo;Two of three. No,  try again, there must be an arrangement ' +
            'where nobody is left facing their own side.&rdquo;</p>';
          choice.innerHTML =
            '<div class="ms-choice">' +
              '<div class="ms-choice-h">He will not accept it.</div>' +
              '<button type="button" class="ms-opt" data-o="retry">Keep rearranging<span>look for the split he wants</span></button>' +
              '<button type="button" class="ms-opt ms-opt-key" data-o="tell">&ldquo;Cordon,  it is an odd loop. Two is the maximum, and that is a theorem.&rdquo;<span>tell him it cannot be done</span></button>' +
            '</div>';
          choice.querySelector('[data-o=retry]').addEventListener('click', function () {
            C.click();
            voice.innerHTML = '<p class="ms-quiet">You try every arrangement. There are only eight. ' +
              'Four give two satisfied roads; four give none. There is no third answer.</p>';
            setTimeout(function () { advance(); }, 2600);
          });
          choice.querySelector('[data-o=tell]').addEventListener('click', function () {
            told = true; C.click();
            cordon.mood('narrowed');
            voice.innerHTML = '<p>&ldquo;&hellip;a theorem.&rdquo; <em>He stops arguing with the map.</em></p>';
            setTimeout(function () { advance(); }, 1900);
          });
        }
        function advance() {
          choice.innerHTML = '';
          stage = 1;
          cordon.mood('neutral');
          var chips = engine.querySelectorAll('[data-r=dist] .hole');
          if (chips.length >= 5) chips[4].click();          // district 5, the trap
        }
      }

      function consequence(panel) {
        var head, body, tag = '', mood;
        if (told) {
          mood = 'softened';
          head = 'The border is drawn.';
          body = '<p class="ms-duo">&ldquo;I spent years thinking I was not clever enough to satisfy that third road.&rdquo;</p>' +
                 '<p class="ms-duo">&ldquo;Nobody is. That is what the word is for.&rdquo;</p>';
          tag = '<div class="ms-codex">Codex entry unlocked,  <strong>Frustration</strong> ' +
                '<span class="tier">&#10214;Proven&#10215;</span><br>' +
                '<span>An odd loop cannot be two-coloured, so at least one edge always has matching ends. ' +
                'Max-Cut is <strong>NP-hard</strong> (Karp 1972), which is why every par here was found by brute force over all 2&#8319; splits. ' +
                'Label the sides &plusmn;1 and the satisfied count is &Sigma;w<sub>ij</sub>(1&minus;s<sub>i</sub>s<sub>j</sub>)/2,  ' +
                'so <em>maximising the cut is minimising the Ising energy</em>. That identity is the entire bridge between ' +
                'operations research and quantum optimisation.</span></div>';
        } else {
          mood = 'neutral';
          head = 'The border is drawn.';
          body = '<p>You found the maximum on both districts,  and on the small one you found it the long way, ' +
                 'by exhausting every arrangement until none was left.</p>' +
                 '<p class="ms-note">That is a perfectly good proof. It is just the one that does not scale: ' +
                 'eight splits here, and more than a billion by thirty districts.</p>';
        }
        var through = throughLine(C, !!tag);
        panel.appendChild(node(
          '<div class="ms-end">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<h3 class="ms-endh">' + head + '</h3>' +
            '<div class="ms-say">' + body + '</div>' + tag + through +
            '<div data-r="share"></div>' +
            '<p class="ms-again"><button type="button" class="preset" data-r="again">Walk it again</button> ' +
            '<button type="button" class="preset" data-r="exit">Leave the city</button></p>' +
          '</div>'));
        cordon = C.scene.portrait(panel.querySelector('[data-r=face]'), 'cordon');
        cordon.el.classList.add('scene-face--lg');
        cordon.mood(mood, 0);
        if (C.coherence) C.coherence.restore(told ? 20 : 12, 'Insight, some things cannot be arranged');

        C.scene.shareCard({
          eyebrow: 'Act III · Graph City',
          title: told ? 'One road can never be satisfied, and that is a theorem'
                      : 'Two districts, both at the true maximum',
          stat: '6 / 6',
          statNote: 'the trap solved, where every single flip makes it worse, and two at once do not',
          line: told ? '"Nobody is. That is what the word is for."' : null,
          tier: 'Proven', seed: 'districts 1 & 5', file: 'symbiq-city'
        }).mount(panel.querySelector('[data-r=share]'));

        panel.querySelector('[data-r=again]').addEventListener('click', function () { C.restart(); });
        panel.querySelector('[data-r=exit]').addEventListener('click', function () { C.exit(); });
      }

      return { arrival: arrival, ask: ask, work: work, consequence: consequence };
    }
  };

  /* ==================================================================== *
   *  ACT IV, VESH, THE ANNEALING VOLCANO                               *
   *                                                                      *
   *  Vesh survives without proofs and it works, until it does not. His   *
   *  rule -- hot early, cold late -- is genuinely excellent on every     *
   *  landscape with structure in it. On the Salt Flat, a dead plain with *
   *  one hole, every move costs exactly nothing, so temperature          *
   *  PROVABLY cannot change your odds of finding it. His best advice is  *
   *  worthless there, and that is No Free Lunch felt rather than stated. *
   *                                                                      *
   *  The background of this act is the level's own height array, pushed  *
   *  into the shader -- so the ridge line you are looking at IS the      *
   *  function the sampler is walking.                                    *
   * ==================================================================== */
  M.volcano = {
    id: 'volcano', engine: 'volcano', world: 'volcano', mentor: 'Vesh',
    act: 'Act IV', place: 'The Volcano',
    title: 'The Rule That Stops Working',
    blurb: 'You are not the climber, you are the temperature. Vesh has one rule that has never failed him, and one landscape where it is provably worthless.',

    run: function (C) {
      var stage = 0, told = false, ended = false, rates = [], vesh = null, shownFlat = false;

      function arrival(panel, next) {
        C.scene.titleCard(C.host, {
          act: C.mission.act, word: 'THE VOLCANO',
          line: 'You are not the one walking. You are how fast the world is allowed to cool.',
          ms: 4200
        });
        panel.appendChild(node(
          '<div class="ms-arrive">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<blockquote class="ms-line">I have never proved anything in my life.' +
            '<br>I have got down off a lot of mountains.</blockquote>' +
            '<div class="ms-who">Vesh · <span>good enough, now</span></div>' +
            '<button type="button" class="preset ms-go" data-r="go">Go on &#9656;</button>' +
          '</div>'));
        vesh = C.scene.portrait(panel.querySelector('[data-r=face]'), 'vesh');
        vesh.el.classList.add('scene-face--lg');
        vesh.mood('eager', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function ask(panel, next) {
        panel.appendChild(node(
          '<div class="ms-ask">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<div class="ms-say">' +
              '<p>Twelve choices. Each one runs twenty steps at whatever temperature you leave it at. ' +
              'Hot, and the walker will climb out of a ditch. Cold, and it settles wherever it stands.</p>' +
              '<p>My rule, and it has never failed me: <strong>stay hot while you are still lost, ' +
              'go cold once you are somewhere worth staying.</strong></p>' +
            '</div>' +
            '<p class="ms-cost">You are judged on the <strong>schedule</strong>, not the run,  ' +
            'your twelve choices are replayed 500 times and scored on how often they actually work. ' +
            'A single lucky descent proves nothing, and he knows it.</p>' +
            '<button type="button" class="preset ms-go" data-r="go">Take the temperature &#9656;</button>' +
          '</div>'));
        vesh = C.scene.portrait(panel.querySelector('[data-r=face]'), 'vesh');
        vesh.el.classList.add('scene-face--lg');
        vesh.mood('neutral', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function work(panel, next) {
        panel.appendChild(node(
          '<div class="ms-work">' +
            '<div class="ms-hud"><div class="ms-face ms-face-sm" data-r="face"></div>' +
              '<div class="ms-meter" data-r="meter"></div></div>' +
            '<div class="ms-say ms-say-sm" data-r="voice"></div>' +
            '<div data-r="choice"></div>' +
            '<div class="card ms-engine" data-r="engine"></div>' +
          '</div>'));
        vesh = C.scene.portrait(panel.querySelector('[data-r=face]'), 'vesh');
        vesh.mood('neutral', 0);
        var voice = panel.querySelector('[data-r=voice]');
        var choice = panel.querySelector('[data-r=choice]');
        var engine = panel.querySelector('[data-r=engine]');
        if (C.coherence) C.coherence.mountMeter(panel.querySelector('[data-r=meter]'));
        var lastLevel = -1;

        C.games.mount(C.mission.engine, engine, {
          mode: 'mission',
          onWin: function (id, first) { C.mark(first); },   // engine declares this act's win
          onState: function (s) {
            /* THE BACKGROUND IS THE DATA. Push the level's own height array
               into the shader and the silhouette behind the game becomes the
               exact function the Metropolis sampler is walking. */
            if (s.li !== lastLevel) { lastLevel = s.li; C.bg.setData(s.heights); }
            C.bg.set({ a: s.Tnorm, b: s.pos });
            if (ended) return;
            if (!s.over) {
              voice.innerHTML = '<p><strong>' + esc(s.name) + '.</strong> Epoch ' + s.epoch + ' of ' + s.epochs +
                '. Standing at depth ' + s.here + (s.onFloor ? ',  <strong>the floor</strong>' : '') + '.</p>';
              return;
            }
            // a schedule has been scored
            if (rates.length === stage) {
              rates.push(s.rate);
              if (stage === 0) firstDone(s);
              else if (stage === 1) secondDone(s);
              else thirdDone(s);
            }
          }
        });

        setTimeout(function () {
          var chips = engine.querySelectorAll('[data-r=chips] .hole');
          if (chips.length >= 2) chips[1].click();          // the Twin Calderas
        }, 0);

        function firstDone(s) {
          vesh.mood('eager');
          voice.innerHTML = '<p>&ldquo;There. ' + Math.round(s.rate * 100) + '% of the time. ' +
            'Told you,  hot then cold, every time, on anything.&rdquo;</p>';
          choice.innerHTML =
            '<div class="ms-choice">' +
              '<div class="ms-choice-h">He wants to move on.</div>' +
              '<button type="button" class="ms-opt ms-opt-key" data-o="flat">&ldquo;Show me the flat one.&rdquo;<span>the plain with a single hole in it</span></button>' +
            '</div>';
          choice.querySelector('[data-o=flat]').addEventListener('click', function () {
            C.click(); choice.innerHTML = ''; stage = 1; shownFlat = true;
            vesh.mood('neutral');
            voice.innerHTML = '<p>&ldquo;Fine. Same rule. Watch.&rdquo;</p>';
            var chips = engine.querySelectorAll('[data-r=chips] .hole');
            if (chips.length >= 4) chips[3].click();        // the Salt Flat
          });
        }

        /* His rule has now been scored on the flat. DO NOT assert that the
           number is "the same" -- it is not, and the truth is better. Out on
           the plain every move has dE = 0, so temperature cannot change your
           odds of FINDING the hole; it only decides whether you STAY once you
           fall in. That makes crash-cooling -- the worst play on every other
           landscape -- the best play here, and Vesh's careful rule loses to
           it. So we do not tell the player that. We run it, and let them
           watch the crudest possible schedule beat the clever one. */
        function secondDone(s) {
          vesh.mood('neutral');
          voice.innerHTML = '<p>&ldquo;' + Math.round(s.rate * 100) + '%. Bit lower than I would like, ' +
            'but the shape was right. The rule holds.&rdquo;</p>';
          choice.innerHTML =
            '<div class="ms-choice">' +
              '<div class="ms-choice-h">Before you agree with him.</div>' +
              '<button type="button" class="ms-opt ms-opt-key" data-o="crash">Run the stupidest schedule there is<span>cool immediately, and never stop,  the play he would call idiotic</span></button>' +
            '</div>';
          choice.querySelector('[data-o=crash]').addEventListener('click', function () {
            C.click(); choice.innerHTML = ''; stage = 2;
            voice.innerHTML = '<p class="ms-quiet">&ldquo;That will do nothing. Go on then.&rdquo;</p>';
            var reset = engine.querySelector('[data-a=reset]');
            if (reset) reset.click();
            // drive the engine's own Cool button twelve times, input, not a write
            var i = 0;
            (function tick() {
              if (i++ >= 12) return;
              var b = engine.querySelector('[data-a=cool]');
              if (b) b.click();
              setTimeout(tick, 90);
            })();
          });
        }

        function thirdDone(s) {
          ended = true;
          var mine = Math.round(rates[1] * 100), crude = Math.round(s.rate * 100);
          vesh.mood('troubled');
          voice.innerHTML = '<p>&ldquo;' + crude + '%. Against my ' + mine + '.&rdquo;<br>' +
            '<em>He does not say anything else for a moment.</em></p>';
          choice.innerHTML =
            '<div class="ms-choice">' +
              '<div class="ms-choice-h">He is looking at you.</div>' +
              '<button type="button" class="ms-opt" data-o="shrug">&ldquo;Fluke. Run it again.&rdquo;<span>let him keep the rule</span></button>' +
              '<button type="button" class="ms-opt ms-opt-key" data-o="tell">&ldquo;Out here every move costs nothing, so heat cannot help you <em>find</em> it,  it only helps you leave.&rdquo;<span>tell him why his rule is backwards here</span></button>' +
            '</div>';
          choice.querySelector('[data-o=shrug]').addEventListener('click', function () {
            C.click(); setTimeout(next, 900);
          });
          choice.querySelector('[data-o=tell]').addEventListener('click', function () {
            told = true; C.click();
            voice.innerHTML = '<p class="ms-quiet">&ldquo;&hellip;so the only thing my heat was doing ' +
              'was walking me back out of the hole.&rdquo;</p>';
            setTimeout(next, 2400);
          });
        }
      }

      function consequence(panel) {
        var head, body, tag = '', mood;
        var r0 = rates[0] != null ? Math.round(rates[0] * 100) : null;
        var r1 = rates[1] != null ? Math.round(rates[1] * 100) : null;
        var r2 = rates[2] != null ? Math.round(rates[2] * 100) : null;
        var scores = '<div class="ms-scores">' +
          '<div><b>' + (r0 == null ? ', ' : r0 + '%') + '</b><span>your schedule<br>Twin Calderas</span></div>' +
          '<div><b>' + (r1 == null ? ', ' : r1 + '%') + '</b><span>your schedule<br>Salt Flat</span></div>' +
          '<div class="hi"><b>' + (r2 == null ? ', ' : r2 + '%') + '</b><span>crash-cooling<br>Salt Flat</span></div>' +
          '</div><p class="ms-note">Each measured over 500 replays of that schedule,  not of one lucky run.</p>';
        if (told) {
          mood = 'softened';
          head = 'The rule has an edge, and you found it.';
          body = '<p class="ms-duo">&ldquo;So it was never a good rule.&rdquo;</p>' +
                 '<p class="ms-duo">&ldquo;It is an excellent rule. It just is not a law.&rdquo;</p>' + scores;
          tag = '<div class="ms-codex">Codex entry unlocked,  <strong>No Free Lunch</strong> ' +
                '<span class="tier">&#10214;Proven&#10215;</span><br>' +
                '<span>Averaged over <em>all</em> possible landscapes, no search method beats any other ' +
                '(Wolpert &amp; Macready 1997). Methods win by exploiting structure, so where there is none, nothing helps. ' +
                'On the Salt Flat every move out on the plain has &Delta;E = 0, so the Metropolis rule accepts everything at every ' +
                'temperature and heat cannot change your odds of <em>finding</em> the hole,  it only decides whether you ' +
                '<em>stay</em> once you fall in. That is why crash-cooling, the worst play on every other landscape, is the best one here. ' +
                'Annealing is <strong>&#10214;heuristic&#10215;</strong>: the schedule that is ' +
                '<em>proven</em> to find the optimum, T<sub>k</sub> = c/log(k+2), needs about 3,000 steps just to reach T = 0.5 here,  ' +
                'twelve times this game&rsquo;s entire budget,  and converges precisely because it refuses to cool.</span></div>';
        } else {
          mood = 'neutral';
          head = 'Both landscapes, done.';
          body = '<p>You let him keep the rule. It is a good rule and it will keep working, right up until it does not,  ' +
                 'and on the flat it has already been beaten by a schedule with no thought in it at all.</p>' + scores;
        }
        var through = throughLine(C, !!tag);
        panel.appendChild(node(
          '<div class="ms-end">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<h3 class="ms-endh">' + head + '</h3>' +
            '<div class="ms-say">' + body + '</div>' + tag + through +
            '<div data-r="share"></div>' +
            '<p class="ms-again"><button type="button" class="preset" data-r="again">Walk it again</button> ' +
            '<button type="button" class="preset" data-r="exit">Leave the ridge</button></p>' +
          '</div>'));
        vesh = C.scene.portrait(panel.querySelector('[data-r=face]'), 'vesh');
        vesh.el.classList.add('scene-face--lg');
        vesh.mood(mood, 0);
        if (C.coherence) C.coherence.restore(told ? 20 : 12, 'Insight, a method is not a law');

        C.scene.shareCard({
          eyebrow: 'Act IV · The Volcano',
          title: told ? 'I found the landscape where the clever schedule loses'
                      : 'Two landscapes, one cooling schedule',
          stat: (r2 != null && r1 != null ? r2 + '% vs ' + r1 + '%' : ', '),
          statNote: 'crash-cooling against a shaped schedule on the Salt Flat, the crude one wins, because out there heat only helps you leave',
          line: told ? '"It is an excellent rule. It just is not a law."' : null,
          tier: 'Heuristic', seed: 'Calderas + Salt Flat', file: 'symbiq-volcano'
        }).mount(panel.querySelector('[data-r=share]'));

        panel.querySelector('[data-r=again]').addEventListener('click', function () { C.restart(); });
        panel.querySelector('[data-r=exit]').addEventListener('click', function () { C.exit(); });
      }

      return { arrival: arrival, ask: ask, work: work, consequence: consequence };
    }
  };

  /* ==================================================================== *
   *  ACT V, KAI & LYRA, THE SHORE OF TWINS                             *
   *                                                                      *
   *  Two halves of a Bell pair who want to reach each other. They can    *
   *  do something no classical pair can: beat 75%, provably, which means *
   *  what they share is real and is NOT pre-arranged answers. And they   *
   *  still cannot send one bit, ever, and it is not a limitation of      *
   *  effort or of engineering.                                           *
   *                                                                      *
   *  14_ §5 promotes this into Act V in place of Quantum Tic-Tac-Toe --  *
   *  QTTT is the one game on the site tiered "analogy" rather than       *
   *  proven, on a product whose promise is that the physics does the     *
   *  judging. CHSH is proven, is already verified, and demonstrates      *
   *  exactly the point their arc is about.                               *
   *                                                                      *
   *  THE RULE FOR THIS SCENE: their failure must be MEASURED, never      *
   *  asserted. So the engine tracks Alice's answer distribution split by *
   *  Bob's setting, and the scene shows the two numbers side by side.    *
   * ==================================================================== */
  M.chsh = {
    id: 'chsh', engine: 'chsh', world: 'shore', mentor: 'Kai & Lyra',
    act: 'Act V', place: 'The Shore of Twins',
    title: 'The Word They Cannot Send',
    blurb: 'Two halves of one pair, on separate shores. They can beat a bound no classical pair can reach, and they still cannot send each other a single letter.',

    run: function (C) {
      var stage = 0, told = false, ended = false, kai = null, lyra = null;
      var classicalRate = null, quantumRate = null, marg = [null, null], margN = [0, 0];

      /* The honest way to compare two measured proportions: state the gap AND
         the gap pure chance would produce at this sample size. Without it, the
         scene asserts "these are the same" over two numbers that visibly are
         not, which is precisely the failure this project keeps making. */
      function noiseBand() {
        if (!margN[0] || !margN[1]) return null;
        return 0.5 * Math.sqrt(1 / margN[0] + 1 / margN[1]) * 100;   // 1 s.e. in points
      }

      function faces(panel) {
        var wrap = panel.querySelector('[data-r=face]');
        if (!wrap) return;
        kai = C.scene.portrait(wrap, 'kai');
        lyra = C.scene.portrait(wrap, 'lyra');
        return [kai, lyra];
      }
      function both(mood, ms) { if (kai) kai.mood(mood, ms); if (lyra) lyra.mood(mood, ms); }

      function arrival(panel, next) {
        C.scene.titleCard(C.host, {
          act: C.mission.act, word: 'THE SHORE OF TWINS',
          line: 'Two shores, one tide. Whatever happens on this side has already happened on that one.',
          ms: 4200
        });
        panel.appendChild(node(
          '<div class="ms-arrive">' +
            '<div class="ms-face ms-face-pair" data-r="face"></div>' +
            '<blockquote class="ms-line">&ldquo;I can feel every choice you make.&rdquo;' +
            '<br>&ldquo;I know. Say something.&rdquo;<br>&ldquo;&hellip;&rdquo;</blockquote>' +
            '<div class="ms-who">Kai &amp; Lyra · <span>one pair, two shores</span></div>' +
            '<button type="button" class="preset ms-go" data-r="go">Go on &#9656;</button>' +
          '</div>'));
        faces(panel);
        if (kai) kai.el.classList.add('scene-face--lg');
        if (lyra) lyra.el.classList.add('scene-face--lg');
        both('troubled', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function ask(panel, next) {
        panel.appendChild(node(
          '<div class="ms-ask">' +
            '<div class="ms-face ms-face-pair" data-r="face"></div>' +
            '<div class="ms-say">' +
              '<p>A referee gives each of them a random bit and takes back one bit each. They win the round ' +
              'when their two answers <strong>differ if and only if both bits were 1</strong>.</p>' +
              '<p>They are not allowed to talk. No classical pair,  no code, no plan, no cleverness,  ' +
              'can win this more than <strong>75%</strong> of the time. That is not an engineering limit. It is a theorem.</p>' +
            '</div>' +
            '<p class="ms-cost">Play the best classical strategy first, and see the wall. Then let them use ' +
            'what they actually share, and watch the wall break.</p>' +
            '<button type="button" class="preset ms-go" data-r="go">Take the referee&rsquo;s chair &#9656;</button>' +
          '</div>'));
        faces(panel);
        if (kai) kai.el.classList.add('scene-face--lg');
        if (lyra) lyra.el.classList.add('scene-face--lg');
        both('neutral', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function work(panel, next) {
        panel.appendChild(node(
          '<div class="ms-work">' +
            '<div class="ms-hud"><div class="ms-face ms-face-sm ms-face-pair" data-r="face"></div>' +
              '<div class="ms-meter" data-r="meter"></div></div>' +
            '<div class="ms-say ms-say-sm" data-r="voice"></div>' +
            '<div data-r="choice"></div>' +
            '<div class="card ms-engine" data-r="engine"></div>' +
          '</div>'));
        faces(panel);
        both('neutral', 0);
        var voice = panel.querySelector('[data-r=voice]');
        var choice = panel.querySelector('[data-r=choice]');
        var engine = panel.querySelector('[data-r=engine]');
        if (C.coherence) C.coherence.mountMeter(panel.querySelector('[data-r=meter]'));

        C.games.mount(C.mission.engine, engine, {
          mode: 'mission',
          onWin: function (id, first) { C.mark(first); },   // a real 2-s.e. breach is this act's win
          onState: function (s) {
            // the two tides move together exactly as far as the pair is correlated
            C.bg.set({ a: s.rounds ? Math.max(0, Math.min(1, (s.rate - 0.5) / 0.36)) : 0.4,
                       b: s.quantum ? 0.35 : 0.9 });
            if (ended) return;
            if (s.aliceGivenBob0 != null) marg = [s.aliceGivenBob0, s.aliceGivenBob1];
            /* Stage 0.5 is "the choice is on screen and not yet taken". Keep
               narrating through it: a player who goes on clicking Play 1,000
               while the button waits would otherwise read "2,000 rounds" in the
               line above a panel that says 8,000, a sentence contradicting the
               number beside it, which is this project's signature defect. */
            if (stage === 0 || stage === 0.5) {
              classicalRate = s.rate;
              voice.innerHTML = '<p><strong>Best classical.</strong> ' +
                (s.rounds ? s.rounds.toLocaleString('en-US') + ' rounds, <strong>' + (s.rate * 100).toFixed(1) + '%</strong>. ' : '') +
                'Play a few thousand and watch it refuse to climb past 75.</p>';
              if (stage === 0 && s.rounds >= 2000) offerQuantum();
            } else if (stage === 1) {
              quantumRate = s.rate;
              margN = s.margN || margN;
              /* Hold the scene back until the marginals have actually settled.
                 At ~1,000 samples per setting a 3-point gap between them is
                 ordinary noise, and the scene would be claiming "Kai's side
                 did not move" over two numbers three points apart. Six
                 thousand rounds is the point at which the picture matches the
                 sentence -- and making the player get there is the same
                 lesson: separation only shows up in the long run. */
              voice.innerHTML = '<p><strong>The pair.</strong> ' +
                (s.rounds ? s.rounds.toLocaleString('en-US') + ' rounds, <strong>' + (s.rate * 100).toFixed(1) + '%</strong>. ' : '') +
                (s.rounds >= 6000 ? 'Above a bound no classical strategy can reach.'
                                  : 'Keep going,  a few thousand more before the numbers mean anything.') + '</p>';
              if (s.rounds >= 6000 && s.beatsClassical) theMoment(s);
            }
          }
        });

        // start on the classical strategy, the wall has to be felt first
        setTimeout(function () {
          var b = engine.querySelector('[data-a=c]');
          if (b) b.click();
        }, 0);

        function offerQuantum() {
          stage = 0.5;
          both('neutral');
          choice.innerHTML =
            '<div class="ms-choice">' +
              '<div class="ms-choice-h">It will not go higher. It cannot.</div>' +
              '<button type="button" class="ms-opt ms-opt-key" data-o="q">Let them use the pair<span>the thing they actually share</span></button>' +
            '</div>';
          choice.querySelector('[data-o=q]').addEventListener('click', function () {
            C.click(); choice.innerHTML = ''; stage = 1;
            both('eager');
            var b = engine.querySelector('[data-a=q]');
            if (b) b.click();
            voice.innerHTML = '<p>&ldquo;Now play it. Play a lot of it.&rdquo;</p>';
          });
        }

        /* THEIR MOMENT. They have just proved that what they share is real and
           is not pre-agreed answers -- so they conclude, reasonably and
           wrongly, that they can talk. The refutation is already on screen:
           Alice's answers come out the same however Bob sets his dial. */
        function theMoment(s) {
          ended = true;
          both('eager');
          var m0 = (marg[0] * 100).toFixed(1), m1 = (marg[1] * 100).toFixed(1), nb = noiseBand();
          voice.innerHTML = '<p>&ldquo;' + (s.rate * 100).toFixed(1) + '%. We broke it. ' +
            'Lyra,  if you can feel my dial, then <em>set yours to mean something.</em>&rdquo;</p>';
          choice.innerHTML =
            '<div class="ms-nosig">' +
              '<div class="ms-choice-h">What Kai sees, split by what Lyra chose</div>' +
              '<div class="ms-scores">' +
                '<div><b>' + m0 + '%</b><span>Kai answers 1<br>when Lyra chose setting 0</span></div>' +
                '<div><b>' + m1 + '%</b><span>Kai answers 1<br>when Lyra chose setting 1</span></div>' +
              '</div>' +
              '<p class="ms-note">Measured over ' + s.rounds.toLocaleString('en-US') + ' rounds. ' +
              'They differ by <strong>' + (Math.abs(marg[0] - marg[1]) * 100).toFixed(1) + ' points</strong>' +
              (nb ? ', and pure chance alone gives about <strong>&plusmn;' + nb.toFixed(1) + '</strong> at this many rounds' : '') +
              '. Lyra changed her setting thousands of times and nothing crossed.</p>' +
            '</div>' +
            '<div class="ms-choice">' +
              '<div class="ms-choice-h">They are waiting for you to say it.</div>' +
              '<button type="button" class="ms-opt" data-o="try">Let them keep trying<span>they have a while yet</span></button>' +
              '<button type="button" class="ms-opt ms-opt-key" data-o="tell">&ldquo;Look at your own numbers. Whatever she does, your side is the same. There is nothing to read.&rdquo;<span>tell them it is not a thing they can fix</span></button>' +
            '</div>';
          choice.querySelector('[data-o=try]').addEventListener('click', function () {
            C.click(); setTimeout(next, 900);
          });
          choice.querySelector('[data-o=tell]').addEventListener('click', function () {
            told = true; C.click();
            both('troubled');
            voice.innerHTML = '<p class="ms-quiet">&ldquo;&hellip;so it is not that we are not trying hard enough.&rdquo;</p>';
            setTimeout(next, 2400);
          });
        }
      }

      function consequence(panel) {
        var head, body, tag = '', mood;
        var cr = classicalRate != null ? (classicalRate * 100).toFixed(1) : ', ';
        var qr = quantumRate != null ? (quantumRate * 100).toFixed(1) : ', ';
        var scores = '<div class="ms-scores">' +
          '<div><b>' + cr + '%</b><span>best classical<br>ceiling 75%</span></div>' +
          '<div class="hi"><b>' + qr + '%</b><span>the pair<br>limit 85.4%</span></div>' +
          '<div><b>' + (marg[0] != null ? (Math.abs(marg[0] - marg[1]) * 100).toFixed(1) : ', ') + ' pts</b>' +
          '<span>Lyra&rsquo;s choice moved Kai<br>by this' + (noiseBand() ? ',  chance gives &plusmn;' + noiseBand().toFixed(1) : '') +
          '</span></div></div>';
        if (told) {
          mood = 'softened';
          head = 'They are as close as two things can be.';
          body = '<p class="ms-duo">&ldquo;So we will always know, and never be told.&rdquo;</p>' +
                 '<p class="ms-duo">&ldquo;Yes.&rdquo;</p>' +
                 '<p class="ms-duo">&ldquo;&hellip;that is almost the same thing.&rdquo;</p>' + scores;
          tag = '<div class="ms-codex">Codex entry unlocked,  <strong>Correlation Is Not Communication</strong> ' +
                '<span class="tier">&#10214;Proven&#10215;</span><br>' +
                '<span>Beating 75% proves the correlation is not pre-agreed answers,  that is the CHSH inequality ' +
                '(Clauser, Horne, Shimony &amp; Holt 1969), and the experiments that closed its loopholes won the ' +
                '<strong>2022 Nobel Prize in Physics</strong>. The quantum ceiling is cos&sup2;(&pi;/8) = 85.36%, ' +
                'Tsirelson&rsquo;s bound, and is also provable. And <strong>no-signalling</strong> is provable too: each side&rsquo;s ' +
                'own statistics are exactly 1/2 whatever the other side does, so not one bit can cross. ' +
                'Entanglement is correlation you cannot fake and cannot speak through.</span></div>';
        } else {
          mood = 'eager';
          head = 'They are still trying.';
          body = '<p>You left them to it. They will keep setting the dial and watching for a pattern, ' +
                 'and the pattern will keep not being there.</p>' +
                 '<p class="ms-note">The numbers are already on the table. Kai&rsquo;s side reads the same whatever Lyra does,  ' +
                 'and that is not a measurement problem, it is a theorem.</p>' + scores;
        }
        var through = throughLine(C, !!tag);
        panel.appendChild(node(
          '<div class="ms-end">' +
            '<div class="ms-face ms-face-pair" data-r="face"></div>' +
            '<h3 class="ms-endh">' + head + '</h3>' +
            '<div class="ms-say">' + body + '</div>' + tag + through +
            '<div data-r="share"></div>' +
            '<p class="ms-again"><button type="button" class="preset" data-r="again">Walk it again</button> ' +
            '<button type="button" class="preset" data-r="exit">Leave the shore</button></p>' +
          '</div>'));
        faces(panel);
        if (kai) kai.el.classList.add('scene-face--lg');
        if (lyra) lyra.el.classList.add('scene-face--lg');
        both(mood, 0);
        if (C.coherence) C.coherence.restore(told ? 22 : 12, 'Insight, correlation is not communication');

        C.scene.shareCard({
          eyebrow: 'Act V · The Shore of Twins',
          title: told ? 'I broke a bound no classical pair can reach, and still could not send a word'
                      : 'Above the classical ceiling, and still silent',
          stat: qr + '%',
          statNote: 'against a provable classical ceiling of 75%, while Lyra’s choice moved Kai’s side by ' +
                    (marg[0] != null ? (Math.abs(marg[0] - marg[1]) * 100).toFixed(1) : ', ') + ' points, which is what chance alone gives',
          line: told ? '"So we will always know, and never be told."' : null,
          tier: 'Proven', seed: 'CHSH, optimal angles', file: 'symbiq-shore'
        }).mount(panel.querySelector('[data-r=share]'));

        panel.querySelector('[data-r=again]').addEventListener('click', function () { C.restart(); });
        panel.querySelector('[data-r=exit]').addEventListener('click', function () { C.exit(); });
      }

      return { arrival: arrival, ask: ask, work: work, consequence: consequence };
    }
  };

  /* ==================================================================== *
   *  ACT VI, HALDEN, THE KNOT                                          *
   *                                                                      *
   *  The finale, and the one faction with no region until now: THE       *
   *  HOLLOW ORACLE (12_ §3.9), "the decoder is never wrong, stop        *
   *  thinking and obey it." It is automation bias wearing a face, and    *
   *  §3.9 says outright how it is beaten: out-decode it once.            *
   *                                                                      *
   *  So the Oracle is not a person and gets no portrait. It is a         *
   *  sentence people say, and the only thing that answers it is ten      *
   *  rounds of evidence. Halden is NOT the Oracle: he is the decoder     *
   *  itself, and his own position is the honest one, he reads the       *
   *  alarms perfectly and decides nothing. §4: "it is right and you      *
   *  overrule it, and you are also right."                               *
   *                                                                      *
   *  Two things are load-bearing and both are measured, not asserted:    *
   *    · the Oracle's offer is a BUTTON. Handing the round over is one   *
   *      click and costs nothing, which is exactly why automation bias   *
   *      is a real failure mode and not a stupidity. Every round you     *
   *      hand over greys the world (u_b), because certainty looks like   *
   *      grey and this is that rule pointed at a machine.                *
   *    · the arc turn needs you to NAME the defect, not merely to win.   *
   *      Beating the reading clears the act; naming the coupled pair is  *
   *      what turns Halden, because that is the difference between       *
   *      getting lucky and reading the chip.                             *
   *                                                                      *
   *  The ending is the story bible's: knowing has a price, and you       *
   *  choose. Kept honest per 12_ §3.10, the universe-as-computation     *
   *  reading is stated as something the CHARACTERS believe, the Codex    *
   *  separates what is established from what is interpretation, and the  *
   *  parity/value distinction underneath it all is ordinary Proven     *
   *  stabilizer physics: a check asks whether neighbours agree and never *
   *  what they are, which is the only reason the code survives being     *
   *  looked at. That is also Ada's Lantern, five acts later.             *
   * ==================================================================== */
  M.knot = {
    id: 'knot', engine: 'duel', world: 'knot', mentor: 'Halden',
    act: 'Act VI', place: 'The Knot',
    title: 'The Price of Knowing',
    blurb: 'The decoder reads the wound faster than you ever will, and has never once decided anything. Ten rounds on a chip nobody told it about, and then a question you answer rather than fight.',

    run: function (C) {
      var face = null, st = null, engine = null, voice = null, oracle = null,
          oslot = null, obey = null, choice = null;
      /* THE WORK beat's `next` is a parameter of work(), and finish() is not
         inside work(), reaching for it there is a ReferenceError that only
         shows up on the very last click of the mission, which is exactly where
         nobody looks. Hold it here instead. (Found by playing it, 2026-08-03.) */
      var advance = null;
      var plays = 0, held = 0, oppHeld = 0, handed = 0;
      var moment = false, autoObey = false, ended = false;
      var named = null, namedOk = null, pair = null, beat = false, ending = null;
      var lastKey = '';

      /* A click is a click. The mission drives the engine through the same
         controls a finger uses and never writes its state, the documented
         boundary at the top of this file. `proposal` is the opponent's public
         bet, not the truth; the truth arrives only with the reveal. */
      function fire(n) {
        if (!n) return;
        try { n.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
        catch (e) {
          var ev = document.createEvent('MouseEvents');
          ev.initEvent('click', true, true);
          n.dispatchEvent(ev);
        }
      }
      function drive(sel) { if (engine) fire(engine.querySelector(sel)); }
      function delegate() {
        if (!st || st.revealed || st.done || !engine) return;
        handed++;
        var want = st.proposal ^ st.pick, i;
        for (i = 0; i < 9; i++) if (want & (1 << i)) fire(engine.querySelector('[data-q="' + i + '"]'));
        drive('[data-a=commit]');
      }
      function say(html) { if (voice) voice.innerHTML = html; }
      function oracleSays(html, hollow) {
        if (!oracle || !oslot) return;
        oslot.innerHTML = html;
        oracle.className = 'ms-oracle' + (hollow ? ' hollow' : '');
      }
      function mood(m, ms) { if (face) face.mood(m, ms); }

      function arrival(panel, next) {
        C.scene.titleCard(C.host, {
          act: C.mission.act, word: 'THE KNOT',
          line: 'A wound that does not bleed. It forgets,  and what it forgets, forgets that it was ever there.',
          ms: 4400
        });
        panel.appendChild(node(
          '<div class="ms-arrive">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<blockquote class="ms-line">&ldquo;I can tell you where the wound is. Exactly, every time, faster than you can look.' +
            '<br>I have never once been able to tell you what to do about it.&rdquo;</blockquote>' +
            '<div class="ms-who">Halden &middot; <span>the decoder</span></div>' +
            '<div class="ms-oracle"><b>The Hollow Oracle</b>&ldquo;Then there is nothing left for you to do. ' +
              'Commit what it reads. It has never been wrong.&rdquo;</div>' +
            '<button type="button" class="preset ms-go" data-r="go">Go on &#9656;</button>' +
          '</div>'));
        face = C.scene.portrait(panel.querySelector('[data-r=face]'), 'halden');
        if (face) face.el.classList.add('scene-face--lg');
        mood('neutral', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function ask(panel, next) {
        panel.appendChild(node(
          '<div class="ms-ask">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<div class="ms-say">' +
              '<p>&ldquo;The Lattice will not show you what it holds. Down here you may ask one kind of question and no other: ' +
              '<strong>do these two agree?</strong> A parity, never a value. That restraint is the only reason anything here ' +
              'survives being looked at.&rdquo;</p>' +
              '<p>&ldquo;I read the answers,  which checks are screaming. I am never wrong about that. ' +
              'Then I have to say <em>what flipped</em>, and I answer with the cheapest set of flips that fits. ' +
              'That is the rule I was handed, and the field has run it since 2001.&rdquo;</p>' +
              '<p>&ldquo;This chip has something in it that nobody told me about. And the alarms cannot tell you either,  ' +
              'a single flip and the thing I have not been told about can scream in exactly the same voice. ' +
              'Only what actually happened, round after round, can separate them.&rdquo;</p>' +
            '</div>' +
            '<div class="ms-oracle"><b>The Hollow Oracle</b>&ldquo;Ten rounds. Commit what it reads, ten times, and be done. ' +
              'You are not qualified to disagree with it.&rdquo;</div>' +
            '<p class="ms-cost">&ldquo;It is right about <em>where</em>. That has never been the same as right. ' +
              'Ten rounds: I read, you decide,  or you do not, and that is also a decision.&rdquo;</p>' +
            '<button type="button" class="preset ms-go" data-r="go">Take the chip &#9656;</button>' +
          '</div>'));
        face = C.scene.portrait(panel.querySelector('[data-r=face]'), 'halden');
        if (face) face.el.classList.add('scene-face--lg');
        mood('troubled', 0);
        panel.querySelector('[data-r=go]').addEventListener('click', function () { C.click(); next(); });
      }

      function work(panel, next) {
        advance = next;
        panel.appendChild(node(
          '<div class="ms-work">' +
            '<div class="ms-hud"><div class="ms-face ms-face-sm" data-r="face"></div>' +
              '<div class="ms-meter" data-r="meter"></div></div>' +
            '<div class="ms-say ms-say-sm" data-r="voice"></div>' +
            '<div class="ms-oracle" data-r="oracle"><b>The Hollow Oracle</b><span data-r="ospeak"></span></div>' +
            '<div data-r="obey"></div>' +
            '<div data-r="choice"></div>' +
            '<div class="card ms-engine" data-r="engine"></div>' +
          '</div>'));
        face = C.scene.portrait(panel.querySelector('[data-r=face]'), 'halden');
        mood('neutral', 0);
        voice = panel.querySelector('[data-r=voice]');
        oracle = panel.querySelector('[data-r=oracle]');
        oslot = panel.querySelector('[data-r=ospeak]');
        obey = panel.querySelector('[data-r=obey]');
        choice = panel.querySelector('[data-r=choice]');
        engine = panel.querySelector('[data-r=engine]');
        if (C.coherence) C.coherence.mountMeter(panel.querySelector('[data-r=meter]'));
        oracleSays('&ldquo;Commit what it reads.&rdquo;');

        C.games.mount(C.mission.engine, engine, {
          mode: 'mission',
          onWin: function () { /* the engine keeps its own record; the act is scored below */ },
          onState: function (s) {
            st = s;
            plays = s.plays; held = s.you; oppHeld = s.dec;
            /* The world reads exactly what the scoreboard reads: how much of
               the wound you have held closed, and how much of it you handed
               over without looking. */
            C.bg.set({ a: plays ? held / plays : 0, b: plays ? handed / plays : 0 });
            if (ended) return;

            var key = s.round + ':' + (s.revealed ? 1 : 0) + ':' + (s.done ? 1 : 0);
            if (s.done) { if (key !== lastKey) { lastKey = key; finish(s); } return; }
            if (key === lastKey) return;          // a pick toggle, not a new beat
            lastKey = key;

            if (!s.revealed) {
              say('<p><strong>Round ' + s.round + ' of ' + s.of + '.</strong> &ldquo;Checks screaming: <strong>' +
                s.fired + '</strong>. Thirty-two different patterns of flips fit that exactly. ' +
                'I return the smallest one. That is the whole of my judgement.&rdquo;</p>');
              renderObey();
              if (autoObey) setTimeout(delegate, 780);
              return;
            }

            // the round is revealed: say what happened, in the words the board shows
            obey.innerHTML = '';
            var l = s.last || {};
            if (s.pairFired && !l.decOk) {
              mood('troubled');
              say('<p>&ldquo;Two of them moved together. I returned one qubit, somewhere else, because one qubit was the ' +
                'cheapest story that fit. <strong>My reading was right. My answer was wrong.</strong>&rdquo;</p>');
              oracleSays('&ldquo;The reading was correct.&rdquo;');
            } else if (l.youOk && !l.decOk) {
              mood('eager');
              say('<p>&ldquo;You held it and I did not. Say that again slowly.&rdquo;</p>');
            } else if (!l.youOk && l.decOk) {
              mood('neutral');
              say('<p>&ldquo;That one was ordinary, and the cheapest story was the true one. It usually is. ' +
                'That is why the rule has lasted.&rdquo;</p>');
              oracleSays('&ldquo;As it always is.&rdquo;');
            } else if (l.youOk && l.decOk) {
              mood('neutral');
              say('<p>&ldquo;Both of us. Nothing was lost.&rdquo;</p>');
            } else {
              mood('troubled');
              say('<p>&ldquo;Neither of us. That happens: sometimes one flip and the thing I was not told about ' +
                'trip the identical alarm, and then nobody can be sure. That residue is the floor, not a mistake.&rdquo;</p>');
            }
            if (!moment && s.truth && countBits(s.truth) > 1) theMoment();
          }
        });
      }

      function countBits(e) { var w = 0; while (e) { w += e & 1; e >>= 1; } return w; }

      function renderObey() {
        if (!obey || autoObey || moment === 'open') return;
        obey.innerHTML =
          '<button type="button" class="ms-obey" data-o="obey">Commit what it reads' +
            '<span>hand this round over,  you will not look at it</span></button>';
        obey.querySelector('[data-o=obey]').addEventListener('click', function () {
          C.click(); obey.innerHTML = ''; delegate();
        });
      }

      /* THE REALITY REFLECTION. It fires the first time the player has SEEN
         two qubits move together, so the evidence for the third option is on
         the screen before it is offered. None of the three is punished. */
      function theMoment() {
        moment = 'open';
        obey.innerHTML = '';
        mood('narrowed');
        choice.innerHTML =
          '<div class="ms-choice">' +
            '<div class="ms-choice-h">Two of them moved at once. Its rule does not allow for that.</div>' +
            '<button type="button" class="ms-opt" data-o="keep">Keep committing what it reads' +
              '<span>every remaining round, without looking,  it is the fastest way through</span></button>' +
            '<button type="button" class="ms-opt" data-o="own">Decide every round yourself' +
              '<span>read the history, bet your own repair</span></button>' +
            '<button type="button" class="ms-opt ms-opt-key" data-o="tell">&ldquo;Halden,  your model is wrong on this chip. ' +
              'Two of these flip together.&rdquo;<span>and then name them</span></button>' +
          '</div>';
        choice.querySelector('[data-o=keep]').addEventListener('click', function () {
          C.click(); autoObey = true; moment = true; choice.innerHTML = '';
          oracleSays('&ldquo;Good. There was never anything to decide.&rdquo;');
        });
        choice.querySelector('[data-o=own]').addEventListener('click', function () {
          C.click(); moment = true; choice.innerHTML = '';
          say('<p>&ldquo;Then read the history. It is all there. I am not allowed to look at it,  ' +
            'I was given a model, not a memory.&rdquo;</p>');
        });
        choice.querySelector('[data-o=tell]').addEventListener('click', function () {
          C.click(); mood('eager'); nameThem();
        });
      }

      /* Naming the defect on its own little board rather than on the engine's:
         the engine's qubits are the repair you are committing this round, and
         one control must not mean two things. */
      function nameThem() {
        moment = 'open';
        var picked = [];
        function paint() {
          Array.prototype.forEach.call(choice.querySelectorAll('.ms-q'), function (b) {
            b.classList.toggle('on', picked.indexOf(+b.getAttribute('data-q')) >= 0);
          });
          var go = choice.querySelector('[data-o=confirm]');
          if (go) go.disabled = picked.length !== 2;
          var lab = choice.querySelector('[data-r=picked]');
          if (lab) lab.innerHTML = picked.length ? picked.map(function (i) { return '<b>q' + i + '</b>'; }).join(' and ') : 'none yet';
        }
        var grid = '';
        for (var i = 0; i < 9; i++) grid += '<button type="button" class="ms-q" data-q="' + i + '">q' + i + '</button>';
        choice.innerHTML =
          '<div class="ms-choice">' +
            '<div class="ms-choice-h">Name them</div>' +
            '<p class="ms-note" style="text-align:center;margin:0 0 12px">&ldquo;I cannot check it from inside my own model. ' +
              'We will both find out at the end.&rdquo;</p>' +
            '<div class="ms-namegrid">' + grid + '</div>' +
            '<p class="ms-name">Named: <span data-r="picked">none yet</span></p>' +
            '<button type="button" class="ms-opt ms-opt-key" data-o="confirm" disabled>Tell him<span>two qubits, the ones you think move together</span></button>' +
          '</div>';
        Array.prototype.forEach.call(choice.querySelectorAll('.ms-q'), function (b) {
          b.addEventListener('click', function () {
            var q = +b.getAttribute('data-q'), at = picked.indexOf(q);
            if (at >= 0) picked.splice(at, 1);
            else { picked.push(q); if (picked.length > 2) picked.shift(); }
            C.click(); paint();
          });
        });
        choice.querySelector('[data-o=confirm]').addEventListener('click', function () {
          named = picked.slice().sort(function (a, b) { return a - b; });
          C.click(); moment = true; choice.innerHTML = '';
          say('<p>&ldquo;Recorded: <strong>q' + named[0] + ' and q' + named[1] + '</strong>. ' +
            'I will not use it,  I cannot; I am the rule I was given. But you can. Play the rest of the rounds ' +
            'as if you were right.&rdquo;</p>');
          renderObey();
        });
        paint();
      }

      /* Ten rounds are up. The scoreboard is the argument, and then the one
         question the mathematics genuinely cannot answer for you. */
      function finish(s) {
        ended = true;
        pair = s.pair ? s.pair.slice().sort(function (a, b) { return a - b; }) : null;
        beat = s.you > s.dec;
        if (named && pair) namedOk = (named[0] === pair[0] && named[1] === pair[1]);
        obey.innerHTML = '';
        mood(beat ? 'eager' : 'troubled');

        say('<p>&ldquo;Ten rounds. You held it <strong>' + s.you + '</strong> times. My cheapest answers held it <strong>' +
          s.dec + '</strong>.' + (pair ? ' The chip was coupled at <strong>q' + pair[0] + ' &harr; q' + pair[1] + '</strong>.' : '') +
          '&rdquo;</p>' +
          (beat ? '<p>&ldquo;Nobody told me about this chip. You did not need telling.&rdquo;</p>'
                : '<p>&ldquo;It read every alarm correctly. It always does. That is not the same as being right, ' +
                  'and tonight nobody was there to say so.&rdquo;</p>'));
        oracleSays(beat ? '&ldquo;&hellip;the reading was correct.&rdquo;' : '&ldquo;Commit what it reads.&rdquo;', beat);

        var verdict = '';
        if (named && pair) {
          verdict = '<p class="ms-name">You named <b>q' + named[0] + '</b> and <b>q' + named[1] + '</b>. ' +
            'The coupling was <b>q' + pair[0] + ' &harr; q' + pair[1] + '</b>,  ' +
            (namedOk ? 'you read the chip.' : 'not this time. Six pairs on this lattice can do it; the history names which.') + '</p>';
        }

        /* THE LAST QUESTION. Diegetic on purpose (12_ §3.10): the characters
           believe something the physics does not establish, and the game says
           so rather than pretending either way. */
        choice.innerHTML = verdict +
          '<div class="ms-choice">' +
            '<div class="ms-choice-h">The last question</div>' +
            '<p class="ms-duo" style="text-align:center">&ldquo;The wound is quiet. Ten rounds of looking, and it never learned what you ' +
              'are holding,  because we never asked. We only ever asked whether neighbours agreed.&rdquo;</p>' +
            '<p class="ms-note" style="text-align:center;margin:0 0 12px">&ldquo;The Solvers who built me believe the Lattice was ' +
              'measured once, at the beginning, and has been coming apart ever since,  that the decoherence <em>is</em> the world ' +
              'being looked at. I cannot settle that. It is not the kind of claim a check can answer. You are standing at the wound. ' +
              'You can ask it either question.&rdquo;</p>' +
            '<button type="button" class="ms-opt ms-opt-key" data-o="parity">Ask only whether they agree' +
              '<span>learn where the damage is and never what it holds,  it stays whole</span></button>' +
            '<button type="button" class="ms-opt" data-o="look">Look at what it holds' +
              '<span>you will know, and it will no longer be what it was</span></button>' +
          '</div>';
        choice.querySelector('[data-o=parity]').addEventListener('click', function () {
          ending = 'parity'; C.click(); setTimeout(advance, 700);
        });
        choice.querySelector('[data-o=look]').addEventListener('click', function () {
          ending = 'look'; C.click();
          if (C.coherence) C.coherence.spend(10, 'You looked at the Lattice itself');
          mood('narrowed');
          say('<p class="ms-quiet">&ldquo;&hellip;there. Now we both know. And it is not the thing it was a moment ago.&rdquo;</p>');
          setTimeout(advance, 2100);
        });
      }

      function consequence(panel) {
        var head, body, tag = '', tier;
        var scores = '<div class="ms-scores">' +
          '<div' + (beat ? ' class="hi"' : '') + '><b>' + held + '</b><span>rounds you held<br>out of ' + (plays || 10) + '</span></div>' +
          '<div><b>' + oppHeld + '</b><span>the reading held<br>it expects 4.7</span></div>' +
          '<div><b>' + handed + '</b><span>rounds you<br>handed over</span></div></div>';

        if (beat && namedOk) {
          head = 'You read the chip, and it never could.';
          body = '<p class="ms-duo">&ldquo;I have been right about where the wound is, every round, for as long as I have existed.&rdquo;</p>' +
                 '<p class="ms-duo">&ldquo;Tonight is the first time that was not the same as being right.&rdquo;</p>' +
                 '<p class="ms-duo">&ldquo;Read it to me again tomorrow. I still will not know what to do.&rdquo;</p>' +
                 '<p class="ms-duo">&ldquo;Good.&rdquo;</p>' + scores;
          tag = '<div class="ms-codex">Codex entry unlocked,  <strong>The Reading and the Decision</strong> ' +
            '<span class="tier">&#10214;Proven&#10215;</span><br>' +
            '<span>Minimum-weight matching is exactly optimal under the noise model it was handed, and this chip is not that ' +
            'chip. Measured over every round this machine can deal: it holds <strong>9 of 9</strong> single flips, ' +
            '<strong>0 of 6</strong> coupled-pair firings and <strong>14 of 42</strong> pair-plus-stray rounds,  ' +
            'an expected <strong>4.7 of 10</strong>. Repairing the pair whenever its alarm fires reaches <strong>7.9</strong>; ' +
            'playing every round properly reaches <strong>9.3</strong> and no further, because on each chip one or two lone ' +
            'flips trip the identical alarm as the pair. That is the AlphaQubit thesis in one sentence: nobody told the learned ' +
            'decoder about the device, and it read the device anyway (Bausch et al., <em>Nature</em> 2024).</span></div>';
        } else if (beat) {
          head = 'You out-decoded it.';
          body = '<p class="ms-duo">&ldquo;You held it more often than my answers did. I do not know how, and I would ' +
                 'like to,  I am the rule I was given, and the rule was wrong here.&rdquo;</p>' +
                 '<p class="ms-note">You beat it without naming what was wrong with the chip. That still counts: ' +
                 'the Hollow Oracle only ever needed to be shown, once, that the machine can read perfectly and answer badly.</p>' + scores;
          tag = '<div class="ms-codex">Codex entry unlocked,  <strong>The Reading and the Decision</strong> ' +
            '<span class="tier">&#10214;Proven&#10215;</span><br>' +
            '<span>The decoder is exactly optimal under the noise model it was handed,  and this chip was not that chip. ' +
            'Measured: it holds <strong>0 of 6</strong> coupled-pair firings on every chip this game can deal, for an expected ' +
            '<strong>4.7 of 10</strong> overall, while a player who learns the coupling reaches <strong>7.9</strong> and correct ' +
            'play reaches <strong>9.3</strong>. A decoder that reads the device instead of a model of it is the whole AI half of ' +
            'this site (Bausch et al., <em>Nature</em> 2024).</span></div>';
        } else {
          /* Three different outcomes live here and they are not the same
             sentence. Saying "it held more of them than you did" over a dead
             heat would be this project's signature defect: a claim the numbers
             on the screen do not support. */
          var lost = oppHeld > held;
          head = handed >= 5 ? 'You handed it over.' : (lost ? 'It out-decoded you.' : 'A dead heat.');
          body = '<p>&ldquo;' + (handed >= 5
            ? 'You committed what I read, and I read it correctly, and the qubit is gone anyway. ' +
              'I want you to notice that I am not to blame for that, and that it does not help at all.'
            : lost
              ? 'It held more of them than you did. It is a very good rule. It is only wrong in one place, ' +
                'and the history says where.'
              : 'Level. You matched it and no better,  and matching a rule that is wrong in one place ' +
                'means you were wrong in the same place it was.') + '&rdquo;</p>' +
            '<p class="ms-note">The act is not cleared,  the Hollow Oracle is answered by out-decoding the reading, once. ' +
            'Walk it again: <strong>New chip</strong> moves the coupling, and the chip history is the whole of the evidence.</p>' + scores;
        }

        /* The honesty split, stated on the page rather than smuggled into the
           fiction. 12_ §3.10: the player is trusted with the distinction, and
           that is also the emotional note the ending wants. */
        tier = '<div class="ms-tier"><b>What is established, and what is not.</b> ' +
          '<span class="tier">&#10214;Proven&#10215;</span> A stabilizer check asks whether neighbours agree and never what they are, ' +
          'so it extracts the error and not the encoded value,  that is why a surface code survives being measured a million ' +
          'times a second, and it is ordinary quantum error correction (Dennis, Kitaev, Landahl &amp; Preskill 2001). ' +
          'Measuring the logical operator itself <em>does</em> collapse what is encoded. ' +
          '<span class="tier">&#10214;Frontier&#10215;</span> That the world is itself a computation, measured once and unravelling since, ' +
          'is a respectable idea and not a result,  Wheeler&rsquo;s it-from-bit, Deutsch, Lloyd. Halden says the Solvers ' +
          '<em>believe</em> it, because that is exactly as far as anyone can honestly put it. ' +
          (ending === 'look'
            ? '<br><br>You looked. That was a real choice and the game does not think less of you for it: ' +
              'the price is stated in the physics, not in the story.'
            : '<br><br>You asked only for the parity. The wound stays closed, and you will not find out.') +
          '</div>';

        var through = throughLine(C, !!tag);
        panel.appendChild(node(
          '<div class="ms-end">' +
            '<div class="ms-face" data-r="face"></div>' +
            '<h3 class="ms-endh">' + head + '</h3>' +
            '<div class="ms-say">' + body + '</div>' + tag + tier + through +
            '<div data-r="share"></div>' +
            '<p class="ms-again"><button type="button" class="preset" data-r="again">Walk it again</button> ' +
            '<button type="button" class="preset" data-r="exit">Leave the Knot</button></p>' +
          '</div>'));
        face = C.scene.portrait(panel.querySelector('[data-r=face]'), 'halden');
        if (face) face.el.classList.add('scene-face--lg');
        mood(beat ? 'softened' : 'troubled', 0);

        /* The act clears by out-decoding the reading, 12_ §3.9's own defeat
           condition for the Hollow Oracle. The engine records its own win under
           `duel`; the ACT is this mission's business, exactly as Act I's is. */
        if (beat) C.clear();
        if (C.coherence) C.coherence.restore(beat ? 24 : 12,
          beat ? 'Insight, a machine can read perfectly and answer badly' : 'You watched it happen');

        C.scene.shareCard({
          eyebrow: 'Act VI · The Knot',
          title: beat ? 'I out-decoded the decoder that reads every alarm correctly'
                      : 'The reading was right about where, and the qubit is gone anyway',
          stat: held + '–' + oppHeld,
          statNote: 'ten rounds against minimum-weight matching on a chip with a coupled pair nobody told it about, ' +
                    'it expects 4.7 of 10 there, and it never misread a single alarm',
          line: (beat && namedOk) ? '"Tonight is the first time that was not the same as being right."' : null,
          tier: 'Proven', seed: 'd=3 rotated surface code, one coupled pair', file: 'symbiq-knot'
        }).mount(panel.querySelector('[data-r=share]'));

        panel.querySelector('[data-r=again]').addEventListener('click', function () { C.restart(); });
        panel.querySelector('[data-r=exit]').addEventListener('click', function () { C.exit(); });
      }

      return { arrival: arrival, ask: ask, work: work, consequence: consequence };
    }
  };

  /* THE DIAL. Six detents on a ring; drag it round and it settles into one,
     or focus a detent and press Enter. Releasing applies that turn by clicking
     the engine's own gate button, so nothing here can affect a par or a score.
     Keyboard and pointer both work, because a control you can only drag is a
     control some people simply cannot use. */
  function makeDial(host, apply) {
    if (!host) return null;
    var NSVG = 'http://www.w3.org/2000/svg';
    var CX = 120, CY = 120, RING = 84, N = DETENTS.length;
    var svg = document.createElementNS(NSVG, 'svg');
    svg.setAttribute('viewBox', '0 0 240 240');
    svg.setAttribute('class', 'ms-dial');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', 'The turn dial, six rotations');
    function mk(t, a) { var n = document.createElementNS(NSVG, t); for (var k in a) n.setAttribute(k, a[k]); return n; }
    svg.appendChild(mk('circle', { cx: CX, cy: CY, r: RING + 18, 'class': 'dial-plate' }));
    svg.appendChild(mk('circle', { cx: CX, cy: CY, r: RING - 26, 'class': 'dial-hub' }));
    var needle = mk('line', { x1: CX, y1: CY, x2: CX, y2: CY - (RING - 30), 'class': 'dial-needle' });
    svg.appendChild(needle);
    var label = mk('text', { x: CX, y: CY + 4, 'class': 'dial-label' });
    var sub = mk('text', { x: CX, y: CY + 20, 'class': 'dial-sub' });
    svg.appendChild(label); svg.appendChild(sub);

    function ang(i) { return (-90 + i * (360 / N)) * Math.PI / 180; }
    var marks = DETENTS.map(function (d, i) {
      var a = ang(i), x = CX + RING * Math.cos(a), y = CY + RING * Math.sin(a);
      var g = mk('g', { 'class': 'dial-detent', tabindex: '0', role: 'button',
                        'aria-label': d.turn + ' ' + d.axis + ', ' + d.note });
      g.appendChild(mk('circle', { cx: x, cy: y, r: 21 }));
      var t1 = mk('text', { x: x, y: y - 2, 'class': 'dial-g' }); t1.textContent = d.turn;
      var t2 = mk('text', { x: x, y: y + 11, 'class': 'dial-ax' }); t2.textContent = d.axis.replace('about ', '');
      g.appendChild(t1); g.appendChild(t2);
      g.addEventListener('click', function () { choose(i); apply(d.g); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i); apply(d.g); }
      });
      g.addEventListener('mouseenter', function () { preview(i); });
      svg.appendChild(g);
      return g;
    });

    var at = 0;
    function paint(i) {
      var a = ang(i);
      needle.setAttribute('x2', CX + (RING - 30) * Math.cos(a));
      needle.setAttribute('y2', CY + (RING - 30) * Math.sin(a));
      label.textContent = DETENTS[i].turn;
      sub.textContent = DETENTS[i].axis;
      marks.forEach(function (m, j) { m.classList.toggle('on', j === i); });
    }
    function preview(i) { paint(i); }
    function choose(i) { at = i; paint(i); }

    // drag anywhere on the plate: the dial follows your hand and settles
    var dragging = false;
    function idxFromEvent(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width * 240 - CX;
      var py = (ev.clientY - r.top) / r.height * 240 - CY;
      var a = Math.atan2(py, px) * 180 / Math.PI + 90;
      while (a < 0) a += 360;
      return Math.round(a / (360 / N)) % N;
    }
    svg.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest && ev.target.closest('.dial-detent')) return;   // a click is a click
      dragging = true;
      try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
      paint(idxFromEvent(ev));
    });
    svg.addEventListener('pointermove', function (ev) { if (dragging) paint(idxFromEvent(ev)); });
    svg.addEventListener('pointerup', function (ev) {
      if (!dragging) return;
      dragging = false;
      var i = idxFromEvent(ev);
      choose(i); apply(DETENTS[i].g);
    });
    svg.addEventListener('pointercancel', function () { dragging = false; paint(at); });
    svg.addEventListener('mouseleave', function () { if (!dragging) paint(at); });

    host.appendChild(svg);
    host.appendChild(node('<p class="ms-dialhint">Turn the dial,  drag it round, or tap a detent. ' +
      'These six rotations are the entire one-qubit gate set.</p>'));
    paint(0);
    return { el: svg };
  }

  /* -------------------------------------------------------------------- */
  window.SymbiQ.missions = {
    all: M,
    list: ['golf', 'grover', 'maxcut', 'volcano', 'chsh', 'knot'].map(function (k) {
      return { id: k, title: M[k].title, act: M[k].act, place: M[k].place,
               mentor: M[k].mentor, blurb: M[k].blurb };
    }),
    get: function (id) { return M[id]; },
    _through: throughLine,               // test seam, see tools/verify_mission_ceremony.mjs

    mount: function (id, host, opts) {
      var m = M[id], S = window.SymbiQ.scene, GS = window.SymbiQ.games;
      if (!m || !host || !S || !GS) return false;
      opts = opts || {};

      host.className = 'scene-host mission-scene';
      host.innerHTML = '';
      var bg = S.background(host, m.world, { seed: m.id, a: 0 });
      S.bindCoherence();

      var C = {
        mission: m, host: host, scene: S,
        // Every work() beat mounts the verified engine through C.games.mount,
        // never GS.mount directly (14_ §9's rule), which means wrapping it
        // HERE gives all six missions the Arcade's "How to play" panel at
        // once instead of six separate edits. It was built (GS.aboutHTML)
        // but only ever wired into journey.html's missions.js-failed
        // fallback, so under normal play nobody ever saw it, and a mission
        // handed you a machine with the narrative as its only instructions
        // (Chinmoy, 2026-08-06: "vague explanation for a beginner"). Same
        // <details>, so it still opens once per game and stays out of the
        // way after (games.js tracks `rules.seen.<id>` in the save).
        games: (function () {
          if (!GS.aboutHTML) return GS;
          var wrapped = {};
          for (var k in GS) wrapped[k] = GS[k];
          wrapped.mount = function (gid, container, o) {
            if (container && container.parentNode && !container.parentNode.querySelector('.gamerules')) {
              var about = node(GS.aboutHTML(gid));
              if (about) container.parentNode.insertBefore(about, container);
            }
            return GS.mount(gid, container, o);
          };
          return wrapped;
        })(),
        bg: bg,
        coherence: window.SymbiQ.coherence || null,
        outcome: null,
        // Set by mark() below the first time this run reaches a genuine clear.
        // `cleared` gates the consequence beat's through-line; `firstClear` is
        // the save's "first ever" verdict for this engine, latched to the first
        // mark() call so a replay or a second onWin cannot flip it.
        cleared: false, firstClear: false,
        click: function () { S.audio.click(); },
        /* Record that this run cleared, and whether it was the first ever.
           The four engine-win acts hand their first-clear verdict here through
           the mount's onWin(id, first); Acts I and VI, whose objective the
           engine cannot see, route through clear() just below. Idempotent and
           latched -- calling it again with a later, falser verdict is a no-op. */
        mark: function (first) {
          if (!C.cleared) C.firstClear = !!first;
          C.cleared = true;
        },
        /* A mission's objective is the MISSION's business, not the engine's.
           Four of the five acts finish exactly where their engine already
           declares a win, so games.js writes the save itself and nothing more
           is needed here. Act I is the deliberate exception: Circuit Golf
           scores a full round of nine holes and the act is three doors, so the
           engine would never mark it and the Path could never open Act II.
           `completeMission` is idempotent, so a mission that calls this over an
           engine that already fired costs nothing. */
        clear: function () {
          var SV = window.SymbiQ && window.SymbiQ.save;
          var f = SV ? SV.completeMission(id) : false;
          C.mark(f);
          return f;
        },
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

      // A way out that does not wait for the ending. Every beat had one
      // AFTER a win ("Leave the corridor" etc.) and none before it, so
      // starting a mission and changing your mind meant hunting for the
      // small nav link at the top of the page. This is always here.
      var bar = document.createElement('div');
      bar.className = 'ms-bar';
      host.appendChild(bar);
      var leave = document.createElement('button');
      leave.type = 'button';
      leave.className = 'ms-leave';
      leave.setAttribute('aria-label', 'Leave this mission and return to the map');
      leave.innerHTML = '<span aria-hidden="true">&#10005;</span><span class="ms-leave-t">Leave</span>';
      leave.addEventListener('click', function () { C.exit(); });
      bar.appendChild(leave);
      S.audio.mountToggle(bar);
      return true;
    }
  };
})();

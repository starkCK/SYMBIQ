/* SymbiQ — THE SCENE KIT (Phase 0 of outputs/14_GAME_REDESIGN.md §8)
 *
 * Everything a mission needs to stop being a widget in a box and start being a
 * place you are standing in. One file, no dependencies, no assets, no network.
 *
 * THE HARD RULE, from 14_ §9 and it is not negotiable:
 *   the scene layer WRAPS a game mount and NEVER reaches inside it.
 *   No engine, threshold, par or scoring path may consult scene state.
 * Everything here is presentation. If you deleted this file the games would
 * still play and every verified number would still be verified. That is the
 * whole point, and it is the same precedent as games.js's display-only `mode`
 * flag: only the costume knows which costume it is wearing.
 *
 * What is in the kit:
 *   scene.background(host, world, opts)  WebGL world layer + static fallback
 *   scene.bindCoherence()                colour drains as coherence falls
 *   scene.turbulence(svg, amount)        analogue warp over VERIFIED geometry,
 *                                        which moves not one coordinate of it
 *   scene.portrait(host, who, expr)      a face, drawn by code, that reacts
 *   scene.audio                          a drone that tracks coherence; clicks
 *   scene.titleCard(host, opts)          one enormous word, four seconds
 *   scene.sequence(host, beats)          ARRIVAL / ASK / WORK / CONSEQUENCE
 *   scene.shareCard(opts)                the frame worth keeping, as a file
 *
 * Accessibility is a constraint, not a setting: WebGL is feature-detected, and
 * prefers-reduced-motion turns every animation in here off and every world into
 * a still gradient. Audio is muted until asked for. Nothing autoplays.
 */
(function () {
  'use strict';
  window.SymbiQ = window.SymbiQ || {};

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var NS = 'http://www.w3.org/2000/svg';

  /* The site's colour law, in the one place a shader can read it.
     teal = AI / real / shipping · violet = quantum / theory / ahead
     yellow = look here · amber = the OR identity */
  var PAL = {
    bg:     [0.043, 0.059, 0.102],
    teal:   [0.176, 0.831, 0.749],
    violet: [0.655, 0.545, 0.980],
    amber:  [0.984, 0.749, 0.141],
    ink:    [0.898, 0.914, 0.945]
  };

  function css(c, a) {
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' +
           Math.round(c[2] * 255) + ',' + (a == null ? 1 : a) + ')';
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seedOf(s) {                     // deterministic: a name is always the same face
    var h = 2166136261, i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }
  function rngFrom(seed) {                 // mulberry32, so portraits never drift
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ==================================================================== *
   *  1. THE WORLD LAYER — one fullscreen quad, one shader per place      *
   *                                                                      *
   *  ~40 lines of GLSL each, no library, no assets, 60 fps on a phone.   *
   *  Per 14_ §6.1 these are PLACES IN THE LATTICE, not laboratory        *
   *  hardware — which is what this pipeline is actually good at.         *
   *  Procedural generation is strongest at the abstract sublime and      *
   *  weakest at the specific real, so the fantasy frame makes the art    *
   *  cheaper rather than dearer.                                         *
   * ==================================================================== */

  var VERT =
    'attribute vec2 p;' +
    'void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

  /* Shared preamble: palette, hash, value noise, fbm, domain warp.
     mediump throughout — this runs behind content on phones. */
  var COMMON = [
    'precision mediump float;',
    'uniform vec2  u_res;',
    'uniform float u_time;',
    'uniform float u_coh;',    // 0..1 — the coherence meter, normalised
    'uniform float u_a;',      // world parameter A (a game may bind a real number here)
    'uniform float u_b;',      // world parameter B
    'uniform float u_seed;',
    'uniform sampler2D u_data;',   // optional 1-D data strip (the Volcano's heights)
    'uniform float u_hasData;',
    'const vec3 BG     = vec3(0.043, 0.059, 0.102);',
    'const vec3 TEAL   = vec3(0.176, 0.831, 0.749);',
    'const vec3 VIOLET = vec3(0.655, 0.545, 0.980);',
    'const vec3 AMBER  = vec3(0.984, 0.749, 0.141);',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }',
    '  return v;',
    '}',
    'vec2 warp(vec2 p, float k){',
    '  return p + k * vec2(fbm(p + vec2(0.0, u_time * 0.03)), fbm(p + vec2(5.2, 1.3)));',
    '}',
    /* THE STATIC — everywhere, always, and it is the coherence meter made
       visible. Structure forgetting its own edges: domain-warped fbm whose
       amplitude is bound to (1 - coherence). At full coherence it is absent. */
    'vec3 statica(vec3 col, vec2 uv){',
    '  float amt = clamp(1.0 - u_coh, 0.0, 1.0);',
    '  float g   = fbm(warp(uv * 3.4 + vec2(0.0, u_time * 0.05), 1.1 * amt));',
    '  float tear = smoothstep(0.62, 0.86, g) * amt;',
    /* A torn region loses its colour AND its light. The first build mixed
       toward a constant vec3(0.10,0.11,0.14), which on a scene this dark is
       BRIGHTER than the ground — so heavy Static made the world glow like fog
       instead of crumbling, and measured peak brightness went UP as coherence
       fell. Mixing toward a darkened greyscale of the pixel's own colour makes
       the loss monotone: the more the Static holds, the less there is. */
    '  vec3 dead = vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))) * 0.45;',
    '  col = mix(col, dead, tear * 0.90);',
    /* Grain SUBTRACTS only. An additive +/- fleck raised peak luminance by ~10%
       as coherence fell, so the brightest thing on screen got brighter the more
       the world decayed — a small magnitude but exactly the wrong signal, and
       the same defect as the tear above in a second place. The Static takes. */
    '  float grain = hash(uv * u_res.xy + fract(u_time) * 91.7);',
    '  col -= grain * 0.045 * amt;',
    '  return max(col, 0.0);',
    '}',
    /* Certainty looks like grey (14_ §6.4): as coherence falls the world
       desaturates toward one flat tone. The shader does its own half so the
       background drains even where CSS filters would be too costly. */
    'vec3 drain(vec3 col){',
    /* Clamp into gamut BEFORE desaturating. Mixing toward luminance preserves
       luminance exactly — but only for in-gamut colour. On an over-bright pixel
       (the corridor's exit glow is deliberately 1.55x) the high channels are
       already clipped at 1.0 and cannot fall to compensate, so the low channel
       rising made the brightest pixel ~8% BRIGHTER as coherence fell. Clamping
       first costs one instruction and makes the invariant true rather than
       nearly true. */
    '  col = clamp(col, 0.0, 1.0);',
    '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  return mix(vec3(lum), col, 0.35 + 0.65 * clamp(u_coh, 0.0, 1.0));',
    '}'
  ].join('\n');

  var WORLDS = {

    /* ACT I — THE QUANTUM REALM.  A vast dark hall; one impossible coin
       turning in a shaft of light, its faces both true. The whole act is one
       object lit well. u_a: how far the coin has turned (else it turns freely). */
    realm: [
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  vec3 col = BG;',
      '  float floorY = -0.34;',
      '  float shaft = exp(-pow(abs(uv.x) * 3.1, 2.0)) * smoothstep(0.85, -0.30, uv.y);',
      '  col += VIOLET * shaft * 0.13;',
      '  float fl = smoothstep(0.0, -0.55, uv.y - floorY);',
      '  col = mix(col, BG * 1.9, fl * 0.55);',
      '  float ph = (u_a > 0.0 ? u_a * 6.2831 : u_time * 0.55);',
      '  float w  = abs(cos(ph));',                       // the coin turning: edge-on at w=0
      '  vec2  q  = uv - vec2(0.0, 0.03);',
      '  float d  = length(vec2(q.x / max(w * 0.20, 0.012), q.y / 0.20));',
      '  float face = 1.0 - smoothstep(0.94, 1.0, d);',
      '  vec3  faceCol = mix(TEAL, VIOLET, 0.5 + 0.5 * sin(ph));',   // both faces true
      '  col = mix(col, faceCol * (0.55 + 0.45 * w), face);',
      '  col += faceCol * exp(-d * 2.4) * 0.28;',                    // its own light
      '  float refl = 1.0 - smoothstep(0.0, 0.9, d * 1.3 + (floorY - uv.y) * 2.4);',
      '  col += faceCol * max(refl, 0.0) * 0.10 * step(uv.y, floorY);',
      '  col = statica(drain(col), uv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),

    /* ACT II — THE LOCKED CORRIDOR.  Doors without end, receding into fog;
       one of them is breathing light. A box tunnel solved analytically: for a
       ray down +z inside |x|<=1, |y|<=1 the first wall hit is min(1/|dx|,1/|dy|),
       so the geometry is exact and costs two divisions.
       u_a IS THE EXIT'S REAL PROBABILITY — bind sin^2((2k+1)theta) to it and
       over-rotating physically dims the door. u_b: door index, 0..1. */
    corridor: [
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  vec3 rd = normalize(vec3(uv, 1.15));',
      '  float tx = 1.0 / max(abs(rd.x), 1e-4);',
      '  float ty = 1.0 / max(abs(rd.y), 1e-4);',
      '  float t  = min(tx, ty);',
      '  float wall = step(tx, ty);',                     // 1 on side walls, 0 on floor/ceiling
      '  float z  = t * rd.z + u_time * 0.42;',
      '  vec3 col = BG;',
      '  float pitch = 1.55;',
      '  float di = floor(z / pitch);',
      '  float dz = fract(z / pitch);',
      '  vec3 hit = rd * t;',
      '  float door = wall',
      '    * step(0.16, dz) * step(dz, 0.84)',
      '    * step(abs(hit.y * t / max(t, 1e-4)), 0.62);',
      '  float slab = 0.5 + 0.5 * sin(di * 1.7 + 0.9);',
      '  col += vec3(0.055, 0.070, 0.115) * (0.6 + 0.4 * slab);',
      '  col += VIOLET * door * 0.055;',
      '  float frame = door * (smoothstep(0.16, 0.20, dz) * smoothstep(0.84, 0.80, dz));',
      '  col += VIOLET * (door - frame) * 0.10;',
      '  float ex   = floor(u_seed * 9.0) + 2.0;',
      '  float mine = mod(di, 11.0);',
      '  float isEx = 1.0 - step(0.5, abs(mine - ex));',
      '  float breathe = 0.75 + 0.25 * sin(u_time * 1.8);',
      '  col += TEAL * door * isEx * clamp(u_a, 0.0, 1.0) * breathe * 1.55;',
      '  col += TEAL * isEx * door * 0.06;',
      '  float fog = exp(-max(z - u_time * 0.42, 0.0) * 0.085);',
      '  col = mix(BG * 0.85, col, clamp(fog, 0.0, 1.0));',
      '  col = statica(drain(col), uv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),

    /* ACT III — GRAPH CITY.  A city of light seen from above, tearing along a
       seam you are drawing. Voronoi cells, two-tone fill, the cut a hard line.
       u_a: how far the cut has been drawn. u_b: how much is unsatisfiable — the
       odd loop that cannot be cut flares amber and stays flared. */
    city: [
      'vec3 vor(vec2 p, out float side){',
      '  vec2 g = floor(p), f = fract(p);',
      '  float md = 8.0; vec2 mr = vec2(0.0), mg = vec2(0.0);',
      '  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {',
      '    vec2 o = vec2(float(i), float(j));',
      '    vec2 r = o + vec2(hash(g + o), hash(g + o + 17.0)) - f;',
      '    float d = dot(r, r);',
      '    if (d < md) { md = d; mr = r; mg = g + o; }',
      '  }',
      '  side = step(0.5, hash(mg + 3.7));',
      '  return vec3(sqrt(md), mr);',
      '}',
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  vec2 p  = uv * 5.0 + vec2(u_time * 0.02, 0.0);',
      '  float side; vec3 v = vor(p, side);',
      '  vec3 col = BG;',
      '  vec3 lit = mix(TEAL, VIOLET, side);',
      '  float glow = exp(-v.x * 2.6);',
      '  col += lit * glow * 0.30;',
      '  float edge = smoothstep(0.06, 0.0, v.x);',
      '  col += vec3(0.10, 0.12, 0.17) * edge;',
      '  float seam = abs(uv.y * 1.4 + sin(uv.x * 2.1 + u_seed * 6.0) * 0.16);',
      '  float cutTo = mix(-0.7, 0.9, clamp(u_a, 0.0, 1.0));',
      '  float drawn = step(uv.x, cutTo);',
      '  col += vec3(1.0) * smoothstep(0.030, 0.0, seam) * drawn * 0.55;',
      '  col += AMBER * smoothstep(0.075, 0.0, seam) * drawn * clamp(u_b, 0.0, 1.0) * 0.9;',
      '  col = statica(drain(col), uv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),

    /* ACT IV — THE VOLCANO.  A living ridge line under heat haze.
       THE BACKGROUND IS LITERALLY THE DATA: when a heights strip is uploaded
       through handle.setData(), the silhouette you see IS the array the
       Metropolis sampler runs on. Free correctness and free beauty on one line.
       u_a: temperature (drives the haze). u_b: the walker's position, 0..1. */
    volcano: [
      'float terrain(float x){',
      '  if (u_hasData > 0.5) return texture2D(u_data, vec2(clamp(x, 0.0, 1.0), 0.5)).r;',
      '  return 0.42 + 0.34 * fbm(vec2(x * 4.0 + u_seed * 10.0, 1.0));',
      '}',
      'void main(){',
      '  vec2 uv = gl_FragCoord.xy / u_res;',
      '  vec2 cv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  vec3 col = mix(BG, BG + vec3(0.05, 0.02, 0.02), uv.y);',
      '  float T = clamp(u_a, 0.0, 1.0);',
      '  vec2 hz = warp(vec2(uv.x * 3.0, uv.y * 2.0 - u_time * 0.06), 0.35 + 0.65 * T);',
      '  float haze = fbm(hz);',
      '  col += AMBER * haze * 0.10 * (0.25 + 0.75 * T);',
      '  float h = terrain(uv.x) * 0.72;',
      '  float land = smoothstep(h + 0.006, h - 0.006, uv.y);',
      '  col = mix(col, BG * 0.35, land);',
      '  float rim = smoothstep(0.012, 0.0, abs(uv.y - h));',
      '  col += mix(VIOLET, AMBER, T) * rim * 1.10;',
      '  float wx = clamp(u_b, 0.0, 1.0);',
      '  float wy = terrain(wx) * 0.72;',
      '  float wd = length((uv - vec2(wx, wy)) * vec2(u_res.x / u_res.y, 1.0));',
      '  col += TEAL * exp(-wd * 22.0) * 0.9;',
      '  col = statica(drain(col), cv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),

    /* ACT V — THE SHORE OF TWINS.  Two particle tides on separate shores,
       moving as one. Break the pairing and the correlation is visibly still
       there — which is the whole no-signalling point Kai & Lyra exist to make.
       u_a: correlation strength. u_b: separation. */
    shore: [
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  vec3 col = BG;',
      '  float sep = 0.24 + 0.30 * clamp(u_b, 0.0, 1.0);',
      '  float corr = clamp(u_a, 0.0, 1.0);',
      '  for (int i = 0; i < 2; i++) {',
      '    float s = (i == 0 ? -1.0 : 1.0);',
      '    vec2 q = vec2(uv.x - s * sep, uv.y);',
      '    vec2 w = warp(q * 2.6 + vec2(0.0, u_time * 0.10), 0.55);',
      '    float tide = fbm(w * 1.7);',
      '    float band = smoothstep(0.34, 0.62, tide) * exp(-abs(q.x) * 1.5);',
      '    col += mix(TEAL, VIOLET, float(i)) * band * 0.40;',
      '  }',
      '  float link = exp(-pow(abs(uv.y - sin(uv.x * 3.0 + u_time * 0.5) * 0.05) * 9.0, 2.0));',
      '  col += vec3(1.0) * link * corr * 0.13;',
      '  col = statica(drain(col), uv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),

    /* THE KNOT — the finale. A single wound in the lattice, folding inward.
       The only scene that breaks the palette. */
    knot: [
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  float r = length(uv), a = atan(uv.y, uv.x);',
      '  vec2 inv = uv / max(r * r, 0.02);',                 // circle inversion: folding inward
      '  vec2 q = warp(inv * 0.9 + vec2(u_time * 0.04, 0.0), 0.9);',
      '  float f = fbm(q * 1.6 + a * 0.3);',
      '  vec3 col = BG;',
      '  col += mix(VIOLET, vec3(0.95, 0.35, 0.45), f) * smoothstep(0.30, 0.85, f) * 0.45;',
      '  col *= smoothstep(0.02, 0.35, r);',                 // the wound itself takes no light
      '  col += vec3(1.0, 0.85, 0.9) * exp(-r * 14.0) * 0.35;',
      '  col = statica(col, uv);',                           // no drain: the Knot is past that
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  };

  /* Static fallbacks, in the same palette, for no-WebGL and reduced-motion.
     No page ever depends on a shader. */
  var FALLBACK = {
    realm:    'radial-gradient(120% 90% at 50% 20%, rgba(167,139,250,.20), transparent 60%), #0b0f1a',
    corridor: 'radial-gradient(70% 120% at 50% 55%, rgba(45,212,191,.20), transparent 62%), linear-gradient(180deg,#0b0f1a,#0d1120)',
    city:     'radial-gradient(90% 70% at 30% 40%, rgba(45,212,191,.16), transparent 60%), radial-gradient(80% 70% at 72% 62%, rgba(167,139,250,.16), transparent 60%), #0b0f1a',
    volcano:  'linear-gradient(180deg,#0b0f1a 0%,#150f14 62%,#1d1116 100%)',
    shore:    'radial-gradient(60% 90% at 22% 50%, rgba(45,212,191,.18), transparent 62%), radial-gradient(60% 90% at 78% 50%, rgba(167,139,250,.18), transparent 62%), #0b0f1a',
    knot:     'radial-gradient(60% 60% at 50% 50%, rgba(244,89,115,.22), transparent 62%), #0b0f1a'
  };

  var glOK = null;
  function webglSupported() {
    if (glOK !== null) return glOK;
    try {
      var c = document.createElement('canvas');
      glOK = !!(window.WebGLRenderingContext &&
                (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { glOK = false; }
    return glOK;
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('shader: ' + log);
    }
    return s;
  }

  var running = [];   // every live world, so one rAF drives them all

  function background(host, world, opts) {
    opts = opts || {};
    if (!host) return null;
    var name = WORLDS[world] ? world : 'realm';
    var layer = document.createElement('div');
    layer.className = 'scene-bg';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.background = FALLBACK[name];
    host.insertBefore(layer, host.firstChild);
    if (!host.classList.contains('scene-host')) host.classList.add('scene-host');

    var handle = {
      world: name, live: false, el: layer,
      u: { a: opts.a || 0, b: opts.b || 0, coh: cohNorm(), seed: (seedOf(opts.seed || name) % 1000) / 1000 },
      set: function (o) { for (var k in o) if (o.hasOwnProperty(k)) this.u[k] = o[k]; return this; },
      setData: function () { return this; },
      destroy: function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }
    };

    if (reduce || opts.still || !webglSupported()) return handle;   // the still world is a real world

    var cv = document.createElement('canvas');
    cv.className = 'scene-canvas';
    layer.appendChild(cv);
    var gl;
    try {
      gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false,
                                    powerPreference: 'low-power', preserveDrawingBuffer: false }) ||
           cv.getContext('experimental-webgl', { alpha: false, antialias: false, depth: false });
    } catch (e) { gl = null; }
    if (!gl) { layer.removeChild(cv); return handle; }

    var prog;
    try {
      var vs = compile(gl, gl.VERTEX_SHADER, VERT);
      var fs = compile(gl, gl.FRAGMENT_SHADER, COMMON + '\n' + WORLDS[name]);
      prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      // A world that will not compile is a still gradient, never a broken page.
      if (cv.parentNode) cv.parentNode.removeChild(cv);
      if (window.console && console.warn) console.warn('SymbiQ.scene: ' + e.message);
      return handle;
    }

    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['u_res', 'u_time', 'u_coh', 'u_a', 'u_b', 'u_seed', 'u_data', 'u_hasData'].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });

    // The data strip: the Volcano uploads its own height array here, so the
    // silhouette on screen IS the energy function the sampler walks.
    var tex = null, hasData = 0;
    handle.setData = function (arr) {
      if (!arr || !arr.length) { hasData = 0; return this; }
      var n = arr.length, px = new Uint8Array(n * 4), i, lo = Infinity, hi = -Infinity;
      for (i = 0; i < n; i++) { if (arr[i] < lo) lo = arr[i]; if (arr[i] > hi) hi = arr[i]; }
      var span = (hi - lo) || 1;
      for (i = 0; i < n; i++) {
        var v = Math.round(255 * clamp01((arr[i] - lo) / span));
        px[i * 4] = v; px[i * 4 + 1] = v; px[i * 4 + 2] = v; px[i * 4 + 3] = 255;
      }
      if (!tex) tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      hasData = 1;
      return this;
    };

    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var w = 0, h = 0;
    function resize() {
      var r = layer.getBoundingClientRect();
      var nw = Math.max(1, Math.round(r.width * dpr)), nh = Math.max(1, Math.round(r.height * dpr));
      if (nw === w && nh === h) return;
      w = nw; h = nh; cv.width = w; cv.height = h;
      gl.viewport(0, 0, w, h);
    }

    var t0 = performance.now(), visible = true;
    handle.live = true;
    handle.destroy = function () {
      handle.live = false;
      var i = running.indexOf(handle); if (i >= 0) running.splice(i, 1);
      if (io) try { io.disconnect(); } catch (e) {}
      try { gl.getExtension('WEBGL_lose_context') && gl.getExtension('WEBGL_lose_context').loseContext(); } catch (e) {}
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    };
    handle._draw = function (now) {
      /* A world whose layer has left the document is a leak: rAF would keep
         rendering into a detached canvas for the life of the page. Reap it. */
      if (!layer.isConnected) { handle.destroy(); return; }
      if (!visible || document.hidden) return;
      resize();
      gl.useProgram(prog);
      gl.uniform2f(U.u_res, w, h);
      gl.uniform1f(U.u_time, (now - t0) / 1000);
      gl.uniform1f(U.u_coh, clamp01(handle.u.coh));
      gl.uniform1f(U.u_a, handle.u.a);
      gl.uniform1f(U.u_b, handle.u.b);
      gl.uniform1f(U.u_seed, handle.u.seed);
      gl.uniform1f(U.u_hasData, hasData);
      if (hasData) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.u_data, 0); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // Offscreen worlds cost nothing. This is the difference between a nice
    // background and a phone that gets warm.
    var io = null;
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; });
      io.observe(layer);
    }

    running.push(handle);
    startLoop();
    return handle;
  }

  var looping = false;
  function startLoop() {
    if (looping) return;
    looping = true;
    (function frame(now) {
      if (!running.length) { looping = false; return; }
      for (var i = 0; i < running.length; i++) { try { running[i]._draw(now); } catch (e) {} }
      requestAnimationFrame(frame);
    })(performance.now());
  }

  /* ==================================================================== *
   *  2. COHERENCE -> COLOUR.  Certainty looks like grey.                 *
   *  coherence.js already writes data-coh onto <html> and persists the   *
   *  number. All this does is read it. It writes nothing back.           *
   * ==================================================================== */

  function cohNorm() {
    var C = window.SymbiQ && window.SymbiQ.coherence;
    return C ? clamp01(C.get() / 100) : 1;
  }

  function bindCoherence() {
    var C = window.SymbiQ && window.SymbiQ.coherence;
    if (!C) return false;
    var apply = function () {
      var v = clamp01(C.get() / 100);
      // 1.0 at full, 0.30 at nothing — the world drains but never goes flat grey,
      // because a page you cannot read is not an aesthetic.
      document.documentElement.style.setProperty('--scene-sat', (0.30 + 0.70 * v).toFixed(3));
      for (var i = 0; i < running.length; i++) running[i].u.coh = v;
    };
    var prev = C.onchange;
    C.onchange = function (val, delta, reason) {
      apply();
      if (typeof prev === 'function') try { prev(val, delta, reason); } catch (e) {}
    };
    apply();
    return true;
  }

  /* ==================================================================== *
   *  3. TURBULENCE — analogue warp over PROVEN geometry.                 *
   *                                                                      *
   *  feTurbulence + feDisplacementMap distorts the RENDERING of an SVG   *
   *  and moves not one coordinate of it. So a provably correct circuit   *
   *  diagram can shimmer, warp and tear as coherence drops while the     *
   *  thing being drawn stays exactly right. Fifteen lines, and it exists *
   *  BECAUSE of the honesty rule rather than in spite of it.             *
   * ==================================================================== */

  var filterId = 0;
  function turbulence(target, amount) {
    if (!target) return null;
    if (reduce) return { set: function () {}, remove: function () {} };
    var id = 'scene-turb-' + (++filterId);
    var svg = target.ownerSVGElement || (target.tagName && target.tagName.toLowerCase() === 'svg' ? target : null);
    if (!svg) return null;
    var defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.insertBefore(defs, svg.firstChild); }
    var f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', '-12%'); f.setAttribute('y', '-12%');
    f.setAttribute('width', '124%'); f.setAttribute('height', '124%');
    var turb = document.createElementNS(NS, 'feTurbulence');
    turb.setAttribute('type', 'fractalNoise');
    turb.setAttribute('numOctaves', '2');
    turb.setAttribute('result', 'n');
    var disp = document.createElementNS(NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'n');
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    f.appendChild(turb); f.appendChild(disp); defs.appendChild(f);
    target.setAttribute('filter', 'url(#' + id + ')');

    var api = {
      // amount 0..1 — at 0 the filter is a no-op and the diagram is pristine
      set: function (v) {
        v = clamp01(v);
        turb.setAttribute('baseFrequency', (0.004 + 0.055 * v).toFixed(4));
        disp.setAttribute('scale', (v * 9).toFixed(2));
        return api;
      },
      // follow the meter: the more the Static holds, the more the page tears
      follow: function () { api.set(1 - cohNorm()); return api; },
      remove: function () {
        target.removeAttribute('filter');
        if (f.parentNode) f.parentNode.removeChild(f);
      }
    };
    return api.set(amount == null ? 0 : amount);
  }

  /* ==================================================================== *
   *  4. PORTRAITS — a face, drawn by code, that reacts to what you did   *
   *                                                                      *
   *  Not purchased, not model-generated: deterministic from a seed, so a *
   *  character is always the same face. House style is one continuous    *
   *  contour, two flat fills and one accent — closer to a linocut than   *
   *  an illustration, deliberately stylised so it reads as designed.     *
   *                                                                      *
   *  The part that matters is THREE EXPRESSION PARAMETERS driven by game *
   *  state. A face that changes in response to what you just did is the  *
   *  cheapest emotion in games and almost nobody does it.                *
   *     brow   -1 (fallen / troubled) .. +1 (raised / open)              *
   *     eyes    0 (narrowed)          .. 1 (wide)                        *
   *     mouth  -1 (down)              .. +1 (up)                         *
   * ==================================================================== */

  var CAST = {
    ada:    { accent: 'violet', motif: 'ring' },
    rue:    { accent: 'teal',   motif: 'chevron' },
    cordon: { accent: 'amber',  motif: 'bar' },
    vesh:   { accent: 'amber',  motif: 'wave' },
    kai:    { accent: 'teal',   motif: 'dot' },
    lyra:   { accent: 'violet', motif: 'dot' },
    halden: { accent: 'teal',   motif: 'grid' }
  };
  var ACCENT = { teal: '#2dd4bf', violet: '#a78bfa', amber: '#fbbf24' };

  function portrait(host, who, expr) {
    if (!host) return null;
    var key = String(who || '').toLowerCase();
    var spec = CAST[key] || { accent: 'violet', motif: 'ring' };
    var R = rngFrom(seedOf(key));
    // The face is fixed at construction; only the three expression parameters move.
    var geo = {
      jaw:   0.82 + R() * 0.30,        // narrow .. square
      cheek: 0.88 + R() * 0.26,
      brow:  R() * 6 - 3,              // resting brow tilt, degrees
      hair:  Math.floor(R() * 4),
      eyeY:  60 + R() * 4,
      nose:  74 + R() * 6
    };
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 140');
    svg.setAttribute('class', 'scene-face');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Portrait of ' + (who || 'a Solver'));
    var acc = ACCENT[spec.accent];

    function node(t, a) { var n = document.createElementNS(NS, t); for (var k in a) n.setAttribute(k, a[k]); return n; }

    // contour: one continuous head shape, jaw width from the seed
    var jw = 30 * geo.jaw, cw = 33 * geo.cheek;
    svg.appendChild(node('path', {
      d: 'M60 22 C' + (60 + cw) + ' 22 ' + (60 + cw) + ' 58 ' + (60 + cw * 0.86) + ' 74' +
         ' C' + (60 + jw) + ' 100 ' + (60 + jw * 0.5) + ' 112 60 112' +
         ' C' + (60 - jw * 0.5) + ' 112 ' + (60 - jw) + ' 100 ' + (60 - cw * 0.86) + ' 74' +
         ' C' + (60 - cw) + ' 58 ' + (60 - cw) + ' 22 60 22 Z',
      fill: '#131a2b', stroke: '#e5e9f1', 'stroke-width': 2.2, 'stroke-linejoin': 'round'
    }));
    // hair: four geometric blocks, one flat fill
    var hair = [
      'M60 18 C88 18 96 40 94 54 L86 46 C82 32 70 28 60 28 C50 28 38 32 34 46 L26 54 C24 40 32 18 60 18 Z',
      'M28 52 C26 26 42 16 60 16 C78 16 94 26 92 52 L84 40 L74 48 L64 38 L52 48 L40 40 Z',
      'M60 16 C84 16 94 32 92 50 L60 42 L28 50 C26 32 36 16 60 16 Z',
      'M30 50 C30 26 44 16 60 16 C76 16 90 26 90 50 L82 44 L82 26 L38 26 L38 44 Z'
    ][geo.hair];
    svg.appendChild(node('path', { d: hair, fill: '#1d2740' }));

    var e = { brow: 0, eyes: 0.62, mouth: 0 };
    var browL = node('path', { stroke: '#e5e9f1', 'stroke-width': 2.6, 'stroke-linecap': 'round', fill: 'none' });
    var browR = node('path', { stroke: '#e5e9f1', 'stroke-width': 2.6, 'stroke-linecap': 'round', fill: 'none' });
    var eyeL  = node('ellipse', { cx: 47, fill: '#e5e9f1' });
    var eyeR  = node('ellipse', { cx: 73, fill: '#e5e9f1' });
    var pupL  = node('circle', { cx: 47, r: 2.2, fill: '#0b0f1a' });
    var pupR  = node('circle', { cx: 73, r: 2.2, fill: '#0b0f1a' });
    var nose  = node('path', { d: 'M60 ' + (geo.eyeY + 6) + ' L57 ' + geo.nose + ' L62 ' + geo.nose,
                               stroke: '#8b94a8', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' });
    var mouth = node('path', { stroke: '#e5e9f1', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' });
    [browL, browR, eyeL, eyeR, pupL, pupR, nose, mouth].forEach(function (n) { svg.appendChild(n); });

    // the accent mark: the character's motif, the one non-monochrome element
    var motif = {
      ring:    node('circle', { cx: 60, cy: 128, r: 6, fill: 'none', stroke: acc, 'stroke-width': 2.4 }),
      chevron: node('path', { d: 'M52 132 L60 122 L68 132', fill: 'none', stroke: acc, 'stroke-width': 2.6, 'stroke-linecap': 'round' }),
      bar:     node('rect', { x: 48, y: 125, width: 24, height: 5, rx: 2.5, fill: acc }),
      wave:    node('path', { d: 'M48 128 q6 -8 12 0 t12 0', fill: 'none', stroke: acc, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
      dot:     node('circle', { cx: 60, cy: 128, r: 4, fill: acc }),
      grid:    node('path', { d: 'M50 122 h20 M50 128 h20 M56 118 v14 M64 118 v14', fill: 'none', stroke: acc, 'stroke-width': 1.8 })
    }[spec.motif];
    if (motif) svg.appendChild(motif);

    function paint() {
      var y = geo.eyeY;
      var open = 1.4 + 4.2 * clamp01(e.eyes);                       // aperture
      eyeL.setAttribute('cy', y); eyeL.setAttribute('rx', 6.4); eyeL.setAttribute('ry', open);
      eyeR.setAttribute('cy', y); eyeR.setAttribute('rx', 6.4); eyeR.setAttribute('ry', open);
      pupL.setAttribute('cy', y); pupR.setAttribute('cy', y);
      pupL.setAttribute('r', Math.min(2.4, open * 0.55));
      pupR.setAttribute('r', Math.min(2.4, open * 0.55));
      var tilt = geo.brow + e.brow * 7;                              // degrees, inner end
      var by = y - 11 - e.brow * 2.5;
      browL.setAttribute('d', 'M40 ' + (by + tilt * 0.35).toFixed(1) + ' Q47 ' + (by - 2.4).toFixed(1) +
                              ' 54 ' + (by - tilt * 0.35).toFixed(1));
      browR.setAttribute('d', 'M66 ' + (by - tilt * 0.35).toFixed(1) + ' Q73 ' + (by - 2.4).toFixed(1) +
                              ' 80 ' + (by + tilt * 0.35).toFixed(1));
      var my = 92, curve = e.mouth * 6;
      mouth.setAttribute('d', 'M50 ' + (my - curve * 0.35).toFixed(1) + ' Q60 ' + (my + curve).toFixed(1) +
                              ' 70 ' + (my - curve * 0.35).toFixed(1));
    }
    paint();
    host.appendChild(svg);

    var api = {
      el: svg,
      /* Drive this from game state, not from a script. Ada narrows her eyes
         when you measure early; Rue's brow drops when you tell her she is wrong. */
      express: function (o, ms) {
        var from = { brow: e.brow, eyes: e.eyes, mouth: e.mouth };
        var to = {
          brow:  o && o.brow  != null ? Math.max(-1, Math.min(1, o.brow))  : e.brow,
          eyes:  o && o.eyes  != null ? clamp01(o.eyes)                    : e.eyes,
          mouth: o && o.mouth != null ? Math.max(-1, Math.min(1, o.mouth)) : e.mouth
        };
        var dur = reduce ? 0 : (ms == null ? 420 : ms), t0 = performance.now();
        if (!dur) { e = to; paint(); return api; }
        (function step(now) {
          var k = clamp01((now - t0) / dur), s = k * k * (3 - 2 * k);
          e.brow  = from.brow  + (to.brow  - from.brow)  * s;
          e.eyes  = from.eyes  + (to.eyes  - from.eyes)  * s;
          e.mouth = from.mouth + (to.mouth - from.mouth) * s;
          paint();
          if (k < 1) requestAnimationFrame(step);
        })(t0);
        return api;
      },
      // the four expressions every mission needs, so callers do not invent numbers
      mood: function (name, ms) {
        var M = {
          neutral:  { brow: 0,    eyes: 0.62, mouth: 0 },
          eager:    { brow: 0.7,  eyes: 0.90, mouth: 0.6 },
          troubled: { brow: -0.8, eyes: 0.45, mouth: -0.6 },
          narrowed: { brow: -0.3, eyes: 0.16, mouth: -0.15 },
          softened: { brow: 0.15, eyes: 0.55, mouth: 0.35 }
        };
        return api.express(M[name] || M.neutral, ms);
      }
    };
    return api;
  }

  /* ==================================================================== *
   *  5. AUDIO — WebAudio, no files, muted until asked.                   *
   *  A drone whose detune tracks coherence: as you decohere the harmonics*
   *  thin and it converges on one flat tone. CERTAINTY SOUNDS LIKE A     *
   *  DIAL TONE. One short dry click per action. Nothing else — restraint *
   *  is the premium signal, and audio that autoplays is a bounce.        *
   * ==================================================================== */

  var A = { ctx: null, on: false, master: null, voices: [], _coh: 1 };

  function audioInit() {
    if (A.ctx) return A.ctx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = 0;
    A.master.connect(A.ctx.destination);
    return A.ctx;
  }

  var audio = {
    get enabled() { return A.on; },
    available: function () { return !!(window.AudioContext || window.webkitAudioContext); },

    enable: function () {
      if (!audioInit()) return false;
      if (A.ctx.state === 'suspended') A.ctx.resume();
      A.on = true;
      A.master.gain.linearRampToValueAtTime(0.16, A.ctx.currentTime + 0.6);
      return true;
    },
    mute: function () {
      if (!A.ctx) return;
      A.on = false;
      A.master.gain.linearRampToValueAtTime(0, A.ctx.currentTime + 0.35);
    },
    toggle: function () { return A.on ? (audio.mute(), false) : audio.enable(); },

    /* The bed. Three voices; the upper two are the harmonics that thin out. */
    drone: function (root) {
      if (!audioInit() || A.voices.length) return;
      var f0 = root || 110;
      [[1, 0.5], [2.0, 0.28], [3.01, 0.16]].forEach(function (h, i) {
        var o = A.ctx.createOscillator(), g = A.ctx.createGain();
        o.type = i ? 'sine' : 'triangle';
        o.frequency.value = f0 * h[0];
        g.gain.value = h[1];
        o.connect(g); g.connect(A.master); o.start();
        A.voices.push({ o: o, g: g, base: h[1], mul: h[0] });
      });
      audio.coherence(A._coh);
    },
    /* v is 0..1. At v=1 the chord is full; at v=0 only the fundamental is left,
       slightly detuned flat. The sound of the world losing its structure. */
    coherence: function (v) {
      A._coh = clamp01(v);
      if (!A.ctx || !A.voices.length) return;
      var t = A.ctx.currentTime;
      A.voices.forEach(function (V, i) {
        var keep = i === 0 ? 1 : Math.pow(A._coh, 1.6);
        V.g.gain.linearRampToValueAtTime(V.base * keep, t + 0.8);
        V.o.detune.linearRampToValueAtTime(-38 * (1 - A._coh), t + 0.8);
      });
    },
    /* Grover hears its own mistake: pitch rises with the amplitude and FALLS
       on over-rotation, so you hear the error before you read it. */
    tone: function (hz, ms, type) {
      if (!A.on || !audioInit()) return;
      var t = A.ctx.currentTime, o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = hz;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (ms || 260) / 1000);
      o.connect(g); g.connect(A.master); o.start(t); o.stop(t + (ms || 260) / 1000 + 0.05);
    },
    click: function () {
      if (!A.on || !audioInit()) return;
      var t = A.ctx.currentTime, o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'square'; o.frequency.value = 1650;
      g.gain.setValueAtTime(0.30, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      o.connect(g); g.connect(A.master); o.start(t); o.stop(t + 0.05);
    },
    /* An obvious toggle, because audio the player did not ask for is a bounce. */
    mountToggle: function (host) {
      if (!host || !audio.available()) return null;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'scene-audio';
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span class="sa-ico" aria-hidden="true">◍</span><span class="sa-t">Sound off</span>';
      b.addEventListener('click', function () {
        if (A.on) { audio.mute(); b.setAttribute('aria-pressed', 'false'); b.querySelector('.sa-t').textContent = 'Sound off'; }
        else { audio.enable(); audio.drone(); b.setAttribute('aria-pressed', 'true'); b.querySelector('.sa-t').textContent = 'Sound on'; }
      });
      host.appendChild(b);
      return b;
    }
  };

  /* ==================================================================== *
   *  6. THE ACT CARD — type as image.                                    *
   *  The Interstellar register comes from typography and negative space, *
   *  not illustration. One enormous word, one thin rule, a long fade.    *
   *  It is free and it does more for perceived production value than any *
   *  particle system.                                                    *
   * ==================================================================== */

  function titleCard(host, o) {
    o = o || {};
    return new Promise(function (done) {
      if (!host) return done();
      var card = document.createElement('div');
      card.className = 'scene-card';
      card.innerHTML =
        (o.act ? '<span class="sc-act">' + o.act + '</span>' : '') +
        '<h2 class="sc-word">' + (o.word || '') + '</h2>' +
        '<span class="sc-rule" aria-hidden="true"></span>' +
        (o.line ? '<p class="sc-line">' + o.line + '</p>' : '') +
        '<button type="button" class="sc-skip">Skip ▸</button>';
      host.appendChild(card);
      var ms = reduce ? 0 : (o.ms == null ? 3600 : o.ms), fired = false;
      function end() {
        if (fired) return; fired = true;
        card.classList.add('out');
        var kill = function () { if (card.parentNode) card.parentNode.removeChild(card); done(); };
        if (reduce) kill(); else setTimeout(kill, 520);
      }
      card.querySelector('.sc-skip').addEventListener('click', end);
      // Never a trap: any key or a click anywhere on the card gets you past it.
      card.addEventListener('click', end);
      if (ms) setTimeout(end, ms); else end();
      requestAnimationFrame(function () { card.classList.add('in'); });
    });
  }

  /* ==================================================================== *
   *  7. THE FOUR-BEAT SEQUENCER                                          *
   *                                                                      *
   *  Every mission, no exceptions, so the shape is learnable:            *
   *    ARRIVAL     — you are somewhere and something is wrong            *
   *    ASK         — the character wants something; the arc lives here   *
   *    WORK        — the verified mechanic, untouched                    *
   *    CONSEQUENCE — something changes and stays changed                 *
   *                                                                      *
   *  This is the piece that most needs the hard rule restated: beat 3    *
   *  hands a bare element to whoever mounts the game and then keeps its  *
   *  hands off. The sequencer never learns what the game scored, only    *
   *  that the game said it was finished.                                 *
   * ==================================================================== */

  function sequence(host, beats, opts) {
    opts = opts || {};
    if (!host) return null;
    /* Clear the host WITHOUT evicting the world. The obvious `host.innerHTML=''`
       deleted the .scene-bg layer that background() had inserted into this same
       element, so the natural calling order — background(host), then
       sequence(host) — silently threw the world away and leaked a detached
       canvas that went on drawing forever. Found by probe, 2026-08-02. */
    Array.prototype.slice.call(host.children).forEach(function (n) {
      if (!n.classList || !n.classList.contains('scene-bg')) host.removeChild(n);
    });
    host.classList.add('scene-seq');
    var stage = document.createElement('div');
    stage.className = 'scene-stage';
    host.appendChild(stage);

    var order = ['arrival', 'ask', 'work', 'consequence'], at = -1, api;

    function panel(cls) {
      var d = document.createElement('div');
      d.className = 'scene-beat ' + cls;
      stage.appendChild(d);
      requestAnimationFrame(function () { d.classList.add('in'); });
      return d;
    }
    function clear() {
      var kids = stage.children, i;
      for (i = kids.length - 1; i >= 0; i--) {
        var k = kids[i];
        k.classList.remove('in'); k.classList.add('out');
        (function (n) { setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, reduce ? 0 : 340); })(k);
      }
    }

    api = {
      stage: stage,
      beat: function () { return order[at]; },
      /* Advance. Each beat callback receives its own empty panel and a `next`
         it may call whenever it likes — a game calls it from its own onWin,
         which is the only channel through which engine state ever reaches
         this layer, and it carries no numbers. */
      next: function () {
        at++;
        if (at >= order.length) { if (opts.onEnd) opts.onEnd(); return api; }
        var name = order[at], fn = beats[name];
        if (!fn) return api.next();
        clear();
        var p = panel('beat-' + name);
        try { fn(p, function () { api.next(); }, api); } catch (e) {
          p.innerHTML = '<p style="color:var(--muted)">This scene could not start. Reload the page.</p>';
        }
        return api;
      },
      start: function () { at = -1; return api.next(); }
    };
    return api;
  }

  /* ==================================================================== *
   *  8. THE SHARE CARD                                                   *
   *                                                                      *
   *  Nobody shares a screenshot because there is no moment designed to be*
   *  screenshotted and no card generated when they try. Both are cheap.  *
   *  Score, seed, evidence tier and URL are burned into the image, so a  *
   *  claim that travels always carries its own provenance.               *
   * ==================================================================== */

  function shareCard(o) {
    o = o || {};
    var W = 1200, H = 630;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');

    c.fillStyle = css(PAL.bg); c.fillRect(0, 0, W, H);
    // the lattice ground the whole site is drawn on
    c.strokeStyle = 'rgba(148,163,184,.08)'; c.lineWidth = 1;
    for (var x = 0; x <= W; x += 40) { c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, H); c.stroke(); }
    for (var y = 0; y <= H; y += 40) { c.beginPath(); c.moveTo(0, y + .5); c.lineTo(W, y + .5); c.stroke(); }
    var g = c.createRadialGradient(W * 0.20, H * 0.16, 0, W * 0.20, H * 0.16, W * 0.62);
    g.addColorStop(0, css(PAL.violet, 0.20)); g.addColorStop(1, css(PAL.violet, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(W * 0.86, H * 0.88, 0, W * 0.86, H * 0.88, W * 0.55);
    g.addColorStop(0, css(PAL.teal, 0.17)); g.addColorStop(1, css(PAL.teal, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    var F = '"Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';
    c.textBaseline = 'alphabetic';

    if (o.eyebrow) {
      c.font = '600 26px ' + F; c.fillStyle = css(PAL.violet);
      c.fillText(String(o.eyebrow).toUpperCase(), 84, 128);
    }
    c.font = '800 74px ' + F; c.fillStyle = css(PAL.ink);
    wrap(c, o.title || 'SymbiQ', 84, 210, W - 300, 84);

    if (o.stat) {
      c.font = '800 128px ' + F; c.fillStyle = css(PAL.teal);
      c.fillText(String(o.stat), 84, 400);
      if (o.statNote) {
        c.font = '400 27px ' + F; c.fillStyle = 'rgba(226,232,240,.78)';
        wrap(c, o.statNote, 84, 448, W - 300, 36);
      }
    }
    if (o.line) {
      c.font = 'italic 400 32px ' + F; c.fillStyle = 'rgba(226,232,240,.86)';
      wrap(c, o.line, 84, o.stat ? 528 : 320, W - 220, 44);
    }

    // the double-loop Q, drawn from assets/logo/symbiq-icon.svg's geometry
    (function (cx, cy, s) {
      var k = s / 500;
      function P(px, py) { return [cx + (px - 250) * k, cy + (py - 250) * k]; }
      c.lineWidth = Math.max(2, 30 * k); c.strokeStyle = css(PAL.violet);
      var a = P(250, 250), r = 140 * k;
      c.beginPath(); c.arc(a[0], a[1], r, 0, Math.PI * 2); c.stroke();
      c.lineWidth = Math.max(2, 24 * k); c.strokeStyle = css(PAL.teal);
      c.beginPath();
      for (var i = 0; i <= 120; i++) {
        var t = i / 120 * Math.PI * 2, ex = 170 * Math.cos(t), ey = 55 * Math.sin(t), rot = Math.PI / 4;
        var q = P(ex * Math.cos(rot) - ey * Math.sin(rot) + 280, ex * Math.sin(rot) + ey * Math.cos(rot) + 280);
        if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]);
      }
      c.stroke();
    })(W - 148, 132, 128);

    // provenance, burned in: nothing travels without its evidence tier and seed
    c.font = '600 24px ' + F; c.fillStyle = 'rgba(148,163,184,.92)';
    var foot = [];
    if (o.tier) foot.push(o.tier);
    if (o.seed != null) foot.push('seed ' + o.seed);
    foot.push(o.url || 'starkck.github.io/SYMBIQ');
    c.fillText(foot.join('   ·   '), 84, H - 62);

    function wrap(ctx, text, x0, y0, maxw, lh) {
      var words = String(text).split(' '), line = '', yy = y0, i;
      for (i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxw && line) { ctx.fillText(line, x0, yy); line = words[i]; yy += lh; }
        else line = test;
      }
      if (line) ctx.fillText(line, x0, yy);
      return yy;
    }

    var api = {
      canvas: cv,
      toBlob: function () {
        return new Promise(function (res) {
          if (cv.toBlob) cv.toBlob(res, 'image/png');
          else res(null);
        });
      },
      download: function (name) {
        return api.toBlob().then(function (b) {
          if (!b) return false;
          var u = URL.createObjectURL(b), a = document.createElement('a');
          a.href = u; a.download = (name || 'symbiq') + '.png';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
          return true;
        });
      },
      copy: function () {
        return api.toBlob().then(function (b) {
          if (!b || !navigator.clipboard || !window.ClipboardItem) return false;
          var item = {}; item[b.type] = b;
          return navigator.clipboard.write([new ClipboardItem(item)]).then(function () { return true; },
                                                                          function () { return false; });
        });
      },
      /* Two buttons and a preview, which is the entire share loop on this end.
         The other end — the link unfurling — shipped 2026-08-01. */
      mount: function (host) {
        if (!host) return null;
        var box = document.createElement('div');
        box.className = 'sharecard';
        cv.className = 'sharecard-img';
        cv.setAttribute('alt', (o.title || 'SymbiQ') + ' — share card');
        box.appendChild(cv);
        var row = document.createElement('p');
        row.className = 'sharecard-row';
        row.innerHTML = '<button type="button" class="preset" data-s="dl">Download image</button>' +
                        '<button type="button" class="preset" data-s="cp">Copy image</button>' +
                        '<span class="sharecard-note" role="status" aria-live="polite"></span>';
        box.appendChild(row);
        host.appendChild(box);
        var note = row.querySelector('.sharecard-note');
        row.querySelector('[data-s=dl]').addEventListener('click', function () {
          api.download(o.file || 'symbiq').then(function (ok) { note.textContent = ok ? 'Saved.' : 'Could not save here — long-press the image.'; });
        });
        var cp = row.querySelector('[data-s=cp]');
        if (!navigator.clipboard || !window.ClipboardItem) cp.style.display = 'none';
        else cp.addEventListener('click', function () {
          api.copy().then(function (ok) { note.textContent = ok ? 'Copied — paste it anywhere.' : 'Copy is blocked here; use Download.'; });
        });
        return box;
      }
    };
    return api;
  }

  /* -------------------------------------------------------------------- */
  window.SymbiQ.scene = {
    reduced: reduce,
    supported: webglSupported,
    worlds: Object.keys(WORLDS),
    palette: PAL,
    background: background,
    bindCoherence: bindCoherence,
    coherence: cohNorm,
    turbulence: turbulence,
    portrait: portrait,
    audio: audio,
    titleCard: titleCard,
    sequence: sequence,
    shareCard: shareCard
  };
})();

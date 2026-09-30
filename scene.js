(function () {
  'use strict';
  window.SymbiQ = window.SymbiQ || {};

  var reduce = window.SymbiQ.core.reduced();
  var NS = 'http://www.w3.org/2000/svg';

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
  function seedOf(s) {
    var h = 2166136261, i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }
  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }


  var VERT =
    'attribute vec2 p;' +
    'void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

  var COMMON = [
    'precision mediump float;',
    'uniform vec2  u_res;',
    'uniform float u_time;',
    'uniform float u_coh;',
    'uniform float u_a;',
    'uniform float u_b;',
    'uniform float u_seed;',
    'uniform sampler2D u_data;',
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
    'vec3 statica(vec3 col, vec2 uv){',
    '  float amt = clamp(1.0 - u_coh, 0.0, 1.0);',
    '  float g   = fbm(warp(uv * 3.4 + vec2(0.0, u_time * 0.05), 1.1 * amt));',
    '  float tear = smoothstep(0.62, 0.86, g) * amt;',
    '  vec3 dead = vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))) * 0.45;',
    '  col = mix(col, dead, tear * 0.90);',
    '  float grain = hash(uv * u_res.xy + fract(u_time) * 91.7);',
    '  col -= grain * 0.045 * amt;',
    '  return max(col, 0.0);',
    '}',
    'vec3 drain(vec3 col){',
    '  col = clamp(col, 0.0, 1.0);',
    '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  return mix(vec3(lum), col, 0.35 + 0.65 * clamp(u_coh, 0.0, 1.0));',
    '}'
  ].join('\n');

  var WORLDS = {

    realm: [
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  vec3 col = BG * 0.72;',
      '  float floorY = -0.30;',
      '  float shaftW = 0.13 + 0.40 * (0.60 - uv.y);',
      '  float shaft  = exp(-pow(abs(uv.x) / max(shaftW, 0.02), 2.2));',
      '  shaft *= smoothstep(0.90, -0.18, uv.y);',
      '  float dust = fbm(vec2(uv.x * 7.0, uv.y * 3.5 - u_time * 0.13));',
      '  col += VIOLET * shaft * (0.26 + 0.20 * dust);',
      '  col += vec3(0.055, 0.062, 0.098) * smoothstep(1.0, -0.3, uv.y) * (0.55 + 0.45 * fbm(uv * 1.7));',
      '  float pool = exp(-pow(abs(uv.x) * 1.5, 2.0)) * smoothstep(-0.72, -0.30, uv.y);',
      '  col += VIOLET * pool * 0.10;',
      '  float ph = (u_a > 0.0 ? u_a * 6.2831 : u_time * 0.55);',
      '  float w  = abs(cos(ph));',
      '  vec3  faceCol = mix(TEAL, VIOLET, 0.5 + 0.5 * sin(ph));',
      '  vec2  q  = uv - vec2(0.0, 0.02);',
      '  float rx = max(w * 0.19, 0.010);',
      '  float d  = length(vec2(q.x / rx, q.y / 0.19));',
      '  float face = 1.0 - smoothstep(0.97, 1.0, d);',
      '  col = mix(col, faceCol * (0.26 + 0.30 * w), face);',
      '  col += faceCol * smoothstep(0.032, 0.0, abs(d - 0.63)) * face * 0.60;',
      '  col += faceCol * smoothstep(0.024, 0.0, abs(d - 0.33)) * face * 0.38;',
      '  float rim = smoothstep(0.11, 0.0, abs(d - 1.0));',
      '  col += mix(TEAL, VIOLET, 0.5) * rim * (0.30 + 0.95 * (1.0 - w));',
      '  col += vec3(1.0) * face * exp(-length(q - vec2(-0.05 * rx, 0.075)) * 13.0) * 0.30 * w;',
      '  col += faceCol * exp(-d * 2.2) * 0.16;',
      '  float below = step(uv.y, floorY);',
      '  col = mix(col, BG * 1.35, below * 0.45);',
      '  vec2 mq = vec2(q.x, (2.0 * floorY - uv.y) - 0.02);',
      '  float md = length(vec2(mq.x / rx, mq.y / 0.19));',
      '  col += faceCol * (1.0 - smoothstep(0.55, 1.05, md)) * below * 0.13;',
      '  col += vec3(0.16, 0.19, 0.28) * smoothstep(0.010, 0.0, abs(uv.y - floorY));',
      '  col = statica(drain(col), uv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),

    corridor: [
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  vec3 rd = normalize(vec3(uv, 1.15));',
      '  float tx = 1.0 / max(abs(rd.x), 1e-4);',
      '  float ty = 1.0 / max(abs(rd.y), 1e-4);',
      '  float t  = min(tx, ty);',
      '  float wall = step(tx, ty);',
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
      '  float frame = door * (smoothstep(0.16, 0.20, dz) * smoothstep(0.84, 0.80, dz));',
      '  float ex   = floor(u_seed * 9.0) + 2.0;',
      '  float mine = mod(di, 11.0);',
      '  float isEx = 1.0 - step(0.5, abs(mine - ex));',
      '  float pa   = clamp(u_a, 0.0, 1.0);',
      '  float over = clamp(u_b, 0.0, 1.0);',
      '  col += VIOLET * door * (1.0 - isEx) * (0.030 + 0.200 * (1.0 - pa) + 0.450 * over);',
      '  col += VIOLET * (door - frame) * (1.0 - isEx) * 0.10;',
      '  float breathe = 0.75 + 0.25 * sin(u_time * 1.8);',
      '  col += TEAL * door * isEx * (0.03 + 2.60 * pow(pa, 5.0)) * breathe * (1.0 - 0.45 * over);',
      '  col += TEAL * isEx * door * 0.06 * (1.0 - 0.6 * over);',
      '  float fog = exp(-max(z - u_time * 0.42, 0.0) * 0.085);',
      '  col = mix(BG * 0.85, col, clamp(fog, 0.0, 1.0));',
      '  col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), over * 0.38);',
      '  col = statica(drain(col), uv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),

    city: [
      'void cells(vec2 p, out vec2 seed2, out float border, out float toEdge){',
      '  vec2 g = floor(p), f = fract(p);',
      '  float d1 = 8.0, d2 = 8.0; vec2 mg = vec2(0.0);',
      '  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {',
      '    vec2 o = vec2(float(i), float(j));',
      '    vec2 c = o + vec2(hash(g + o), hash(g + o + 17.0));',
      '    float d = length(c - f);',
      '    if (d < d1) { d2 = d1; d1 = d; mg = g + o + vec2(hash(g + o), hash(g + o + 17.0)); }',
      '    else if (d < d2) { d2 = d; }',
      '  }',
      '  seed2 = mg;',
      '  toEdge = d2 - d1;',
      '  border = smoothstep(0.085, 0.008, d2 - d1);',
      '}',
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  vec2 off = vec2(u_seed * 13.0, 7.0);',
      '  vec2 p = uv * 4.2 + off;',
      '  vec2 cc; float border, toEdge;',
      '  cells(p, cc, border, toEdge);',
      '  float progress = clamp(u_a, 0.0, 1.0);',
      '  float cutX  = -0.86 + 1.72 * progress;',
      '  float jitter = sin(cc.y * 2.3 + u_seed * 9.0) * 0.05;',
      '  float cutP  = (cutX + jitter) * 4.2 + off.x;',
      '  float side  = step(cutP, cc.x);',
      '  float claimed = step(cc.x, cutX * 4.2 + off.x + 0.9);',
      '  vec3 col = BG * 0.9;',
      '  vec3 lit = mix(TEAL, VIOLET, side);',
      '  vec3 unlit = vec3(0.085, 0.098, 0.140);',
      '  col = mix(col + unlit, col + lit * 0.20, claimed);',
      '  col += vec3(0.020, 0.024, 0.036) * border * 3.0;',
      '  vec2 wq = p * 7.0;',
      '  float win = step(0.86, hash(floor(wq)));',
      '  float tw  = 0.55 + 0.45 * sin(u_time * 1.3 + hash(floor(wq) + 5.0) * 30.0);',
      '  col += mix(vec3(0.85, 0.88, 0.95), lit, 0.55) * win * tw * 0.30 * (1.0 - border);',
      '  float seam = abs(uv.x - (cutX + sin(uv.y * 2.3 + u_seed * 9.0) * 0.05));',
      '  col += vec3(1.0) * smoothstep(0.006, 0.0, seam) * 0.75;',
      '  col += mix(TEAL, VIOLET, 0.5) * smoothstep(0.030, 0.0, seam) * 0.30;',
      '  float odd = step(0.93, hash(floor(cc * 3.0))) * clamp(u_b, 0.0, 1.0) * claimed;',
      '  col += AMBER * odd * (0.22 + 0.16 * sin(u_time * 2.2)) * (1.0 - border);',
      '  col = statica(drain(col), uv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),

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

    shore: [
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  vec3 col = BG * 0.85;',
      '  float corr = clamp(u_a, 0.0, 1.0);',
      '  float sep  = 0.06 + 0.16 * clamp(u_b, 0.0, 1.0);',
      '  float ax = abs(uv.x);',
      '  float gap  = smoothstep(sep, sep + 0.025, ax);',
      '  float x    = ax - sep;',
      '  float bandId = floor(uv.y * 7.0 + 3.0);',
      '  float phase  = uv.y * 7.0 + sin(u_time * 0.40) * 1.1;',
      '  float dec    = (1.0 - corr) * (hash(vec2(bandId, 3.0)) - 0.5) * 9.0;',
      '  float rough  = fbm(vec2(x * 2.2, uv.y * 2.0 + u_time * 0.07)) * 0.75;',
      '  float mine   = phase + rough + step(0.0, uv.x) * dec;',
      '  float tide   = sin(mine);',
      '  float band   = smoothstep(0.55, 0.99, tide) * exp(-max(x, 0.0) * 1.5);',
      '  vec3  c = mix(TEAL, VIOLET, step(0.0, uv.x));',
      '  col += c * band * 0.62 * gap;',
      '  col += c * exp(-max(x, 0.0) * 7.0) * 0.10 * gap;',
      '  float leftT  = sin(phase + rough);',
      '  float rightT = sin(phase + rough + dec);',
      '  float agree  = smoothstep(0.55, 1.0, leftT) * smoothstep(0.55, 1.0, rightT);',
      '  col += vec3(0.92, 0.95, 1.0) * agree * (1.0 - gap) * corr * 0.55;',
      '  col += vec3(0.92, 0.95, 1.0) * agree * corr * 0.10 * smoothstep(0.32, 0.0, x);',
      '  col *= 1.0 - 0.55 * (1.0 - gap) * (1.0 - agree * corr);',
      '  col = statica(drain(col), uv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),

    knot: [
      'void main(){',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;',
      '  float r = length(uv);',
      '  vec2 dir = r > 0.0001 ? uv / r : vec2(1.0, 0.0);',
      '  float mend = clamp(u_a, 0.0, 1.0);',
      '  float obey = clamp(u_b, 0.0, 1.0);',
      '  vec2 inv = uv / max(r * r * mix(1.0, 2.4, mend), 0.02);',
      '  vec2 q = warp(inv * 0.9 + vec2(u_time * 0.04, 0.0), 0.9 - 0.35 * mend);',
      '  float f = fbm(q * 1.6 + dir * 0.3);',
      '  vec3 wound = mix(vec3(0.95, 0.35, 0.45), VIOLET, mend);',
      '  vec3 col = BG;',
      '  col += mix(VIOLET, wound, f) * smoothstep(0.30, 0.85, f) * 0.45;',
      '  col *= smoothstep(0.02, 0.35 * (1.0 - 0.62 * mend), r);',
      '  col += vec3(1.0, 0.85, 0.9) * exp(-r * (14.0 + 10.0 * mend)) * (0.35 + 0.25 * mend);',
      '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
      '  col = mix(col, vec3(lum), obey * 0.72);',
      '  col = statica(col, uv);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  };

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

  var running = [];

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

    if (reduce || opts.still || !webglSupported()) return handle;

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


  function cohNorm() {
    var C = window.SymbiQ && window.SymbiQ.coherence;
    return C ? clamp01(C.get() / 100) : 1;
  }

  function bindCoherence() {
    var C = window.SymbiQ && window.SymbiQ.coherence;
    if (!C) return false;
    var apply = function () {
      var v = clamp01(C.get() / 100);
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
      set: function (v) {
        v = clamp01(v);
        turb.setAttribute('baseFrequency', (0.004 + 0.055 * v).toFixed(4));
        disp.setAttribute('scale', (v * 9).toFixed(2));
        return api;
      },
      follow: function () { api.set(1 - cohNorm()); return api; },
      remove: function () {
        target.removeAttribute('filter');
        if (f.parentNode) f.parentNode.removeChild(f);
      }
    };
    return api.set(amount == null ? 0 : amount);
  }


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
    var geo = {
      jaw:   0.82 + R() * 0.30,
      cheek: 0.88 + R() * 0.26,
      brow:  R() * 6 - 3,
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

    var jw = 30 * geo.jaw, cw = 33 * geo.cheek;
    svg.appendChild(node('path', {
      d: 'M60 22 C' + (60 + cw) + ' 22 ' + (60 + cw) + ' 58 ' + (60 + cw * 0.86) + ' 74' +
         ' C' + (60 + jw) + ' 100 ' + (60 + jw * 0.5) + ' 112 60 112' +
         ' C' + (60 - jw * 0.5) + ' 112 ' + (60 - jw) + ' 100 ' + (60 - cw * 0.86) + ' 74' +
         ' C' + (60 - cw) + ' 58 ' + (60 - cw) + ' 22 60 22 Z',
      fill: '#131a2b', stroke: '#e5e9f1', 'stroke-width': 2.2, 'stroke-linejoin': 'round'
    }));
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
      var open = 1.4 + 4.2 * clamp01(e.eyes);
      eyeL.setAttribute('cy', y); eyeL.setAttribute('rx', 6.4); eyeL.setAttribute('ry', open);
      eyeR.setAttribute('cy', y); eyeR.setAttribute('rx', 6.4); eyeR.setAttribute('ry', open);
      pupL.setAttribute('cy', y); pupR.setAttribute('cy', y);
      pupL.setAttribute('r', Math.min(2.4, open * 0.55));
      pupR.setAttribute('r', Math.min(2.4, open * 0.55));
      var tilt = geo.brow + e.brow * 7;
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

    var busy = false, curEyes = e.eyes, gen = 0;
    var api = {
      el: svg,
      express: function (o, ms) {
        var from = { brow: e.brow, eyes: e.eyes, mouth: e.mouth };
        var to = {
          brow:  o && o.brow  != null ? Math.max(-1, Math.min(1, o.brow))  : e.brow,
          eyes:  o && o.eyes  != null ? clamp01(o.eyes)                    : e.eyes,
          mouth: o && o.mouth != null ? Math.max(-1, Math.min(1, o.mouth)) : e.mouth
        };
        var dur = reduce ? 0 : (ms == null ? 420 : ms), t0 = performance.now();
        var myGen = ++gen;
        busy = true;
        if (!dur) { e = to; paint(); busy = false; return api; }
        (function step(now) {
          if (myGen !== gen) return;
          var k = clamp01((now - t0) / dur), s = k * k * (3 - 2 * k);
          e.brow  = from.brow  + (to.brow  - from.brow)  * s;
          e.eyes  = from.eyes  + (to.eyes  - from.eyes)  * s;
          e.mouth = from.mouth + (to.mouth - from.mouth) * s;
          paint();
          if (k < 1) { requestAnimationFrame(step); } else { busy = false; }
        })(t0);
        return api;
      },
      mood: function (name, ms) {
        var M = {
          neutral:  { brow: 0,    eyes: 0.62, mouth: 0 },
          eager:    { brow: 0.7,  eyes: 0.90, mouth: 0.6 },
          troubled: { brow: -0.8, eyes: 0.45, mouth: -0.6 },
          narrowed: { brow: -0.3, eyes: 0.16, mouth: -0.15 },
          softened: { brow: 0.15, eyes: 0.55, mouth: 0.35 }
        };
        var target = M[name] || M.neutral;
        curEyes = target.eyes;
        return api.express(target, ms);
      }
    };
    function tween(myGen, from, to, dur, onDone) {
      var t0 = performance.now();
      (function step(now) {
        if (myGen !== gen) return;
        var k = clamp01((now - t0) / dur);
        e.eyes = from + (to - from) * k;
        paint();
        if (k < 1) requestAnimationFrame(step); else onDone();
      })(t0);
    }
    function scheduleBlink() {
      if (reduce) return;
      setTimeout(function () {
        if (!svg.isConnected) return;
        if (!busy) {
          busy = true;
          var myGen = ++gen, openEyes = curEyes;
          tween(myGen, openEyes, 0.05, 90, function () {
            tween(myGen, 0.05, openEyes, 110, function () { busy = false; });
          });
        }
        scheduleBlink();
      }, 3400 + Math.random() * 3200);
    }
    scheduleBlink();
    return api;
  }


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
      card.addEventListener('click', end);
      if (ms) setTimeout(end, ms); else end();
      requestAnimationFrame(function () { card.classList.add('in'); });
    });
  }


  function sequence(host, beats, opts) {
    opts = opts || {};
    if (!host) return null;
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


  function shareCard(o) {
    o = o || {};
    var W = 1200, H = 630;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');

    c.fillStyle = css(PAL.bg); c.fillRect(0, 0, W, H);
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
      mount: function (host) {
        if (!host) return null;
        var box = document.createElement('div');
        box.className = 'sharecard';
        cv.className = 'sharecard-img';
        cv.setAttribute('alt', (o.title || 'SymbiQ') + ', share card');
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
          api.download(o.file || 'symbiq').then(function (ok) { note.textContent = ok ? 'Saved.' : 'Could not save here, long-press the image.'; });
        });
        var cp = row.querySelector('[data-s=cp]');
        if (!navigator.clipboard || !window.ClipboardItem) cp.style.display = 'none';
        else cp.addEventListener('click', function () {
          api.copy().then(function (ok) { note.textContent = ok ? 'Copied, paste it anywhere.' : 'Copy is blocked here; use Download.'; });
        });
        return box;
      }
    };
    return api;
  }

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

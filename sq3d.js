import * as THREE from './vendor/three/three.module.min.js';

const W = typeof window !== 'undefined' ? window : null;
const coreApi = () => (W && W.SymbiQ && W.SymbiQ.core) || {};
const reduced = () => !!(coreApi().reduced && coreApi().reduced());
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);


const S2 = 1 / Math.sqrt(2), C4 = Math.cos(Math.PI / 4), S4 = Math.sin(Math.PI / 4);
export const GATES = {
  X: [[0, 0], [1, 0], [1, 0], [0, 0]],
  Y: [[0, 0], [0, -1], [0, 1], [0, 0]],
  Z: [[1, 0], [0, 0], [0, 0], [-1, 0]],
  H: [[S2, 0], [S2, 0], [S2, 0], [-S2, 0]],
  S: [[1, 0], [0, 0], [0, 0], [0, 1]],
  T: [[1, 0], [0, 0], [0, 0], [C4, S4]],
};
const cm = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
const ca = (p, q) => [p[0] + q[0], p[1] + q[1]];
export function applyGate(st, g) {
  const m = GATES[g], a = st[0], b = st[1];
  return [ca(cm(m[0], a), cm(m[1], b)), ca(cm(m[2], a), cm(m[3], b))];
}
export function blochOf(st) {
  const a = st[0], b = st[1], acb = cm([a[0], -a[1]], b);
  return [2 * acb[0], 2 * acb[1], (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1])];
}
export const ROT = {
  X: { axis: [1, 0, 0], angle: Math.PI },
  Y: { axis: [0, 1, 0], angle: Math.PI },
  Z: { axis: [0, 0, 1], angle: Math.PI },
  H: { axis: [S2, 0, S2], angle: Math.PI },
  S: { axis: [0, 0, 1], angle: Math.PI / 2 },
  T: { axis: [0, 0, 1], angle: Math.PI / 4 },
};
export function rotateVec(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), k = axis;
  const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const cx = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [v[0] * c + cx[0] * s + k[0] * dot * (1 - c), v[1] * c + cx[1] * s + k[1] * dot * (1 - c), v[2] * c + cx[2] * s + k[2] * dot * (1 - c)];
}

export const ZS = [[0, 1, 3, 4], [4, 5, 7, 8], [2, 5], [3, 6]];
export const XS = [[0, 1], [1, 2, 4, 5], [3, 4, 6, 7], [7, 8]];
const mask = (list) => list.reduce((m, i) => m | (1 << i), 0);
const weight = (e) => { let w = 0; while (e) { w += e & 1; e >>= 1; } return w; };
export const zM = ZS.map(mask), xM = XS.map(mask);
const group = (ms) => { const g = new Set(); for (let s = 0; s < 1 << ms.length; s++) { let x = 0; for (let i = 0; i < ms.length; i++) if (s & (1 << i)) x ^= ms[i]; g.add(x); } return g; };
export const xGroup = group(xM);
export const zGroup = group(zM);
const ORDER = Array.from({ length: 512 }, (_, i) => i).sort((a, b) => (weight(a) - weight(b)) || (a - b));
export function syndrome(err, checks) { let s = 0; for (let i = 0; i < checks.length; i++) if (weight(err & checks[i]) & 1) s |= 1 << i; return s; }
export function decodeMW(target, checks) { for (const e of ORDER) if (syndrome(e, checks) === target) return e; return 0; }

function outcome(err, checks, stab) {
  const s = syndrome(err, checks);
  const fix = s ? decodeMW(s, checks) : 0;
  const net = err ^ fix;
  let kind;
  if (!err) kind = 'clean';
  else if (!s) kind = stab.has(err) ? 'harmless' : 'silent';
  else if (!net) kind = 'corrected';
  else if (stab.has(net)) kind = 'equivalent';
  else kind = 'miscorrected';
  return { syn: s, fix, net, kind, logical: (kind === 'silent' || kind === 'miscorrected') };
}
export function analyse(ex, ez) {
  return { x: outcome(ex & 511, zM, xGroup), z: outcome(ez & 511, xM, zGroup) };
}

function makeEnv(renderer, scene) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0x24314f, side: THREE.BackSide })));
  const box = (c, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3.4), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  box(0xfff2dd, 14, 22, 10, 22, 12); box(0x9ad8ff, -22, 8, -10, 10, 24); box(0xc9b8ff, 6, 4, -24, 26, 6); box(0xffffff, 0, -16, 12, 20, 4);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.03).texture; scene.environmentIntensity = 1.0; pm.dispose();
}

export function createStage(host, o = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sq3d-canvas'; canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
  if (o.label) canvas.setAttribute('aria-label', o.label);
  host.appendChild(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); return null; }
  renderer.setPixelRatio(Math.min(W.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a12);
  const camera = new THREE.PerspectiveCamera(o.fov || 38, 1, 0.05, 200);
  makeEnv(renderer, scene);
  const key = new THREE.DirectionalLight(0xfff1dd, 1.2); key.position.set(6, 12, 8); scene.add(key);
  scene.add(new THREE.HemisphereLight(0x8fb2ff, 0x101522, 0.55));

  const home = Object.assign({ r: 6, az: 0.6, el: 0.35, target: V3() }, o.view || {});
  const cam = { r: home.r, az: home.az, el: home.el, target: home.target.clone(), vaz: 0, vel: 0, fly: null, rmin: o.rmin || home.r * 0.4, rmax: o.rmax || home.r * 2.2 };
  const st = { active: true, onScreen: true, interacted: false, armed: false, raf: 0, last: 0, running: false, frames: [], tap: null, hover: null, disposed: false };
  const place = () => {
    const c = Math.cos(cam.el);
    camera.position.set(cam.target.x + cam.r * Math.sin(cam.az) * c, cam.target.y + cam.r * Math.sin(cam.el), cam.target.z + cam.r * Math.cos(cam.az) * c);
    camera.lookAt(cam.target);
  };
  const fitK = () => Math.max(1, 0.42 / (camera.aspect * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
  const size = () => {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    cam.rmax = (o.rmax || home.r * 2.2) * fitK();
    if (!st.interacted && !cam.fly) cam.r = home.r * fitK();
  };
  const ro = new ResizeObserver(size); ro.observe(host); size();

  function flyTo(g, ms) {
    if (reduced() || !ms) { Object.assign(cam, { r: g.r ?? cam.r, az: g.az ?? cam.az, el: g.el ?? cam.el }); cam.fly = null; return; }
    let daz = (g.az ?? cam.az) - cam.az; daz = Math.atan2(Math.sin(daz), Math.cos(daz));
    cam.fly = { t0: performance.now(), ms, from: { r: cam.r, az: cam.az, el: cam.el }, to: { r: g.r ?? cam.r, az: cam.az + daz, el: g.el ?? cam.el } };
  }

  const ptrs = new Map(); let down = null, pinch0 = 0;
  const touch = () => { st.interacted = true; cam.fly = null; };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); st.armed = true;
    if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, moved: 0 };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); down = null; }
    touch(); cam.vaz = cam.vel = 0; canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (st.hoverFn) st.hoverFn(e.clientX, e.clientY); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) { if (down) down.moved += Math.abs(dx) + Math.abs(dy); cam.az -= dx * 0.0065; cam.el = clamp(cam.el + dy * 0.0065, -1.35, 1.5); cam.vaz = -dx * 0.0065; cam.vel = dy * 0.0065; }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) cam.r = clamp(cam.r * (pinch0 / d), cam.rmin, cam.rmax); pinch0 = d; }
  });
  const end = (e) => {
    const one = ptrs.size === 1; ptrs.delete(e.pointerId);
    if (one && down && down.moved < 7 && e.type === 'pointerup' && st.tap) st.tap(e.clientX, e.clientY);
    if (!ptrs.size) down = null; pinch0 = 0;
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('blur', () => { st.armed = false; });
  canvas.addEventListener('wheel', (e) => { if (!st.armed) return; e.preventDefault(); touch(); cam.r = clamp(cam.r * Math.exp(e.deltaY * 0.0014), cam.rmin, cam.rmax); }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const k = e.key; let used = true; touch();
    if (k === 'ArrowLeft') cam.az -= 0.12; else if (k === 'ArrowRight') cam.az += 0.12;
    else if (k === 'ArrowUp') cam.el = clamp(cam.el + 0.1, -1.35, 1.5); else if (k === 'ArrowDown') cam.el = clamp(cam.el - 0.1, -1.35, 1.5);
    else if (k === '+' || k === '=') cam.r = clamp(cam.r * 0.88, cam.rmin, cam.rmax); else if (k === '-' || k === '_') cam.r = clamp(cam.r * 1.14, cam.rmin, cam.rmax);
    else if (k === '0') stage.reset(); else used = false;
    if (used) e.preventDefault();
  });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function frame(now) {
    st.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
    if (cam.fly) {
      const f = cam.fly, t = clamp((now - f.t0) / f.ms, 0, 1), e = ease(t);
      cam.r = f.from.r + (f.to.r - f.from.r) * e; cam.az = f.from.az + (f.to.az - f.from.az) * e; cam.el = f.from.el + (f.to.el - f.from.el) * e;
      if (t >= 1) cam.fly = null;
    } else if (!ptrs.size) {
      cam.az += cam.vaz; cam.el = clamp(cam.el + cam.vel, -1.35, 1.5); cam.vaz *= 0.92; cam.vel *= 0.92;
      if (!st.interacted && !reduced() && o.spin !== false) cam.az += dt * 0.12;
    }
    cam.r = clamp(cam.r, cam.rmin, cam.rmax); place();
    for (const fn of st.frames) fn(now / 1000, dt);
    renderer.render(scene, camera);
  }
  function loop() {
    const want = st.active && st.onScreen && !document.hidden && !st.disposed;
    if (want && !st.running) { st.running = true; st.last = performance.now(); st.raf = requestAnimationFrame(frame); }
    else if (!want && st.running) { st.running = false; cancelAnimationFrame(st.raf); }
  }
  const io = new IntersectionObserver((es) => { st.onScreen = es[0].isIntersecting; loop(); }, { threshold: 0.02 }); io.observe(host);
  const vis = () => loop(); document.addEventListener('visibilitychange', vis);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); st.running = false; cancelAnimationFrame(st.raf); host.classList.add('is-lost'); });
  canvas.addEventListener('webglcontextrestored', () => { host.classList.remove('is-lost'); loop(); });
  place(); loop();

  const stage = {
    THREE, renderer, scene, camera, canvas, cam, state: st,
    frame: (fn) => st.frames.push(fn),
    setActive: (b) => { st.active = !!b; loop(); if (b) size(); },
    tap: (fn) => { st.tap = fn; },
    hover: (fn) => { st.hoverFn = fn; },
    reset: () => flyTo({ r: home.r * fitK(), az: home.az, el: home.el }, 700),
    pick(cx, cy, objs) {
      const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); const hits = ray.intersectObjects(objs, true); return hits.length ? hits[0] : null;
    },
    render: () => renderer.render(scene, camera),
    dispose() {
      st.disposed = true; loop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis);
      scene.traverse((o2) => { if (o2.geometry) o2.geometry.dispose(); if (o2.material) [].concat(o2.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
      renderer.dispose(); canvas.remove();
    },
  };
  return stage;
}

function label(text, o = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), px = o.px || 64;
  g.font = `600 ${px}px ${o.font || 'Inter, "Segoe UI", system-ui, sans-serif'}`;
  const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = px + 24;
  g.font = `600 ${px}px ${o.font || 'Inter, "Segoe UI", system-ui, sans-serif'}`; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillStyle = o.color || '#dbe3f3'; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 8; g.fillText(text, w / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  const h = o.h || 0.22; s.scale.set(h * w / c.height, h, 1); s.renderOrder = 10; return s;
}

const b2t = (v) => V3(v[0], v[2], -v[1]);
const ax2t = (a) => V3(a[0], a[2], -a[1]);

export function mountBloch(ctx) {
  const stage = createStage(ctx.host, {
    label: 'The Bloch sphere in 3D. It shows the same state as the flat view; use the gate buttons above or below to turn it.',
    view: { r: 4.05, az: -0.65, el: 0.42 }, rmin: 2.4, rmax: 8,
  });
  if (!stage) return null;
  const { scene } = stage;
  const grp = new THREE.Group(); scene.add(grp);

  grp.add(new THREE.Mesh(new THREE.SphereGeometry(1, 56, 36), new THREE.MeshPhysicalMaterial({ color: 0x6d87b6, transparent: true, opacity: 0.1, roughness: 0.15, side: THREE.DoubleSide, depthWrite: false })));
  const wire = [];
  const ring = (fn, n = 96) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(fn(i / n * Math.PI * 2)); return pts; };
  for (const lat of [-60, -30, 30, 60]) { const y = Math.sin(lat * Math.PI / 180), r = Math.cos(lat * Math.PI / 180); wire.push(ring((t) => V3(r * Math.cos(t), y, r * Math.sin(t)))); }
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 6; wire.push(ring((t) => V3(Math.cos(t) * Math.cos(a), Math.sin(t), Math.cos(t) * Math.sin(a)))); }
  const wireMat = new THREE.LineBasicMaterial({ color: 0x8fa3c7, transparent: true, opacity: 0.2 });
  wire.forEach((pts) => grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat)));
  grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring((t) => V3(Math.cos(t), 0, Math.sin(t)))), new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.85 })));

  const axMat = new THREE.LineBasicMaterial({ color: 0xb8c4dd, transparent: true, opacity: 0.55 });
  for (const a of [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)]) grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.clone().multiplyScalar(-1.18), a.clone().multiplyScalar(1.18)]), axMat));
  for (const [t, v] of [['|0⟩', [0, 0, 1]], ['|1⟩', [0, 0, -1]], ['|+⟩', [1, 0, 0]], ['|−⟩', [-1, 0, 0]], ['|i⟩', [0, 1, 0]], ['|−i⟩', [0, -1, 0]]]) {
    const s = label(t, { h: 0.2 }); s.position.copy(b2t(v)).multiplyScalar(1.36); grp.add(s);
  }

  const arrow = new THREE.Group(); grp.add(arrow);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 14), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffa41b, emissiveIntensity: 0.55, roughness: 0.4 }));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 20), shaft.material);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd76a, emissiveIntensity: 1.2, roughness: 0.3 }));
  arrow.add(shaft, head, bead);
  const plumbGeo = new THREE.BufferGeometry().setFromPoints([V3(), V3()]);
  const plumb = new THREE.Line(plumbGeo, new THREE.LineDashedMaterial({ color: 0xe8ecf6, transparent: true, opacity: 0.4, dashSize: 0.05, gapSize: 0.04 }));
  const foot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), new THREE.MeshBasicMaterial({ color: 0xe8ecf6, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  foot.rotation.x = -Math.PI / 2; grp.add(plumb, foot);
  const TRAIL = 220, trailPts = [], trailGeo = new THREE.BufferGeometry(), trailCol = new Float32Array(TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3)); trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true })); trail.frustumCulled = false; grp.add(trail);
  const axisLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(0, -1.3, 0), V3(0, 1.3, 0)]), new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.9 }));
  axisLine.visible = false; grp.add(axisLine);

  const bg = new THREE.Color(0x070a12), vio = new THREE.Color(0xa78bfa);
  function paintTrail() {
    const pos = trailGeo.attributes.position.array, n = trailPts.length;
    for (let i = 0; i < n; i++) {
      const p = trailPts[i]; pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      const f = (i + 1) / n; trailCol[i * 3] = bg.r + (vio.r - bg.r) * f; trailCol[i * 3 + 1] = bg.g + (vio.g - bg.g) * f; trailCol[i * 3 + 2] = bg.b + (vio.b - bg.b) * f;
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true; trailGeo.setDrawRange(0, n);
  }
  const up = V3(0, 1, 0), q = new THREE.Quaternion();
  function setArrow(v) {
    const t = b2t(v), len = Math.max(t.length(), 1e-6), dir = t.clone().normalize();
    q.setFromUnitVectors(up, dir); arrow.quaternion.copy(q);
    const shaftLen = Math.max(len - 0.1, 0.02);
    shaft.scale.set(1, shaftLen, 1); shaft.position.set(0, shaftLen / 2, 0); head.position.set(0, shaftLen + 0.08, 0); bead.position.set(0, len, 0);
    const pos = plumbGeo.attributes.position; pos.setXYZ(0, t.x, t.y, t.z); pos.setXYZ(1, t.x, 0, t.z); pos.needsUpdate = true; plumb.computeLineDistances();
    foot.position.set(t.x, 0.001, t.z);
  }

  let cur = ctx.api ? blochOf(ctx.api.state()) : [0, 0, 1], anim = null, gate = null;
  setArrow(cur); trailPts.push(b2t(cur)); paintTrail();
  function push(v) { const t = b2t(v); trailPts.push(t); if (trailPts.length > TRAIL) trailPts.shift(); paintTrail(); }

  function onState(st, last, first) {
    const target = blochOf(st);
    if (first) { cur = target; setArrow(cur); trailPts.length = 0; trailPts.push(b2t(cur)); paintTrail(); return; }
    if (anim) { cur = anim.target; setArrow(cur); anim = null; axisLine.visible = false; }
    const from = cur.slice();
    const visible = ctx.isVisible ? ctx.isVisible() : true;
    if (!visible || reduced()) { cur = target; setArrow(cur); push(cur); if (!last) { trailPts.length = 0; trailPts.push(b2t(cur)); paintTrail(); } return; }
    let axis, angle;
    if (last && ROT[last]) { axis = ROT[last].axis; angle = ROT[last].angle; gate = last; }
    else {
      const dot = clamp(from[0] * target[0] + from[1] * target[1] + from[2] * target[2], -1, 1);
      let k = [from[1] * target[2] - from[2] * target[1], from[2] * target[0] - from[0] * target[2], from[0] * target[1] - from[1] * target[0]];
      let kl = Math.hypot(k[0], k[1], k[2]);
      if (kl < 1e-9) { k = Math.abs(from[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; k = [from[1] * k[2] - from[2] * k[1], from[2] * k[0] - from[0] * k[2], from[0] * k[1] - from[1] * k[0]]; kl = Math.hypot(k[0], k[1], k[2]); }
      axis = k.map((x) => x / kl); angle = Math.acos(dot); gate = null;
    }
    if (angle < 1e-9) { cur = target; setArrow(cur); return; }
    anim = { t0: performance.now(), dur: 300 + 420 * (angle / Math.PI), from, axis, angle, target, reset: !last };
    const at = ax2t(axis).normalize(); axisLine.quaternion.setFromUnitVectors(up, at); axisLine.visible = !anim.reset;
  }
  stage.frame(() => {
    if (!anim) return;
    const t = clamp((performance.now() - anim.t0) / anim.dur, 0, 1), e = ease(t);
    const v = rotateVec(anim.from, anim.axis, anim.angle * e);
    cur = v; setArrow(v); push(v);
    if (t >= 1) { cur = anim.target; setArrow(cur); axisLine.visible = false; if (anim.reset) { trailPts.length = 0; trailPts.push(b2t(cur)); paintTrail(); } anim = null; }
  });

  if (ctx.api) ctx.api.on(onState);
  return {
    stage, setActive: (b) => stage.setActive(b), reset: () => stage.reset(),
    get vector() { return cur; },
    dispose: () => stage.dispose(),
  };
}

const SP = 1.5;
const QPOS = Array.from({ length: 9 }, (_, i) => V3((i % 3 - 1) * SP, 0, (Math.floor(i / 3) - 1) * SP));

function plaquette(list) {
  const P = list.map((i) => QPOS[i]);
  const cx = P.reduce((s, p) => s + p.x, 0) / P.length, cz = P.reduce((s, p) => s + p.z, 0) / P.length;
  let pts, anc;
  if (P.length === 4) {
    const order = [P[0], P[1], P[3], P[2]];
    pts = order.map((p) => [cx + (p.x - cx) * 0.9, cz + (p.z - cz) * 0.9]); anc = [cx, cz];
  } else {
    const a = P[0], b = P[1], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const nx = Math.abs(mx) > Math.abs(mz) ? Math.sign(mx) : 0, nz = Math.abs(mx) > Math.abs(mz) ? 0 : Math.sign(mz);
    const R = SP * 0.5 * 0.92, ang0 = Math.atan2(nz, nx); pts = [];
    for (let i = 0; i <= 24; i++) { const t = ang0 - Math.PI / 2 + Math.PI * i / 24; pts.push([mx + R * Math.cos(t), mz + R * Math.sin(t)]); }
    anc = [mx + nx * R * 0.5, mz + nz * R * 0.5];
  }
  return { pts, anc, list };
}
const ZPLAQ = ZS.map(plaquette), XPLAQ = XS.map(plaquette);

const NAMES = { Z: ['Z₁', 'Z₂', 'Z₃', 'Z₄'], X: ['X₁', 'X₂', 'X₃', 'X₄'] };
const listNames = (s, pre) => NAMES[pre].filter((_, i) => s & (1 << i)).join(', ');
const qnames = (m) => { const o = []; for (let i = 0; i < 9; i++) if (m & (1 << i)) o.push(i + 1); return o.join(', '); };

export function mountSurface(ctx) {
  const card = ctx.card;
  const stageHost = card.querySelector('.s3d-stage');
  const stage = createStage(stageHost, {
    label: 'Surface-17 in 3D: nine data qubits in the middle, the bit-flip checks on an upper layer and the phase-flip checks on a lower layer. Use the buttons below to add errors.',
    view: { r: 8.6, az: 0.5, el: 0.62 }, rmin: 4.5, rmax: 16,
  });
  if (!stage) return null;
  const { scene } = stage;
  const root = new THREE.Group(); scene.add(root);
  const state = { ex: 0, ez: 0, unfold: 0.65, logical: false, hover: -1, ran: false };

  const dataMat = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.3, emissive: 0x000000 });
  const qs = QPOS.map((p, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 28, 20), dataMat(0x9db2d6)); m.position.copy(p); m.userData.q = i; root.add(m);
    const l = label(String(i + 1), { h: 0.2, color: '#ffffff' }); l.position.set(0, 0, 0); m.add(l);
    return m;
  });
  const ringOf = (R, col, flat, op) => QPOS.map((p) => { const t = new THREE.Mesh(new THREE.TorusGeometry(R, 0.028, 10, 44), new THREE.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op })); if (flat) t.rotation.x = Math.PI / 2; t.position.copy(p); t.visible = false; root.add(t); return t; });
  const xRing = ringOf(0.36, 0xff5d5d, true, 1), zRing = ringOf(0.42, 0x5ec8ff, false, 1);
  const fxRing = ringOf(0.5, 0x2dd4bf, true, 0.85), fzRing = ringOf(0.56, 0x2dd4bf, false, 0.85);

  function layer(plaqs, baseColor, sign) {
    const tiles = [], ancs = [], stems = [];
    plaqs.forEach((pl) => {
      const sh = new THREE.Shape(pl.pts.map((p) => new THREE.Vector2(p[0], -p[1])));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({ color: baseColor, transparent: true, opacity: 0.3, roughness: 0.4, metalness: 0.2, emissive: baseColor, emissiveIntensity: 0.08, side: THREE.DoubleSide, depthWrite: false });
      const tile = new THREE.Mesh(geo, mat); root.add(tile);
      tile.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pl.pts.map((p) => V3(p[0], 0.04, p[1]))), new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.7 })));
      const anc = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), new THREE.MeshStandardMaterial({ color: baseColor, emissive: baseColor, emissiveIntensity: 0.25, roughness: 0.35 })); root.add(anc);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pl.list.length * 6), 3));
      const stem = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.55 })); stem.frustumCulled = false; root.add(stem);
      tiles.push(tile); ancs.push(anc); stems.push({ obj: stem, list: pl.list });
    });
    return { tiles, ancs, stems, sign, plaqs };
  }
  const zLayer = layer(ZPLAQ, 0x2dd4bf, 1), xLayer = layer(XPLAQ, 0xa78bfa, -1);
  const zLab = ZPLAQ.map((pl, i) => { const s2 = label(NAMES.Z[i], { h: 0.2, color: '#9ff3e6' }); root.add(s2); return s2; });
  const xLab = XPLAQ.map((pl, i) => { const s2 = label(NAMES.X[i], { h: 0.2, color: '#d4c6ff' }); root.add(s2); return s2; });

  const chainMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
  const chain = (ids, c) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ids.map((i) => QPOS[i].clone().setY(0.02))), 24, 0.06, 8), chainMat(c));
  const xChain = chain([0, 3, 6], 0xff5d5d), zChain = chain([0, 1, 2], 0x5ec8ff);
  xChain.visible = zChain.visible = false; root.add(xChain, zChain);
  const cLab = [label('X̄: 1, 4, 7', { h: 0.2, color: '#ff9c9c' }), label('Z̄: 1, 2, 3', { h: 0.2, color: '#a8dcff' })];
  cLab[0].position.copy(QPOS[6]).add(V3(-0.6, 0.5, 0.55)); cLab[1].position.copy(QPOS[2]).add(V3(0.75, 0.5, -0.1)); cLab.forEach((l) => { l.visible = false; root.add(l); });

  function relayout() {
    const L = 1.25 * state.unfold;
    for (const ly of [zLayer, xLayer]) {
      const y = ly.sign * L;
      ly.tiles.forEach((t) => { t.position.y = y; });
      ly.ancs.forEach((a, i) => { a.position.set(ly.plaqs[i].anc[0], y + 0.05, ly.plaqs[i].anc[1]); });
      ly.stems.forEach((s2, i) => {
        const a = ly.ancs[i].position, arr = s2.obj.geometry.attributes.position; let k = 0;
        s2.list.forEach((qi) => { arr.setXYZ(k++, a.x, a.y, a.z); arr.setXYZ(k++, QPOS[qi].x, QPOS[qi].y, QPOS[qi].z); });
        arr.needsUpdate = true;
      });
    }
    zLab.forEach((s2, i) => s2.position.set(ZPLAQ[i].anc[0], L + 0.36, ZPLAQ[i].anc[1]));
    xLab.forEach((s2, i) => s2.position.set(XPLAQ[i].anc[0], -L + 0.36, XPLAQ[i].anc[1]));
  }

  const ui = document.createElement('div'); ui.className = 's3d-ui';
  ui.innerHTML =
    '<p class="s3d-legend">Teal layer: the checks that catch <b>bit flips</b> (Z-type). Violet layer: the checks that catch <b>phase flips</b> (X-type). ' +
    '<span class="s3d-k s3d-kx"></span> bit flip &middot; <span class="s3d-k s3d-kz"></span> phase flip &middot; amber: a check firing &middot; <span class="s3d-k s3d-kf"></span> the decoder&rsquo;s repair.</p>' +
    '<div class="s3d-row"><div class="s3d-grid" role="group" aria-label="The nine data qubits. Activate one to cycle it through no error, bit flip, phase flip, both."></div>' +
    '<div class="s3d-btns"><button type="button" class="preset" data-a="reset">Reset</button><button type="button" class="preset" data-a="one">One bit flip</button><button type="button" class="preset" data-a="phase">One phase flip</button>' +
    '<button type="button" class="preset" data-a="pair">A pair that lies</button><button type="button" class="preset" data-a="xchain">The silent bit-flip chain</button><button type="button" class="preset" data-a="zchain">The silent phase-flip chain</button>' +
    '<button type="button" class="preset s3d-run" data-a="run">Run the decoder</button></div></div>' +
    '<div class="s3d-tog"><label class="s3d-unf">Unfold the layers <input type="range" min="0" max="100" value="65" aria-label="Unfold the two layers of checks"></label>' +
    '<label class="s3d-chk"><input type="checkbox"> Show the shortest chains no check can see</label></div>' +
    '<div class="formula s3d-out" aria-live="polite"></div>';
  const noteEl = card.querySelector('.s3d-note'); if (noteEl) card.insertBefore(ui, noteEl); else card.appendChild(ui);
  const gridEl = ui.querySelector('.s3d-grid'), outEl = ui.querySelector('.s3d-out');
  const qBtn = QPOS.map((_, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 's3d-q'; b.setAttribute('data-q', i); gridEl.appendChild(b); return b; });
  const SYM = { 0: '·', 1: 'X', 2: 'Z', 3: 'Y' }, WORD = { 0: 'no error', 1: 'bit flip', 2: 'phase flip', 3: 'bit and phase flip' };
  const kindOf = (i) => ((state.ex >> i) & 1) | (((state.ez >> i) & 1) << 1);

  const SAY = {
    x: {
      harmless: () => 'Every Z check reads clean, <strong>correctly</strong>. Your bit flips form a product of X checks: something physically happened and logically nothing changed. The code did not need to act.',
      silent: () => '<strong>Silent failure.</strong> Your bit flips form a chain no Z check can see, and it runs from one edge of the code to the other: the logical qubit is flipped while every bit-flip alarm stays quiet.',
      corrected: (a) => `Z checks firing: <strong>${listNames(a.syn, 'Z')}</strong>. The decoder infers exactly your flips and undoes them. <strong>Corrected.</strong>`,
      equivalent: (a) => `Z checks firing: <strong>${listNames(a.syn, 'Z')}</strong>. The decoder repairs <em>different</em> qubits (${qnames(a.fix)}) than you flipped, but the difference is a product of X checks, so logically nothing changed.`,
      miscorrected: (a) => `Z checks firing: <strong>${listNames(a.syn, 'Z')}</strong>, but your flips imitate a <em>smaller</em> error, so the decoder&rsquo;s cheapest explanation is wrong and its repair completes a chain across the code. <strong>Logical bit flip.</strong>`,
    },
    z: {
      harmless: () => 'Every X check reads clean, <strong>correctly</strong>. Your phase flips form a product of Z checks: logically nothing changed.',
      silent: () => '<strong>Silent failure.</strong> Your phase flips form a chain no X check can see, edge to edge: the logical phase is flipped while every phase alarm stays quiet.',
      corrected: (a) => `X checks firing: <strong>${listNames(a.syn, 'X')}</strong>. The decoder infers exactly your flips and undoes them. <strong>Corrected.</strong>`,
      equivalent: (a) => `X checks firing: <strong>${listNames(a.syn, 'X')}</strong>. The decoder repairs <em>different</em> qubits (${qnames(a.fix)}), but the difference is a product of Z checks, so logically nothing changed.`,
      miscorrected: (a) => `X checks firing: <strong>${listNames(a.syn, 'X')}</strong>, but your flips imitate a <em>smaller</em> error, so the decoder guesses wrong and completes a chain across the code. <strong>Logical phase flip.</strong>`,
    },
  };
  function describe(a) {
    const rows = [];
    if (!state.ex && !state.ez) return (state.ran ? 'The decoder ran on a clean lattice: nothing to do. ' : '') + 'All eight checks read clean and the logical qubit is safe. <strong>Tap a qubit</strong>, or use the grid, to give it an error: once for a bit flip, twice for a phase flip, three times for both.';
    if (a.x.kind !== 'clean') rows.push('<p><span class="s3d-tag s3d-tx">Bit flips</span> ' + SAY.x[a.x.kind](a.x) + '</p>');
    if (a.z.kind !== 'clean') rows.push('<p><span class="s3d-tag s3d-tz">Phase flips</span> ' + SAY.z[a.z.kind](a.z) + '</p>');
    const lx = a.x.logical, lz = a.z.logical;
    rows.push('<p class="s3d-verdict ' + (lx || lz ? 'bad' : 'good') + '">' + (state.ran ? 'The decoder ran. ' : '') +
      (lx && lz ? 'Logical qubit: both a bit flip and a phase flip got through.' : lx ? 'Logical qubit: flipped.' : lz ? 'Logical qubit: its phase is flipped.' : 'Logical qubit: intact.') + '</p>');
    return rows.join('');
  }

  function refresh(quiet) {
    const a = analyse(state.ex, state.ez);
    for (let i = 0; i < 9; i++) {
      const ex = !!(state.ex & (1 << i)), ez = !!(state.ez & (1 << i));
      xRing[i].visible = ex; zRing[i].visible = ez;
      fxRing[i].visible = !!(a.x.fix & (1 << i)); fzRing[i].visible = !!(a.z.fix & (1 << i));
      const c = ex && ez ? 0xd66bff : ex ? 0xff7a7a : ez ? 0x7fd0ff : 0x9db2d6;
      qs[i].material.color.setHex(c); qs[i].material.emissive.setHex(ex || ez ? c : 0x000000); qs[i].material.emissiveIntensity = ex || ez ? 0.35 : 0;
      const k = kindOf(i); qBtn[i].textContent = SYM[k]; qBtn[i].setAttribute('data-k', k);
      qBtn[i].setAttribute('aria-label', 'Qubit ' + (i + 1) + ': ' + WORD[k] + '. Activate to change.');
    }
    const paint = (ly, syn) => ly.tiles.forEach((t, i) => {
      const on = !!(syn & (1 << i)), base = ly === zLayer ? 0x2dd4bf : 0xa78bfa, an = ly.ancs[i];
      t.material.opacity = on ? 0.6 : 0.28; t.material.emissive.setHex(on ? 0xffb020 : base); t.material.emissiveIntensity = on ? 0.55 : 0.08;
      an.material.color.setHex(on ? 0xffc44d : base); an.material.emissive.setHex(on ? 0xffa41b : base); an.material.emissiveIntensity = on ? 1.1 : 0.25;
    });
    paint(zLayer, a.x.syn); paint(xLayer, a.z.syn);
    xChain.visible = zChain.visible = cLab[0].visible = cLab[1].visible = state.logical;
    outEl.innerHTML = describe(a);
    if (ctx.onChange && !quiet) ctx.onChange(state, a);
    return a;
  }

  const pulse = [];
  function cycle(i) {
    const k = (kindOf(i) + 1) & 3, b = 1 << i;
    state.ex = (state.ex & ~b) | ((k & 1) ? b : 0); state.ez = (state.ez & ~b) | ((k & 2) ? b : 0);
    state.ran = false; pulse.push({ q: i, t: performance.now() }); refresh();
  }
  const set = (ex, ez) => { state.ex = ex & 511; state.ez = ez & 511; state.ran = false; refresh(); };
  const bit = (...l) => l.reduce((m, i) => m | (1 << i), 0);
  const ACT = {
    reset: () => set(0, 0),
    one: () => set(1 << Math.floor(Math.random() * 9), 0),
    phase: () => set(0, 1 << Math.floor(Math.random() * 9)),
    pair: () => set(bit(0, 4), 0),
    xchain: () => set(bit(0, 3, 6), 0),
    zchain: () => set(0, bit(0, 1, 2)),
    run: () => { const a = analyse(state.ex, state.ez); state.ex = a.x.net; state.ez = a.z.net; state.ran = true; refresh(); },
  };
  ui.addEventListener('click', (e) => {
    const q = e.target.closest('.s3d-q'); if (q) { cycle(+q.getAttribute('data-q')); return; }
    const b = e.target.closest('[data-a]'); if (b && ACT[b.getAttribute('data-a')]) ACT[b.getAttribute('data-a')]();
  });
  ui.querySelector('.s3d-unf input').addEventListener('input', (e) => { state.unfold = +e.target.value / 100; relayout(); });
  ui.querySelector('.s3d-chk input').addEventListener('change', (e) => { state.logical = e.target.checked; refresh(true); });

  stage.tap((x, y) => { const h = stage.pick(x, y, qs); if (h) cycle(h.object.userData.q); });
  stage.hover((x, y) => { const h = stage.pick(x, y, qs); const i = h ? h.object.userData.q : -1; if (i !== state.hover) { state.hover = i; stage.canvas.style.cursor = i >= 0 ? 'pointer' : 'grab'; } });
  stage.canvas.style.cursor = 'grab';

  stage.frame((t) => {
    const now = performance.now(), beat = 0.5 + 0.5 * Math.sin(t * 5), a = analyse(state.ex, state.ez);
    const still = reduced();
    zLayer.ancs.forEach((m, i) => m.scale.setScalar(!still && (a.x.syn & (1 << i)) ? 1 + 0.25 * beat : 1));
    xLayer.ancs.forEach((m, i) => m.scale.setScalar(!still && (a.z.syn & (1 << i)) ? 1 + 0.25 * beat : 1));
    qs.forEach((m, i) => { const p = pulse.find((u) => u.q === i); const k = p && !still ? clamp((now - p.t) / 350, 0, 1) : 1; m.scale.setScalar(1 + (1 - k) * 0.35 + (i === state.hover ? 0.08 : 0)); });
    for (let i = pulse.length - 1; i >= 0; i--) if (now - pulse[i].t > 400) pulse.splice(i, 1);
  });

  relayout(); refresh(true);
  return {
    stage, state, card, act: ACT, cycle, set,
    setActive: (b) => stage.setActive(b),
    unfold(v) { state.unfold = clamp(v, 0, 1); relayout(); },
    showLogical(b) { state.logical = !!b; refresh(true); },
    dispose: () => { stage.dispose(); ui.remove(); },
  };
}

export const mounts = { bloch: mountBloch, surface: mountSurface };
export default { mounts };

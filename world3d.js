import * as THREE from './vendor/three/three.module.min.js';

const W = window, D = document;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const reduced = () => !!(W.SymbiQ && W.SymbiQ.core && W.SymbiQ.core.reduced && W.SymbiQ.core.reduced());
const esc = (s) => (W.SymbiQ && W.SymbiQ.core && W.SymbiQ.core.esc) ? W.SymbiQ.core.esc(s) : String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const RING = 34, LIMIT = 74, BR = 5.6, DOOR = 8.6;
const KEYS = /^(Key[WASDEM]|Space|Enter|Escape|Arrow(Up|Down|Left|Right))$/;

function std(color, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.78, metalness: 0.08, flatShading: true }, extra || {})); }

const BUILD = {
  observatory(c) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5, 5, 16), std(0x2a2350)); base.position.y = 2.5; g.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(c, { emissive: c, emissiveIntensity: 0.18 })); dome.position.y = 5; g.add(dome);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(1, 4.2, 2.4), std(0x0b1020)); slit.position.set(0, 7.2, 2.2); slit.rotation.x = -0.5; g.add(slit);
    return g;
  },
  fridge(c) {
    const g = new THREE.Group();
    [[4.4, 1.1], [3.8, 1.1], [3.2, 1.1], [2.6, 1.1], [2.0, 1.1], [1.4, 1.1]].forEach((p, i) => {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(p[0], p[0], 0.5, 20), std(c, { metalness: 0.7, roughness: 0.35 })); plate.position.y = 10.5 - i * 1.75; g.add(plate);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.25, 6), std(0xb8c4d8)); rod.position.set(1.1, 9.6 - i * 1.75, 0.4); g.add(rod);
    });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.5, 20), std(0x6f8fd6, { emissive: 0x6f8fd6, emissiveIntensity: 0.5 })); can.position.y = 1.4; g.add(can);
    const pl = new THREE.Mesh(new THREE.BoxGeometry(11, 0.5, 9), std(0x1a2238)); pl.position.y = 0.25; g.add(pl);
    return g;
  },
  arcade(c) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(10, 6.5, 8), std(0x2b1a3c)); b.position.y = 3.25; g.add(b);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(9, 1.8, 0.5), std(c, { emissive: c, emissiveIntensity: 0.9 })); sign.position.set(0, 7.4, 3.9); g.add(sign);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.4), std(0x0b1020, { emissive: [0x2dd4bf, 0xa78bfa, 0xfbbf24][i], emissiveIntensity: 0.55 })); s.position.set(-3 + i * 3, 3, 4.05); g.add(s); }
    return g;
  },
  court(c) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 7), std(0xcfc9b8, { roughness: 0.9 })); b.position.y = 2.5 + 0.5; g.add(b);
    for (let i = 0; i < 5; i++) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 5, 8), std(0xe9e4d3)); col.position.set(-4 + i * 2, 3, 4.1); g.add(col); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 2.6, 4), std(c)); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.75; roof.position.y = 7.3; g.add(roof);
    return g;
  },
  vault(c) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(10, 5.6, 8), std(0x233036, { metalness: 0.5, roughness: 0.5 })); b.position.y = 2.8; g.add(b);
    const door = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.45, 8, 20), std(c, { emissive: c, emissiveIntensity: 0.35, metalness: 0.7 })); door.position.set(0, 3, 4.05); g.add(door);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 12), std(0xb8c4d8, { metalness: 0.8 })); hub.rotation.x = Math.PI / 2; hub.position.set(0, 3, 4.1); g.add(hub);
    return g;
  },
  stadium(c) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 1.5, 6, 24), std(0x2a2f45)); ring.rotation.x = Math.PI / 2; ring.position.y = 1.5; ring.scale.set(1, 1, 0.8); g.add(ring);
    const field = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.3, 24), std(c, { emissive: c, emissiveIntensity: 0.25 })); field.position.y = 0.4; g.add(field);
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 5), std(0xdfe6f5)); const a = i * Math.PI / 2 + Math.PI / 4; m.position.set(Math.cos(a) * 5, 4, Math.sin(a) * 4.2); g.add(m); const l = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.3), std(0xfff3c0, { emissive: 0xfff3c0, emissiveIntensity: 1 })); l.position.set(Math.cos(a) * 5, 8, Math.sin(a) * 4.2); g.add(l); }
    return g;
  },
  volcano(c) {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(5.4, 8, 10, 1, true), std(0x3b2a26)); cone.position.y = 4; g.add(cone);
    const lava = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 10), std(c, { emissive: c, emissiveIntensity: 1.1 })); lava.position.y = 7.9; g.add(lava);
    const glow = new THREE.PointLight(c, 18, 16, 2); glow.position.y = 9; g.add(glow);
    return g;
  }
};

export function mount({ host, data }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;
  const places = data.places;
  const calm = reduced();

  host.textContent = '';
  const wrap = D.createElement('div'); wrap.className = 'w3-wrap'; wrap.tabIndex = 0;
  wrap.setAttribute('role', 'application');
  wrap.setAttribute('aria-label', 'A small 3D town. Drive with W A S D or the arrow keys, Space to brake, Enter to open the door you are parked at, Escape to close it. Every building is also a link in the list below the town.');
  const canvas = renderer.domElement; wrap.appendChild(canvas);
  const labels = D.createElement('div'); labels.className = 'w3-labels'; wrap.appendChild(labels);
  const hud = D.createElement('div'); hud.className = 'w3-hud';
  hud.innerHTML = '<span class="w3-score" id="w3-score">Qubits 0</span><span class="w3-near" id="w3-near" hidden></span>';
  wrap.appendChild(hud);
  const live = D.createElement('p'); live.className = 'w3-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); wrap.appendChild(live);
  const mini = D.createElement('canvas'); mini.className = 'w3-mini'; mini.width = 132; mini.height = 132; mini.setAttribute('aria-hidden', 'true'); wrap.appendChild(mini);
  const card = D.createElement('div'); card.className = 'w3-card'; card.hidden = true; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Building'); wrap.appendChild(card);
  const openBtn = D.createElement('button'); openBtn.type = 'button'; openBtn.className = 'w3-open'; openBtn.hidden = true; wrap.appendChild(openBtn);
  const stick = D.createElement('div'); stick.className = 'w3-stick'; stick.innerHTML = '<i></i>'; wrap.appendChild(stick);
  const brake = D.createElement('button'); brake.type = 'button'; brake.className = 'w3-brake'; brake.textContent = 'Brake'; wrap.appendChild(brake);
  const fsBtn = D.createElement('button'); fsBtn.type = 'button'; fsBtn.className = 'w3-fs'; fsBtn.setAttribute('aria-label', 'Full screen'); fsBtn.textContent = '⛶'; wrap.appendChild(fsBtn);
  host.appendChild(wrap);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b18);
  scene.fog = new THREE.Fog(0x070b18, 38, 120);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x1a1030, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.5); sun.position.set(-30, 50, 20); scene.add(sun);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(LIMIT + 6, 64), std(0x0f1830, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const grid = new THREE.GridHelper((LIMIT + 6) * 2, 74, 0x2a3a66, 0x16223f); grid.position.y = 0.02; grid.material.transparent = true; grid.material.opacity = 0.55; scene.add(grid);
  const road = new THREE.Mesh(new THREE.RingGeometry(RING - 4.4, RING + 4.4, 72), std(0x1b2440, { roughness: 1 })); road.rotation.x = -Math.PI / 2; road.position.y = 0.05; scene.add(road);
  const edge = new THREE.Mesh(new THREE.RingGeometry(RING - 0.12, RING + 0.12, 72), new THREE.MeshBasicMaterial({ color: 0x3a4c7e })); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.07; scene.add(edge);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 40), std(0x202c4e, { roughness: 1 })); plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.06; scene.add(plaza);

  const sculpt = new THREE.Group();
  const orbCore = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), std(0x8b5cf6, { emissive: 0x8b5cf6, emissiveIntensity: 0.7 })); orbCore.position.y = 3.2; sculpt.add(orbCore);
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.1, 6, 40), std(0x2dd4bf, { emissive: 0x2dd4bf, emissiveIntensity: 0.9 })); ringA.position.y = 3.2; ringA.rotation.x = Math.PI / 2.4; sculpt.add(ringA);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 1.2, 12), std(0x2a3358)); pedestal.position.y = 0.6; sculpt.add(pedestal);
  scene.add(sculpt);

  const blds = places.map((p, i) => {
    const a = (i / places.length) * Math.PI * 2 + Math.PI / places.length;
    const x = Math.sin(a) * RING, z = Math.cos(a) * RING;
    const col = new THREE.Color(p.color).getHex();
    const g = (BUILD[p.kind] || BUILD.arcade)(col);
    g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z);
    scene.add(g);
    const dx = x + (-x / RING) * DOOR, dz = z + (-z / RING) * DOOR;
    const spot = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.9, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 })); spot.rotation.x = -Math.PI / 2; spot.position.set(dx, 0.09, dz); scene.add(spot);
    const lab = D.createElement('span'); lab.className = 'w3-label'; lab.textContent = p.name; lab.style.borderColor = p.color; labels.appendChild(lab);
    return { p, x, z, dx, dz, g, spot, lab, col, visited: false };
  });

  { const n = 70, geo = new THREE.ConeGeometry(1.3, 3.6, 6), mesh = new THREE.InstancedMesh(geo, std(0x1f6f5c), n), m = new THREE.Matrix4();
    let k = 0, s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    while (k < n) { const r = LIMIT * 0.52 + rnd() * LIMIT * 0.46, a = rnd() * Math.PI * 2, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (blds.some((b) => Math.hypot(b.x - x, b.z - z) < 9) || Math.abs(r - RING) < 6) continue;
      const sc = 0.7 + rnd() * 1.1; m.makeScale(sc, sc, sc); m.setPosition(x, 1.8 * sc, z); mesh.setMatrixAt(k++, m); }
    scene.add(mesh); }

  const ORBS = [];
  { let i = 0, tries = 0; const N = 12;
    while (ORBS.length < N && tries++ < 400) { const a = i * 2.399963, r = 14 + ((i * 7) % 12) * 4 + (i % 3); i++;
      const x = Math.sin(a) * r, z = Math.cos(a) * r; if (r > LIMIT - 6) continue;
      if (blds.some((b) => Math.hypot(b.x - x, b.z - z) < 9) || r < 11 || Math.hypot(x, z - 14) < 7) continue;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), std(0x2dd4bf, { emissive: 0x2dd4bf, emissiveIntensity: 1 })); m.position.set(x, 1.4, z); scene.add(m); ORBS.push({ m, x, z, got: false }); } }

  const car = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 3.6), std(0x8b5cf6, { metalness: 0.4, roughness: 0.4 })); body.position.y = 0.75; car.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.7), std(0x2dd4bf, { metalness: 0.2 })); cab.position.set(0, 1.36, -0.2); car.add(cab);
  const wheels = [];
  [[-1.05, 1.2], [1.05, 1.2], [-1.05, -1.2], [1.05, -1.2]].forEach((p, i) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.4, 12), std(0x10131c)); w.rotation.z = Math.PI / 2;
    const pv = new THREE.Group(); pv.position.set(p[0], 0.46, p[1]); pv.add(w); car.add(pv); wheels.push({ pv, w, front: i < 2 });
  });
  [[-0.65, 1.82], [0.65, 1.82]].forEach((p) => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), std(0xfff3c0, { emissive: 0xfff3c0, emissiveIntensity: 1.2 })); h.position.set(p[0], 0.85, p[1]); car.add(h); });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.1), std(0xff5577, { emissive: 0xff3355, emissiveIntensity: 0.9 })); tail.position.set(0, 0.85, -1.82); car.add(tail);
  scene.add(car);
  const S = { x: 0, z: RING - 15, h: Math.PI, v: 0, steer: 0, near: null, carded: null, orbs: 0, t: 0, cam: new THREE.Vector3(), camOk: false };
  S.x = 0; S.z = 14; S.h = 0;
  const fwd = () => ({ x: Math.sin(S.h), z: Math.cos(S.h) });

  const K = new Set(); const T = { sx: 0, sy: 0, brake: false };
  function key(e, down) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!KEYS.test(e.code)) return;
    if (down) K.add(e.code); else K.delete(e.code);
    e.preventDefault(); e.stopPropagation();
    if (!down) return;
    if (e.code === 'Enter' || e.code === 'KeyE') { if (S.carded) closeCard(); else if (S.near) openCard(S.near); }
    else if (e.code === 'Escape') closeCard();
    else if (e.code === 'KeyM') mini.hidden = !mini.hidden;
  }
  wrap.addEventListener('keydown', (e) => key(e, true));
  wrap.addEventListener('keyup', (e) => key(e, false));
  wrap.addEventListener('blur', () => { K.clear(); });
  canvas.addEventListener('pointerdown', () => { wrap.focus({ preventScroll: true }); });
  let stickId = null; const sr = () => stick.getBoundingClientRect();
  function stickAt(e) { const r = sr(), R = r.width / 2; let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R; const L = Math.hypot(dx, dy); if (L > 1) { dx /= L; dy /= L; } T.sx = dx; T.sy = dy; stick.firstChild.style.transform = 'translate(' + (dx * 30) + 'px,' + (dy * 30) + 'px)'; }
  stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickAt(e); e.preventDefault(); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickAt(e); });
  const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; T.sx = T.sy = 0; stick.firstChild.style.transform = ''; };
  stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
  brake.addEventListener('pointerdown', (e) => { T.brake = true; brake.setPointerCapture(e.pointerId); }); ['pointerup', 'pointercancel'].forEach((n) => brake.addEventListener(n, () => { T.brake = false; }));
  openBtn.addEventListener('click', () => { if (S.near) openCard(S.near); });
  fsBtn.addEventListener('click', () => { try { if (D.fullscreenElement) D.exitFullscreen(); else if (wrap.requestFullscreen) wrap.requestFullscreen(); } catch (e) { } });
  function pad() { const g = (navigator.getGamepads && navigator.getGamepads()[0]) || null; if (!g) return { x: 0, y: 0, b: false, a: false }; const ax = Math.abs(g.axes[0]) > 0.15 ? g.axes[0] : 0, ay = Math.abs(g.axes[1]) > 0.15 ? g.axes[1] : 0; return { x: ax, y: ay, b: !!(g.buttons[1] && g.buttons[1].pressed), a: !!(g.buttons[0] && g.buttons[0].pressed) }; }
  let padA = false;

  function say(t) { live.textContent = t; }
  function openCard(b) {
    S.carded = b; b.visited = true; save(); scoreEl.textContent = scoreText();
    card.innerHTML = '<h3>' + esc(b.p.name) + '</h3><p>' + esc(b.p.blurb) + '</p><ul>' +
      b.p.links.map((l) => '<li><a href="' + esc(l[0]) + '">' + esc(l[1]) + '</a></li>').join('') + '</ul>' +
      '<button type="button" class="w3-x">Back to the car <kbd>Esc</kbd></button>';
    card.hidden = false; card.querySelector('a').focus({ preventScroll: true });
    card.querySelector('.w3-x').addEventListener('click', closeCard);
    say(b.p.name + ' opened. ' + b.p.links.length + ' places.');
  }
  function closeCard() { if (!S.carded) return; S.carded = null; card.hidden = true; wrap.focus({ preventScroll: true }); say('Back on the road.'); }
  card.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCard(); } e.stopPropagation(); });

  const VKEY = 'symbiq_world_v1';
  function load() { try { const v = JSON.parse(localStorage.getItem(VKEY)); if (v && Array.isArray(v.seen)) blds.forEach((b) => { if (v.seen.indexOf(b.p.id) >= 0) b.visited = true; }); } catch (e) { } }
  function save() { try { localStorage.setItem(VKEY, JSON.stringify({ seen: blds.filter((b) => b.visited).map((b) => b.p.id) })); } catch (e) { } }
  load();
  const scoreEl = hud.querySelector('#w3-score'), nearEl = hud.querySelector('#w3-near');
  const scoreText = () => 'Qubits ' + S.orbs + ' of ' + ORBS.length + ' · Visited ' + blds.filter((b) => b.visited).length + ' of ' + blds.length;
  scoreEl.textContent = scoreText();

  let active = true, raf = 0, last = 0;
  const v3 = new THREE.Vector3(), mctx = mini.getContext('2d');
  function step(dt) {
    const gp = pad();
    let thr = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - T.sy - gp.y;
    let st = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0) + T.sx + gp.x;
    thr = clamp(thr, -1, 1); st = clamp(st, -1, 1);
    const hand = K.has('Space') || T.brake || gp.b;
    if (S.carded) { thr = 0; st = 0; }
    S.v += thr * (thr > 0 ? 17 : 12) * dt;
    S.v *= Math.exp(-(hand ? 4.2 : thr === 0 ? 1.1 : 0.32) * dt);
    S.v = clamp(S.v, -8, 22);
    S.steer += (st - S.steer) * Math.min(1, dt * 9);
    S.h -= S.steer * 1.95 * clamp(S.v / 5, -1, 1) * dt;
    const f = fwd(); S.x += f.x * S.v * dt; S.z += f.z * S.v * dt;
    const solid = blds.map((b) => [b.x, b.z, BR]).concat([[0, 0, 2.6]]);
    for (const [cx, cz, r] of solid) { const dx = S.x - cx, dz = S.z - cz, d = Math.hypot(dx, dz), m = r + 1.5; if (d < m && d > 0.001) { S.x = cx + dx / d * m; S.z = cz + dz / d * m; S.v *= 0.55; } }
    const rr = Math.hypot(S.x, S.z); if (rr > LIMIT) { S.x *= LIMIT / rr; S.z *= LIMIT / rr; S.v *= 0.6; }
    car.position.set(S.x, 0, S.z); car.rotation.y = S.h;
    wheels.forEach((w) => { w.w.rotation.x += S.v * dt * 2.2; if (w.front) w.pv.rotation.y = -S.steer * 0.45; });
    car.rotation.z = calm ? 0 : -S.steer * clamp(S.v / 22, 0, 1) * 0.07;
    ORBS.forEach((o) => { if (o.got) return; o.m.position.y = 1.4 + (calm ? 0 : Math.sin(S.t * 2 + o.x) * 0.25); o.m.rotation.y += dt;
      if (Math.hypot(o.x - S.x, o.z - S.z) < 2.6) { o.got = true; o.m.visible = false; S.orbs++; scoreEl.textContent = scoreText(); say('Qubit ' + S.orbs + ' of ' + ORBS.length + ' collected.'); } });
    let near = null; blds.forEach((b) => { if (Math.hypot(b.dx - S.x, b.dz - S.z) < 3.4 && Math.abs(S.v) < 6) near = b; });
    if (near !== S.near) {
      S.near = near;
      nearEl.hidden = !near; openBtn.hidden = !near;
      if (near) { nearEl.textContent = near.p.name + ': press Enter'; openBtn.textContent = 'Open ' + near.p.name; say('At ' + near.p.name + '. Press Enter to open it.'); }
    }
    blds.forEach((b) => { b.spot.material.opacity = b === S.near ? 1 : (b.visited ? 0.35 : 0.85); });
    if (S.near && !padA && gp.a && !S.carded) openCard(S.near);
    padA = gp.a;
    const want = new THREE.Vector3(S.x - f.x * (14 + Math.abs(S.v) * 0.18), 9 + Math.abs(S.v) * 0.06, S.z - f.z * (14 + Math.abs(S.v) * 0.18));
    if (!S.camOk || calm) { S.cam.copy(want); S.camOk = true; } else S.cam.lerp(want, 1 - Math.exp(-dt * 4.2));
    camera.position.copy(S.cam); camera.lookAt(S.x + f.x * 4, 1.2, S.z + f.z * 4);
    if (!calm) { orbCore.rotation.y += dt * 0.8; ringA.rotation.z += dt * 0.6; }
  }
  function labelsPass() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    blds.forEach((b) => { v3.set(b.x, 10.5, b.z).project(camera);
      const dist = Math.hypot(b.x - S.x, b.z - S.z);
      const on = v3.z < 1 && Math.abs(v3.x) < 1.1 && v3.y > -1.1 && dist < 60;
      b.lab.style.display = on ? '' : 'none'; if (on) { b.lab.style.transform = 'translate(' + ((v3.x * 0.5 + 0.5) * w) + 'px,' + ((-v3.y * 0.5 + 0.5) * h) + 'px) translate(-50%,-100%)'; b.lab.classList.toggle('is-visited', b.visited); } });
  }
  function minimap() {
    if (mini.hidden) return;
    const s = mini.width, c = s / 2, k = (s / 2 - 6) / (LIMIT + 4);
    mctx.clearRect(0, 0, s, s); mctx.fillStyle = 'rgba(7,11,24,.82)'; mctx.beginPath(); mctx.arc(c, c, c - 1, 0, 7); mctx.fill();
    mctx.strokeStyle = 'rgba(120,150,230,.45)'; mctx.beginPath(); mctx.arc(c, c, RING * k, 0, 7); mctx.stroke();
    blds.forEach((b) => { mctx.fillStyle = b.p.color; mctx.globalAlpha = b.visited ? 0.5 : 1; mctx.fillRect(c + b.x * k - 4, c + b.z * k - 4, 8, 8); });
    mctx.globalAlpha = 1; mctx.fillStyle = '#2dd4bf'; ORBS.forEach((o) => { if (!o.got) { mctx.beginPath(); mctx.arc(c + o.x * k, c + o.z * k, 2, 0, 7); mctx.fill(); } });
    mctx.save(); mctx.translate(c + S.x * k, c + S.z * k); mctx.rotate(-S.h + Math.PI); mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4.5, 5); mctx.lineTo(-4.5, 5); mctx.closePath(); mctx.fill(); mctx.restore();
  }
  function resize() { const w = wrap.clientWidth || 640, h = wrap.clientHeight || 420; renderer.setPixelRatio(Math.min(W.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = (typeof ResizeObserver === 'function') ? new ResizeObserver(resize) : null; if (ro) ro.observe(wrap); else W.addEventListener('resize', resize);
  resize();
  function frame(ts) {
    raf = 0; if (!active) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; S.t += dt;
    step(dt); labelsPass(); minimap(); renderer.render(scene, camera);
    raf = W.requestAnimationFrame(frame);
  }
  function setActive(on) { active = !!on && !D.hidden; if (active && !raf) { last = 0; raf = W.requestAnimationFrame(frame); } if (!active && raf) { W.cancelAnimationFrame(raf); raf = 0; } }
  D.addEventListener('visibilitychange', () => setActive(!D.hidden));
  setActive(true);
  say('The town is open. Drive with W A S D or the arrow keys.');
  W.setTimeout(() => { try { wrap.focus({ preventScroll: true }); } catch (e) { } }, 0);

  const api = {
    setActive, state: S, places: blds.map((b) => ({ id: b.p.id, x: b.x, z: b.z, dx: b.dx, dz: b.dz })), orbs: ORBS,
    teleport(x, z, h) { S.x = x; S.z = z; if (h != null) S.h = h; S.v = 0; S.camOk = false; },
    destroy() { setActive(false); if (ro) ro.disconnect(); renderer.dispose(); host.textContent = ''; }
  };
  return api;
}

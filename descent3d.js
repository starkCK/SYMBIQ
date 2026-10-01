import * as THREE from './vendor/three/three.module.min.js';

const W = window;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const reduced = () => !!(W.SymbiQ && W.SymbiQ.core && W.SymbiQ.core.reduced && W.SymbiQ.core.reduced());
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const RADII = [3.0, 2.7, 2.4, 2.05, 1.7, 1.35];
const GAP = 1.35, TOP = 3.4;
const PLATE_HEX = [0xc9a24b, 0xbfae5e, 0x9fb36b, 0x6fb3a0, 0x5aa6c4, 0x6f8fd6];
const LINE_HEX = { q: 0xa78bfa, o: 0xfbbf24, s: 0xfb7185 };

export function mount({ host, data, seen, deepest }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;
  const L = data.layers;

  host.textContent = '';
  const wrap = document.createElement('div'); wrap.className = 'd3-wrap';
  const canvas = renderer.domElement;
  canvas.tabIndex = 0; canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', '3D map of the site as a dilution refrigerator. Drag to turn it, scroll to zoom, left and right arrows turn it, up and down arrows move between plates. The same map is the list below.');
  wrap.appendChild(canvas);
  const labels = document.createElement('div'); labels.className = 'd3-labels'; wrap.appendChild(labels);
  const bar = document.createElement('div'); bar.className = 'd3-bar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'View');
  bar.innerHTML = '<button type="button" class="preset" data-z="in" aria-label="Zoom in">+</button><button type="button" class="preset" data-z="out" aria-label="Zoom out">&minus;</button><button type="button" class="preset" data-z="reset">Reset</button>';
  wrap.appendChild(bar);
  const panel = document.createElement('div'); panel.className = 'd3-panel'; panel.hidden = true; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'The selected plate'); panel.setAttribute('aria-live', 'polite');
  const grid = document.createElement('div'); grid.className = 'd3-grid';
  grid.appendChild(wrap); grid.appendChild(panel);
  host.appendChild(grid);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(4, 7, 5); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.5); rim.position.set(-5, 2, -4); scene.add(rim);

  const yOf = (i) => TOP - i * GAP;
  const plates = [];
  RADII.forEach((r, i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 72),
      new THREE.MeshStandardMaterial({ color: PLATE_HEX[i], metalness: 0.55, roughness: 0.38, emissive: 0x000000 }));
    m.position.y = yOf(i); m.userData.layer = i; scene.add(m); plates.push(m);
  });
  const rodH = yOf(0) - yOf(RADII.length - 1);
  [90, 210, 330].forEach((deg) => {
    const a = deg * Math.PI / 180;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, rodH, 12), new THREE.MeshStandardMaterial({ color: 0x9aa4b8, metalness: 0.7, roughness: 0.4 }));
    rod.position.set(Math.cos(a) * 1.05, (yOf(0) + yOf(RADII.length - 1)) / 2, Math.sin(a) * 1.05); scene.add(rod);
  });
  data.tracks.forEach((t, k) => {
    const a = (k * 120 + 20) * Math.PI / 180;
    const pts = RADII.map((r, i) => new THREE.Vector3(Math.cos(a) * (r + 0.22), yOf(i), Math.sin(a) * (r + 0.22)));
    pts.unshift(new THREE.Vector3(Math.cos(a) * (RADII[0] + 0.5), yOf(0) + 0.8, Math.sin(a) * (RADII[0] + 0.5)));
    const mat = new THREE.MeshStandardMaterial({ color: LINE_HEX[t.k] || 0xffffff, emissive: LINE_HEX[t.k] || 0xffffff, emissiveIntensity: 0.25, roughness: 0.5 });
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4), 80, 0.045, 8, false), mat));
    pts.slice(1).forEach((p) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), mat); s.position.copy(p); scene.add(s); });
  });
  const here = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 10, 72), new THREE.MeshBasicMaterial({ color: 0x2dd4bf }));
  here.rotation.x = Math.PI / 2; here.visible = false; scene.add(here);
  if (deepest >= 0) { here.visible = true; here.scale.setScalar(RADII[deepest] + 0.12); here.position.y = yOf(deepest) + 0.1; }

  const btns = L.map((l, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'd3-label';
    b.innerHTML = '<b>' + esc(l.temp) + '</b> ' + esc(l.short);
    b.addEventListener('click', () => select(i, true));
    labels.appendChild(b); return b;
  });

  const target = new THREE.Vector3(0, 0.3, 0);
  const home = { az: 0.55, el: 0.28, r: 15.5 };
  const cam = { az: home.az, el: home.el, r: home.r, rmin: 7, rmax: 26 };
  let interacted = false, active = true, sel = -1, raf = 0, last = performance.now();
  function place() {
    const ce = Math.cos(cam.el);
    camera.position.set(target.x + Math.sin(cam.az) * ce * cam.r, target.y + Math.sin(cam.el) * cam.r, target.z + Math.cos(cam.az) * ce * cam.r);
    camera.lookAt(target);
  }
  function resize() {
    const w = wrap.clientWidth || 640, h = wrap.clientHeight || 460;
    renderer.setPixelRatio(Math.min(W.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; if (ro) ro.observe(wrap); resize();

  function select(i, focusPanel) {
    sel = i;
    plates.forEach((p, k) => p.material.emissive.setHex(k === i ? 0x2a2a44 : 0x000000));
    btns.forEach((b, k) => { b.classList.toggle('is-sel', k === i); b.setAttribute('aria-pressed', String(k === i)); });
    if (i < 0) { panel.hidden = true; return; }
    const l = L[i], n = l.pages.filter((p) => seen[p]).length;
    panel.hidden = false;
    panel.innerHTML = '<h3><span class="ds-tempchip">' + esc(l.temp) + '</span> ' + esc(l.name) + '</h3><p>' + esc(l.blurb) + '</p><ul>' +
      l.links.map((x) => '<li><a href="' + esc(x[0]) + '">' + esc(x[1]) + '</a></li>').join('') + '</ul>' +
      (n ? '<p class="d3-open">You have opened ' + n + ' of ' + l.pages.length + ' pages here.</p>' : '');
    if (focusPanel) { const a = panel.querySelector('a'); if (a) a.focus(); }
  }

  const ptrs = new Map(); let down = null, pinch0 = 0, over = false;
  canvas.addEventListener('pointerenter', () => { over = true; });
  canvas.addEventListener('pointerleave', () => { over = false; });
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); interacted = true;
    if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, moved: 0 };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); down = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) { if (down) down.moved += Math.abs(dx) + Math.abs(dy); cam.az -= dx * 0.006; cam.el = clamp(cam.el + dy * 0.006, -0.5, 1.2); }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) cam.r = clamp(cam.r * (pinch0 / d), cam.rmin, cam.rmax); pinch0 = d; }
  });
  const end = (e) => {
    const one = ptrs.size === 1; ptrs.delete(e.pointerId);
    if (one && down && down.moved < 7 && e.type === 'pointerup') {
      const r = canvas.getBoundingClientRect(), ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(plates)[0]; select(hit ? hit.object.userData.layer : -1, false);
    }
    if (!ptrs.size) down = null; pinch0 = 0;
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    if (!over) return; e.preventDefault(); interacted = true;
    const dy = clamp(e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1), -240, 240);
    cam.r = clamp(cam.r * Math.exp(dy * (e.ctrlKey ? 0.011 : 0.0016)), cam.rmin, cam.rmax);
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    let used = true; interacted = true;
    if (e.key === 'ArrowLeft') cam.az -= 0.12; else if (e.key === 'ArrowRight') cam.az += 0.12;
    else if (e.key === 'ArrowDown') select(Math.min(L.length - 1, sel + 1), false); else if (e.key === 'ArrowUp') select(Math.max(0, sel < 0 ? 0 : sel - 1), false);
    else if (e.key === '+' || e.key === '=') cam.r = clamp(cam.r * 0.88, cam.rmin, cam.rmax); else if (e.key === '-' || e.key === '_') cam.r = clamp(cam.r * 1.14, cam.rmin, cam.rmax);
    else if (e.key === 'Enter' && sel >= 0) { const a = panel.querySelector('a'); if (a) a.focus(); } else used = false;
    if (used) e.preventDefault();
  });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; interacted = true;
    if (b.dataset.z === 'in') cam.r = clamp(cam.r * 0.8, cam.rmin, cam.rmax);
    else if (b.dataset.z === 'out') cam.r = clamp(cam.r * 1.25, cam.rmin, cam.rmax);
    else { cam.az = home.az; cam.el = home.el; cam.r = home.r; }
  });

  const v = new THREE.Vector3();
  function frame(now) {
    raf = 0; if (!active || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!interacted && !reduced()) cam.az += dt * 0.18;
    place();
    const w = wrap.clientWidth, h = wrap.clientHeight;
    btns.forEach((b, i) => {
      v.set(0, yOf(i), 0).project(camera);
      const cx = (v.x * 0.5 + 0.5) * w, cy = (-v.y * 0.5 + 0.5) * h;
      v.set(RADII[i], yOf(i), 0).project(camera);
      const rpx = Math.abs((v.x * 0.5 + 0.5) * w - cx);
      const bx = Math.min(cx + Math.max(rpx, 40) + 10, w - b.offsetWidth - 6);
      b.style.transform = 'translate(' + Math.round(Math.max(6, bx)) + 'px,' + Math.round(cy) + 'px) translateY(-50%)';
    });
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function setActive(on) {
    active = on;
    if (on && !raf) { last = performance.now(); resize(); raf = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });

  if (deepest >= 0) select(deepest, false);
  place(); raf = requestAnimationFrame(frame);
  return { canvas, setActive, select, state: () => ({ sel, az: cam.az, el: cam.el, r: cam.r, labels: btns.length, plates: plates.length }) };
}

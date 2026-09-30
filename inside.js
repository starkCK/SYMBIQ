import * as THREE from './vendor/three/three.module.min.js';

const core = (window.SymbiQ && window.SymbiQ.core) || {};
const reduced = () => !!(core.reduced && core.reduced());
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r) => (r || document).querySelector(s);
const EMBED = (() => { try { return window.self !== window.top && /[?&]embed=1(&|$)/.test(location.search); } catch (e) { return false; } })();
if (EMBED) document.documentElement.setAttribute('data-embed', '');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const MACHINES = {
  sc: { name: 'Superconducting', who: 'IBM, Google', levels: [
    { id: 'system',   label: 'Machine',      size: 'a few metres' },
    { id: 'cryostat', label: 'Cryostat',     size: 'about 1.5 m' },
    { id: 'package',  label: 'Chip package', size: 'about 10 cm' },
    { id: 'chip',     label: 'Chip',         size: 'about 1 cm' },
    { id: 'transmon', label: 'One qubit',    size: 'about 0.5 mm' },
    { id: 'junction', label: 'Junction',     size: 'about 100 nm' },
  ] },
  ion: { name: 'Trapped ions', who: 'Quantinuum, IonQ', levels: [
    { id: 'ion-machine', label: 'Machine',        size: 'a few metres' },
    { id: 'ion-trap',    label: 'Vacuum chamber', size: 'about 10 cm' },
    { id: 'ion-chain',   label: 'Ion chain',      size: 'about 50 \u00B5m' },
    { id: 'ion-ion',     label: 'One ion',        size: 'about 0.3 nm' },
  ] },
  atom: { name: 'Neutral atoms', who: 'QuEra, Atom Computing, Pasqal', levels: [
    { id: 'atom-machine', label: 'Machine',        size: 'a few metres' },
    { id: 'atom-cell',    label: 'Glass cell',     size: 'about 3 cm' },
    { id: 'atom-array',   label: 'Tweezer array',  size: 'about 50 \u00B5m' },
    { id: 'atom-atom',    label: 'One atom',       size: 'about 0.5 nm' },
  ] },
};
const machineOf = (id) => Object.keys(MACHINES).find((k) => MACHINES[k].levels.some((l) => l.id === id));
const levelsOf = (id) => MACHINES[machineOf(id)].levels;

const MAT = {};
function initMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  MAT.gold = std({ color: 0xd2a03c, metalness: 1, roughness: 0.36 });
  MAT.copper = std({ color: 0xc9773f, metalness: 1, roughness: 0.34 });
  MAT.steel = std({ color: 0xb9c0cc, metalness: 1, roughness: 0.36 });
  MAT.darksteel = std({ color: 0x59616e, metalness: 0.95, roughness: 0.46 });
  MAT.cuni = std({ color: 0xb98b72, metalness: 1, roughness: 0.4 });
  MAT.nbti = std({ color: 0x7c8fb0, metalness: 0.9, roughness: 0.4 });
  MAT.nb = std({ color: 0xa9bdd6, metalness: 0.9, roughness: 0.42 });
  MAT.al = std({ color: 0xd3dae3, metalness: 1, roughness: 0.24 });
  MAT.si = std({ color: 0x2c3653, metalness: 0.35, roughness: 0.5 });
  MAT.sapphire = std({ color: 0x6d87b6, metalness: 0.2, roughness: 0.12 });
  MAT.pcb = std({ color: 0x0e5b3c, metalness: 0.15, roughness: 0.62 });
  MAT.black = std({ color: 0x14171e, metalness: 0.6, roughness: 0.5 });
  MAT.rack = std({ color: 0x1b2233, metalness: 0.7, roughness: 0.45 });
  MAT.white = std({ color: 0xe8ecf3, metalness: 0.2, roughness: 0.5 });
  MAT.hose = std({ color: 0x2a2f3a, metalness: 0.1, roughness: 0.7 });
  MAT.atten = std({ color: 0x2b3b78, metalness: 0.8, roughness: 0.35 });
  MAT.indium = std({ color: 0xdfe4ea, metalness: 1, roughness: 0.18 });
  MAT.junction = std({ color: 0xffd76a, emissive: 0xffb020, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 });
  MAT.led = std({ color: 0x2dd4bf, emissive: 0x2dd4bf, emissiveIntensity: 1.4, roughness: 0.4 });
  MAT.ledv = std({ color: 0xa78bfa, emissive: 0xa78bfa, emissiveIntensity: 1.4, roughness: 0.4 });
  const shell = (color, op, metal = 0.9) => { const m = std({ color, metalness: metal, roughness: 0.32, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }); m.userData.op = op; return m; };
  MAT.shellSteel = shell(0xcdd3dc, 0.2);
  MAT.shellGold = shell(0xdcae55, 0.22, 1);
  MAT.shellCopper = shell(0xd08a55, 0.2, 1);
  MAT.shellMag = shell(0x6f7885, 0.34);
  MAT.shellGlass = shell(0x8fb2e0, 0.13, 0.2);
  MAT.oxide = std({ color: 0x35e0c8, emissive: 0x1aa892, emissiveIntensity: 0.7, transparent: true, opacity: 0.85, roughness: 0.2 });
  MAT.oxide.userData.op = 0.85;
  MAT.pair = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
  MAT.ion = std({ color: 0xc6f7ef, emissive: 0x2dd4bf, emissiveIntensity: 0.9, roughness: 0.3 });
}

const cyl = (rt, rb, h, mat, seg = 40, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const sph = (r, mat, s = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, s, Math.max(8, s >> 1)), mat);
const put = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const tubeGeo = (pts, r, seg = 40, rad = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, rad, false);
const tubeM = (pts, r, mat, seg = 40, rad = 6) => new THREE.Mesh(tubeGeo(pts, r, seg, rad), mat);
const ring = (R, r, mat, seg = 48) => new THREE.Mesh(new THREE.TorusGeometry(R, r, 10, seg), mat);

function slab(outer, holes, depth, mat) {
  const sh = new THREE.Shape(outer.map((p) => new THREE.Vector2(p[0], p[1])));
  (holes || []).forEach((h) => sh.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1])))));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(0, depth, 0);
  return new THREE.Mesh(g, mat);
}
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

function makeView(def) {
  const v = {
    def, root: new THREE.Group(), parts: [], byId: {}, items: [], dyn: [], anim: [],
    t: def.expl, sel: null, isolate: null, stageOff: null, ctx: {},
  };
  v.part = (id, meta) => {
    const p = Object.assign({ id, items: [], mats: new Map(), hover: false, selected: false, hidden: false, f: [] }, meta);
    v.parts.push(p); v.byId[id] = p; return p;
  };
  v.add = (part, obj, o = {}) => {
    obj.traverse((m) => {
      if (!m.isMesh) return;
      m.userData.part = part;
      const base = m.material;
      const key = (o.key || '') + base.uuid;
      let mm = part.mats.get(key);
      if (!mm) {
        mm = base.clone();
        mm.userData.op = base.userData.op == null ? 1 : base.userData.op;
        mm.userData.baseEm = mm.emissive ? mm.emissive.clone() : null;
        mm.userData.baseEmI = mm.emissiveIntensity;
        mm.userData.led = base === MAT.led || base === MAT.ledv || base === MAT.ion || base === MAT.junction || base === MAT.oxide;
        part.mats.set(key, mm);
      }
      m.material = mm;
    });
    const it = { obj, part, home: obj.position.clone(), off: o.off || V3(), stage: o.stage == null ? null : o.stage, bg: !!o.bg };
    part.items.push(it); v.items.push(it); v.root.add(obj);
    return obj;
  };
  v.decor = (obj) => { v.root.add(obj); return obj; };
  v.setExplode = (t) => {
    v.t = t;
    for (const it of v.items) {
      it.obj.position.copy(it.home).addScaledVector(it.off, t);
      if (it.stage != null && v.stageOff) it.obj.position.y += v.stageOff(it.stage, t);
    }
    v.dyn.forEach((fn) => fn(t));
  };
  return v;
}

function buildSystem(v) {
  const ground = ring(6.6, 0.02, MAT.darksteel, 96); ground.rotation.x = Math.PI / 2;
  v.decor(ground);
  const g2 = ring(9.5, 0.015, MAT.darksteel, 96); g2.rotation.x = Math.PI / 2; v.decor(g2);

  const frame = v.part('frame', {
    name: 'Support frame', t: 'room temperature', s: 'about 3 m tall',
    d: 'Holds the cryostat off the floor and helps keep building vibration out of it. Vibration is heat and noise, and both reach the chip.',
    f: ['Many systems mount the cryostat on a frame with vibration damping, and the cooler is often decoupled from the cold plates.'], swatch: '#b9c0cc',
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    v.add(frame, put(cyl(0.13, 0.13, 8.7, MAT.steel, 20), Math.cos(a) * 3.35, 4.35, Math.sin(a) * 3.35));
    v.add(frame, put(box(1.0, 0.25, 0.6, MAT.darksteel), Math.cos(a) * 3.35, 0.12, Math.sin(a) * 3.35));
  }
  const topRing = ring(3.35, 0.12, MAT.steel, 64); topRing.rotation.x = Math.PI / 2; v.add(frame, put(topRing, 0, 8.6, 0));
  const lowRing = ring(3.35, 0.09, MAT.steel, 64); lowRing.rotation.x = Math.PI / 2; v.add(frame, put(lowRing, 0, 1.1, 0));

  const ins = v.part('insides', {
    name: 'Cold stages', opens: 'cryostat', t: '300 K at the top, about 10 mK at the bottom', s: 'about 1.5 m tall',
    d: 'Five gold-plated plates hung one under another, each colder than the one above. The qubits sit under the lowest one. It is often called the chandelier.',
    f: ['Open it to see each plate, the wiring between them and the processor at the bottom.'], swatch: '#d9a441',
  });
  const py = [7.7, 6.75, 5.85, 5.05, 4.35, 3.75];
  py.forEach((y, k) => {
    v.add(ins, put(cyl(2.35 - k * 0.22, 2.35 - k * 0.22, 0.14, MAT.gold, 56), 0, y, 0));
    if (k < 5) for (let s = 0; s < 3; s++) { const a = s * 2.094 + 0.4; v.add(ins, put(cyl(0.05, 0.05, py[k] - py[k + 1], MAT.steel, 8), Math.cos(a) * (1.9 - k * 0.2), (py[k] + py[k + 1]) / 2, Math.sin(a) * (1.9 - k * 0.2))); }
  });
  v.add(ins, put(box(0.6, 0.6, 0.6, MAT.gold), 0, 3.3, 0));

  const can = v.part('can', {
    name: 'Vacuum can', opens: 'cryostat', shell: true, t: 'room temperature outside, near-empty inside', s: 'roughly 0.5 to 1 m across',
    d: 'The outer wall of the fridge. The air is pumped out, so heat from the room cannot creep to the cold stages through gas. Without a vacuum the coldest plate could not get anywhere near its temperature.',
    f: ['The vacuum inside is typically below 10⁻⁵ mbar.', 'Made of metal, commonly stainless steel or aluminium.'], swatch: '#cdd3dc',
  });
  v.add(can, put(cyl(2.55, 2.55, 6.9, MAT.shellSteel, 64, true), 0, 4.55, 0), { off: V3(0, 7.2, 0) });
  const canCap = new THREE.Mesh(new THREE.SphereGeometry(2.55, 48, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 5), MAT.shellSteel);
  canCap.scale.y = 0.6; v.add(can, put(canCap, 0, 1.1, 0).rotateX(Math.PI), { off: V3(0, 7.2, 0) });
  v.add(can, put(ring(2.55, 0.06, MAT.steel, 64), 0, 8.0, 0).rotateX(Math.PI / 2), { off: V3(0, 7.2, 0) });

  const pt = v.part('pulsetube', {
    name: 'Pulse-tube cooler', t: '50 K first stage, 4 K second stage', s: 'about 1 m tall',
    d: 'A closed-cycle refrigerator with nothing moving in its cold end: helium gas pulses in and out and the pressure swings carry heat away. It does the first job, getting from room temperature to a few kelvin. It cannot go much colder.',
    f: ['A compressor on the floor supplies the gas pulses through two flexible hoses.', 'It shakes a little. Isolating that vibration from the chip is a design problem of its own.'], swatch: '#8b93a3',
  });
  v.add(pt, put(cyl(3.0, 3.0, 0.22, MAT.steel, 64), 0, 8.66, 0), { off: V3(0, 1.4, 0) });
  v.add(pt, put(cyl(0.72, 0.72, 1.7, MAT.darksteel, 40), 0, 9.6, 0), { off: V3(0, 2.4, 0) });
  v.add(pt, put(cyl(0.9, 0.9, 0.22, MAT.steel, 40), 0, 10.55, 0), { off: V3(0, 2.4, 0) });
  v.add(pt, put(cyl(0.32, 0.32, 1.0, MAT.black, 24), 1.15, 10.0, 0).rotateZ(Math.PI / 2), { off: V3(0, 2.4, 0) });
  v.add(pt, put(box(0.6, 0.75, 0.6, MAT.black), 1.75, 10.0, 0), { off: V3(0, 2.4, 0) });
  const hoseA = [V3(0.4, 10.5, 0.2), V3(1.4, 12, 1.5), V3(-1, 11, 4), V3(-5.5, 3.3, 3.3), V3(-6.6, 1.35, 1.7)];
  v.add(pt, tubeM(hoseA, 0.09, MAT.hose, 60), { off: V3(0, 2.4, 0) });
  v.add(pt, tubeM(hoseA.map((p) => p.clone().add(V3(0.32, 0.05, -0.28))), 0.09, MAT.hose, 60), { off: V3(0, 2.4, 0) });

  const comp = v.part('compressor', {
    name: 'Compressor', t: 'room temperature', s: 'about the size of a washing machine',
    d: 'Sends high-pressure helium to the pulse tube through two hoses and takes it back. It runs day and night for months, drawing several kilowatts from the wall.',
    f: ['The cooling itself runs on plain mains electricity, not on a supply of liquid helium.'], swatch: '#3a4459',
  });
  v.add(comp, put(box(2.6, 2.0, 1.9, MAT.rack), -6.6, 1.0, 1.8));
  v.add(comp, put(cyl(0.55, 0.55, 0.5, MAT.steel, 32), -6.6, 2.25, 1.8));
  v.add(comp, put(box(1.7, 0.1, 0.06, MAT.led), -6.6, 1.3, 2.77));

  const gas = v.part('gas', {
    name: 'Gas handling and pumps', t: 'room temperature', s: 'a cabinet',
    d: 'Holds the helium-3 and helium-4 mixture that does the last stretch of cooling, plus the pumps that circulate it and the pumps that keep the vacuum. The mixture stays in a sealed loop.',
    f: ['Helium-3 is rare and costly, so the loop is closed and never vented in normal use.'], swatch: '#48607a',
  });
  v.add(gas, put(box(2.4, 2.8, 1.6, MAT.rack), -5.8, 1.4, -4.4));
  v.add(gas, put(cyl(0.34, 0.34, 1.2, MAT.steel, 24), -4.2, 0.6, -4.9));
  v.add(gas, put(cyl(0.34, 0.34, 1.2, MAT.steel, 24), -4.2, 0.6, -3.9));
  v.add(gas, tubeM([V3(-4.6, 2.5, -4.4), V3(-3, 4, -3.5), V3(-1.5, 7.8, -2)], 0.07, MAT.steel, 40));
  v.add(gas, put(box(1.6, 0.08, 0.05, MAT.ledv), -5.8, 2.2, -3.57));

  const rk = v.part('racks', {
    name: 'Control and readout electronics', t: 'room temperature', s: 'one or more racks',
    d: 'Instruments that make the microwave pulses that control the qubits and measure what comes back. Every qubit needs its own control lines, so the electronics and the wiring grow with qubit count.',
    f: ['Single-qubit gates last tens of nanoseconds; two-qubit gates take from tens to a few hundred, depending on the design.', 'The signals sit in the microwave band, around 4 to 8 GHz.'], swatch: '#1b2233',
  });
  for (let i = 0; i < 2; i++) {
    const x = 6.4 + i * 1.7;
    v.add(rk, put(box(1.5, 5.4, 1.3, MAT.rack), x, 2.7, 1.0));
    for (let r = 0; r < 9; r++) v.add(rk, put(box(1.2, 0.06, 0.05, r % 3 ? MAT.led : MAT.ledv), x, 0.7 + r * 0.55, 1.66));
  }
  v.add(rk, tubeM([V3(6.4, 5.4, 1.0), V3(5.4, 8, 0.6), V3(2.2, 9.4, 0.2), V3(1.4, 9.9, 0)], 0.06, MAT.black, 50));
  v.add(rk, tubeM([V3(6.5, 5.4, 1.2), V3(5.5, 8.4, 0.9), V3(2.4, 9.8, 0.4), V3(1.5, 10.2, 0.1)], 0.06, MAT.black, 50));

  v.def.cam = { target: V3(0, 5.0, 0), r: 29, az: 0.75, el: 0.22 };
}

function buildCryostat(v) {
  const PY = [10, 8.2, 6.4, 4.9, 3.6, 2.4];
  const RS = 1.25;
  const PR = [3.0, 2.8, 2.5, 2.2, 1.9, 1.6].map((x) => x * RS);
  const PN = ['300 K', '50 K', '4 K', '0.8 K', '100 mK', '10 mK'];
  v.stageOff = (k, t) => (2.5 - k) * 0.85 * t;
  const yOf = (k, t) => PY[k] + v.stageOff(k, t);
  const lane = (ang, r) => V3(Math.cos(ang) * r, 0, Math.sin(ang) * r);
  const LIN = 0.7, LOUT = 3.85;

  const floor = ring(5.2, 0.015, MAT.darksteel, 96); floor.rotation.x = Math.PI / 2; floor.position.y = -3.5; v.decor(floor);

  const P = {};
  const plate = (k, id, meta) => {
    P[k] = v.part(id, meta);
    v.add(P[k], put(cyl(PR[k], PR[k], 0.18, MAT.gold, 64), 0, PY[k], 0), { stage: k });
    for (let b = 0; b < 8; b++) { const a = (b / 8) * Math.PI * 2; v.add(P[k], put(cyl(0.07, 0.07, 0.07, MAT.steel, 8), Math.cos(a) * (PR[k] - 0.22), PY[k] + 0.12, Math.sin(a) * (PR[k] - 0.22)), { stage: k }); }
    return P[k];
  };
  plate(0, 'plate300', { name: 'Top flange', t: 'room temperature, about 300 K', s: 'the lid of the vacuum',
    d: 'The lid of the vacuum. Every wire and pipe that enters the fridge passes through a vacuum-sealed connector here.',
    f: ['Large processors need hundreds of separate lines through this one plate.'], swatch: '#d9a441' });
  plate(1, 'plate50', { name: '50 K stage', t: 'about 50 K (−223 °C)', s: 'plate, gold-plated copper',
    d: 'Cooled by the first stage of the pulse tube. Its main job is to intercept the heat that runs down the cables and the radiation from the room, so the colder plates never see it.',
    f: ['Copper carries heat well; gold plating stops it tarnishing.', 'The gaps between plates are held open by thin low-conductance struts.'], swatch: '#d9a441' });
  plate(2, 'plate4k', { name: '4 K stage', t: 'about 4 K (−269 °C)', s: 'plate, gold-plated copper',
    d: 'Cooled by the second stage of the pulse tube. Helium gas liquefies at about this temperature. Some of the cables switch to superconductors here, and the first transistor amplifier of the readout chain sits on it.',
    f: ['4.2 K is where helium boils at normal pressure.', 'This is the coldest the pulse tube can go on its own.'], swatch: '#d9a441' });
  plate(3, 'still', { name: 'Still plate', t: 'about 0.8 K', s: 'plate, gold-plated copper',
    d: 'Part of the dilution refrigerator. Helium-3 boils out of the mixture here and is pumped away, which drives the circulation. A small heater sets how fast it flows.',
    f: ['Below about 1 K the fridge stops relying on the pulse tube and starts using the helium mixture.'], swatch: '#d9a441' });
  plate(4, 'cold', { name: 'Cold plate', t: 'about 100 mK', s: 'plate, gold-plated copper',
    d: 'An intermediate stage that lowers the heat load on the last plate. Filters and attenuators sit here.',
    f: ['100 mK is a tenth of a degree above absolute zero.'], swatch: '#d9a441' });
  plate(5, 'mxc', { name: 'Mixing chamber', t: 'about 10 to 20 mK', s: 'the coldest plate',
    d: 'The coldest point. Below about 0.87 K a helium-3/helium-4 mixture separates into two phases. Helium-3 dissolving from the pure phase into the dilute one absorbs heat, and that is the cooling.',
    f: ['Colder than outer space, whose background glow is 2.7 K.', 'The processor hangs from this plate.'], swatch: '#d9a441' });

  const stru = v.part('struts', { name: 'Support struts', t: 'span every stage', s: 'thin rods',
    d: 'Rods that hold each plate under the one above. They are thin and made of stainless steel or a fibre composite because a rod that holds weight also conducts heat, and the design goal is as little of it as possible.',
    f: ['Every gap has three of them, at 120°.'], swatch: '#b9c0cc' });
  const struts = [];
  for (let k = 0; k < 5; k++) for (let s = 0; s < 3; s++) {
    const a = s * 2.0944 + 1.57; const m = cyl(0.06, 0.06, 1, MAT.steel, 8);
    v.add(stru, put(m, Math.cos(a) * (PR[k + 1] - 0.3), 0, Math.sin(a) * (PR[k + 1] - 0.3)));
    struts.push({ m, k });
  }
  v.dyn.push((t) => struts.forEach(({ m, k }) => { const a = yOf(k, t), b = yOf(k + 1, t); m.position.y = (a + b) / 2; m.scale.y = a - b - 0.18; }));

  const dil = v.part('dilution', { name: 'Dilution unit', t: 'from 4 K down to 10 mK', s: 'central column',
    d: 'The central plumbing: pipes and heat exchangers that carry the helium mixture down to the mixing chamber and back up. Outgoing mixture pre-cools the incoming mixture, which is what lets the last stage get so cold.',
    f: ['The mixture circulates in a sealed loop for as long as the fridge runs.', 'The coils are heat exchangers, long thin channels that give heat time to leave.'], swatch: '#c9773f' });
  const col = [];
  for (let k = 2; k < 5; k++) { const m = cyl(0.2, 0.2, 1, MAT.copper, 20); v.add(dil, put(m, 0, 0, 0)); col.push({ m, k }); }
  v.dyn.push((t) => col.forEach(({ m, k }) => { const a = yOf(k, t), b = yOf(k + 1, t); m.position.y = (a + b) / 2; m.scale.y = a - b - 0.18; }));
  for (let k = 3; k < 5; k++) {
    const pts = []; for (let i = 0; i <= 60; i++) { const a = i * 0.55; pts.push(V3(Math.cos(a) * 0.5, -0.05 - (i / 60) * 1.05, Math.sin(a) * 0.5)); }
    v.add(dil, put(tubeM(pts, 0.05, MAT.copper, 160, 6), 0, PY[k] - 0.09, 0), { stage: k });
  }

  const att = v.part('atten', { name: 'Attenuators', t: 'one set per cold stage', s: 'each about thumb-sized',
    d: 'Small in-line resistors on the control lines. Each one cuts the signal by a set amount, about 60 dB in total (the split varies by lab). That also cuts the thermal noise that came down the wire from a warm room, which would otherwise scramble the qubits.',
    f: ['60 dB is a factor of a million in power.', 'Each attenuator turns the power it removes into heat, so they are spread across stages, not stacked on one.'], swatch: '#2b3b78' });
  for (let k = 2; k <= 5; k++) { const p = lane(LIN, 1.05); const c = new THREE.Group(); c.add(cyl(0.12, 0.12, 0.44, MAT.atten, 20)); c.add(put(cyl(0.135, 0.135, 0.08, MAT.gold, 20), 0, 0.14, 0)); v.add(att, put(c, p.x, PY[k] + 0.31, p.z), { stage: k }); }

  const hemt = v.part('hemt', { name: 'HEMT amplifier', t: 'about 4 K', s: 'a small box, palm-sized or less',
    d: 'A transistor amplifier cooled to 4 K. It boosts the readout signal by roughly 30 to 40 dB so that room-temperature electronics can read it.',
    f: ['It adds only a few kelvin of noise, far less than a warm amplifier would.', 'It sits at 4 K because it dissipates real power, and the mixing chamber could not remove it.'], swatch: '#59616e' });
  { const p = lane(LOUT, 1.3); const g = new THREE.Group(); g.add(box(0.7, 0.28, 0.42, MAT.darksteel)); g.add(put(box(0.5, 0.06, 0.3, MAT.gold), 0, 0.17, 0)); v.add(hemt, put(g, p.x, PY[2] + 0.23, p.z), { stage: 2 }); }

  const twpa = v.part('twpa', { name: 'Parametric amplifier', t: 'mixing chamber, about 10 mK', s: 'a small box',
    d: 'The first amplifier after the chip. It is built from superconducting Josephson junctions, so it adds almost no noise, close to the limit quantum mechanics sets. Without it a single readout would take far longer.',
    f: ['TWPA means travelling-wave parametric amplifier; the older kind is a JPA.'], swatch: '#7c8fb0' });
  { const p = lane(LOUT, 1.0); const g = new THREE.Group(); g.add(box(0.55, 0.22, 0.38, MAT.nbti)); g.add(put(sph(0.06, MAT.junction, 10), 0, 0.14, 0)); v.add(twpa, put(g, p.x + 0.35, PY[5] + 0.2, p.z - 0.3), { stage: 5 }); }

  const circ = v.part('circ', { name: 'Circulators and isolators', t: 'mixing chamber, about 10 mK', s: 'each about coin-sized',
    d: 'One-way valves for microwaves. They let the qubit’s signal travel toward the amplifiers and stop noise from the amplifiers flowing back to the chip.',
    f: ['They contain a small magnet, so they need their own magnetic shielding away from the qubits.'], swatch: '#8b93a3' });
  for (let i = 0; i < 3; i++) { const p = lane(LOUT, 0.75 + i * 0.28); const g = new THREE.Group(); g.add(cyl(0.2, 0.2, 0.16, MAT.steel, 24)); g.add(put(cyl(0.11, 0.11, 0.2, MAT.black, 16), 0, 0, 0)); v.add(circ, put(g, p.x - 0.1, PY[5] + 0.17, p.z + 0.35 - i * 0.05), { stage: 5 }); }

  const pkg = v.part('package', { name: 'Processor package', opens: 'package', t: 'mixing chamber, about 10 mK', s: 'about 10 cm',
    d: 'The sealed metal box that holds the chip, with a shield around it. It hangs from the coldest plate. Open it to see the chip inside.',
    f: ['Every control and readout line ends at this box.'], swatch: '#d9a441' });
  v.add(pkg, put(cyl(0.5, 0.5, 0.5, MAT.gold, 32), 0, PY[5] - 0.85, 0), { stage: 5, off: V3(0, -1.6, 0) });
  v.add(pkg, put(cyl(0.16, 0.16, 0.4, MAT.copper, 16), 0, PY[5] - 0.45, 0), { stage: 5, off: V3(0, -1.6, 0) });

  const sh = v.part('shields', { name: 'Radiation shields', shell: true, t: 'each at its stage temperature', s: 'nested cans',
    d: 'One metal can hangs from each cold stage and encloses everything below it. Each blocks the thermal radiation of the warmer can around it. The innermost set also includes a magnetic shield.',
    f: ['Without them, infrared from the room-temperature walls would swamp the cooling power of the coldest plate.'], swatch: '#cdd3dc' });
  const cap = (r, mat) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat); m.rotation.x = Math.PI / 2; return m; };
  [[1, 2.86, 7.0, MAT.shellSteel, -5.4], [2, 2.56, 5.4, MAT.shellCopper, -4.2], [4, 1.98, 3.4, MAT.shellGold, -3.0], [5, 1.74, 2.6, MAT.shellMag, -2.2]].forEach(([k, r0, h, mat, dy]) => {
    const r = r0 * RS;
    const g = new THREE.Group();
    g.add(put(cyl(r, r, h, mat, 64, true), 0, -h / 2, 0)); g.add(put(cap(r, mat), 0, -h, 0));
    v.add(sh, put(g, 0, PY[k] - 0.1, 0), { stage: k, off: V3(0, dy, 0) });
  });

  const cin = v.part('cablesIn', { name: 'Control lines (in)', t: 'from 300 K to 10 mK', s: 'coax, about 2 mm across',
    d: 'Microwave coax that carries the control pulses down to the qubits. The metal changes down the fridge: poor heat conductors where it is warm, better conductors where it is cold.',
    f: ['A typical choice is stainless steel near the top, cupronickel in the middle and copper at the bottom.', 'Teal dots show a pulse travelling down.'], swatch: '#2dd4bf' });
  const cout = v.part('cablesOut', { name: 'Readout lines (out)', t: 'from 10 mK to 300 K', s: 'coax, about 2 mm across',
    d: 'The reply path. Between 4 K and the mixing chamber the line is superconducting niobium-titanium, which carries the faint signal up with almost no loss and almost no heat.',
    f: ['The signal that comes back is far below a picowatt.', 'Amber dots show a reply travelling up.'], swatch: '#f0b429' });
  const segMat = { in: [MAT.steel, MAT.steel, MAT.cuni, MAT.cuni, MAT.copper, MAT.copper], out: [MAT.steel, MAT.nbti, MAT.nbti, MAT.nbti, MAT.nbti, MAT.nbti] };
  const cables = [];
  for (const [nm, ang, part] of [['in', LIN, cin], ['out', LOUT, cout]]) {
    for (let k = 0; k < 6; k++) for (let s = -1; s <= 1; s++) {
      const m = new THREE.Mesh(new THREE.BufferGeometry(), segMat[nm][k]);
      v.add(part, m); cables.push({ m, nm, ang, k, s });
    }
  }
  const lanes = { in: [], out: [] };
  const cablePts = (nm, ang, k, s, t) => {
    const a = yOf(k, t) - 0.09; const last = k === 5;
    const b = last ? yOf(5, t) - 0.85 + 0.25 + (-1.6 * t) : yOf(k + 1, t) + 0.09;
    const r = last ? 0.5 : 1.0, r2 = last ? 0.16 : 1.0;
    const tang = V3(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(0.085 * s);
    const p0 = lane(ang, r).add(tang).setY(a), p1 = lane(ang, r2).add(tang).setY(b);
    const mid = p0.clone().lerp(p1, 0.5); mid.add(lane(ang, 1).multiplyScalar(last ? 0.2 : 0.42));
    return [p0, mid, p1];
  };
  const rebuild = (t) => {
    lanes.in.length = 0; lanes.out.length = 0;
    cables.forEach((c) => {
      const pts = cablePts(c.nm, c.ang, c.k, c.s, t);
      c.m.geometry.dispose(); c.m.geometry = tubeGeo(pts, 0.045, 24, 6);
      if (c.s === 0) lanes[c.nm][c.k] = new THREE.CatmullRomCurve3(pts);
    });
  };
  v.dyn.push(rebuild);

  const pulses = [];
  const pm = { in: new THREE.MeshBasicMaterial({ color: 0x5eead4 }), out: new THREE.MeshBasicMaterial({ color: 0xfbbf24 }) };
  ['in', 'out'].forEach((nm) => { for (let i = 0; i < 5; i++) { const m = sph(0.11, pm[nm], 10); m.visible = false; v.decor(m); pulses.push({ m, nm, ph: i / 5 }); } });
  v.ctx.flow = !reduced();
  v.anim.push((time) => pulses.forEach((p) => {
    const on = v.ctx.flow && lanes[p.nm].length === 6;
    p.m.visible = on; if (!on) return;
    let u = (time * 0.11 + p.ph) % 1; if (p.nm === 'out') u = 1 - u;
    const f = u * 6, i = Math.min(5, Math.floor(f)); p.m.position.copy(lanes[p.nm][i].getPoint(f - i));
  }));
  v.setExplode(v.t);
  v.def.cam = { target: V3(0, 4.7, 0), r: 25.5, az: 0.62, el: 0.2 };
}

function buildPackage(v) {
  const floor = ring(5.2, 0.015, MAT.darksteel, 96); floor.rotation.x = Math.PI / 2; floor.position.y = -1.6; v.decor(floor);

  const base = v.part('base', { name: 'Base block', t: 'mixing chamber, about 10 mK', s: 'about 10 cm across',
    d: 'A gold-plated copper block bolted to the mixing chamber. Copper carries heat out of the chip, and a braided strap ties it to the coldest plate.',
    f: ['A chip is a very poor conductor of heat at these temperatures, so getting it cold takes a good thermal path.'], swatch: '#d9a441' });
  v.add(base, put(slab(rect(-2.6, -2.6, 2.6, 2.6), [rect(-0.95, -0.95, 0.95, 0.95)], 0.5, MAT.gold), 0, 0, 0), { off: V3(0, -1.5, 0) });
  v.add(base, put(box(1.8, 0.1, 1.8, MAT.gold), 0, 0.02, 0), { off: V3(0, -1.5, 0) });
  for (const [x, z] of [[-2.25, -2.25], [2.25, -2.25], [-2.25, 2.25], [2.25, 2.25]]) v.add(base, put(cyl(0.16, 0.16, 0.09, MAT.steel, 12), x, 0.54, z), { off: V3(0, -1.5, 0) });
  v.add(base, tubeM([V3(2.6, 0.25, 0), V3(3.6, 0.9, 0), V3(3.9, 2.4, 0), V3(3.5, 4.2, 0)], 0.16, MAT.copper, 40, 8), { off: V3(0, -1.5, 0) });

  const chip = v.part('chip', { name: 'The chip', opens: 'chip', t: 'about 10 mK', s: 'about 1 cm',
    d: 'The processor. A piece of silicon or sapphire with superconducting circuits patterned on top. Open it to see the qubits.',
    f: ['A fingernail-sized piece of silicon holds the qubits.'], swatch: '#2c3653' });
  const die = box(1.5, 0.1, 1.5, MAT.si); v.add(chip, put(die, 0, 0.1, 0), { off: V3(0, -0.2, 0) });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 1.34), chipTexMat()); top.rotation.x = -Math.PI / 2; v.add(chip, put(top, 0, 0.155, 0), { off: V3(0, -0.2, 0) });

  const pcb = v.part('pcb', { name: 'Circuit board', t: 'about 10 mK', s: 'about 10 cm',
    d: 'A printed circuit with microwave transmission lines that fan in from the connectors toward the chip. Its job is to change scale: from millimetre connectors to micrometre chip pads.',
    f: ['Lines are matched to 50 Ω so signals do not reflect back.'], swatch: '#0e5b3c' });
  v.add(pcb, put(slab(rect(-2.3, -2.3, 2.3, 2.3), [rect(-1.0, -1.0, 1.0, 1.0)], 0.1, MAT.pcb), 0, 0.5, 0), { off: V3(0, 0.6, 0) });
  const bondpads = [];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 6; i++) {
    const u = -0.8 + i * 0.32; const rot = s * Math.PI / 2;
    const c = Math.cos(rot), sn = Math.sin(rot);
    const ex = (x, z) => [x * c - z * sn, x * sn + z * c];
    const [px, pz] = ex(u, 1.13); const [lx, lz] = ex(u, 1.7);
    v.add(pcb, put(box(0.16, 0.03, 0.16, MAT.gold), px, 0.63, pz), { off: V3(0, 0.6, 0) });
    const tr = box(0.06, 0.02, 1.2, MAT.gold); tr.rotation.y = -rot; put(tr, ...[(px + ex(u, 2.05)[0]) / 2, 0.63, (pz + ex(u, 2.05)[1]) / 2]);
    v.add(pcb, tr, { off: V3(0, 0.6, 0) });
    bondpads.push([u, s]);
  }
  const lau = v.part('launchers', { name: 'Connectors (launchers)', t: 'about 10 mK', s: 'each a few mm',
    d: 'Small microwave connectors, one per line, where the cables from the fridge plug in.',
    f: ['SMP-style push-on connectors are common because they are small and can be mated many times.'], swatch: '#d9a441' });
  for (let s = 0; s < 4; s++) for (let i = 0; i < 6; i++) {
    const rot = s * Math.PI / 2; const u = -0.8 + i * 0.32; const c = Math.cos(rot), sn = Math.sin(rot);
    const g = new THREE.Group(); g.add(cyl(0.11, 0.11, 0.3, MAT.gold, 14).rotateX(Math.PI / 2)); g.add(put(cyl(0.05, 0.05, 0.32, MAT.black, 10).rotateX(Math.PI / 2), 0, 0, 0));
    g.rotation.y = -rot; put(g, u * c - 2.3 * sn, 0.68, u * sn + 2.3 * c);
    v.add(lau, g, { off: V3(0, 0.6, 0) });
  }
  const bonds = v.part('bonds', { name: 'Wire bonds', t: 'about 10 mK', s: 'each about 25 µm thick',
    d: 'Aluminium wires thinner than a hair, joining pads on the board to pads on the chip. Each wire is a tiny inductor, so where and how long they are matters to the circuit.',
    f: ['Aluminium is superconducting below about 1.2 K, so the wire carries signal with no resistance.'], swatch: '#d3dae3' });
  bondpads.forEach(([u, s]) => {
    const rot = s * Math.PI / 2; const c = Math.cos(rot), sn = Math.sin(rot); const ex = (x, z) => [x * c - z * sn, x * sn + z * c];
    const a = ex(u, 0.69), b = ex(u, 1.13), m = ex(u, 0.91);
    v.add(bonds, tubeM([V3(a[0], 0.2, a[1]), V3(m[0], 0.42, m[1]), V3(b[0], 0.64, b[1])], 0.018, MAT.al, 12, 5), { off: V3(0, 0.3, 0) });
  });

  const lid = v.part('lid', { name: 'Sample box lid', shell: true, t: 'about 10 mK', s: 'about 10 cm across',
    d: 'A cover of gold-plated copper or aluminium. It closes the box around the chip so microwaves from the outside cannot leak in and the chip’s own signals cannot leak out.',
    f: ['A box that size has its own resonant frequencies, and the design has to keep them away from the qubits’.'], swatch: '#d9a441' });
  v.add(lid, put(slab(rect(-2.6, -2.6, 2.6, 2.6), null, 0.5, MAT.shellGold), 0, 0.62, 0), { off: V3(0, 2.6, 0) });

  const shd = v.part('shield', { name: 'Magnetic and infrared shield', shell: true, t: 'about 10 mK', s: 'a cup around the box',
    d: 'A cup that surrounds the sample box. A layer of superconducting aluminium pushes magnetic field out; a layer of high-permeability metal steers what is left away from the chip. Stray magnetic flux shifts qubit frequencies and stray photons break Cooper pairs.',
    f: ['Even the Earth’s magnetic field is a strong disturbance at this scale.'], swatch: '#6f7885' });
  const cup = new THREE.Group(); cup.add(put(cyl(3.9, 3.9, 2.6, MAT.shellMag, 64, true), 0, 0, 0));
  const cupTop = new THREE.Mesh(new THREE.CircleGeometry(3.9, 64), MAT.shellMag); cupTop.rotation.x = -Math.PI / 2; cup.add(put(cupTop, 0, 1.3, 0));
  v.add(shd, put(cup, 0, 1.4, 0), { off: V3(0, 4.9, 0) });

  v.setExplode(v.t);
  v.def.cam = { target: V3(0, 1.6, 0), r: 18.5, az: 0.7, el: 0.5 };
}

function chipTexMat() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#1d2540'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(169,189,214,.85)'; g.lineWidth = 3;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = 30 + i * 49, y = 30 + j * 49; g.strokeRect(x - 7, y - 4, 14, 8); if (i < 4) { g.beginPath(); g.moveTo(x + 7, y); g.lineTo(x + 42, y); g.stroke(); } if (j < 4) { g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, y + 45); g.stroke(); } }
  g.strokeStyle = 'rgba(217,164,65,.9)'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 244);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.35 });
}

function heavyHex(cols = 3, rows = 3, R = 1.42) {
  const w = Math.sqrt(3) * R; const sites = [], links = [], vmap = new Map(), emap = new Set();
  const key = (x, z) => Math.round(x * 1000) + ',' + Math.round(z * 1000);
  const vert = (x, z) => { const k = key(x, z); if (!vmap.has(k)) { vmap.set(k, sites.length); sites.push({ x, z }); } return vmap.get(k); };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const cx = (i + (j % 2) * 0.5) * w, cz = j * 1.5 * R; const ids = [];
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; ids.push(vert(cx + R * Math.cos(a), cz + R * Math.sin(a))); }
    for (let k = 0; k < 6; k++) {
      const a = ids[k], b = ids[(k + 1) % 6], ek = a < b ? a + '-' + b : b + '-' + a; if (emap.has(ek)) continue; emap.add(ek);
      const m = sites.length; sites.push({ x: (sites[a].x + sites[b].x) / 2, z: (sites[a].z + sites[b].z) / 2 }); links.push([a, m], [m, b]);
    }
  }
  const xs = sites.map((s) => s.x), zs = sites.map((s) => s.z); const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  sites.forEach((s) => { s.x -= cx; s.z -= cz; });
  return { sites, links, kind: 'hex' };
}
function squareGrid(n = 6, p = 1.42) {
  const sites = [], links = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) sites.push({ x: (i - (n - 1) / 2) * p, z: (j - (n - 1) / 2) * p });
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * n + i; if (i < n - 1) links.push([a, a + 1]); if (j < n - 1) links.push([a, a + n]); }
  return { sites, links, kind: 'sq' };
}

function buildChip(v, state) {
  const lat = state.layout === 'square' ? squareGrid() : heavyHex();
  const half = 5.4;
  const floor = ring(9.5, 0.015, MAT.darksteel, 96); floor.rotation.x = Math.PI / 2; floor.position.y = -2.4; v.decor(floor);

  const sub = v.part('substrate', { name: 'Substrate', t: 'about 10 mK', s: 'about 1 cm square, under 1 mm thick',
    d: 'A piece of silicon or sapphire. Cold and clean it is a very good insulator, but defects in it and on its surface are one of the main ways qubits lose their state.',
    f: ['Chip makers spend as much effort on the quality of this surface as on the circuit drawn on it.'], swatch: '#2c3653' });
  v.add(sub, put(box(half * 2, 0.4, half * 2, MAT.si), 0, -0.2, 0), { off: V3(0, -1.9, 0), bg: true });

  const pads = v.part('pads', { name: 'Launch pads and control lines', t: 'about 10 mK', s: 'pads about 100 µm across',
    d: 'Pads around the edge where wire bonds land, with lines running in from them. They carry drive pulses that rotate a qubit, flux pulses that tune its frequency and the readout tones.',
    f: ['Edge pads run out of room quickly, which is the reason large chips stack a wiring die on top.'], swatch: '#a9bdd6' });
  const nPad = (n, fn) => { for (let i = 0; i < n; i++) fn(-half + 0.85 + i * ((half * 2 - 1.7) / (n - 1))); };
  nPad(10, (u) => { for (const s of [-1, 1]) { v.add(pads, put(box(0.42, 0.04, 0.42, MAT.nb), u, 0.02, s * (half - 0.32))); v.add(pads, put(box(0.05, 0.03, 0.9, MAT.nb), u, 0.02, s * (half - 0.98))); } });
  nPad(8, (u) => { for (const s of [-1, 1]) { v.add(pads, put(box(0.42, 0.04, 0.42, MAT.nb), s * (half - 0.32), 0.02, u)); v.add(pads, put(box(0.9, 0.03, 0.05, MAT.nb), s * (half - 0.98), 0.02, u)); } });

  const res = v.part('resonators', { name: 'Readout resonators', t: 'about 10 mK', s: 'a few mm long, folded',
    d: 'Each qubit has a small microwave resonator whose frequency shifts slightly depending on whether the qubit is 0 or 1. Send a probe tone to it and the returning tone tells you the answer without disturbing the qubit.',
    f: ['A resonator this long is folded back and forth to fit, hence the zigzag.', 'Each one is tuned to a slightly different frequency so many can share one line.'], swatch: '#a9bdd6' });
  const cpl = v.part('couplers', { name: 'Couplers', t: 'about 10 mK', s: 'links about 1 mm',
    d: 'Links between neighbouring qubits so they can run two-qubit gates. Simple designs use a fixed coupling; newer ones use a tunable coupler that can switch the interaction on and off.',
    f: [], swatch: '#a9bdd6' });
  const qb = v.part('qubits', { name: 'Transmon qubits', opens: 'transmon', t: 'about 10 mK', s: 'each about 0.5 mm',
    d: 'Each one is a tiny circuit that behaves like an atom with two usable energy levels, called 0 and 1. Two metal pads store charge and a Josephson junction between them makes the levels unevenly spaced, so the circuit can be driven between just two. Open one to look closer.',
    f: [], swatch: '#a9bdd6' });
  qb.f = lat.kind === 'hex'
    ? ['This layout is IBM’s heavy-hex lattice: qubits sit on the corners and edge midpoints of hexagons, so each has two or three neighbours. Fewer neighbours means less crosstalk and a layout suited to error correction.', 'Frequency is around 4 to 6 GHz.']
    : ['This layout is a square grid, as in Google’s Sycamore and Willow chips: each qubit couples to up to four neighbours. It fits the surface error-correcting code directly.', 'Frequency is around 4 to 6 GHz.'];
  cpl.f = lat.kind === 'hex'
    ? ['In this layout every link joins a corner qubit to an edge-midpoint qubit.']
    : ['The small squares at the midpoints are tunable couplers.'];

  const nbr = lat.sites.map(() => V3());
  lat.links.forEach(([a, b]) => { const d = V3(lat.sites[b].x - lat.sites[a].x, 0, lat.sites[b].z - lat.sites[a].z).normalize(); nbr[a].add(d); nbr[b].sub(d); });
  lat.sites.forEach((s, i) => {
    const q = new THREE.Group();
    if (lat.kind === 'hex') { q.add(put(box(0.5, 0.07, 0.26, MAT.nb), -0.27, 0, 0)); q.add(put(box(0.5, 0.07, 0.26, MAT.nb), 0.27, 0, 0)); }
    else { q.add(box(0.86, 0.07, 0.24, MAT.nb)); q.add(box(0.24, 0.07, 0.86, MAT.nb)); }
    q.add(put(box(0.09, 0.07, 0.09, MAT.junction), 0, 0.02, 0));
    v.add(qb, put(q, s.x, 0.04, s.z), { off: V3(0, 1.4, 0) });
    let d = nbr[i].clone().negate(); if (d.length() < 0.2) d = V3(0, 0, 1); d.normalize();
    const nrm = V3(-d.z, 0, d.x); const pts = [];
    for (let z = 0; z < 9; z++) pts.push(V3(s.x, 0.03, s.z).addScaledVector(d, 0.3 + z * 0.075).addScaledVector(nrm, (z % 2 ? 1 : -1) * 0.1));
    v.add(res, tubeM(pts, 0.017, MAT.nb, 30, 5), { off: V3(0, 0.55, 0) });
  });
  lat.links.forEach(([a, b]) => {
    const A = lat.sites[a], B = lat.sites[b]; const len = Math.hypot(B.x - A.x, B.z - A.z), ang = Math.atan2(B.x - A.x, B.z - A.z);
    const m = box(0.05, 0.035, len - 0.55, MAT.nb); m.rotation.y = ang; v.add(cpl, put(m, (A.x + B.x) / 2, 0.03, (A.z + B.z) / 2), { off: V3(0, 0.95, 0) });
    if (lat.kind === 'sq') { const t = box(0.16, 0.05, 0.16, MAT.nb); t.rotation.y = ang; v.add(cpl, put(t, (A.x + B.x) / 2, 0.03, (A.z + B.z) / 2), { off: V3(0, 0.95, 0) }); }
  });

  const wr = v.part('wiring', { name: 'Wiring die and bump bonds', shell: true, t: 'about 10 mK', s: 'same footprint as the chip',
    d: 'When there are too many qubits for edge pads, a second chip carrying the wiring is stacked face-to-face over the first and joined by many small indium or solder bumps. Control lines then reach the qubits from above.',
    f: ['Indium is a superconductor below about 3.4 K, so the bumps carry signal with no resistance when cold.', 'Both IBM and Google use stacked, bump-bonded chips in their large processors.'], swatch: '#6d87b6' });
  v.add(wr, put(box(half * 2, 0.3, half * 2, MAT.shellGlass), 0, 0.45, 0), { off: V3(0, 3.3, 0) });
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    const x = -half + 0.75 + i * ((half * 2 - 1.5) / 8), z = -half + 0.75 + j * ((half * 2 - 1.5) / 8);
    v.add(wr, put(sph(0.1, MAT.indium, 10), x, 0.2, z), { off: V3(0, 2.2, 0) });
  }
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) v.add(wr, put(box(0.5, 0.02, 0.05, MAT.gold), -3.2 + i * 1.28, 0.63, -3.2 + j * 1.28), { off: V3(0, 3.3, 0) });

  v.setExplode(v.t);
  v.def.cam = { target: V3(0, 1.0, 0), r: 25, az: 0.55, el: 0.72 };
}

function buildTransmon(v) {
  const sub = v.part('substrate', { name: 'Substrate', t: 'about 10 mK', s: 'silicon or sapphire',
    d: 'The wafer piece under everything. At this scale it is a vast flat plain.', f: [], swatch: '#2c3653' });
  v.add(sub, put(box(15, 0.7, 12, MAT.si), 0, -0.35, 0), { off: V3(0, -1.6, 0), bg: true });

  const gr = v.part('ground', { name: 'Ground plane', t: 'about 10 mK', s: 'niobium or aluminium film, about 100 nm thick',
    d: 'A sheet of superconducting metal around the qubit, cut away in a moat. It gives every microwave signal a return path and keeps the qubit from talking to its neighbours by accident.',
    f: ['Niobium turns superconducting below 9.2 K, aluminium below about 1.2 K.', 'The moat is the empty gap around the pads: the pads must not touch the ground.'], swatch: '#a9bdd6' });
  const outer = rect(-7, -5.5, 7, 5.5);
  const hole = [[-4.8, -1.8], [-0.45, -1.8], [-0.45, -4.6], [0.45, -4.6], [0.45, -1.8], [4.8, -1.8], [4.8, -0.45], [6.1, -0.45], [6.1, 0.45], [4.8, 0.45], [4.8, 1.8], [-4.8, 1.8]];
  v.add(gr, slab(outer, [hole], 0.12, MAT.nb), { off: V3(0, 0, 0), bg: true });

  const pd = v.part('pads', { name: 'Capacitor pads', t: 'about 10 mK', s: 'each a few hundred µm across',
    d: 'Two islands of metal that together act as the capacitor of a tiny LC circuit. The qubit’s energy is charge sloshing from one pad to the other, about five billion times a second.',
    f: ['The pads are far larger than the junction. That makes the qubit far less sensitive to stray electric charge, the trick that lets a transmon live long enough to compute with.'], swatch: '#a9bdd6' });
  v.add(pd, slab(rect(-4.2, -1.2, -0.4, 1.2), null, 0.14, MAT.nb), { off: V3(0, 0.6, 0), key: 'A' });
  v.add(pd, slab(rect(0.4, -1.2, 4.2, 1.2), null, 0.14, MAT.nb), { off: V3(0, 0.6, 0), key: 'B' });
  for (const m of pd.mats.values()) { m.emissive = new THREE.Color(0x2dd4bf); m.emissiveIntensity = 0; }

  const sq = v.part('squid', { name: 'SQUID loop', opens: 'junction', t: 'about 10 mK', s: 'about 10 µm',
    d: 'Two Josephson junctions wired in a loop between the pads. Magnetic flux through the loop changes the effective strength of the junction, so a current pulse in the flux line retunes the qubit. Open it to see a junction.',
    f: ['SQUID stands for superconducting quantum interference device.', 'The bright squares on the loop are the two junctions.'], swatch: '#ffd76a' });
  const sq0 = new THREE.Group();
  sq0.add(put(box(0.06, 0.06, 0.7, MAT.al), -0.4, 0, 0)); sq0.add(put(box(0.06, 0.06, 0.7, MAT.al), 0.4, 0, 0));
  sq0.add(put(box(0.86, 0.06, 0.06, MAT.al), 0, 0, 0.32)); sq0.add(put(box(0.86, 0.06, 0.06, MAT.al), 0, 0, -0.32));
  sq0.add(put(box(0.14, 0.09, 0.14, MAT.junction), 0, 0.02, 0.32)); sq0.add(put(box(0.14, 0.09, 0.14, MAT.junction), 0, 0.02, -0.32));
  sq0.scale.setScalar(1.35);
  v.add(sq, put(sq0, 0, 0.1, 0), { off: V3(0, 1.4, 0) });

  const rd = v.part('readout', { name: 'Readout coupling', t: 'about 10 mK', s: 'a slot in the ground plane',
    d: 'The line from this qubit’s readout resonator ends beside one pad. The coupling is deliberately weak: strong enough to read the qubit, weak enough not to shorten its life.',
    f: ['The line continues off the edge of this view to the resonator.'], swatch: '#a9bdd6' });
  v.add(rd, put(box(2.6, 0.13, 0.32, MAT.nb), 5.4, 0.07, 0), { off: V3(0, 0.9, 0) });
  v.add(rd, put(box(0.16, 0.13, 1.1, MAT.nb), 4.55, 0.07, 0), { off: V3(0, 0.9, 0) });

  const fl = v.part('flux', { name: 'Flux line', t: 'about 10 mK', s: 'a thin superconducting line',
    d: 'A thin line that ends close to the SQUID. Current in it makes a magnetic field through the loop, which tunes the qubit’s frequency. Fixed-frequency designs leave it out and drive the qubit through a separate line.',
    f: ['A tunable qubit can be moved away from its neighbours when it should stay idle.'], swatch: '#a9bdd6' });
  v.add(fl, put(box(0.32, 0.13, 4.6, MAT.nb), 0, 0.07, -3.25), { off: V3(0, 0.9, 0) });

  const [pa, pb] = [...pd.mats.entries()].filter(([k]) => k.startsWith('A') || k.startsWith('B')).map(([, m]) => m);
  v.anim.push((time) => { const s = Math.sin(time * 2.2); if (!pd.selected && !pd.hover) { pa.emissive.setHex(0x2dd4bf); pb.emissive.setHex(0xa78bfa); pa.emissiveIntensity = 0.04 + 0.2 * (0.5 + 0.5 * s); pb.emissiveIntensity = 0.04 + 0.2 * (0.5 - 0.5 * s); } });
  v.setExplode(v.t);
  v.def.cam = { target: V3(0, 0.4, 0), r: 21, az: 0.5, el: 0.78 };
}

function buildJunction(v) {
  const sub = v.part('substrate', { name: 'Substrate', t: 'about 10 mK', s: 'silicon or sapphire', d: 'The wafer piece under everything.', f: [], swatch: '#2c3653' });
  v.add(sub, put(box(11, 0.6, 11, MAT.si), 0, -0.3, 0), { off: V3(0, -1.2, 0), bg: true });

  const A = v.part('elA', { name: 'Bottom aluminium electrode', t: 'about 10 mK', s: 'a film tens of nm thick',
    d: 'The first layer: aluminium laid down on the substrate through a patterned mask. Aluminium becomes superconducting below about 1.2 K.',
    f: ['Deposited by evaporation, in vacuum, from a chosen angle.'], swatch: '#d3dae3' });
  v.add(A, put(box(6.6, 0.45, 1.2, MAT.al), -3.0, 0.225, 0), { off: V3(0, 0, 0) });

  const bar = v.part('barrier', { name: 'Aluminium-oxide barrier', t: 'about 10 mK', s: 'about 1 to 2 nm, drawn about 10× too thick',
    d: 'After the first layer a little oxygen is let into the chamber and the aluminium surface oxidises. The oxide is an insulator only about four to eight atoms thick. Electrons do not simply flow across it, but pairs of them can tunnel through.',
    f: ['The barrier is roughly a hundred times thinner than the junction is wide, which is why the drawing has to exaggerate it.', 'How thick the oxide is sets how easily pairs tunnel, and so the qubit’s frequency.'], swatch: '#35e0c8' });
  v.add(bar, put(box(1.2, 0.12, 1.2, MAT.oxide), 0, 0.51, 0), { off: V3(0, 0.9, 0) });

  const B = v.part('elB', { name: 'Top aluminium electrode', t: 'about 10 mK', s: 'overlap about 100 to 300 nm wide',
    d: 'The second layer of aluminium, laid down from a different angle. It overlaps the first over a small patch, and that patch is the junction. The two electrodes and the oxide between them are all there is to it.',
    f: ['Two evaporations at different angles through one mask is called shadow evaporation.', 'Real overlaps are around a hundred to a few hundred nanometres across; junction size is a design choice.'], swatch: '#d3dae3' });
  v.add(B, put(box(1.2, 0.45, 1.2, MAT.al), 0, 0.81, 0), { off: V3(0, 1.8, 0) });
  { const prof = [[-1.3, 0], [-1.3, 0.43], [-0.6, 1.03], [-0.6, 0.6]];
    const sh = new THREE.Shape(prof.map((p) => new THREE.Vector2(p[0], p[1]))); const g = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false });
    g.rotateY(-Math.PI / 2); g.translate(0.6, 0, 0);
    const ramp = new THREE.Mesh(g, MAT.al); v.add(B, ramp, { off: V3(0, 1.8, 0) });
    v.add(B, put(box(1.2, 0.43, 4.6, MAT.al), 0, 0.215, -3.6), { off: V3(0, 1.8, 0) }); }

  const cp = v.part('pairs', { name: 'Cooper pairs', t: 'about 10 mK', s: 'two electrons bound together',
    d: 'In a superconductor electrons bind into pairs and move without resistance. Across the barrier they tunnel as pairs. That gives the junction an inductance that changes with the current through it, the one ingredient that turns a plain oscillator into a qubit.',
    f: ['A plain LC circuit has evenly spaced energy levels, so a pulse that flips 0 to 1 would also push 1 to 2. The junction breaks that spacing.', 'Junctions are not identical: resistance varies by a few percent across a wafer, which is a real headache for large chips.'], swatch: '#fff1b0' });
  const pairs = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group(); g.add(put(sph(0.07, MAT.pair, 8), -0.06, 0, 0)); g.add(put(sph(0.07, MAT.pair, 8), 0.06, 0, 0));
    const px = (Math.random() - 0.5) * 0.8, pz = (Math.random() - 0.5) * 0.8;
    v.add(cp, put(g, px, 0.5, pz), { off: V3() }); pairs.push({ g, px, pz, ph: i / 9 });
  }
  v.anim.push((time) => pairs.forEach((p) => {
    const yA = 0.3, yB = 0.75 + 1.8 * v.t; const u = ease((time * 0.35 + p.ph) % 1);
    p.g.position.set(p.px, yA + (yB - yA) * u, p.pz);
    p.g.rotation.y = time * 2 + p.ph * 6;
  }));
  v.setExplode(v.t);
  v.def.cam = { target: V3(-0.6, 0.9, -0.8), r: 16, az: -0.6, el: 0.5 };
}

const HALO_TEX = {};
function haloTex(hex) {
  if (HALO_TEX[hex]) return HALO_TEX[hex];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const col = '#' + new THREE.Color(hex).getHexString();
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, col); gr.addColorStop(0.28, col + '73'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (HALO_TEX[hex] = t);
}
const halo = (hex, size, op = 0.9) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(hex), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); return s; };
const lightMat = (hex, op) => { const m = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); m.userData.op = op; return m; };
const UPV = V3(0, 1, 0);
function between(mesh, a, b) { const d = b.clone().sub(a), len = d.length(); mesh.position.copy(a).addScaledVector(d, 0.5); mesh.quaternion.setFromUnitVectors(UPV, d.clone().normalize()); mesh.scale.y = len; return mesh; }
const beam = (a, b, r, hex, op = 0.5) => between(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10, 1, true), lightMat(hex, op)), a, b);
const coneBeam = (apex, base, rBase, hex, op = 0.4) => between(new THREE.Mesh(new THREE.ConeGeometry(rBase, 1, 18, 1, true), lightMat(hex, op)), base, apex);
function arrowBetween(a, b, hex, r = 0.03) {
  const g = new THREE.Group(), d = b.clone().sub(a), len = d.length();
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), new THREE.MeshBasicMaterial({ color: hex })); between(sh, a, b.clone().addScaledVector(d.clone().normalize(), -r * 5));
  const hd = new THREE.Mesh(new THREE.ConeGeometry(r * 3, r * 7, 14), new THREE.MeshBasicMaterial({ color: hex })); hd.position.copy(b).addScaledVector(d.clone().normalize(), -r * 3.5); hd.quaternion.setFromUnitVectors(UPV, d.clone().normalize());
  g.add(sh, hd); return g;
}
function textSprite(text, o = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), px = o.px || 56, font = `600 ${px}px Inter, "Segoe UI", system-ui, sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = px + 24;
  g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = o.color || '#dbe3f3'; g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 8; g.fillText(text, w / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); const h = o.h || 0.5; s.scale.set(h * w / c.height, h, 1); s.renderOrder = 10; return s;
}
let TABLE_MAT = null;
function tableMat() {
  if (TABLE_MAT) return TABLE_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#2a3141'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#8390a8';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(16 + i * 32, 16 + j * 32, 3.2, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 5); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (TABLE_MAT = new THREE.MeshStandardMaterial({ map: t, metalness: 0.55, roughness: 0.6 }));
}
function opticalTable(v, part, w, d) {
  v.add(part, put(box(w, 0.5, d, tableMat()), 0, -0.25, 0), { off: V3(0, -0.4, 0) });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) v.add(part, put(cyl(0.34, 0.4, 3, MAT.darksteel, 20), x * (w / 2 - 0.9), -2, z * (d / 2 - 0.9)), { off: V3(0, -0.8, 0) });
}
function ionEquilibrium(N) {
  let u = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * 0.55);
  for (let it = 0; it < 6000; it++) {
    const g = u.map((ui, i) => { let s = ui; for (let j = 0; j < N; j++) if (j !== i) { const d = ui - u[j]; s -= Math.sign(d) / (d * d); } return s; });
    u = u.map((ui, i) => ui - 0.02 * g[i]);
  }
  return u;
}

function buildIonMachine(v) {
  const fl = ring(9.6, 0.015, MAT.darksteel, 96); fl.rotation.x = Math.PI / 2; fl.position.y = -3.7; v.decor(fl);
  const tb = v.part('table', { name: 'Optical table', t: 'room temperature', s: 'a few metres',
    d: 'A steel table drilled with a grid of screw holes and floated on air-cushioned legs so the building cannot shake it. Every laser, mirror and lens is bolted to a known spot.',
    f: ['A mirror that drifts by a fraction of a wavelength can miss a single ion, which is why the table is built to stay still.'], swatch: '#9aa4b4' });
  opticalTable(v, tb, 16, 9);

  const ch = v.part('chamber', { name: 'Vacuum chamber', opens: 'ion-trap', shell: true, t: 'room temperature in most designs', s: 'about 10 to 30 cm',
    d: 'A steel chamber pumped to ultra-high vacuum, so stray air molecules almost never knock an ion out of its trap. Glass viewports let the beams in and the ion light out.',
    f: ['Pressures are typically around 10⁻¹¹ mbar.', 'Some experiments cool the trap to cryogenic temperatures to reduce heating and improve the vacuum. Many run at room temperature.'], swatch: '#cdd3dc' });
  const off = V3(0, 3.6, 0);
  v.add(ch, put(new THREE.Mesh(new THREE.SphereGeometry(1.3, 40, 24), MAT.shellSteel), 0, 1.2, 0), { off });
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
    const g = new THREE.Group();
    g.add(put(cyl(0.38, 0.38, 0.9, MAT.shellSteel, 24), 0, 0.95, 0)); g.add(put(cyl(0.5, 0.5, 0.12, MAT.steel, 24), 0, 1.45, 0)); g.add(put(cyl(0.34, 0.34, 0.05, MAT.shellGlass, 24), 0, 1.5, 0));
    g.quaternion.setFromUnitVectors(UPV, V3(dx, dy, dz)); g.position.set(0, 1.2, 0); v.add(ch, g, { off });
  }

  const tr = v.part('trap', { name: 'The trap', opens: 'ion-trap', t: 'the ions: about a millikelvin', s: 'millimetres to centimetres',
    d: 'Four electrodes and a chain of ions, small enough to hide inside the chamber. Open it to see how the ions are held.',
    f: ['The trap itself is millimetres to centimetres across. Some are etched onto a chip.'], swatch: '#d9a441' });
  for (const [y, z] of [[0.12, 0.12], [-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12]]) v.add(tr, put(cyl(0.03, 0.03, 1.1, MAT.gold, 10), 0, 1.2 + y, z).rotateZ(Math.PI / 2));
  for (let i = 0; i < 7; i++) { const s = put(sph(0.045, MAT.ion, 10), (i - 3) * 0.13, 1.2, 0); s.add(halo(0x2dd4bf, 0.4, 0.8)); v.add(tr, s); }

  const ls = v.part('lasers', { name: 'Lasers', t: 'room temperature', s: 'boxes the size of a shoebox',
    d: 'Several lasers, each tuned to one atomic transition: one cools the ions, one repumps them, one ionizes the atoms that load the trap, one drives the gates. Most of these beams are ultraviolet or infrared, so the colours here are only for the picture.',
    f: ['A laser’s colour must be held steady to within about one part in a hundred million.'], swatch: '#8a5cff' });
  const laser = (x, y, z, hex, ax) => {
    const g = new THREE.Group(); g.add(box(1.5, 0.9, 0.9, MAT.rack)); g.add(put(box(0.06, 0.34, 0.34, new THREE.MeshBasicMaterial({ color: hex })), ax * 0.78, 0, 0)); g.position.set(x, y, z); return g;
  };
  const VIO = 0x8a5cff, RED = 0xff4d5e, BLU = 0x4aa3ff;
  v.add(ls, laser(-7.4, 0.45, -0.7, VIO, 1), { off: V3(-1.4, 0, 0) });
  v.add(ls, laser(-7.4, 0.45, 0.7, RED, 1), { off: V3(-1.4, 0, 0) });
  v.add(ls, laser(0, 0.45, -4.6, BLU, 1).rotateY(Math.PI / 2), { off: V3(0, 0, -1.4) });
  v.add(ls, laser(7.4, 0.45, 0, VIO, -1), { off: V3(1.4, 0, 0) });
  v.add(ls, beam(V3(-6.6, 1.2, -0.7), V3(-1.5, 1.2, -0.12), 0.05, VIO, 0.55), { off: V3(-1.4, 0, 0) });
  v.add(ls, beam(V3(-6.6, 1.2, 0.7), V3(-1.5, 1.2, 0.12), 0.05, RED, 0.5), { off: V3(-1.4, 0, 0) });
  v.add(ls, beam(V3(0, 1.2, -4.1), V3(0, 1.2, -1.5), 0.05, BLU, 0.55), { off: V3(0, 0, -1.4) });
  v.add(ls, beam(V3(6.6, 1.2, 0), V3(1.5, 1.2, 0), 0.05, VIO, 0.55), { off: V3(1.4, 0, 0) });
  v.add(ls, tubeM([V3(-7, 0.7, -0.7), V3(-8.4, 0.2, -2), V3(-9.6, 0.2, -3)], 0.05, MAT.hose, 24));

  const op = v.part('optics', { name: 'Mirrors and lenses', t: 'room temperature', s: 'each about thumb-sized',
    d: 'Mirrors steer each beam and lenses focus it to a spot a few micrometres wide, small enough to hit one ion in a chain.',
    f: ['Acousto-optic modulators, small crystals driven by radio waves, switch a beam on and off within about a microsecond.'], swatch: '#b9c0cc' });
  for (const [x, z] of [[-4.6, -0.7], [-3.0, 0.7], [0, -3], [4.2, 0]]) {
    const g = new THREE.Group(); g.add(put(cyl(0.34, 0.34, 0.08, MAT.shellGlass, 24), 0, 1.2, 0).rotateZ(Math.PI / 2)); g.add(put(ring(0.36, 0.035, MAT.steel, 24), 0, 1.2, 0).rotateY(Math.PI / 2)); g.add(put(cyl(0.05, 0.05, 1.2, MAT.darksteel, 10), 0, 0.6, 0));
    g.position.set(x, 0, z); if (Math.abs(z) > 1.5) g.rotation.y = Math.PI / 2; v.add(op, g, { off: V3(0, 1.2, 0) });
  }

  const im = v.part('imaging', { name: 'Imaging system', t: 'room temperature', s: 'a lens and a camera',
    d: 'A lens close to the chamber collects the faint glow of the ions onto a camera or a photon counter. That glow is the readout: a lit ion is in one state, a dark ion in the other.',
    f: ['Detection takes from a few hundred microseconds to a few milliseconds.'], swatch: '#3a4459' });
  v.add(im, put(cyl(0.62, 0.62, 1.4, MAT.darksteel, 28), 0, 3.35, 0), { off: V3(0, 2.4, 0) });
  v.add(im, put(cyl(0.5, 0.62, 0.3, MAT.black, 28), 0, 2.5, 0), { off: V3(0, 2.4, 0) });
  v.add(im, put(box(1.1, 0.9, 1.1, MAT.rack), 0, 4.5, 0), { off: V3(0, 2.4, 0) });
  v.add(im, put(box(0.8, 0.05, 0.05, MAT.led), 0, 4.5, 0.57), { off: V3(0, 2.4, 0) });

  const pu = v.part('pumps', { name: 'Pumps and gauges', t: 'room temperature', s: 'a small can and a gauge',
    d: 'An ion pump and a getter hold the vacuum and a gauge reads it. Ion pumps have no moving parts, so they add no vibration.',
    f: [], swatch: '#48607a' });
  v.add(pu, put(cyl(0.55, 0.55, 1.5, MAT.atten, 28), -3, 0.75, -2.4), { off: V3(-1.2, 0, -0.8) });
  v.add(pu, tubeM([V3(-3, 1.4, -2.4), V3(-2.6, 1.4, -1.6), V3(-1.1, 1.0, -0.5)], 0.13, MAT.steel, 24), { off: V3(-1.2, 0, -0.8) });

  const rk = v.part('racks', { name: 'Control electronics', t: 'room temperature', s: 'one or two racks',
    d: 'Radio-frequency sources, waveform generators and FPGA boards that shape the laser pulses in time and produce the trap’s own oscillating drive voltage.',
    f: ['The trap needs tens to hundreds of volts of radio-frequency drive, oscillating tens of millions of times a second.'], swatch: '#1b2233' });
  for (let i = 0; i < 2; i++) {
    const x = 5.6 + i * 1.5; v.add(rk, put(box(1.3, 4.2, 1.2, MAT.rack), x, 2.1, 3.3), { off: V3(1.6, 0, 0.8) });
    for (let r = 0; r < 7; r++) v.add(rk, put(box(1.0, 0.06, 0.05, r % 3 ? MAT.led : MAT.ledv), x, 0.7 + r * 0.55, 3.93), { off: V3(1.6, 0, 0.8) });
  }
  v.setExplode(v.t);
  v.def.cam = { target: V3(0, -1.3, 0), r: 25, az: 0.7, el: 0.36 };
}

function buildIonTrap(v) {
  const fl = ring(6.6, 0.015, MAT.darksteel, 96); fl.rotation.x = Math.PI / 2; fl.position.y = -3.4; v.decor(fl);
  const VIO = 0x8a5cff, TEAL = 0x2dd4bf;
  const rods = v.part('rods', { name: 'Radio-frequency electrodes', t: 'room temperature', s: 'rods about 1 mm across',
    d: 'Two of the four rods carry a voltage that oscillates tens of millions of times a second. Averaged over the shaking, the field pushes a charged atom toward the axis. A steady field alone cannot hold a charge still, which is why the trap needs the oscillation.',
    f: ['This is a Paul trap, after Wolfgang Paul, who shared the 1989 Nobel Prize in Physics for it.', 'The two rods glow in turn to show the field swinging back and forth.'], swatch: '#d9a441' });
  const rfMats = [];
  for (const [y, z, rf] of [[0.55, 0.55, 1], [-0.55, -0.55, 1], [0.55, -0.55, 0], [-0.55, 0.55, 0]]) {
    const m = put(cyl(0.13, 0.13, 8, MAT.gold, 24), 0, y, z).rotateZ(Math.PI / 2); v.add(rods, m, { off: V3(0, y * 2.2, z * 2.2) }); if (rf) rfMats.push(m);
  }
  const caps = v.part('endcaps', { name: 'End-cap electrodes', t: 'room temperature', s: 'a steady voltage',
    d: 'A steady voltage on each end keeps the ions from escaping along the axis, so the chain sits in a shallow bowl of potential.',
    f: ['Segmented electrodes on a chip trap can also shuttle ions along the trap and around corners, the idea behind the trapped-ion quantum CCD architecture (Pino et al. 2021).'], swatch: '#e9c46a' });
  for (const s of [-1, 1]) v.add(caps, put(ring(0.55, 0.09, MAT.gold, 40), s * 4.3, 0, 0).rotateY(Math.PI / 2), { off: V3(s * 1.3, 0, 0) });

  const ions = v.part('ions', { name: 'The ion chain', opens: 'ion-chain', t: 'about a millikelvin', s: 'a row a few micrometres apart',
    d: 'Charged atoms held in a row along the axis. They repel each other and the trap squeezes them together, so they settle into a line. Each ion is a qubit.',
    f: ['The real spacing is a few micrometres, far too small to see at this scale, so the drawing exaggerates the ions and the gaps.'], swatch: '#2dd4bf' });
  const ionMeshes = [];
  for (let i = 0; i < 9; i++) {
    const m = put(sph(0.2, MAT.ion, 20), (i - 4) * 0.62, 0, 0); m.add(halo(TEAL, 1.5, 0.85)); v.add(ions, m, { off: V3(0, 0.4, 0) }); ionMeshes.push(m);
  }
  const cool = v.part('cooling', { name: 'Cooling laser', t: 'room temperature', s: 'a beam about a millimetre wide',
    d: 'A laser tuned just below an atomic transition slows any ion moving toward it, like friction. It brings the motion of the chain down to about a millikelvin or less, so the ions sit nearly still.',
    f: ['This is Doppler cooling. The chain has to be this still, because gates use the ions’ shared motion.'], swatch: '#8a5cff' });
  v.add(cool, beam(V3(-3.4, 1.5, 3.1), V3(1.6, -0.2, -0.6), 0.14, VIO, 0.35), { off: V3(-0.8, 0.8, 1.0) });
  const ctl = v.part('control', { name: 'Gate laser', t: 'room temperature', s: 'focused to a few micrometres',
    d: 'A tightly focused beam aimed at one ion, or a pair, to flip its state or entangle it with a neighbour.',
    f: ['A single-qubit flip takes about a microsecond and a two-qubit gate tens to hundreds of microseconds, far slower than the tens of nanoseconds on a superconducting chip.'], swatch: '#ff4d5e' });
  v.add(ctl, coneBeam(ionMeshes[3].position.clone(), V3(0.4, 3.6, 1.2), 0.5, 0xff4d5e, 0.4), { off: V3(0, 1.6, 0.4) });
  v.add(ctl, coneBeam(ionMeshes[4].position.clone(), V3(-1.2, 3.6, -1.0), 0.5, 0xff4d5e, 0.4), { off: V3(0, 1.6, -0.4) });
  const img = v.part('imaging', { name: 'Collection lens', t: 'room temperature', s: 'a lens a few centimetres wide',
    d: 'A lens with a high numerical aperture gathers the light an ion scatters and images it onto a camera or photon counter.',
    f: ['Detection takes a few hundred microseconds to a few milliseconds. A bright ion is one state, a dark ion the other.'], swatch: '#3a4459' });
  v.add(img, put(cyl(1.15, 1.15, 0.9, MAT.darksteel, 40), 0, -3.0, 0), { off: V3(0, -1.6, 0) });
  v.add(img, put(cyl(1.0, 1.0, 0.1, MAT.shellGlass, 40), 0, -2.5, 0), { off: V3(0, -1.6, 0) });
  const cone = v.add(img, coneBeam(V3(0, 0, 0), V3(0, -2.4, 0), 1.0, 0x9bf0e2, 0.13), { off: V3(0, -0.8, 0) });
  const photons = [];
  for (let i = 0; i < 14; i++) { const p = sph(0.045, new THREE.MeshBasicMaterial({ color: 0xbafaf0 }), 8); v.add(img, p); photons.push({ p, ph: i / 14, x: (Math.random() - 0.5) * 2.4 }); }
  const ov = v.part('oven', { name: 'Atom oven and ionizing laser', t: 'the oven runs at a few hundred degrees Celsius', s: 'a small tube',
    d: 'A tiny oven gently warms a sample of the element and a thin stream of neutral atoms drifts toward the middle of the trap. A laser there strips one electron from an atom, and the new ion is caught.',
    f: ['Only ions stay: the trap holds charged atoms, so neutral atoms simply drift on through.'], swatch: '#c9773f' });
  v.add(ov, put(cyl(0.16, 0.16, 1.6, MAT.copper, 16), 0, 0, 0).rotateZ(-0.9), { off: V3(-0.6, -0.9, 0.2) });
  v.add(ov, beam(V3(-0.2, 1.6, -4.2), V3(0.3, -0.05, -0.4), 0.05, 0x4aa3ff, 0.5), { off: V3(0, 0, -1.2) });
  const wall = v.part('chamber', { name: 'Chamber wall', shell: true, t: 'room temperature', s: 'the inside of the vacuum chamber',
    d: 'The inside of the chamber. Every surface near the trap is smooth and clean, because stray charge on a wall shifts the ions.',
    f: ['Electric noise from nearby surfaces heats the ions’ motion, one reason traps are made small and clean.'], swatch: '#cdd3dc' });
  v.add(wall, put(cyl(5.4, 5.4, 9.4, MAT.shellSteel, 56, true), 0, 0, 0).rotateZ(Math.PI / 2), { off: V3(0, 0, 0), bg: true });

  v.anim.push((t) => {
    const s = Math.sin(t * 5); rfMats.forEach((m) => { const mm = m.material; mm.emissive = mm.emissive || new THREE.Color(); mm.emissive.setHex(0xa78bfa); mm.emissiveIntensity = 0.05 + 0.25 * (0.5 + 0.5 * s); });
    ionMeshes.forEach((m, i) => { const h = m.children[0]; if (h) h.material.opacity = 0.6 + 0.25 * Math.sin(t * 3 + i); });
    photons.forEach((q) => { const u = (t * 0.5 + q.ph) % 1; q.p.position.set(ionMeshes[4].position.x + (q.x * u) * 0.55, -2.2 * u * (1 + 0.36 * v.t) - 0.05, (q.x * 0.4) * u); q.p.visible = true; });
  });
  v.setExplode(v.t);
  v.def.cam = { target: V3(0, 0.2, 0), r: 15.5, az: 0.45, el: 0.32 };
}

function buildIonChain(v) {
  const N = 10, eq = ionEquilibrium(N), sc = 4.4 / Math.max(...eq.map(Math.abs)), X = eq.map((u) => u * sc);
  const TEAL = 0x2dd4bf;
  const fl = ring(7.4, 0.015, MAT.darksteel, 96); fl.rotation.x = Math.PI / 2; fl.position.y = -2.6; v.decor(fl);
  const ions = v.part('ions', { name: 'Ions', opens: 'ion-ion', t: 'about a millikelvin', s: 'each a fraction of a nanometre, a few micrometres apart',
    d: 'Each ion is one qubit. Its two states are two of its own internal energy levels, and a laser pulse rotates the qubit between them.',
    f: ['Every ion of an isotope is identical, unlike fabricated qubits, which differ from one to the next.', 'The spacing is uneven: closer in the middle, wider at the ends. That is the real shape of the equilibrium, computed for ten ions.'], swatch: '#2dd4bf' });
  const im = [];
  X.forEach((x, i) => { const m = put(sph(0.3, MAT.ion, 24), x, 0, 0); m.add(halo(TEAL, 2.0, 0.9)); v.add(ions, m, { off: V3(0, 0.5, 0) }); im.push(m); });
  const pot = v.part('potential', { name: 'Trapping potential', t: 'a shallow electric bowl', s: 'along the axis',
    d: 'The trap acts like a bowl along its axis. The ions push each other apart and the bowl pushes them together, so they sit closer in the middle than at the ends.',
    f: [], swatch: '#a78bfa' });
  const pts = []; for (let i = 0; i <= 48; i++) { const x = -5.28 + i * 0.22; pts.push(V3(x, -1.5 + 0.055 * x * x, 0)); }
  v.add(pot, tubeM(pts, 0.05, new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x8a5cff, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }), 90, 8), { off: V3(0, -0.9, 0) });
  const mo = v.part('motion', { name: 'Shared motion', t: 'about a millikelvin', s: 'collective vibrations of the chain',
    d: 'The ions repel one another, so the chain has collective vibrations, like beads on springs. Lasers use this shared motion as a bus: kick one ion and the others feel it. That is how two ions in a chain become entangled.',
    f: ['The drawing shows the two lowest modes together: the whole chain rocking, and the chain stretching and shrinking.', 'Cirac and Zoller proposed using this motion for gates in 1995. The Mølmer–Sørensen gate that most machines use followed in 1999.'], swatch: '#e9c46a' });
  const springGeo = new THREE.BufferGeometry(); springGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N - 1) * 6), 3));
  v.add(mo, new THREE.LineSegments(springGeo, new THREE.LineBasicMaterial({ color: 0xe9c46a, transparent: true, opacity: 0.6 })), { off: V3(0, 0.5, 0) });
  const bm = v.part('beams', { name: 'Gate beams', t: 'room temperature', s: 'each focused to a few micrometres',
    d: 'Two laser beams meet at a pair of ions. Together they drive the shared motion in a way that depends on the ions’ states, which entangles the pair. Any two ions in a chain can be paired this way.',
    f: ['Any pair in one chain can interact directly: all-to-all connectivity, which a fixed chip layout cannot match. The cost is speed, and the length a single chain can grow.', 'Two-qubit gate fidelities above 99.9% have been reported (Ballance et al. and Gaebler et al., 2016).'], swatch: '#ff4d5e' });
  const bA = coneBeam(V3(0, 0, 0), V3(-2.4, 4.4, 2.0), 0.6, 0xff4d5e, 0.4), bB = coneBeam(V3(0, 0, 0), V3(2.4, 4.4, -2.0), 0.6, 0xff4d5e, 0.4);
  v.add(bm, bA, { off: V3(0, 1.0, 0) }); v.add(bm, bB, { off: V3(0, 1.0, 0) });
  const pair = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), lightMat(0xff6b7a, 0.1)); v.add(bm, pair, { off: V3(0, 0.5, 0) });
  let k = 3, lastK = -1;
  v.anim.push((t) => {
    const a = 0.16 * Math.sin(t * 2.2), b = 0.05 * Math.sin(t * 2.2 * Math.sqrt(3) + 1);
    const p = im.map((m, i) => { const x = X[i] + a + b * X[i]; return x; });
    im.forEach((m, i) => { m.position.x = p[i]; m.position.y = v.t * 0.5 * 1; });
    const arr = springGeo.attributes.position; for (let i = 0; i < N - 1; i++) { arr.setXYZ(i * 2, p[i], im[i].position.y, 0); arr.setXYZ(i * 2 + 1, p[i + 1], im[i + 1].position.y, 0); } arr.needsUpdate = true;
    k = 1 + Math.floor((t / 2.6) % (N - 2)); const cx = (p[k] + p[k + 1]) / 2, cy = im[k].position.y;
    const tgt = V3(cx, cy, 0);
    for (const [bmx, from] of [[bA, V3(cx - 2.4, 4.4 + v.t, 2.0)], [bB, V3(cx + 2.4, 4.4 + v.t, -2.0)]]) between(bmx, from, tgt);
    pair.position.set(cx, cy, 0);
    im.forEach((m, i) => { const on = i === k || i === k + 1; m.children[0].material.opacity = on ? 1 : 0.7; m.children[0].scale.setScalar(on ? 2.8 : 2.0); });
  });
  v.setExplode(v.t);
  v.def.cam = { target: V3(0, 0.6, 0), r: 16.5, az: 0.35, el: 0.28 };
  v.ctx.ionX = X; v.ctx.ionEq = eq;
}

function buildIonIon(v) {
  const VIO = 0x8a5cff, TEAL = 0x2dd4bf, GOLD = 0xffd76a;
  const nuc = v.part('nucleus', { name: 'Nucleus', t: 'about a millikelvin', s: 'about 0.00001 nm across, drawn far too big',
    d: 'The nucleus is far smaller than the atom around it, and it has a spin of its own. In ytterbium-171, the isotope used in many ion machines, the nuclear spin is one half.',
    f: ['Nothing about the nucleus changes during a computation. Its spin matters because the electron’s spin can line up with it in two ways.'], swatch: '#ffb347' });
  for (let i = 0; i < 5; i++) { const a = i * 1.257; v.add(nuc, put(sph(0.16, new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff8a5b : 0xffd166, emissive: 0x552200, emissiveIntensity: 0.4, roughness: 0.4 }), 16), Math.cos(a) * 0.12, Math.sin(a * 1.3) * 0.12, Math.sin(a) * 0.12)); }
  const sh = v.part('shells', { name: 'Inner electrons', t: 'about a millikelvin', s: 'the atom is about 0.3 nm across',
    d: 'Most of the ion’s electrons sit in closed shells and do nothing. This ion has lost one electron, which is why it is charged and can be held by electric fields.',
    f: ['A neutral ytterbium atom has 70 electrons. The ion has 69.'], swatch: '#6d87b6' });
  v.add(sh, new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 20), lightMat(0x6d87b6, 0.14)));
  v.add(sh, new THREE.Mesh(new THREE.SphereGeometry(1.7, 32, 20), lightMat(0x6d87b6, 0.08)));
  const el = v.part('electron', { name: 'The outer electron', t: 'about a millikelvin', s: 'one electron',
    d: 'One electron does the work. Its spin and the nucleus’s spin can line up in two ways, and the two ways differ very slightly in energy. Those two levels are the qubit.',
    f: ['This is a hyperfine qubit. The two levels differ by about 12.6 GHz in ytterbium-171: a microwave frequency.', 'The arrows are a cartoon: the two states differ in how the electron’s spin sits relative to the nucleus’s.'], swatch: '#ffd76a' });
  const eOrb = new THREE.Group(); const eMesh = put(sph(0.14, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: GOLD, emissiveIntensity: 1.3, roughness: 0.3 }), 16), 2.5, 0, 0); eMesh.add(halo(GOLD, 1.0, 0.9)); eOrb.add(eMesh);
  eOrb.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => V3(Math.cos(i / 64 * 6.283) * 2.5, 0, Math.sin(i / 64 * 6.283) * 2.5))), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.35 })));
  eOrb.rotation.z = 0.35; v.add(el, eOrb);
  const spinN = arrowBetween(V3(0, -0.5, 0), V3(0, 0.6, 0), 0xff8a5b, 0.03), spinE = arrowBetween(V3(0, -0.4, 0), V3(0, 0.5, 0), GOLD, 0.03);
  spinE.position.set(2.5, 0, 0); eMesh.parent.add(spinE);
  v.add(el, spinN);

  const lv = v.part('levels', { name: 'Energy levels', t: 'about a millikelvin', s: 'a diagram',
    d: '|0⟩ and |1⟩ are the two hyperfine levels. A third, much higher level is used only for reading out: light tuned to it makes one state glow and leaves the other dark.',
    f: ['The gap between |0⟩ and |1⟩ is drawn far too large. The real gap is roughly 60,000 times smaller than the gap up to the higher level.'], swatch: '#e9ecf6' });
  const LX = 8;
  const line = (y, w, hex) => put(box(w, 0.05, 0.05, new THREE.MeshBasicMaterial({ color: hex })), LX, y, 0);
  v.add(lv, line(-1.6, 3.2, 0x2dd4bf)); v.add(lv, line(-0.8, 3.2, 0xa78bfa)); v.add(lv, line(3.4, 3.2, 0xe9ecf6));
  const t0 = textSprite('|0⟩', { h: 0.55, color: '#9ff3e6' }); t0.position.set(LX + 2.3, -1.6, 0); v.add(lv, t0);
  const t1 = textSprite('|1⟩', { h: 0.55, color: '#d4c6ff' }); t1.position.set(LX + 2.3, -0.8, 0); v.add(lv, t1);
  const tp = textSprite('higher level', { h: 0.5, color: '#e8ecf6' }); tp.position.set(LX + 2.8, 3.4, 0); v.add(lv, tp);
  const dot = put(sph(0.2, new THREE.MeshBasicMaterial({ color: 0xffd76a }), 14), LX, -1.6, 0); dot.add(halo(GOLD, 1.2, 0.9)); v.add(lv, dot);
  const pu = v.part('pulse', { name: 'Control pulse', t: 'room temperature source', s: 'microseconds',
    d: 'A microwave or laser pulse tuned to the gap between |0⟩ and |1⟩ swings the ion between them, like a pendulum: a quarter swing makes an even superposition, a half swing flips it.',
    f: ['The gold dot shows the ion’s state: it slides between |0⟩ and |1⟩ as the pulse acts, and is left half way when the pulse ends. Then it is read out.'], swatch: '#ff4d5e' });
  v.add(pu, arrowBetween(V3(LX - 1.9, -1.6, 0), V3(LX - 1.9, -0.8, 0), 0xff4d5e, 0.035));
  v.add(pu, arrowBetween(V3(LX - 1.9, -0.8, 0), V3(LX - 1.9, -1.6, 0), 0xff4d5e, 0.035));
  const ph = v.part('photons', { name: 'Fluorescence', t: 'room temperature detector', s: 'a stream of photons',
    d: 'For readout, a laser tuned to the higher level makes an ion in one state scatter photons that a camera counts, while an ion in the other state stays dark. Every run here ends in a random bright or dark result, because the pulse left the ion in an even superposition.',
    f: ['One shot gives one bit. Many shots give the probabilities.'], swatch: '#9bf0e2' });
  v.add(ph, arrowBetween(V3(LX + 1.4, -0.8, 0), V3(LX + 1.4, 3.4, 0), 0x9bf0e2, 0.03));
  const stream = []; for (let i = 0; i < 26; i++) { const p = sph(0.07, new THREE.MeshBasicMaterial({ color: 0xbafaf0 }), 8); p.visible = false; v.add(ph, p); stream.push({ p, a: Math.random() * 6.283, b: Math.random() * 3.14 - 1.57, ph: Math.random() }); }
  const tally = textSprite('bright 0 · dark 0', { h: 0.6, color: '#e8ecf6' }); tally.position.set(LX + 0.4, 5.0, 0); v.add(ph, tally);
  let bright = 0, dark = 0, outcome = 0;
  v.anim.push((t) => {
    const T = 6.0, c = Math.floor(t / T), u = t % T;
    const p1 = u < 2 ? Math.pow(Math.sin(u * Math.PI / 8), 2) : 0.5;
    if (u >= 3 && c !== v.ctx.lastCyc) { v.ctx.lastCyc = c; outcome = Math.random() < 0.5 ? 1 : 0; if (outcome) bright++; else dark++; tally.material.map.dispose(); const n = textSprite('bright ' + bright + ' · dark ' + dark, { h: 0.6, color: '#e8ecf6' }); tally.material.map = n.material.map; tally.material.needsUpdate = true; }
    const level = u >= 3 && u < 5.4 ? (outcome ? -0.8 : -1.6) : (u >= 5.4 ? -1.6 : -1.6 + 0.8 * p1);
    dot.position.y += (level - dot.position.y) * 0.25;
    dot.children[0].material.opacity = 0.9;
    const read = u >= 3.2 && u < 5.2 && outcome === 1;
    stream.forEach((s) => { s.p.visible = read; if (!read) return; const w = (t * 1.3 + s.ph) % 1, r = 0.4 + w * 4; s.p.position.set(Math.cos(s.a) * Math.cos(s.b) * r, Math.sin(s.b) * r, Math.sin(s.a) * Math.cos(s.b) * r); });
    eOrb.rotation.y = t * 1.6; eOrb.rotation.z = 0.35;
    const flip = (u >= 3 && u < 5.4) ? outcome : p1 >= 0.25 ? 1 : 0;
    spinE.rotation.z = flip ? 0 : Math.PI;
    spinE.rotation.y = -t * 1.6;
  });
  v.setExplode(v.t);
  v.def.cam = { target: V3(4.2, 1.0, 0), r: 22.5, az: 0.15, el: 0.25 };
}

function buildAtomMachine(v) {
  const fl = ring(9.6, 0.015, MAT.darksteel, 96); fl.rotation.x = Math.PI / 2; fl.position.y = -3.7; v.decor(fl);
  const RED = 0xff4d5e, BLU = 0x4aa3ff, VIO = 0x8a5cff;
  const tb = v.part('table', { name: 'Optical table', t: 'room temperature', s: 'a few metres',
    d: 'A steel table drilled with a grid of screw holes and floated on air-cushioned legs so the building cannot shake it. Every laser, mirror and lens is bolted to a known spot.',
    f: ['Neutral-atom machines share this table with lasers and cameras. There is no fridge: the atoms are cooled by light, not by a cryostat.'], swatch: '#9aa4b4' });
  opticalTable(v, tb, 16, 9);

  const off = V3(0, 3.0, 0);
  const cell = v.part('cell', { name: 'Vacuum cell', opens: 'atom-cell', shell: true, t: 'room temperature', s: 'a few centimetres',
    d: 'A small glass cell pumped to ultra-high vacuum. Glass lets laser light in and out from every side, so there are no bulky metal ports.',
    f: ['Nothing electric is needed inside. The atoms are neutral, and light does all the holding.'], swatch: '#8fb2e0' });
  v.add(cell, put(box(1.7, 1.7, 1.7, MAT.shellGlass), 0, 1.0, 0), { off });
  v.add(cell, put(cyl(0.3, 0.3, 1.4, MAT.shellGlass, 20), 0, 1.0, 1.4).rotateX(Math.PI / 2), { off });
  v.add(cell, put(cyl(0.55, 0.6, 0.35, MAT.steel, 24), 0, 0.05, 0), { off: V3(0, -0.2, 0) });

  const ar = v.part('atoms', { name: 'The atoms', opens: 'atom-cell', t: 'tens of microkelvin', s: 'a grid a few tens of micrometres across',
    d: 'A grid of single atoms held in the middle of the cell, too small to see at this scale. Open the cell to see how they are caught and held.',
    f: ['Rubidium, cesium and strontium are the usual choices.'], swatch: '#2dd4bf' });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const a = put(sph(0.035, MAT.ion, 8), (i - 1.5) * 0.14, 1.0, (j - 1.5) * 0.14); v.add(ar, a); }
  v.add(ar, halo(0x2dd4bf, 0.9, 0.5).translateY(1.0));

  const obj = v.part('objective', { name: 'Objective lens', t: 'room temperature', s: 'a lens about as wide as a fist',
    d: 'One lens with a very high numerical aperture does two jobs: it focuses the trapping light into spots about a micrometre wide, and it collects the atoms’ glow for the camera.',
    f: ['The same lens builds the array and reads it.'], swatch: '#3a4459' });
  v.add(obj, put(cyl(0.7, 0.7, 1.4, MAT.darksteel, 32), 0, 2.9, 0), { off: V3(0, 2.4, 0) });
  v.add(obj, put(cyl(0.45, 0.7, 0.6, MAT.black, 32), 0, 2.0, 0), { off: V3(0, 2.4, 0) });
  v.add(obj, coneBeam(V3(0, 1.0, 0), V3(0, 1.9, 0), 0.42, 0xff8a5b, 0.3), { off: V3(0, 0.9, 0) });

  const cam = v.part('camera', { name: 'Camera', t: 'room temperature', s: 'a sensitive camera',
    d: 'A very sensitive camera photographs the atoms’ glow and shows which sites hold an atom. Reading out the whole array takes milliseconds.',
    f: ['A picture of the array is how the machine checks its own work: which sites are filled, and what state each atom is in.'], swatch: '#1b2233' });
  v.add(cam, put(box(1.2, 1.0, 1.2, MAT.rack), 0, 4.4, 0), { off: V3(0, 2.4, 0) });
  v.add(cam, put(box(0.8, 0.05, 0.05, MAT.led), 0, 4.4, 0.62), { off: V3(0, 2.4, 0) });

  const ls = v.part('lasers', { name: 'Lasers', t: 'room temperature', s: 'boxes the size of a shoebox',
    d: 'Different lasers do different jobs: cool the atoms, make the tweezers, lift atoms into the interacting state, read them out. Many are infrared or blue and ultraviolet, so the colours here are only for the picture.',
    f: ['A laser’s colour must be held steady to within about one part in a hundred million.'], swatch: '#ff4d5e' });
  const laser = (x, z, hex, ax) => { const g = new THREE.Group(); g.add(box(1.5, 0.9, 0.9, MAT.rack)); g.add(put(box(0.06, 0.34, 0.34, new THREE.MeshBasicMaterial({ color: hex })), ax * 0.78, 0, 0)); g.position.set(x, 0.45, z); return g; };
  v.add(ls, laser(-7.4, -0.8, RED, 1), { off: V3(-1.4, 0, 0) }); v.add(ls, laser(-7.4, 0.8, BLU, 1), { off: V3(-1.4, 0, 0) });
  v.add(ls, laser(7.4, -0.8, VIO, -1), { off: V3(1.4, 0, 0) }); v.add(ls, laser(7.4, 0.8, RED, -1), { off: V3(1.4, 0, 0) });
  for (const [x0, z0, hex] of [[-6.6, -0.8, RED], [-6.6, 0.8, BLU], [6.6, -0.8, VIO], [6.6, 0.8, RED]]) v.add(ls, beam(V3(x0, 1.0, z0), V3(Math.sign(x0) * 0.9, 1.0, z0 * 0.2), 0.045, hex, 0.5), { off: V3(Math.sign(x0) * 1.4, 0, 0) });

  const op = v.part('optics', { name: 'Beam shaping', t: 'room temperature', s: 'crystals and mirrors',
    d: 'Acousto-optic deflectors and spatial light modulators split one laser beam into a grid of hundreds of tweezers and steer individual ones to move atoms around.',
    f: ['A deflector is a crystal driven by radio waves: change the radio frequency and the beam swings.'], swatch: '#b9c0cc' });
  for (const [x, z] of [[-4.2, -0.8], [-3.0, 0.8], [3.4, -0.8], [4.6, 0.8]]) {
    const g = new THREE.Group(); g.add(put(box(0.6, 0.5, 0.5, MAT.darksteel), 0, 1.0, 0)); g.add(put(cyl(0.05, 0.05, 1.0, MAT.darksteel, 10), 0, 0.5, 0)); g.position.set(x, 0, z); v.add(op, g, { off: V3(0, 1.2, 0) });
  }
  const pu = v.part('pumps', { name: 'Pumps and atom source', t: 'the source is warm', s: 'a small can and a heater',
    d: 'An ion pump holds the vacuum. A small heated dispenser releases rubidium or cesium atoms into the cell as a thin vapour that the lasers then catch.',
    f: [], swatch: '#48607a' });
  v.add(pu, put(cyl(0.5, 0.5, 1.4, MAT.atten, 28), -3, 0.7, -2.6), { off: V3(-1.2, 0, -0.8) });
  v.add(pu, tubeM([V3(-3, 1.3, -2.6), V3(-2.4, 1.2, -1.5), V3(-0.9, 1.0, -0.3)], 0.12, MAT.steel, 24), { off: V3(-1.2, 0, -0.8) });
  const rk = v.part('racks', { name: 'Control electronics', t: 'room temperature', s: 'one or two racks',
    d: 'Waveform generators and FPGA boards that time every laser pulse and drive the deflectors that move the atoms.',
    f: [], swatch: '#1b2233' });
  for (let i = 0; i < 2; i++) {
    const x = 5.6 + i * 1.5; v.add(rk, put(box(1.3, 4.2, 1.2, MAT.rack), x, 2.1, 3.3), { off: V3(1.6, 0, 0.8) });
    for (let r = 0; r < 7; r++) v.add(rk, put(box(1.0, 0.06, 0.05, r % 3 ? MAT.led : MAT.ledv), x, 0.7 + r * 0.55, 3.93), { off: V3(1.6, 0, 0.8) });
  }
  v.setExplode(v.t);
  v.def.cam = { target: V3(0, -1.2, 0), r: 24, az: 0.65, el: 0.34 };
}

function buildAtomCell(v) {
  const TEAL = 0x2dd4bf, RED = 0xff4d5e, ORG = 0xff8a5b;
  const fl = ring(6.4, 0.015, MAT.darksteel, 96); fl.rotation.x = Math.PI / 2; fl.position.y = -3.6; v.decor(fl);
  const cell = v.part('cell', { name: 'Glass cell', shell: true, t: 'room temperature', s: 'a few centimetres',
    d: 'The walls of the vacuum cell. Every surface is coated to let the laser colours through and keep the rest out.',
    f: ['Glass gives the lasers a clear view from every side.'], swatch: '#8fb2e0' });
  v.add(cell, put(box(8, 8, 8, MAT.shellGlass), 0, 0, 0), { off: V3(0, 0, 0), bg: true });
  const coils = v.part('coils', { name: 'Magnetic coils', t: 'room temperature', s: 'two coils',
    d: 'Two coils carry currents in opposite directions, making a magnetic field that is zero at the centre and grows outward. Together with the laser beams it forms a magneto-optical trap, which first catches atoms from the vapour.',
    f: ['The field tells the atoms which way is the middle: an atom that drifts off feels the beams push it back.'], swatch: '#c9773f' });
  for (const s of [-1, 1]) v.add(coils, put(ring(3.2, 0.2, MAT.copper, 56), 0, s * 1.6, 0).rotateX(Math.PI / 2), { off: V3(0, s * 1.6, 0) });
  const mot = v.part('mot', { name: 'Cooling beams and the atom cloud', t: 'tens to hundreds of microkelvin', s: 'a cloud about a millimetre across',
    d: 'Six laser beams from all directions push atoms back toward the centre and slow them, cooling a cloud to well under a millikelvin. The cloud is the raw material: single atoms are then picked out of it.',
    f: ['Light can cool because an atom moving toward a beam sees its colour shifted and absorbs more from it, and each absorbed photon pushes it back.', 'Typical temperatures are tens to hundreds of microkelvin.'], swatch: '#ff4d5e' });
  for (const [ax, ay, az] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) v.add(mot, beam(V3(-ax * 3.6, -ay * 3.6, -az * 3.6), V3(ax * 3.6, ay * 3.6, az * 3.6), 0.12, RED, 0.3), { off: V3(0, 0, 0) });
  const cloud = []; for (let i = 0; i < 90; i++) { const p = sph(0.05, new THREE.MeshBasicMaterial({ color: 0xffb3a0 }), 6); const r = Math.cbrt(Math.random()) * 0.9, a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1); p.userData.b = [r, a, b, Math.random() * 6.283]; v.add(mot, p); cloud.push(p); }
  v.add(mot, halo(ORG, 2.8, 0.55));
  const obj = v.part('objective', { name: 'Objective lens', t: 'room temperature', s: 'a lens about as wide as a fist',
    d: 'The lens that both makes the tweezers and collects the light from the atoms. It sits just outside the glass, close to the atoms.',
    f: [], swatch: '#3a4459' });
  v.add(obj, put(cyl(1.5, 1.5, 1.6, MAT.darksteel, 40), 0, 5.6, 0), { off: V3(0, 1.4, 0) });
  v.add(obj, put(cyl(0.7, 1.5, 1.1, MAT.black, 40), 0, 4.3, 0), { off: V3(0, 1.4, 0) });
  const tw = v.part('tweezers', { name: 'Optical tweezers', t: 'the atoms: tens of microkelvin', s: 'each spot about a micrometre wide',
    d: 'A tightly focused laser beam attracts an atom to its brightest point and holds it there, like a bead in a bowl of light. A grid of beams makes a grid of traps, and each trap catches at most one atom.',
    f: ['A tweezer catches an atom only about half the time, so the array is photographed and rearranged into a full grid.', 'The colour is chosen so the light pulls atoms in without exciting them.'], swatch: '#ff8a5b' });
  const spots = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) spots.push(V3((i - 1.5) * 0.7, 0, (j - 1.5) * 0.7));
  spots.forEach((s) => v.add(tw, coneBeam(s, V3(s.x * 3.6, 4.4, s.z * 3.6), 0.09 * 3.6, ORG, 0.28), { off: V3(0, 0.6, 0) }));
  const at = v.part('atoms', { name: 'The atoms', opens: 'atom-array', t: 'tens of microkelvin', s: 'single atoms about 0.5 nm across',
    d: 'Single atoms, each held in its own tweezer. Open the array to look at them.',
    f: ['Every atom of an element is identical.'], swatch: '#2dd4bf' });
  spots.forEach((s, i) => { const a = put(sph(0.09, MAT.ion, 12), s.x, 0, s.z); a.add(halo(TEAL, 0.6, 0.85)); v.add(at, a, { off: V3(0, 1.4, 0) }); });
  v.anim.push((t) => cloud.forEach((p) => { const [r, a, b, ph] = p.userData.b; const w = t * 0.8 + ph; const rr = r * (1 + 0.12 * Math.sin(w * 2)); p.position.set(rr * Math.sin(b) * Math.cos(a + w * 0.3), rr * Math.cos(b) * (0.5), rr * Math.sin(b) * Math.sin(a + w * 0.3)); }));
  v.setExplode(v.t);
  v.def.cam = { target: V3(0, 1.4, 0), r: 19, az: 0.6, el: 0.42 };
}

function buildAtomArray(v) {
  const TEAL = 0x2dd4bf, ORG = 0xff8a5b, BLU = 0x4aa3ff;
  const P = 1.5, n = 6;
  const fl = ring(8.4, 0.015, MAT.darksteel, 96); fl.rotation.x = Math.PI / 2; fl.position.y = -2.4; v.decor(fl);
  const site = (i, j) => V3((i - (n - 1) / 2) * P, 0, (j - (n - 1) / 2) * P);
  const gap = [2, 3];
  const at = v.part('atoms', { name: 'The atoms', opens: 'atom-atom', t: 'tens of microkelvin', s: 'each about 0.5 nm, about 5 µm apart',
    d: 'Each atom is one qubit. Two of its long-lived internal levels are |0⟩ and |1⟩. Neutral atoms barely interact with each other until you want them to.',
    f: ['Arrays of hundreds of atoms are routine, and one with 6,100 atoms has been demonstrated (Manetsch et al., Nature 2025).', 'The drawing exaggerates the atoms and the gaps: real atoms are thousands of times smaller than their spacing.'], swatch: '#2dd4bf' });
  const atoms = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === gap[0] && j === gap[1]) continue;
    const a = put(sph(0.17, MAT.ion, 20), site(i, j).x, 0, site(i, j).z); a.add(halo(TEAL, 1.2, 0.85)); v.add(at, a, { off: V3(0, 0.6, 0) }); atoms.push({ a, i, j });
  }
  const tw = v.part('tweezers', { name: 'Tweezer grid', t: 'light', s: 'each spot about a micrometre wide',
    d: 'Each atom sits at the focus of its own beam of light. The beams come from a single laser that a crystal deflector or a liquid-crystal panel divides into a grid.',
    f: ['Any pattern of sites is possible, not just a square grid: lines, rings, triangles, whatever the problem needs.'], swatch: '#ff8a5b' });
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const s = site(i, j); v.add(tw, coneBeam(s, V3(s.x * 1.5, 3.4, s.z * 1.5), 0.4, ORG, 0.16), { off: V3(0, 0.3, 0) }); }
  const bl = v.part('blockade', { name: 'Blockade radius', t: 'set by the excitation', s: 'a few micrometres',
    d: 'When an atom is lifted to a Rydberg state it swells to a huge size, and any neighbour within a few micrometres cannot be lifted at the same moment. That blockade is what lets two atoms interact and become entangled.',
    f: ['The sphere is the blockade radius, and it is bigger than the gap between neighbours.', 'Jaksch et al. (2000) and Lukin et al. (2001) proposed gates built on this.'], swatch: '#a78bfa' });
  const pairA = site(3, 2), pairB = site(4, 2);
  const bs = new THREE.Mesh(new THREE.SphereGeometry(1.15 * P, 32, 20), lightMat(0xa78bfa, 0.16)); bs.position.copy(pairA); v.add(bl, bs, { off: V3(0, 0.6, 0) });
  const bs2 = new THREE.Mesh(new THREE.SphereGeometry(1.15 * P, 32, 20), lightMat(0xa78bfa, 0.16)); bs2.position.copy(pairB); v.add(bl, bs2, { off: V3(0, 0.6, 0) });
  const ry = v.part('rydberg', { name: 'Excitation laser', t: 'light', s: 'a sheet of blue light over the array',
    d: 'A wide beam of the right colour lifts the atoms to the Rydberg state for a moment. Atoms in a blockaded pair share one excitation between them, which entangles them.',
    f: ['A single global pulse can act on many pairs at once. Two-qubit gate fidelity around 99.5% has been shown across many pairs in parallel (Evered et al. 2023).'], swatch: '#4aa3ff' });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 11.5), lightMat(BLU, 0.1)); sheet.rotation.x = -Math.PI / 2; sheet.position.y = 0.9; v.add(ry, sheet, { off: V3(0, 2.6, 0) });
  const mv = v.part('movable', { name: 'Moving tweezer', t: 'light', s: 'steered by a deflector',
    d: 'Some tweezers can be steered while they hold an atom. That lets the machine fill gaps in the array before a computation, and carry atoms next to one another during it.',
    f: ['Moving atoms means any atom can be brought beside any other, at the cost of the time the move takes.', 'Bluvstein et al. (2022) demonstrated entangling gates on atoms carried by moving tweezers.'], swatch: '#ffd76a' });
  const carried = put(sph(0.17, MAT.junction, 20), 0, 0, 0); carried.add(halo(0xffd76a, 1.3, 0.9)); v.add(mv, carried, { off: V3(0, 0.6, 0) });
  const from = V3(-(n / 2 + 1.1) * P, 0, site(0, gap[1]).z), to = site(gap[0], gap[1]);
  const carriedTw = coneBeam(V3(0, 0, 0), V3(0, 3.4, 0), 0.4, 0xffd76a, 0.25); v.add(mv, carriedTw, { off: V3(0, 0.3, 0) });
  v.anim.push((t) => {
    const T = 7, u = (t % T) / T;
    const k = u < 0.15 ? 0 : u < 0.6 ? (u - 0.15) / 0.45 : 1; const e = k * k * (3 - 2 * k);
    const x = from.x + (to.x - from.x) * e, z = from.z + (to.z - from.z) * e;
    carried.position.set(x, 0.45 * Math.sin(e * Math.PI), z);
    between(carriedTw, V3(x, carried.position.y, z), V3(x * 1.5, 3.4, z * 1.5));
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    bs.material.opacity = 0.1 + 0.12 * pulse; bs2.material.opacity = 0.1 + 0.12 * pulse;
    atoms.forEach((o) => { const inPair = (o.i === 3 && o.j === 2) || (o.i === 4 && o.j === 2); o.a.children[0].material.opacity = inPair ? 0.7 + 0.3 * pulse : 0.75; });
  });
  v.setExplode(v.t);
  v.def.cam = { target: V3(0, 0.4, 0), r: 24, az: 0.35, el: 0.62 };
}

function buildAtomAtom(v) {
  const GOLD = 0xffd76a, TEAL = 0x2dd4bf, VIO = 0xa78bfa, BLU = 0x4aa3ff;
  const nuc = v.part('nucleus', { name: 'Nucleus', t: 'tens of microkelvin', s: 'about 0.00001 nm across, drawn far too big',
    d: 'The nucleus is far smaller than the atom around it and plays no active part in a gate.', f: [], swatch: '#ffb347' });
  for (let i = 0; i < 5; i++) { const a = i * 1.257; v.add(nuc, put(sph(0.15, new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff8a5b : 0xffd166, emissive: 0x552200, emissiveIntensity: 0.4, roughness: 0.4 }), 16), Math.cos(a) * 0.11, Math.sin(a * 1.3) * 0.11, Math.sin(a) * 0.11)); }
  const gr = v.part('ground', { name: 'The atom in its ordinary state', t: 'tens of microkelvin', s: 'a few tenths of a nanometre to half a nanometre',
    d: 'In its ordinary state an atom is a small ball of electron cloud, a few tenths of a nanometre across.',
    f: ['Rubidium-87 is a common choice. Its two ground-state hyperfine levels, about 6.8 GHz apart, are the qubit.'], swatch: '#6d87b6' });
  v.add(gr, new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 20), lightMat(0x6d87b6, 0.22)));
  v.add(gr, new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 20), lightMat(0x6d87b6, 0.1)));
  const ry = v.part('rydberg', { name: 'The Rydberg orbit', t: 'tens of microkelvin', s: 'a few hundred nanometres in radius, drawn about 300× too small',
    d: 'A laser pulse lifts the outer electron to a very high orbit, around the 70th energy level. Orbit size grows as the square of the level number, so the atom swells to a few hundred nanometres in radius: a thousand times its usual size or more.',
    f: ['That swollen atom is easily pushed around by its neighbours, which is exactly what makes two-qubit gates possible.', 'Relative to the ordinary atom, the orbit is drawn about 300 times too small.'], swatch: '#a78bfa' });
  const orbit = new THREE.Group();
  const rr = 5.2; orbit.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => V3(Math.cos(i / 128 * 6.283) * rr, 0, Math.sin(i / 128 * 6.283) * rr))), new THREE.LineBasicMaterial({ color: VIO, transparent: true, opacity: 0.6 })));
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(rr, 40, 24), lightMat(VIO, 0.06)); orbit.add(cloud);
  const eR = put(sph(0.2, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: VIO, emissiveIntensity: 1.4, roughness: 0.3 }), 18), rr, 0, 0); eR.add(halo(VIO, 1.6, 0.9)); orbit.add(eR);
  orbit.rotation.z = 0.4; v.add(ry, orbit);
  const nb = v.part('neighbour', { name: 'A neighbouring atom', t: 'tens of microkelvin', s: 'a few micrometres away, drawn much too close',
    d: 'Close enough to the swollen atom, a neighbour’s own Rydberg level is pushed out of tune, so the same laser can no longer excite it. That is the blockade, and it is the whole basis of the gate.',
    f: ['The neighbour is drawn far closer than it really is, so that both atoms fit in one view.'], swatch: '#2dd4bf' });
  const nbm = put(sph(0.28, MAT.ion, 20), 9.5, -1.2, -3.2); nbm.add(halo(TEAL, 1.4, 0.8)); v.add(nb, nbm);
  v.add(nb, new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), lightMat(0x6d87b6, 0.18)).translateX(9.5).translateY(-1.2).translateZ(-3.2));
  const lv = v.part('levels', { name: 'Energy levels', t: 'a diagram', s: 'a diagram',
    d: '|0⟩ and |1⟩ are the two ground-state hyperfine levels, and they carry the qubit. The Rydberg level |r⟩ is used only for the length of a gate, then the atom comes back.',
    f: ['Between gates the atoms sit in |0⟩ and |1⟩, which last for seconds. That long life is why neutral atoms are good at storing quantum information.'], swatch: '#e9ecf6' });
  const LX = -9.0;
  const line = (y, w, hex) => put(box(w, 0.05, 0.05, new THREE.MeshBasicMaterial({ color: hex })), LX, y, 0);
  v.add(lv, line(-2.4, 3.0, TEAL)); v.add(lv, line(-1.6, 3.0, VIO)); v.add(lv, line(3.6, 3.0, 0xe9ecf6));
  const t0 = textSprite('|0⟩', { h: 0.55, color: '#9ff3e6' }); t0.position.set(LX - 2.2, -2.4, 0); v.add(lv, t0);
  const t1 = textSprite('|1⟩', { h: 0.55, color: '#d4c6ff' }); t1.position.set(LX - 2.2, -1.6, 0); v.add(lv, t1);
  const tr = textSprite('|r⟩ Rydberg', { h: 0.55, color: '#e8ecf6' }); tr.position.set(LX - 3.0, 3.6, 0); v.add(lv, tr);
  const dot = put(sph(0.2, new THREE.MeshBasicMaterial({ color: GOLD }), 14), LX, -1.6, 0); dot.add(halo(GOLD, 1.2, 0.9)); v.add(lv, dot);
  const lz = v.part('laser', { name: 'Excitation pulse', t: 'light', s: 'a pulse of a few hundred nanoseconds',
    d: 'A pulse of blue or ultraviolet light lifts the atom from |1⟩ to |r⟩. Timed correctly, a second pulse brings it back, and the atom picks up a phase that depends on whether its neighbour was also excited.',
    f: ['That conditional phase is the two-qubit gate.'], swatch: '#4aa3ff' });
  v.add(lz, arrowBetween(V3(LX + 1.0, -1.6, 0), V3(LX + 1.0, 3.6, 0), BLU, 0.04));
  v.add(lz, beam(V3(-4.5, 2.6, 4.5), V3(0, 0, 0), 0.07, BLU, 0.5), { off: V3(0, 0, 0) });
  v.anim.push((t) => {
    const T = 6, u = (t % T) / T;
    const k = u < 0.2 ? 0 : u < 0.4 ? (u - 0.2) / 0.2 : u < 0.7 ? 1 : u < 0.9 ? 1 - (u - 0.7) / 0.2 : 0; const e = k * k * (3 - 2 * k);
    orbit.scale.setScalar(0.06 + 0.94 * e); orbit.visible = e > 0.02; orbit.rotation.y = t * 0.8;
    dot.position.y += ((e > 0.5 ? 3.6 : -1.6) - dot.position.y) * 0.18;
    cloud.material.opacity = 0.03 + 0.05 * e;
    nbm.children[0].material.opacity = 0.8 - 0.35 * e;
  });
  v.setExplode(v.t);
  v.def.cam = { target: V3(-1.0, 0.4, 0), r: 29, az: 0.12, el: 0.22 };
}

const INTRO = {
  system: { title: 'The whole machine', text: 'Most of what you see is not the computer. The processor is a chip about the size of a fingernail, buried in the can at the centre. Everything else keeps it cold, isolated and connected to the outside world.' },
  cryostat: { title: 'Inside the cryostat', text: 'Five gold plates, each colder than the last, from room temperature at the top to about ten thousandths of a degree above absolute zero at the bottom. Wires run down, cool as they go, and end at the processor.' },
  package: { title: 'The chip package', text: 'A gold box on the coldest plate. Connectors fan into a circuit board, the board reaches the chip through hair-thin wires, and shields around it keep out light and magnetic fields.' },
  chip: { title: 'The chip', text: 'Superconducting circuits patterned on silicon: qubits, the resonators that read them and the couplers that link them. This is a small excerpt; real chips carry from tens to over a hundred qubits, and the largest more.' },
  transmon: { title: 'One transmon qubit', text: 'Two metal pads and a loop, in a moat cut from a sheet of superconductor. The pads glow in turn to show charge sloshing between them, billions of times a second.' },
  junction: { title: 'The Josephson junction', text: 'The bottom of the stack: two aluminium films separated by an oxide layer a few atoms thick. Everything above exists to protect, drive and read this one component.' },
  'ion-machine': { title: 'A trapped-ion machine', text: 'Mostly light. The qubits are single charged atoms held in a vacuum chamber a few centimetres across; the table around it carries the lasers and optics that cool, control and read them. There is no fridge.' },
  'ion-trap': { title: 'Inside the vacuum chamber', text: 'Four electrodes shake a radio-frequency field that squeezes the ions onto a line, end electrodes stop them sliding off, and beams of light cool them, address them and read them out. The ions and gaps are drawn far too big to be seen at this scale.' },
  'ion-chain': { title: 'A chain of ions', text: 'Ten ions in a row, closer together in the middle than at the ends because that is where the repulsion and the trap balance. They wobble together like beads on springs, and lasers use that shared motion to entangle any two of them.' },
  'ion-ion': { title: 'One ion', text: 'A single ytterbium ion: a nucleus, closed shells of electrons and one outer electron. Two ways its spin can sit relative to the nucleus\u2019s are |0\u27E9 and |1\u27E9. Watch a pulse put it in a superposition and a readout turn that into a random bright or dark result.' },
  'atom-machine': { title: 'A neutral-atom machine', text: 'Also mostly light, but the qubits are uncharged atoms, held not by electrodes but by focused laser beams. The heart of it is a small glass cell and one very good lens.' },
  'atom-cell': { title: 'Inside the glass cell', text: 'A cloud of atoms is cooled by six laser beams, then a grid of tightly focused beams, the optical tweezers, catches single atoms out of it. The same lens that focuses the tweezers collects the light for the camera.' },
  'atom-array': { title: 'The tweezer array', text: 'A grid of single atoms, each held in its own beam of light. A sheet of blue light lifts them to the Rydberg state, where a blockade entangles neighbours, and a moving tweezer carries an atom in to fill a gap.' },
  'atom-atom': { title: 'One atom, and its Rydberg state', text: 'In its ordinary state the atom is a small ball of electron cloud. A laser pulse lifts the outer electron into an enormous orbit, and that swollen atom stops its neighbours from following. The orbit is drawn about 300 times too small.' },
};
const BUILD = { system: buildSystem, cryostat: buildCryostat, package: buildPackage, chip: buildChip, transmon: buildTransmon, junction: buildJunction,
  'ion-machine': buildIonMachine, 'ion-trap': buildIonTrap, 'ion-chain': buildIonChain, 'ion-ion': buildIonIon,
  'atom-machine': buildAtomMachine, 'atom-cell': buildAtomCell, 'atom-array': buildAtomArray, 'atom-atom': buildAtomAtom };
const DEF = {
  system: { expl: 0 }, cryostat: { expl: 0.6 }, package: { expl: 0.6 }, chip: { expl: 0.55 }, transmon: { expl: 0.5 }, junction: { expl: 0.55 },
  'ion-machine': { expl: 0 }, 'ion-trap': { expl: 0.5 }, 'ion-chain': { expl: 0.4 }, 'ion-ion': { expl: 0 },
  'atom-machine': { expl: 0 }, 'atom-cell': { expl: 0.5 }, 'atom-array': { expl: 0.4 }, 'atom-atom': { expl: 0 },
};

const SRC_BY_LEVEL = {
  system: [1, 2], cryostat: [1, 2], package: [1, 2], chip: [2, 3, 4, 5, 6], transmon: [2, 3], junction: [2, 3],
  'ion-machine': [7], 'ion-trap': [7, 8], 'ion-chain': [7, 9, 10, 11], 'ion-ion': [7, 11],
  'atom-machine': [12], 'atom-cell': [12], 'atom-array': [12, 13, 14, 15, 16], 'atom-atom': [12, 13],
};
const MADE = {
  'system/can': 'Metal, commonly stainless steel or aluminium.',
  'cryostat/struts': 'Stainless steel or a fibre composite.',
  'cryostat/cablesIn': 'Coax. A typical choice is stainless steel near the top, cupronickel in the middle and copper at the bottom.',
  'cryostat/cablesOut': 'Coax that is superconducting niobium-titanium between 4 K and the mixing chamber.',
  'cryostat/twpa': 'Superconducting Josephson junctions.',
  'cryostat/atten': 'Small in-line resistors.',
  'cryostat/circ': 'Contains a small magnet.',
  'package/base': 'Gold-plated copper.',
  'package/chip': 'Silicon or sapphire with superconducting circuits patterned on top.',
  'package/pcb': 'A printed circuit with microwave transmission lines.',
  'package/bonds': 'Aluminium wire, each about 25 µm thick.',
  'package/lid': 'Gold-plated copper or aluminium.',
  'package/shield': 'A layer of superconducting aluminium and a layer of high-permeability metal.',
  'chip/substrate': 'Silicon or sapphire.',
  'chip/wiring': 'A second chip, joined to the first by many small indium or solder bumps.',
  'chip/qubits': 'Two metal pads and a Josephson junction between them.',
  'transmon/substrate': 'Silicon or sapphire.',
  'transmon/ground': 'A niobium or aluminium film, about 100 nm thick.',
  'transmon/squid': 'Two Josephson junctions wired in a loop.',
  'junction/substrate': 'Silicon or sapphire.',
  'junction/elA': 'Aluminium, evaporated in vacuum.',
  'junction/elB': 'Aluminium, evaporated in vacuum from a different angle.',
  'junction/barrier': 'Aluminium oxide, made by oxidising the first aluminium layer.',
  'junction/pairs': 'Pairs of electrons bound together.',
  'ion-machine/table': 'Steel, drilled with a grid of screw holes.',
  'ion-machine/chamber': 'Steel, with glass viewports.',
  'ion-trap/rods': 'Four electrodes; the two radio-frequency rods are about 1 mm across.',
  'atom-machine/cell': 'Glass.',
  'atom-machine/table': 'Steel, drilled with a grid of screw holes.',
  'atom-cell/cell': 'Glass, coated to let the laser colours through.',
  'atom-cell/coils': 'Two current-carrying coils.',
};
const RELATED = { sc: ['circuits.html', 'How circuits and qubits work'], ion: ['compare.html', 'How the companies compare'], atom: ['compare.html', 'How the companies compare'] };

function boot() {
  const stage = $('#in-stage'); if (!stage) return;
  const canvas = $('#in-canvas'); const panel = $('#in-panel');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return fallback(stage, panel); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  initMaterials();

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a12);
  scene.fog = new THREE.Fog(0x070a12, 55, 140);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 400);
  { const env = new THREE.Scene(); const bg = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0x24314f, side: THREE.BackSide })); env.add(bg);
    const sb = (c, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3.4), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    sb(0xfff2dd, 14, 22, 10, 22, 12); sb(0x9ad8ff, -22, 8, -10, 10, 24); sb(0xc9b8ff, 6, 4, -24, 26, 6); sb(0xffffff, 0, -16, 12, 20, 4);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.03).texture; scene.environmentIntensity = 1.0; pm.dispose(); }
  const key = new THREE.DirectionalLight(0xfff1dd, 1.2); key.position.set(10, 22, 12); scene.add(key);
  scene.add(new THREE.HemisphereLight(0x8fb2ff, 0x101522, 0.55));

  const S = { view: null, id: null, xray: false, layout: 'hex', busy: false, interacted: false, armed: false, hover: null };
  const cam = { target: V3(), r: 20, az: 0.6, el: 0.3, vaz: 0, vel: 0, fly: null, rmin: 2, rmax: 60 };

  const veil = $('#in-veil'), tip = $('#in-tip'), live = $('#in-live'), cap = $('#in-cap');
  const cardEl = $('#in-card'), hudEl = $('#in-hud'), crossEl = $('#in-cross'), deepEl = $('#in-deep');

  const F = { on: false, pos: V3(), yaw: 0, pitch: 0, vel: V3(), keys: new Set(), joy: { x: 0, y: 0 }, vbtn: 0, lock: false, tilt: false, tref: null, tbase: null,
    auto: true, speedK: 1, slow: 1, solid: [], base: 10, dwell: 0, dwellPart: null, boxes: [], boxT: 0, out: 0, hint: '' };
  camera.rotation.order = 'YXZ';

  const fitK = () => Math.max(1, 0.40 / (camera.aspect * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
  function place() {
    const c = Math.cos(cam.el);
    camera.position.set(cam.target.x + cam.r * Math.sin(cam.az) * c, cam.target.y + cam.r * Math.sin(cam.el), cam.target.z + cam.r * Math.cos(cam.az) * c);
    camera.lookAt(cam.target);
  }
  function flyTo(goal, ms) {
    if (reduced() || !ms) { Object.assign(cam, { r: goal.r ?? cam.r, az: goal.az ?? cam.az, el: goal.el ?? cam.el }); if (goal.target) cam.target.copy(goal.target); cam.fly = null; return Promise.resolve(); }
    let daz = (goal.az ?? cam.az) - cam.az; daz = Math.atan2(Math.sin(daz), Math.cos(daz));
    return new Promise((res) => { cam.fly = { t0: performance.now(), ms, from: { target: cam.target.clone(), r: cam.r, az: cam.az, el: cam.el }, to: { target: goal.target ? goal.target.clone() : cam.target.clone(), r: goal.r ?? cam.r, az: cam.az + daz, el: goal.el ?? cam.el }, res }; });
  }
  function stepFly(now) {
    const f = cam.fly; if (!f) return; const t = clamp((now - f.t0) / f.ms, 0, 1), e = ease(t);
    cam.target.lerpVectors(f.from.target, f.to.target, e); cam.r = f.from.r + (f.to.r - f.from.r) * e; cam.az = f.from.az + (f.to.az - f.from.az) * e; cam.el = f.from.el + (f.to.el - f.from.el) * e;
    if (t >= 1) { cam.fly = null; f.res(); }
  }

  const HL_HOVER = new THREE.Color(0x2dd4bf), HL_SEL = new THREE.Color(0xa78bfa);
  function paint(v) {
    for (const p of v.parts) {
      const hl = p.selected ? 0.5 : p.hover ? 0.3 : 0; const col = p.selected ? HL_SEL : HL_HOVER;
      const fac = p.hidden ? 0 : (S.xray && !p.selected) ? 0.13 : 1;
      const show = !p.hidden && (!v.isolate || v.isolate === p);
      for (const m of p.mats.values()) {
        if (!m.userData.led && m.emissive) { if (hl) { m.emissive.copy(col); m.emissiveIntensity = hl; } else if (!(v.id === 'transmon' && p.id === 'pads')) { m.emissive.copy(m.userData.baseEm); m.emissiveIntensity = m.userData.baseEmI; } }
        const op = m.userData.op * fac; const tr = op < 0.999;
        if (m.transparent !== tr || m.opacity !== op) { m.opacity = op; m.transparent = tr; m.depthWrite = op > 0.6; m.needsUpdate = true; }
      }
      for (const it of p.items) it.obj.visible = show;
    }
  }

  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  function pick(cx, cy) {
    const v = S.view; if (!v) return null; const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(v.root.children, true); let shellHit = null;
    for (const h of hits) {
      const p = h.object.userData.part; if (!p || !h.object.visible || p.hidden) continue;
      if (p.shell) { if (!shellHit) shellHit = p; continue; }
      return p;
    }
    return shellHit;
  }

  function disposeView(v) {
    v.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    v.parts.forEach((p) => p.mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }));
    scene.remove(v.root);
  }
  function makeAndShow(id) {
    const def = Object.assign({}, DEF[id]); const v = makeView(def); v.id = id;
    BUILD[id](v, S); v.setExplode(def.expl);
    scene.add(v.root); S.view = v; S.id = id;
    cam.rmin = v.def.cam.r * 0.14; cam.rmax = v.def.cam.r * 2.3 * fitK();
    const sl = $('#in-explode'); sl.value = String(Math.round(v.t * 100));
    paint(v); return v;
  }
  async function goto(id, o = {}) {
    if (S.busy || !BUILD[id]) return; S.busy = true;
    const from = S.view; const dive = o.dive;
    const prevId = from && from.id;
    if (from && !reduced()) {
      veil.classList.add('on');
      if (F.on) F.vel.set(0, 0, 0);
      else if (dive && dive.center) flyTo({ target: dive.center, r: Math.max(cam.rmin, dive.size * 0.9) }, 460);
      else flyTo({ r: cam.r * (o.up ? 1.5 : 0.7) }, 460);
      await sleep(F.on ? 300 : 470);
    }
    if (from) disposeView(from);
    S.interacted = false;
    const v = makeAndShow(id); const c = v.def.cam;
    const R = c.r * fitK();
    if (F.on) { flyPlace(v, o.up ? prevId : null); veil.classList.remove('on'); }
    else {
      cam.target.copy(c.target); cam.az = c.az + (o.up ? 0.5 : -0.5); cam.el = c.el; cam.r = R * (o.up ? 0.55 : 1.6);
      place(); veil.classList.remove('on');
      flyTo({ r: R, az: c.az }, 900);
    }
    S.busy = false; syncUi(); history.replaceState(null, '', '#' + id);
    if (o.select && v.byId[o.select]) select(v.byId[o.select], false);
    announce(INTRO[id].title + '. ' + INTRO[id].text);
  }
  function partBox(p) { const b = new THREE.Box3(); p.items.forEach((it) => { if (it.obj.visible) { it.obj.updateMatrixWorld(true); b.expandByObject(it.obj); } }); return b; }
  function focus(p) {
    const b = partBox(p); if (b.isEmpty()) return; const c = b.getCenter(V3()), s = b.getSize(V3()); const size = Math.max(s.x, s.y, s.z);
    if (size > S.view.def.cam.r * 0.9) return;
    if (F.on) {
      const dirv = F.pos.clone().sub(c); if (dirv.lengthSq() < 1e-9) dirv.set(0, 0.3, 1); dirv.normalize();
      const p1 = c.clone().addScaledVector(dirv, size * 1.6 + F.base * 0.03), save = { p: F.pos.clone(), y: F.yaw, q: F.pitch };
      F.pos.copy(p1); faceTo(c); const y1 = F.yaw, q1 = F.pitch; let dy = y1 - save.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      F.pos.copy(save.p); F.yaw = save.y; F.pitch = save.q;
      F.tw = { t0: performance.now(), ms: reduced() ? 1 : 650, p0: save.p, p1, y0: save.y, dy, q0: save.q, q1 };
      return;
    }
    flyTo({ target: c, r: clamp(size * 2.1 + 2.2, cam.rmin, cam.rmax) }, 700);
  }

  function select(p, fly) {
    const v = S.view; if (!v) return;
    if (v.sel) v.sel.selected = false; v.sel = p; if (p) p.selected = true;
    if (!p) v.isolate = null;
    paint(v); renderInfo(); renderList();
    if (p && fly) focus(p);
    if (p) announce(p.name + '. ' + p.d);
  }
  function announce(t) { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); }
  function open(p) {
    if (!p || !p.opens) return; const b = partBox(p); const c = b.getCenter(V3()), s = b.getSize(V3());
    goto(p.opens, { dive: { center: c, size: Math.max(s.x, s.y, s.z) } });
  }

  const listEl = $('#in-list'), infoEl = $('#in-info'), headEl = $('#in-head');
  function renderHead() {
    const L = levelsOf(S.id), i = L.findIndex((l) => l.id === S.id), M = MACHINES[machineOf(S.id)], it = INTRO[S.id];
    headEl.innerHTML = '<p class="in-lvl">' + esc(M.name) + ' &middot; level ' + (i + 1) + ' of ' + L.length + ' &middot; ' + esc(L[i].label) + ', ' + esc(L[i].size) + '</p><h2 class="in-title">' + esc(it.title) + '</h2><p class="in-intro">' + esc(it.text) + '</p>';
  }
  function renderList() {
    const v = S.view; if (!v) return;
    listEl.innerHTML = v.parts.map((p) => '<li><button type="button" class="in-part' + (p.selected ? ' is-sel' : '') + (p.hidden ? ' is-off' : '') + '" data-part="' + esc(p.id) + '" aria-pressed="' + (p.selected ? 'true' : 'false') + '"><i style="background:' + esc(p.swatch || '#999') + '"></i><span>' + esc(p.name) + '</span>' + (p.opens ? '<em title="Has an inside view">opens</em>' : '') + '</button></li>').join('');
  }
  function renderInfo() {
    const v = S.view; const p = v && v.sel;
    if (!p) { infoEl.innerHTML = '<p class="in-hint">Click any part in the scene, or pick one from the list. Parts marked <b>opens</b> have an inside you can dive into.</p>'; cap.classList.remove('on'); renderCard(); return; }
    const facts = (p.f && p.f.length) ? '<ul class="in-facts">' + p.f.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '';
    const iso = v.isolate === p;
    infoEl.innerHTML = '<h3 class="in-name">' + esc(p.name) + '</h3><dl class="in-meta"><div><dt>Temperature</dt><dd>' + esc(p.t || '') + '</dd></div><div><dt>Size</dt><dd>' + esc(p.s || '') + '</dd></div></dl><p>' + esc(p.d) + '</p>' + facts +
      '<div class="in-actions">' + (p.opens ? '<button type="button" class="in-btn in-primary" data-act="open">Open inside &#9656;</button>' : '') +
      '<button type="button" class="in-btn" data-act="zoom">Zoom to it</button><button type="button" class="in-btn" data-act="iso" aria-pressed="' + iso + '">' + (iso ? 'Show everything' : 'Isolate') + '</button><button type="button" class="in-btn" data-act="hide">Hide</button></div>' +
      (p.opens ? '' : '<p class="in-end">No separate inside view for this part.</p>');
    cap.innerHTML = '<b>' + esc(p.name) + '</b><span>' + esc(p.t || '') + '</span>'; cap.classList.add('on'); renderCard();
  }
  function renderMachines() {
    const cur = machineOf(S.id);
    $('#in-mach').innerHTML = Object.keys(MACHINES).map((k) => '<button type="button" class="in-m" data-m="' + k + '" aria-pressed="' + (k === cur) + '"><b>' + esc(MACHINES[k].name) + '</b><small>' + esc(MACHINES[k].who) + '</small></button>').join('');
  }
  function renderLadder() {
    $('#in-ladder').innerHTML = levelsOf(S.id).map((l, i) => '<button type="button" class="in-step' + (l.id === S.id ? ' is-cur' : '') + '" data-go="' + l.id + '"' + (l.id === S.id ? ' aria-current="step"' : '') + '><b>' + (i + 1) + '</b><span>' + esc(l.label) + '<small>' + esc(l.size) + '</small></span></button>').join('');
  }
  function syncUi() {
    renderMachines(); renderHead(); renderList(); renderInfo(); renderLadder();
    $('#in-layout').hidden = S.id !== 'chip'; $('#in-flowbtn').hidden = S.id !== 'cryostat';
    $('#in-flowbtn').setAttribute('aria-pressed', String(!!(S.view.ctx && S.view.ctx.flow)));
    $$('#in-layout [data-layout]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === S.layout)));
    $('#in-xray').setAttribute('aria-pressed', String(S.xray));
    $('#in-flybtn').setAttribute('aria-pressed', String(F.on));
    ['#in-lockbtn', '#in-autobtn'].forEach((q) => { $(q).hidden = !F.on; });
    $('#in-tiltbtn').hidden = !(F.on && COARSE && window.DeviceOrientationEvent);
    $('#in-joy').hidden = $('#in-vert').hidden = !(F.on && COARSE);
    $('#in-up').disabled = levelsOf(S.id).findIndex((l) => l.id === S.id) === 0;
  }
  function $$(s) { return Array.from(document.querySelectorAll(s)); }

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const v = S.view;
    if (b.dataset.part) { const p = v.byId[b.dataset.part]; select(v.sel === p ? null : p, true); return; }
    const p = v.sel; if (!p) return;
    if (b.dataset.act === 'open') open(p);
    if (b.dataset.act === 'zoom') focus(p);
    if (b.dataset.act === 'iso') { v.isolate = v.isolate === p ? null : p; paint(v); renderInfo(); }
    if (b.dataset.act === 'hide') { p.hidden = true; v.sel = null; p.selected = false; paint(v); renderInfo(); renderList(); }
  });
  $('#in-ladder').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (!b || b.dataset.go === S.id) return; const L = levelsOf(S.id), to = L.findIndex((l) => l.id === b.dataset.go), cur = L.findIndex((l) => l.id === S.id); goto(b.dataset.go, { up: to < cur }); });
  $('#in-mach').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === machineOf(S.id)) return; goto(MACHINES[b.dataset.m].levels[0].id, {}); });
  $('#in-up').addEventListener('click', up);
  function up() { const L = levelsOf(S.id), i = L.findIndex((l) => l.id === S.id); if (i > 0) goto(L[i - 1].id, { up: true, from: S.id }); }
  $('#in-explode').addEventListener('input', (e) => { S.view.setExplode(+e.target.value / 100); });
  $('#in-xray').addEventListener('click', () => { S.xray = !S.xray; paint(S.view); syncUi(); });
  $('#in-flowbtn').addEventListener('click', () => { S.view.ctx.flow = !S.view.ctx.flow; syncUi(); });
  $('#in-showall').addEventListener('click', () => { const v = S.view; v.isolate = null; v.parts.forEach((p) => { p.hidden = false; }); paint(v); renderInfo(); renderList(); });
  $('#in-layout').addEventListener('click', (e) => { const b = e.target.closest('[data-layout]'); if (!b || S.layout === b.dataset.layout) return; S.layout = b.dataset.layout; const keep = S.view.sel && S.view.sel.id; const t = S.view.t; disposeView(S.view); const v = makeAndShow('chip'); v.setExplode(t); $('#in-explode').value = String(Math.round(t * 100)); if (keep && v.byId[keep]) { v.sel = v.byId[keep]; v.sel.selected = true; } paint(v); syncUi(); });
  $('#in-reset').addEventListener('click', () => { const c = S.view.def.cam; flyTo({ target: c.target, r: c.r * fitK(), az: c.az, el: c.el }, 700); });
  $('#in-zin').addEventListener('click', () => { flyTo({ r: clamp(cam.r * 0.7, cam.rmin, cam.rmax) }, 260); });
  $('#in-zout').addEventListener('click', () => { flyTo({ r: clamp(cam.r * 1.4, cam.rmin, cam.rmax) }, 260); });
  $('#in-full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen(); });

  const ptrs = new Map(); let down = null, pinch0 = 0, btn = 0;
  const touched = () => { S.interacted = true; cam.fly = null; };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); btn = e.button; S.armed = true;
    if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, moved: 0 }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); down = null; }
    touched(); cam.vaz = cam.vel = 0; canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { hover(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) {
      if (down) down.moved += Math.abs(dx) + Math.abs(dy);
      if (F.on) { if (!F.lock) look(dx * 0.0042, dy * 0.0042); }
      else if (btn === 2 || e.shiftKey || e.ctrlKey || e.metaKey) pan(dx, dy); else { cam.az -= dx * 0.0062; cam.el = clamp(cam.el + dy * 0.0062, -1.3, 1.5); cam.vaz = -dx * 0.0062; cam.vel = dy * 0.0062; }
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (F.on) { if (pinch0) F.pos.addScaledVector(fwdVec(), (d - pinch0) * F.base * 0.012 * F.speedK); pinch0 = d; return; }
      if (pinch0) cam.r = clamp(cam.r * (pinch0 / d), cam.rmin, cam.rmax); pinch0 = d; pan(dx / 2, dy / 2);
    }
  });
  const end = (e) => {
    const wasOne = ptrs.size === 1; ptrs.delete(e.pointerId);
    if (wasOne && down && down.moved < 7 && e.type === 'pointerup') {
      const cr = canvas.getBoundingClientRect(), cx = F.lock ? cr.left + cr.width / 2 : e.clientX, cy = F.lock ? cr.top + cr.height / 2 : e.clientY;
      const p = pick(cx, cy); if (p) select(p, false); else select(null);
    }
    if (!ptrs.size) down = null; pinch0 = 0;
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (!ptrs.size) hover(null); });
  canvas.addEventListener('blur', () => { S.armed = false; });
  canvas.addEventListener('dblclick', (e) => { const p = pick(e.clientX, e.clientY); if (p && p.opens) { select(p, false); open(p); } });
  canvas.addEventListener('wheel', (e) => { if (!S.armed) return; e.preventDefault(); touched();
    if (F.on) { F.speedK = clamp(F.speedK * Math.exp(-e.deltaY * 0.0012), 0.12, 8); return; }
    cam.r = clamp(cam.r * Math.exp(e.deltaY * 0.0014), cam.rmin, cam.rmax); }, { passive: false });
  function pan(dx, dy) {
    const k = cam.r * 0.0016; const right = V3().setFromMatrixColumn(camera.matrix, 0), upv = V3().setFromMatrixColumn(camera.matrix, 1);
    cam.target.addScaledVector(right, -dx * k).addScaledVector(upv, dy * k);
  }
  function hover(e) {
    const v = S.view; if (!v) return; const p = e ? pick(e.clientX, e.clientY) : null;
    if (p !== S.hover) { if (S.hover) S.hover.hover = false; S.hover = p; if (p) p.hover = true; paint(v); canvas.style.cursor = p ? 'pointer' : 'grab'; }
    if (p && e) { const r = stage.getBoundingClientRect(); tip.textContent = p.name + (p.opens ? '  ▸' : ''); tip.style.transform = 'translate(' + (e.clientX - r.left + 14) + 'px,' + (e.clientY - r.top + 12) + 'px)'; tip.classList.add('on'); } else tip.classList.remove('on');
  }
  canvas.addEventListener('keydown', (e) => {
    if (F.on) return;
    const k = e.key; let used = true; touched();
    if (k === 'ArrowLeft') cam.az -= 0.12; else if (k === 'ArrowRight') cam.az += 0.12; else if (k === 'ArrowUp') cam.el = clamp(cam.el + 0.1, -1.3, 1.5); else if (k === 'ArrowDown') cam.el = clamp(cam.el - 0.1, -1.3, 1.5);
    else if (k === '+' || k === '=') cam.r = clamp(cam.r * 0.88, cam.rmin, cam.rmax); else if (k === '-' || k === '_') cam.r = clamp(cam.r * 1.14, cam.rmin, cam.rmax);
    else if (k === 'Enter' && S.view.sel && S.view.sel.opens) open(S.view.sel);
    else if (k === 'Escape') { if (S.view.sel) select(null); else up(); }
    else if (k === '0') $('#in-reset').click(); else used = false;
    if (used) e.preventDefault();
  });

  const COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const fwdVec = () => V3(-Math.sin(F.yaw) * Math.cos(F.pitch), Math.sin(F.pitch), -Math.cos(F.yaw) * Math.cos(F.pitch));
  function faceTo(pt) { const d = pt.clone().sub(F.pos), L = d.length() || 1; F.yaw = Math.atan2(-d.x, -d.z); F.pitch = Math.asin(clamp(d.y / L, -1, 1)); }
  function look(dx, dy) {
    F.tw = null; F.yaw -= dx; F.pitch = clamp(F.pitch - dy, -1.5, 1.5);
    if (F.tbase) { F.tbase.yaw -= dx; F.tbase.pitch -= dy; }
  }
  function flyPlace(v, cameFrom) {
    const c = v.def.cam, R = c.r * fitK();
    const dir = V3(Math.sin(c.az) * Math.cos(c.el), Math.sin(c.el), Math.cos(c.az) * Math.cos(c.el));
    let look0 = c.target.clone(), pos = null;
    if (cameFrom) {
      const pp = v.parts.find((q) => q.opens === cameFrom && !q.shell) || v.parts.find((q) => q.opens === cameFrom);
      if (pp) { const b = partBox(pp), cc = b.getCenter(V3()), sz = b.getSize(V3()); look0 = cc; pos = cc.clone().addScaledVector(dir, Math.max(sz.x, sz.y, sz.z) * 1.8 + c.r * 0.05); }
    }
    if (!pos) pos = c.target.clone().addScaledVector(dir, R * 0.78);
    F.pos.copy(pos); faceTo(look0); F.vel.set(0, 0, 0); F.tw = null; F.base = c.r; F.speedK = 1;
    F.boxes = []; F.solid = []; F.slow = 1; F.boxT = 0; F.dwell = 0; F.dwellPart = null; F.out = 0; F.tref = null;
    camera.near = c.r * 0.004; camera.updateProjectionMatrix();
  }
  function enterFly() {
    if (F.on || !S.view) return;
    F.on = true; cam.fly = null; S.interacted = true; S.armed = true;
    F.pos.copy(camera.position); faceTo(S.view.def.cam.target);
    F.base = S.view.def.cam.r; F.speedK = 1; F.vel.set(0, 0, 0); F.boxT = 0; F.dwell = 0; F.dwellPart = null; F.out = 0; F.tw = null;
    camera.near = F.base * 0.004; camera.updateProjectionMatrix();
    stage.classList.add('is-fly'); syncUi(); renderCard(); canvas.focus({ preventScroll: true });
    announce('Fly mode. W A S D to move, drag to look, Q and E for down and up. Fly into a part that opens to shrink inside it.');
  }
  function leaveFly() {
    if (!F.on) return;
    F.on = false; F.keys.clear(); F.joy.x = F.joy.y = 0; F.vbtn = 0;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    setTilt(false);
    const c = S.view.def.cam, rel = F.pos.clone().sub(c.target), r = rel.length() || c.r;
    cam.target.copy(c.target); cam.r = clamp(r, cam.rmin, cam.rmax);
    cam.az = Math.atan2(rel.x, rel.z); cam.el = clamp(Math.asin(clamp(rel.y / r, -1, 1)), -1.3, 1.5); cam.vaz = cam.vel = 0;
    camera.near = 0.05; camera.updateProjectionMatrix(); place();
    stage.classList.remove('is-fly'); cardEl.hidden = true; syncUi();
    announce('Back to the orbit view.');
  }
  function flyKey(e, isDown) {
    if (deepEl.open || e.ctrlKey || e.metaKey || e.altKey) return;
    const c = e.code;
    if (/^(Key[WASDQEC]|Space|Shift(Left|Right)|Arrow(Up|Down|Left|Right))$/.test(c)) { if (isDown) F.keys.add(c); else F.keys.delete(c); e.preventDefault(); e.stopPropagation(); return; }
    if (!isDown) return;
    const v = S.view, k = e.key; let used = true;
    if (k === 'Enter') { const p = F.dwellPart || (v.sel && v.sel.opens ? v.sel : null); if (p) open(p); else used = false; }
    else if (k === 'Escape') { if (v.sel) select(null); else leaveFly(); }
    else if (k === 'b' || k === 'B') up();
    else if (k === 'f' || k === 'F') leaveFly();
    else if (k === 'r' || k === 'R') showAll();
    else if (k === 'i' || k === 'I') { if (v.sel) toggleIso(v.sel); }
    else if (k === 'x' || k === 'X') { const t = v.t > 0.05 ? 0 : (DEF[S.id].expl || 0.5); $('#in-explode').value = String(Math.round(t * 100)); v.setExplode(t); }
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }
  const flyIgnores = (e) => { const t = e.target, tag = t && t.tagName; return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || ((tag === 'BUTTON' || tag === 'A') && (e.code === 'Space' || e.key === 'Enter')); };
  stage.addEventListener('keydown', (e) => { if (F.on && !flyIgnores(e)) flyKey(e, true); });
  stage.addEventListener('keyup', (e) => { if (F.on) flyKey(e, false); });
  stage.addEventListener('focusout', (e) => { if (!stage.contains(e.relatedTarget)) F.keys.clear(); });
  window.addEventListener('blur', () => F.keys.clear());
  function showAll() { const v = S.view; v.isolate = null; v.parts.forEach((p) => { p.hidden = false; }); paint(v); renderInfo(); renderList(); }
  function toggleIso(p) { const v = S.view; v.isolate = v.isolate === p ? null : p; paint(v); renderInfo(); }

  const hudState = { a: '', b: '' };
  function updateHud() {
    if (!F.on) { hudEl.hidden = true; return; }
    hudEl.hidden = false;
    const L = levelsOf(S.id), i = L.findIndex((l) => l.id === S.id), M = MACHINES[machineOf(S.id)];
    const a = '<b>' + esc(L[i].label) + '</b> <span>' + esc(M.name) + ' &middot; ' + esc(L[i].size) + ' &middot; speed ' + (F.speedK).toFixed(2) + '&times;</span>';
    let hint;
    if (F.dwellPart) hint = F.auto ? 'Shrinking into <b>' + esc(F.dwellPart.name) + '</b>&hellip; fly away to cancel' : 'Press <b>Enter</b> to shrink into <b>' + esc(F.dwellPart.name) + '</b>';
    else if (F.out > 0.05) hint = 'Growing back out&hellip;';
    else hint = 'Fly into a part marked &#9656; to shrink inside it. Fly out, or press <b>B</b>, to grow back.';
    if (a !== hudState.a) { hudState.a = a; hudEl.querySelector('.in-hud-a').innerHTML = a; }
    if (hint !== hudState.b) { hudState.b = hint; hudEl.querySelector('.in-hud-b').innerHTML = hint; }
  }
  function stepFlight(dt) {
    const v = S.view, k = F.keys;
    if (F.tw) {
      const t = clamp((performance.now() - F.tw.t0) / F.tw.ms, 0, 1), e = ease(t);
      F.pos.lerpVectors(F.tw.p0, F.tw.p1, e); F.yaw = F.tw.y0 + F.tw.dy * e; F.pitch = F.tw.q0 + (F.tw.q1 - F.tw.q0) * e; F.vel.set(0, 0, 0);
      if (t >= 1) F.tw = null;
    } else {
      const f = fwdVec(), right = V3(Math.cos(F.yaw), 0, -Math.sin(F.yaw));
      const has = (a, b) => (k.has(a) || (b && k.has(b)) ? 1 : 0);
      const fw = has('KeyW') - has('KeyS') + F.joy.y, st = has('KeyD') - has('KeyA') + F.joy.x, vt = has('KeyE', 'Space') - has('KeyQ', 'KeyC') + F.vbtn;
      const want = V3().addScaledVector(f, fw).addScaledVector(right, st).addScaledVector(UPV, vt);
      if (want.length() > 1) want.normalize();
      let dmin = Infinity; for (const b of F.solid) { const dd = b.distanceToPoint(F.pos); if (dd < dmin) dmin = dd; }
      const target = clamp(dmin / (F.base * 0.28), 0.22, 1);
      F.slow += (target - F.slow) * (1 - Math.exp(-10 * dt));
      const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1;
      want.multiplyScalar(F.base * 0.28 * F.speedK * (boost > 1 ? Math.max(F.slow, 0.35) : F.slow) * boost);
      F.vel.lerp(want, 1 - Math.exp(-9 * dt)); F.pos.addScaledVector(F.vel, dt);
      const ly = has('ArrowLeft') - has('ArrowRight'), lp = has('ArrowUp') - has('ArrowDown');
      if (ly || lp) look(-ly * 1.7 * dt, -lp * 1.4 * dt);
    }
    const c = v.def.cam, d = F.pos.distanceTo(c.target), lim = c.r * 2.4 * fitK();
    if (d > lim * 1.7) F.pos.copy(c.target).addScaledVector(F.pos.clone().sub(c.target), lim * 1.7 / d);
    const idx = levelsOf(S.id).findIndex((l) => l.id === S.id);
    if (d > lim && idx > 0 && !S.busy) { F.out += dt; if (F.out > 0.9) { F.out = 0; up(); return; } } else F.out = Math.max(0, F.out - dt * 2);
    F.boxT -= dt;
    if (F.boxT <= 0) {
      F.boxT = 0.3; const all = v.parts.filter((p) => !p.hidden).map((p) => ({ p, b: partBox(p) })).filter((x) => !x.b.isEmpty());
      F.boxes = all.filter((x) => x.p.opens).map((x) => { const z = x.b.getSize(V3()); return { p: x.p, b: x.b.clone().expandByScalar(Math.max(0.15 * Math.max(z.x, z.y, z.z), 0.04 * F.base)) }; });
      F.solid = all.filter((x) => !x.p.shell && x.b.getSize(V3()).length() < F.base * 0.6).map((x) => x.b);
    }
    let best = null, bv = Infinity;
    for (const x of F.boxes) if (x.b.containsPoint(F.pos)) { const z = x.b.getSize(V3()), vol = z.x * z.y * z.z; if (vol < bv) { bv = vol; best = x.p; } }
    if (best) { if (best === F.dwellPart) F.dwell += dt; else { F.dwellPart = best; F.dwell = 0; } }
    else if (F.dwellPart) { F.dwell -= dt * 1.5; if (F.dwell <= 0) { F.dwellPart = null; F.dwell = 0; } }
    if (best && F.auto && F.dwell > 0.85 && !S.busy) { F.dwell = 0; open(best); return; }
    camera.position.copy(F.pos); camera.rotation.set(F.pitch, F.yaw, 0);
    if (F.lock && (F.hoverT = (F.hoverT || 0) - dt) <= 0) { F.hoverT = 0.1; const r = canvas.getBoundingClientRect(); hover({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); }
  }

  document.addEventListener('pointerlockchange', () => {
    F.lock = document.pointerLockElement === canvas; crossEl.hidden = !F.lock; $('#in-lockbtn').setAttribute('aria-pressed', String(F.lock));
    if (!F.lock) hover(null);
  });
  document.addEventListener('mousemove', (e) => { if (F.on && F.lock) look(e.movementX * 0.0022, e.movementY * 0.0022); });
  $('#in-lockbtn').addEventListener('click', () => { if (document.pointerLockElement === canvas) document.exitPointerLock(); else if (canvas.requestPointerLock) canvas.requestPointerLock(); canvas.focus({ preventScroll: true }); });

  const tq = new THREE.Quaternion(), tq1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2), tq0 = new THREE.Quaternion(), te = new THREE.Euler(), Z = V3(0, 0, 1);
  function onTilt(e) {
    if (!F.on || e.alpha == null) return;
    const D = Math.PI / 180, o = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * D;
    te.set(e.beta * D, e.alpha * D, -e.gamma * D, 'YXZ'); tq.setFromEuler(te); tq.multiply(tq1); tq.multiply(tq0.setFromAxisAngle(Z, -o));
    if (!F.tref) { F.tref = tq.clone().invert(); F.tbase = { yaw: F.yaw, pitch: F.pitch }; return; }
    te.setFromQuaternion(F.tref.clone().multiply(tq), 'YXZ');
    F.yaw = F.tbase.yaw + te.y; F.pitch = clamp(F.tbase.pitch + te.x, -1.5, 1.5);
  }
  async function setTilt(on) {
    const b = $('#in-tiltbtn');
    if (on && !F.tilt) {
      try { if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission && (await DeviceOrientationEvent.requestPermission()) !== 'granted') return; } catch (e) { return; }
      window.addEventListener('deviceorientation', onTilt); F.tilt = true; F.tref = null;
    } else if (!on && F.tilt) { window.removeEventListener('deviceorientation', onTilt); F.tilt = false; F.tref = null; F.tbase = null; }
    b.setAttribute('aria-pressed', String(F.tilt));
  }
  $('#in-tiltbtn').addEventListener('click', () => setTilt(!F.tilt));

  { const joy = $('#in-joy'), knob = joy.firstElementChild; let pid = null, c0 = null; const RADIUS = 46;
    const set = (e) => { let dx = e.clientX - c0.x, dy = e.clientY - c0.y; const L = Math.hypot(dx, dy); if (L > RADIUS) { dx *= RADIUS / L; dy *= RADIUS / L; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; F.joy.x = dx / RADIUS; F.joy.y = -dy / RADIUS; };
    joy.addEventListener('pointerdown', (e) => { pid = e.pointerId; joy.setPointerCapture(pid); const r = joy.getBoundingClientRect(); c0 = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; set(e); e.preventDefault(); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === pid) set(e); });
    const off = (e) => { if (e.pointerId !== pid) return; pid = null; F.joy.x = F.joy.y = 0; knob.style.transform = ''; };
    joy.addEventListener('pointerup', off); joy.addEventListener('pointercancel', off);
    const vb = (id, val) => { const b = $(id); b.addEventListener('pointerdown', (e) => { F.vbtn = val; b.setPointerCapture(e.pointerId); e.preventDefault(); }); const r = () => { F.vbtn = 0; }; b.addEventListener('pointerup', r); b.addEventListener('pointercancel', r); };
    vb('#in-vup', 1); vb('#in-vdn', -1); }

  $('#in-flybtn').addEventListener('click', () => (F.on ? leaveFly() : enterFly()));
  $('#in-autobtn').addEventListener('click', () => { F.auto = !F.auto; $('#in-autobtn').setAttribute('aria-pressed', String(F.auto)); });

  function renderCard() {
    const v = S.view, p = v && v.sel;
    if (!F.on || !p) { cardEl.hidden = true; return; }
    const iso = v.isolate === p;
    cardEl.innerHTML = '<button type="button" class="in-x" data-cact="close" aria-label="Close details">&times;</button><h3>' + esc(p.name) + (p.opens ? ' <small>opens &#9656;</small>' : '') + '</h3>' +
      '<p class="in-cmeta">' + esc(p.t || '') + ' &middot; ' + esc(p.s || '') + '</p><p class="in-cd">' + esc(p.d) + '</p>' +
      '<div class="in-cact">' + (p.opens ? '<button type="button" class="in-btn in-primary" data-cact="open">Shrink into it</button>' : '') +
      '<button type="button" class="in-btn" data-cact="deep">Full explanation</button>' +
      '<button type="button" class="in-btn" data-cact="iso" aria-pressed="' + iso + '">' + (iso ? 'Back to the whole structure' : 'See it alone') + '</button></div>';
    cardEl.hidden = false;
  }
  cardEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cact]'); if (!b) return; const v = S.view, p = v.sel; if (!p) return;
    if (b.dataset.cact === 'close') select(null);
    else if (b.dataset.cact === 'open') open(p);
    else if (b.dataset.cact === 'iso') toggleIso(p);
    else if (b.dataset.cact === 'deep') openDeep(p);
  });
  function openDeep(p) {
    if (document.pointerLockElement) document.exitPointerLock();
    const id = S.id, M = MACHINES[machineOf(id)], L = levelsOf(id), i = L.findIndex((l) => l.id === id), made = MADE[id + '/' + p.id];
    const lis = Array.from(document.querySelectorAll('.in-src li')), srcs = (SRC_BY_LEVEL[id] || []).map((n) => (lis[n - 1] ? '<li value="' + n + '">' + lis[n - 1].innerHTML + '</li>' : '')).join('');
    const rel = RELATED[machineOf(id)];
    const child = p.opens ? [].concat(...Object.values(MACHINES).map((m) => m.levels)).find((l) => l.id === p.opens) : null;
    $('#in-deep-body').innerHTML =
      '<p class="in-crumb">' + esc(M.name) + ' &rsaquo; ' + L.slice(0, i + 1).map((l) => esc(l.label)).join(' &rsaquo; ') + ' &rsaquo; <b>' + esc(p.name) + '</b></p>' +
      '<h2 id="in-deep-h">' + esc(p.name) + '</h2>' +
      '<dl class="in-meta"><div><dt>Temperature</dt><dd>' + esc(p.t || '') + '</dd></div><div><dt>Size</dt><dd>' + esc(p.s || '') + '</dd></div></dl>' +
      '<h3>What it is, and why it is needed</h3><p>' + esc(p.d) + '</p>' +
      (p.f && p.f.length ? '<h3>How it works, and what to know</h3><ul>' + p.f.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '') +
      (made ? '<h3>Made of</h3><p>' + esc(made) + '</p>' : '') +
      (child ? '<h3>Inside it</h3><p>Opens to the <b>' + esc(child.label) + '</b> level (' + esc(child.size) + ').</p><p><button type="button" class="in-btn in-primary" data-dact="open">Shrink into it</button></p>' : '') +
      '<h3>Sources</h3><p class="in-fine">The sources this page draws on for this level. Not every sentence above comes from every source, and where a size in the drawing is exaggerated to be visible, the text says so.</p><ol class="in-dsrc">' + srcs + '</ol>' +
      '<p class="in-fine">' + (rel ? '<a href="' + rel[0] + '">' + esc(rel[1]) + '</a> &middot; ' : '') + '<a href="#in-src-card" data-dact="close">Every source, with the numbers</a>. This is a teaching model, not a drawing of any company&rsquo;s machine.</p>';
    if (!deepEl.open) deepEl.showModal();
    deepEl.dataset.part = p.id; $('#in-deep-close').focus();
  }
  deepEl.addEventListener('click', (e) => {
    if (e.target === deepEl) { deepEl.close(); return; }
    const b = e.target.closest('[data-dact]'); if (!b) return;
    const p = S.view.byId[deepEl.dataset.part];
    if (b.dataset.dact === 'open' && p) { deepEl.close(); open(p); }
    if (b.dataset.dact === 'close') deepEl.close();
  });
  $('#in-deep-close').addEventListener('click', () => deepEl.close());
  deepEl.addEventListener('close', () => { if (F.on) canvas.focus({ preventScroll: true }); });

  let raf = 0, last = performance.now(), running = false, onScreen = true;
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 52 : 38; camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(stage);
  function frame(now) {
    raf = requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (F.on) { stepFlight(dt); updateHud(); }
    else {
      stepFly(now);
      if (!ptrs.size && !cam.fly) {
        cam.az += cam.vaz; cam.el = clamp(cam.el + cam.vel, -1.3, 1.5); cam.vaz *= 0.92; cam.vel *= 0.92;
        if (!S.interacted && !reduced()) cam.az += dt * 0.09;
      }
      cam.r = clamp(cam.r, cam.rmin, cam.rmax); place();
    }
    if (S.view && !reduced()) S.view.anim.forEach((fn) => fn(now / 1000, dt));
    renderer.render(scene, camera);
  }
  function start() { if (!running && onScreen && !document.hidden) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; onScreen ? start() : stop(); }, { threshold: 0.02 }).observe(stage);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); stage.classList.add('is-lost'); });
  canvas.addEventListener('webglcontextrestored', () => { stage.classList.remove('is-lost'); start(); });

  size();
  const first = (location.hash || '').slice(1).split('/')[0]; const startId = BUILD[first] ? first : 'system';
  S.busy = false; const v0 = makeAndShow(startId); const c = v0.def.cam;
  cam.target.copy(c.target); cam.az = c.az - 0.6; cam.el = c.el; cam.r = c.r * fitK() * 1.5; place(); syncUi(); flyTo({ r: c.r * fitK(), az: c.az }, 1400);
  start();
  if (EMBED) {
    S.armed = true;
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      if (S.view.sel) select(null); else if (S.id !== 'system') up(); else window.parent.postMessage({ sq: 'inside-close' }, location.origin);
    }, true);
    requestAnimationFrame(() => requestAnimationFrame(() => window.parent.postMessage({ sq: 'inside-ready' }, location.origin)));
  }
  window.__inside = { S, cam, F, pick, goto, select, open, up, enterFly, leaveFly, openDeep, THREE, scene, camera, renderer, MACHINES, ionEquilibrium, SRC_BY_LEVEL, MADE };
  window.addEventListener('hashchange', () => { const h = (location.hash || '').slice(1); if (BUILD[h] && h !== S.id) goto(h); });
}

function fallback(stage, panel) {
  stage.classList.add('is-nogl');
  stage.querySelector('.in-nogl').hidden = false;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

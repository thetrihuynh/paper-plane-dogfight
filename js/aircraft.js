'use strict';
// Máy Bay Giấy · plane models, aircraft types, hangar designs, flight model
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Aircraft
// =====================================================================
function makePlaneGeo() {
  const N = [0, 0.02, -1.25], L = [-0.78, 0.15, 0.6], Rr = [0.78, 0.15, 0.6], LI = [-0.13, 0.02, 0.6], RI = [0.13, 0.02, 0.6], K = [0, -0.3, 0.55];
  const tris = [N, L, LI, N, RI, Rr, N, LI, K, N, K, RI];
  const pos = [], uv = [];
  tris.forEach(v => { pos.push(...v); uv.push(v[0] * 0.6 + 0.5 + v[1], v[2] * 0.5 + 0.5); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
// other real-world paper plane designs (forward = -z, right = +x, up = +y); right side is mirrored from the left
function triGeo(left, centre = []) {
  const m = v => [-v[0], v[1], v[2]], tris = [...centre];
  for (let i = 0; i < left.length; i += 3) tris.push(left[i], left[i + 1], left[i + 2], m(left[i]), m(left[i + 2]), m(left[i + 1]));
  const pos = [], uv = [];
  tris.forEach(v => { pos.push(...v); uv.push(v[0] * 0.6 + 0.5 + v[1], v[2] * 0.5 + 0.5); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
function makeRingGeo() {   // ring-wing / tube glider: a rolled band with a thicker folded leading edge
  const band = new THREE.CylinderGeometry(0.42, 0.42, 0.6, 22, 1, true).rotateX(PI / 2).translate(0, 0.1, 0.15);
  const lip = new THREE.CylinderGeometry(0.4, 0.4, 0.16, 22, 1, true).rotateX(PI / 2).translate(0, 0.1, -0.1);
  return mergeGeometries([band, lip]);
}
function makeCrumpleGeo() {   // a scrunched-up paper ball (kamikaze)
  const g = new THREE.IcosahedronGeometry(0.5, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.28 * Math.sin(x * 12.9 + y * 78.2 + z * 37.7) * Math.cos(x * 4.1 - z * 9.3);   // same point -> same bump, so no cracks
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}
// Tàu Mẹ: a giant "Bomber" paper plane. A broad flying wing with a sharp nose, leading edges swept back to a
// shoulder and then out to the tips, an almost straight trailing edge, tall winglets standing up at both tips,
// and a raised folded ridge down the middle. No guns: it fights with missiles and its escorts. About 1.6 long
// and 2.2 across at scale 1 (forward = -z).
const MOTHER_ENGINES = [[-0.6, 0.12, 0.42], [0.6, 0.12, 0.42], [0, 0.2, 0.2], [0, -0.1, 0.3]];   // where it smokes when hurt
function makeMotherGeo() {
  const N = [0, 0.05, -1.0], S = [-0.42, 0.07, -0.08], T1 = [-1.08, 0.12, 0.34], T2 = [-1.08, 0.12, 0.6], C = [-0.24, 0.05, 0.6], R = [0, 0.04, 0.6];
  const H = [0, 0.27, -0.08], B = [-0.2, 0.07, 0.12], RT = [0, 0.06, 0.42];   // the raised ridge: its top, its foot, its tail
  const TW = [-1.16, 0.56, 0.72], TF = [-1.1, 0.22, 0.24];                       // winglet tip and its leading foot
  const left = [
    N, S, C,  S, T1, T2,  S, T2, C,  N, C, R,      // the wing
    N, B, H,  H, B, RT,                           // ridge, left face
    T1, TW, T2,  T1, TF, TW,                      // winglet
  ];
  const centre = [N, R, [0, -0.2, 0.25]];         // a shallow keel fold under the middle
  return triGeo(left, centre);
}
const PLANE_GEOS = {
  dart: makePlaneGeo(),
  // Suzanne-style glider (John Collins' distance record plane): broad wings with upturned winglets
  glider: triGeo([[0, 0.02, -1.0], [-1.05, 0.16, 0.05], [-1.05, 0.16, 0.45], [0, 0.02, -1.0], [-1.05, 0.16, 0.45], [-0.1, 0.02, 0.55],
    [-1.05, 0.16, 0.12], [-1.05, 0.16, 0.45], [-1.05, 0.42, 0.45], [0, 0.02, -1.0], [-0.1, 0.02, 0.55], [0, -0.22, 0.45]]),
  // Nakamura Lock: blunt locked nose, compact swept wings, deep keel
  nakamura: triGeo([[-0.14, 0.02, -0.85], [-0.62, 0.14, 0.55], [-0.12, 0.02, 0.55], [-0.14, 0.02, -0.85], [-0.12, 0.02, 0.55], [0, 0.02, 0.55],
    [-0.14, 0.02, -0.85], [0, 0.02, 0.55], [0, 0.02, -0.85], [0, 0.02, -0.85], [0, -0.14, -0.7], [0, -0.32, 0.5]]),
  // stunt dart: classic dart with elevator flaps folded up at the trailing edge (loops on its own)
  stunt: triGeo([[0, 0.02, -1.25], [-0.78, 0.15, 0.5], [-0.13, 0.02, 0.6], [-0.78, 0.15, 0.5], [-0.4, 0.09, 0.55], [-0.78, 0.34, 0.78],
    [-0.4, 0.09, 0.55], [-0.4, 0.27, 0.8], [-0.78, 0.34, 0.78], [0, 0.02, -1.25], [-0.13, 0.02, 0.6], [0, -0.3, 0.55]]),
  // boomerang: crescent wings swept far back, curves round in a circle
  boomerang: triGeo([[0, 0.02, -0.9], [-0.35, 0.06, -0.35], [-0.12, 0.02, 0.35], [-0.35, 0.06, -0.35], [-0.75, 0.12, 0.15], [-0.12, 0.02, 0.35],
    [-0.75, 0.12, 0.15], [-0.6, 0.1, 0.55], [-0.12, 0.02, 0.35], [-0.75, 0.12, 0.15], [-0.95, 0.18, 0.8], [-0.6, 0.1, 0.55],
    [0, 0.02, -0.9], [-0.12, 0.02, 0.35], [0, -0.25, 0.3]]),
  // swallow: sharply swept wings and a forked tail, built for speed
  swallow: triGeo([[0, 0.02, -1.1], [-0.85, 0.12, 0.2], [-0.3, 0.05, 0.2], [0, 0.02, -1.1], [-0.3, 0.05, 0.2], [0, 0.02, 0.45],
    [-0.3, 0.05, 0.2], [-0.32, 0.04, 0.9], [-0.08, 0.02, 0.45], [-0.3, 0.05, 0.2], [-0.08, 0.02, 0.45], [0, 0.02, 0.45],
    [0, 0.02, -1.1], [0, 0.02, 0.45], [0, -0.22, 0.3]]),
  ring: makeRingGeo(),
  // Đại Bàng Đỏ: a B-2 style flying wing (swept leading edge, sawtooth trailing edge, cockpit hump)
  // whose wingtips fan out into eagle "finger" feathers
  eagle: (() => {
    const N = [0, 0.06, -0.9], M = [-0.45, 0.07, 0.1], T = [-1.5, 0.12, 0.33];
    const A = [-1.17, 0.1, 0.62], B = [-0.82, 0.08, 0.36], C = [-0.47, 0.07, 0.64], D = [-0.2, 0.06, 0.42], E = [0, 0.06, 0.6];
    const H = [0, 0.22, -0.25], S = [-0.32, 0.07, 0.02], R = [0, 0.1, 0.42];
    const feather = (b0, b1, tip) => [b0, tip, b1];
    return triGeo([
      N, T, M, M, T, A, M, A, B, M, B, C, M, C, D, M, D, E, M, E, N,   // wing (fan around M)
      N, S, H, H, S, R,   // cockpit hump
      ...feather([-1.32, 0.11, 0.24], [-1.5, 0.12, 0.33], [-1.92, 0.2, 0.36]),   // primaries spread like fingers
      ...feather([-1.36, 0.11, 0.38], [-1.46, 0.11, 0.5], [-1.86, 0.18, 0.6]),
      ...feather([-1.25, 0.1, 0.5], [-1.33, 0.1, 0.6], [-1.68, 0.15, 0.82]),
      ...feather([-1.1, 0.09, 0.58], [-1.17, 0.1, 0.62], [-1.36, 0.12, 0.92]),
    ]);
  })(),
  mother: makeMotherGeo(),
};
const PLANE_EDGES = {};
for (const k in PLANE_GEOS) PLANE_EDGES[k] = new THREE.EdgesGeometry(PLANE_GEOS[k], k === 'ring' ? 30 : 1);
const planeGeo = PLANE_GEOS.dart;
function makeTrail(color) {
  const N = 30, pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }));
  line.frustumCulled = false; scene.add(line);
  return { line, pos, N, init: false };
}
const _tip = new THREE.Vector3();
function updTrail(tr, obj, x, z = 0.6) {
  _tip.set(x, 0.15, z); obj.localToWorld(_tip);
  if (!tr.init) { for (let i = 0; i < tr.N; i++) tr.pos.set([_tip.x, _tip.y, _tip.z], i * 3); tr.init = true; }
  tr.pos.copyWithin(3, 0, (tr.N - 1) * 3); tr.pos[0] = _tip.x; tr.pos[1] = _tip.y; tr.pos[2] = _tip.z;
  tr.line.geometry.attributes.position.needsUpdate = true;
}

const KINDS = {
  player: { hp: 100, veq: 7.5, rates: [1.5, 2.6, 0.55], scale: 0.32, hitR: 0.42, pr: 0.12, color: 0xffffff, gunMul: 1 },
  ally:   { hp: 160, veq: 7.8, rates: [1.4, 2.5, 0.5], scale: 0.34, hitR: 0.5, gunDmg: 1.6, gunCone: 0.08, gunRange: 26, fireRate: 6, evade: 1.0 },
  dart:   { hp: 48, veq: 8, rates: [1.4, 2.5, 0.5], scale: 0.36, hitR: 0.55, color: 0xff5a4f, gunDmg: 2.0, gunCone: 0.085, gunRange: 25, fireRate: 6, points: 100, label: 'Phi Tiêu', evade: 1.0 },
  glider: { hp: 90, veq: 6.5, rates: [0.9, 1.8, 0.35], scale: 0.6, hitR: 0.85, color: 0xffa64d, gunDmg: 2.6, gunCone: 0.12, gunRange: 24, fireRate: 4, points: 150, label: 'Tàu Lượn', evade: 0.4, geo: 'glider', mslN: 1, flares: 2 },
  swallow:   { hp: 38, veq: 9.6, rates: [1.5, 2.8, 0.5], scale: 0.36, hitR: 0.5, color: 0xff3d7f, gunDmg: 1.8, gunCone: 0.09, gunRange: 22, fireRate: 7, points: 120, label: 'Chim Én', evade: 1.2, geo: 'swallow', ai: 'hitrun' },
  nakamura:  { hp: 60, veq: 7.2, rates: [1.2, 2.2, 0.45], scale: 0.42, hitR: 0.6, color: 0xb03a2e, gunDmg: 3.4, gunCone: 0.05, gunRange: 34, fireRate: 3.5, points: 150, label: 'Khoá Nakamura', evade: 0.7, geo: 'nakamura', ai: 'sniper', mslN: 1, flares: 1 },
  stunt:     { hp: 45, veq: 8, rates: [2.3, 3.8, 0.7], scale: 0.38, hitR: 0.55, color: 0xffd23f, gunDmg: 2.0, gunCone: 0.09, gunRange: 24, fireRate: 6, points: 140, label: 'Diều Nhào Lộn', evade: 2.4, geo: 'stunt', ai: 'stunt' },
  boomerang: { hp: 50, veq: 8.5, rates: [1.5, 2.8, 0.6], scale: 0.42, hitR: 0.6, color: 0xff7a2f, gunDmg: 2.2, gunCone: 0.1, gunRange: 22, fireRate: 7, points: 130, label: 'Bumerang', evade: 1.0, geo: 'boomerang', ai: 'boomerang', mslN: 1 },
  ring:      { hp: 150, veq: 5.6, rates: [0.8, 1.6, 0.3], scale: 0.55, hitR: 0.75, color: 0x9b59b6, gunDmg: 3.0, gunCone: 0.13, gunRange: 26, fireRate: 3, points: 200, label: 'Vòng Ống', evade: 0.2, geo: 'ring', mslN: 2, flares: 3, ai: 'bomber', bombs: 3 },
  tape:      { hp: 80, veq: 6.8, rates: [1.0, 2.0, 0.4], scale: 0.5, hitR: 0.7, color: 0x5fd35f, gunDmg: 1.2, gunCone: 0.1, gunRange: 18, fireRate: 3, points: 180, label: 'Băng Keo', evade: 0.8, geo: 'glider', ai: 'support' },
  crumple:   { hp: 20, veq: 10, rates: [1.8, 2.5, 0.8], scale: 0.42, hitR: 0.55, color: 0xe8e2d0, gunDmg: 0, gunCone: 0, gunRange: 0, fireRate: 1, points: 80, label: 'Giấy Vo', evade: 0.3, geo: 'crumple', ai: 'ram' },
  mother:    { hp: 900, veq: 4.5, rates: [0.4, 0.6, 0.2], scale: 5.5, hitR: 3.2, color: 0xc8473d, edge: 0x5a0f0f, gunDmg: 2.4, gunCone: 0.16, gunRange: 26, fireRate: 4, points: 1500, label: 'Tàu Mẹ', evade: 0, geo: 'mother', ai: 'carrier', mslN: 4, flares: 6, rigid: true, tough: true, turrets: true, mslDmg: 22 },
  // the flagship Tàu Mẹ of Chương 4: huge, slow, armed to the teeth, flying dead straight for our library
  dread:     { hp: 1100, veq: 4, rates: [0, 0, 0], scale: 12, hitR: 6.5, color: 0xc8473d, edge: 0x5a0f0f, gunDmg: 0, gunCone: 0, gunRange: 0, fireRate: 1, points: 3000, label: 'Tàu Mẹ', evade: 0, geo: 'mother', ai: 'dread', mslN: 999, flares: 8, rigid: true, tough: true, turrets: true, mslDmg: 18, mslSpeed: 22, mslTurn: 1.9 },
  elite:     { hp: 230, veq: 10.5, rates: [2.0, 3.6, 0.8], scale: 0.4, hitR: 0.5, color: 0x1e1e24, gunDmg: 3.2, gunCone: 0.1, gunRange: 32, fireRate: 9, points: 800, label: 'Song Ưng', evade: 2.2, geo: 'swallow', ai: 'elite', mslN: 4, flares: 6 },
  heron:     { hp: 480, veq: 7, rates: [0.7, 1.2, 0.3], scale: 2.0, hitR: 2.4, color: 0x3d6fd8, gunDmg: 0, gunCone: 0, gunRange: 0, fireRate: 1, label: 'Hạc Lớn', geo: 'glider', ai: 'route', flares: 6 },
  ace:    { hp: 460, veq: 11, rates: [2.1, 3.6, 0.85], scale: 0.36, hitR: 0.65, color: 0xc8102e, geo: 'eagle', gunDmg: 3.4, gunCone: 0.09, gunRange: 34, fireRate: 10, points: 2000, label: 'Đại Bàng Đỏ', evade: 2.4, mslN: 6, flares: 8, ai: 'boss' },
};
// player's folding designs (hangar): each tweaks the base player plane
const PLAYER_DESIGNS = {
  dart:      { label: 'Phi Tiêu', desc: 'Phi Tiêu cổ điển: cân bằng mọi mặt, dễ làm quen.', hp: 100, veq: 7.5, rm: [1, 1, 1], gunMul: 1 },
  glider:    { label: 'Suzanne', desc: 'Tàu lượn Suzanne (kỷ lục bay xa): cánh rộng, bền, lượn mượt nhưng hơi chậm và lăn cánh chậm.', hp: 125, veq: 6.9, rm: [1.05, 0.85, 1], gunMul: 1, hitR: 0.5 },
  nakamura:  { label: 'Nakamura', desc: 'Khoá Nakamura mũi tù: bay rất ổn định, súng chính xác, sát thương súng +30%.', hp: 105, veq: 7.3, rm: [1, 0.95, 1], gunMul: 1.3 },
  stunt:     { label: 'Nhào Lộn', desc: 'Diều Nhào Lộn có cánh lái bẻ ngược: lộn vòng cực gắt, nhưng giấy mỏng.', hp: 85, veq: 7.6, rm: [1.35, 1.3, 1.2], gunMul: 1 },
  swallow:   { label: 'Chim Én', desc: 'Chim Én đuôi chẻ: nhanh nhất, lăn cánh nhanh, nhưng chịu đòn kém.', hp: 80, veq: 8.8, rm: [1.05, 1.2, 1], gunMul: 1 },
  boomerang: { label: 'Bumerang', desc: 'Bumerang cánh lưỡi liềm: quẹo đuôi rất gắt, cân bằng.', hp: 95, veq: 7.8, rm: [1.2, 1.05, 1.4], gunMul: 1 },
  ring:      { label: 'Vòng Ống', desc: 'Vòng Ống: trâu nhất, súng nặng hơn 15%, nhưng chậm và khó lượn.', hp: 160, veq: 6.4, rm: [0.85, 0.8, 0.9], gunMul: 1.15, hitR: 0.55 },
};
const custom = Object.assign({ design: 'dart', color: 0xffffff, edge: 0x7d8da0 }, JSON.parse(localStorage.getItem('pp_custom') || '{}'));
if (!PLAYER_DESIGNS[custom.design]) custom.design = 'dart';
function playerKind() {
  const d = PLAYER_DESIGNS[custom.design], b = KINDS.player;
  KINDS.playerCustom = { ...b, hp: d.hp, veq: d.veq, rates: b.rates.map((r, i) => r * d.rm[i]), gunMul: d.gunMul, hitR: d.hitR || b.hitR, geo: custom.design };
  return 'playerCustom';
}
const flyers = [];
// high-speed wing flutter: the paper wings bend & buzz in the vertex shader (body stays rigid)
// wing flutter: each paper wing bends under load and buzzes in the vertex shader (body stays rigid)
// uFl / uBend: x = left wing (-x), y = right wing (+x)
function addFlutter(mat) {
  const u = mat.userData.fl = { uFl: { value: new THREE.Vector2() }, uBend: { value: new THREE.Vector2() }, uT: { value: 0 }, uSweep: { value: 0 }, uFold: { value: new THREE.Vector2() },
    uTear: { value: new THREE.Vector2() }, uSeed: { value: 0 } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform vec2 uFl; uniform vec2 uBend; uniform float uT; uniform float uSweep; uniform vec2 uFold; uniform vec2 uTear;\nvarying vec3 vTearP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vTearP = position;
      float wx = smoothstep(0.08, 0.95, abs(position.x));
      float side = position.x < 0.0 ? 0.0 : 1.0;
      float fl = mix(uFl.x, uFl.y, side), bend = mix(uBend.x, uBend.y, side);
      float tr = mix(uTear.x, uTear.y, side);   // torn wing: limp, flaps in the airflow and droops a little
      fl += tr * 0.9; bend -= tr * 0.35;
      float ph = uT + side * 0.37;
      float buzz = sin(ph * 52.0 + position.z * 6.0) * 0.55 + sin(ph * 33.0 + position.x * 11.0) * 0.3 + sin(ph * 87.0) * 0.15;
      transformed.y += buzz * fl * 0.024 * wx + bend * 0.08 * wx * wx;     // flap (toned down to 10%) + load bend: slight in gentle turns, deep in hard U-turns
      transformed.z += sin(ph * 44.0 + position.x * 8.0) * fl * 0.006 * wx; // trailing edge twist (10%)
      transformed.x *= 1.0 - bend * 0.05 * wx;
      // supersonic: wings fold in & sweep back (variable geometry)
      float sw = uSweep * smoothstep(0.08, 0.5, abs(position.x));
      transformed.x *= 1.0 - 0.45 * sw;
      transformed.z += sw * abs(position.x) * 0.55;
      transformed.y -= sw * 0.04;
      // bird-like turning: the inside wing folds in (shorter, swept back), the outside wing stretches out
      float fd = mix(uFold.x, uFold.y, side) * smoothstep(0.08, 0.55, abs(position.x));
      transformed.x *= 1.0 - 0.24 * fd;
      transformed.z += max(fd, 0.0) * abs(position.x) * 0.3;
      transformed.y += max(fd, 0.0) * 0.05 * abs(position.x);`);
    // torn paper: ragged rips eaten in from the trailing edge & wingtip, plus round bullet holes,
    // each with a darker crumpled rim. uTear = how torn each wing is (0..~0.85)
    sh.fragmentShader = `uniform vec2 uTear; uniform float uSeed; varying vec3 vTearP;
      float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float tNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(tHash(i), tHash(i + vec2(1, 0)), f.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), f.x), f.y); }
      ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float side = vTearP.x < 0.0 ? 0.0 : 1.0;
        float d = mix(uTear.x, uTear.y, side);
        float wing = smoothstep(0.12, 0.55, abs(vTearP.x));
        if (d > 0.01 && wing > 0.0) {
          vec2 q = vTearP.xz + vec2(uSeed + side * 7.3, uSeed * 0.7);
          float n = tNoise(q * vec2(5.0, 7.0)) * 0.6 + tNoise(q * 17.0) * 0.28 + tNoise(q * 43.0) * 0.12;
          float reach = d * wing * (0.5 + 0.8 * smoothstep(0.0, 0.6, vTearP.z) + 0.6 * smoothstep(0.4, 0.85, abs(vTearP.x)));
          float cut = reach * 0.72 - 0.1;
          if (n < cut) discard;
          float rim = 1.0 - smoothstep(cut, cut + 0.09, n);
          vec2 cell = floor(q * 6.0), fc = fract(q * 6.0) - 0.5 - (vec2(tHash(cell + 3.1), tHash(cell + 8.7)) - 0.5) * 0.4;
          float hole = step(tHash(cell), d * wing * 0.55), r = length(fc * vec2(1.0, 1.3));
          if (hole > 0.5 && r < 0.2) discard;
          rim = max(rim, hole * (1.0 - smoothstep(0.2, 0.36, r)));
          diffuseColor.rgb *= 1.0 - rim * 0.6;
        }
      }`);
  };
  return mat;
}
function makeFlyer(kind, team, name, color, edgeColor) {
  const K = KINDS[kind];
  const c = color ?? K.color;
  const g = new THREE.Group();
  const geo = K.geo || 'dart';
  const mesh = new THREE.Mesh(PLANE_GEOS[geo], addFlutter(new THREE.MeshLambertMaterial({ color: c, map: paperTex, side: THREE.DoubleSide })));
  mesh.castShadow = true; g.add(mesh);
  const edges = new THREE.LineSegments(PLANE_EDGES[geo], addFlutter(new THREE.LineBasicMaterial({ color: edgeColor ?? K.edge ?? (kind === 'ace' ? 0x000000 : 0x7d8da0), transparent: true, opacity: edgeColor != null || K.edge ? 0.95 : 0.7 })));
  g.add(edges);
  if (kind === 'ace') {   // dark chevrons along the wing, following the leading-edge sweep
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.07), new THREE.MeshBasicMaterial({ color: 0x1a0505, side: THREE.DoubleSide }));
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const m = st.clone(); m.rotation.set(-PI / 2, 0, sx * 0.62); m.position.set(sx * (0.38 + k * 0.28), 0.1 + k * 0.012, -0.32 + k * 0.2); g.add(m); }
  }
  g.scale.setScalar(K.scale);
  scene.add(g);
  const f = {
    kind, K, team, name, colorHex: c, css: '#' + new THREE.Color(c).getHexString(),
    obj: g, pos: g.position, q: g.quaternion, vel: new THREE.Vector3(), speed: K.veq, throttle: 0.6,
    hp: K.hp, maxHp: K.hp, alive: true, falling: false, spin: new THREE.Vector3(),
    trails: [makeTrail(c), makeTrail(c)], gunT: 0, gunSide: 1, mslT: rr(4, 7), mslLeft: K.mslN || 0, lockT: 0, bombs: K.bombs || 0, bombCD: 0, spawnT: 6, sweep: 0, flares: K.flares || 0,
    target: null, mode: 'attack', modeT: 0, thinkT: 0, evadeDir: new THREE.Vector3(), wander: rr(0, 10),
    flU: [mesh.material.userData.fl, edges.material.userData.fl], flutter: 0,
    lastHitBy: null, lastHitT: -99, smokeT: 0, curl: Math.random() < 0.5 ? -1 : 1,
    tearBias: 0, tearSeed: rr(0, 50), tearL: 0, tearR: 0, joltR: 0, joltP: 0,
  };
  flyers.push(f);
  return f;
}
function removeFlyer(f) {
  scene.remove(f.obj); f.trails.forEach(t => scene.remove(t.line));
  const i = flyers.indexOf(f); if (i >= 0) flyers.splice(i, 1);
}
const fwdOf = (f, out) => out.set(0, 0, -1).applyQuaternion(f.q);
const upOf = (f, out) => out.set(0, 1, 0).applyQuaternion(f.q);
const rightOf = (f, out) => out.set(1, 0, 0).applyQuaternion(f.q);

// ---- Flight model ----
const _ui = new THREE.Vector3(), _qd = new THREE.Quaternion(), _eu = new THREE.Euler(), _ax = new THREE.Vector3(), _fw = new THREE.Vector3(), _lt = new THREE.Vector3(), _rt = new THREE.Vector3(), _qi = new THREE.Quaternion();
const STALL = 3.2;
const SONIC_SPEED = 17, SONIC_MAX = 27;   // 'speed of sound' for paper planes :)
function flyPhysics(f, ctl, dt) {
  const K = f.K;
  const auth = clamp((f.speed - 1.5) / 5, 0.25, 1) * (f.ctlAuth ?? 1) * (f.sonic ? 0.55 : 1);   // supersonic: much wider turns
  // stick inputs ease in/out so the plane responds smoothly instead of snapping
  const sm = f.sm || (f.sm = { pitch: 0, roll: 0, yaw: 0 }), k = 1 - Math.exp(-dt * 6);
  // torn wings (player): sluggish stick, the more-torn wing drops (constant roll pull), buffeting, extra drag
  const wd = f.isPlayer && !f.sonic ? clamp((1 - f.hp / f.maxHp - 0.15) / 0.85, 0, 1) : 0;
  let inP = ctl.pitch, inR = ctl.roll;
  if (wd > 0 || f.joltR || f.joltP) {
    const sp = clamp(f.speed / 8, 0.4, 1.4), t = clock + f.tearSeed;
    inR += ((f.tearR - f.tearL) * 0.35 + (Math.sin(t * 3.1) * 0.6 + Math.sin(t * 7.9) * 0.4) * 0.16 * wd * sp) + f.joltR;
    inP += (Math.sin(t * 4.3 + 1) * 0.6 + Math.sin(t * 11.3) * 0.4) * 0.1 * wd * sp + f.joltP;
    const jk = Math.exp(-dt * 4); f.joltR *= jk; f.joltP *= jk;
    if (Math.abs(f.joltR) + Math.abs(f.joltP) < 0.01) f.joltR = f.joltP = 0;
  }
  const rk = 1 - 0.3 * wd;
  sm.pitch += (inP - sm.pitch) * k; sm.roll += (inR - sm.roll) * k; sm.yaw += (ctl.yaw - sm.yaw) * k;
  _eu.set(sm.pitch * K.rates[0] * rk * auth * dt, -sm.yaw * K.rates[2] * rk * auth * dt, -sm.roll * K.rates[1] * rk * Math.max(auth, 0.5) * dt, 'XYZ');
  _qd.setFromEuler(_eu); f.q.multiply(_qd);
  const fwd = fwdOf(f, _fw);
  if (f.speed < STALL) {                 // stall: the nose falls
    _ax.crossVectors(fwd, DOWN); const l = _ax.length();
    if (l > 1e-3) { _qd.setFromAxisAngle(_ax.divideScalar(l), (STALL - f.speed) / STALL * 1.8 * dt); f.q.premultiply(_qd); }
  }
  f.q.normalize();
  fwdOf(f, fwd);
  f.throttle = lerp(f.throttle, ctl.throttle, Math.min(1, dt * 1.2));
  const thrust = K.veq * 0.45 / 0.6 * (f.sonic ? 2.6 : 1);
  const loopK = f.looping ? 0.35 : 1;   // arcade loop: gravity & pull drag eased so the plane carries over the top
  f.speed += (f.throttle * thrust - (0.45 + 0.06 * wd) * f.speed - 4 * fwd.y * loopK) * dt - Math.abs(sm.pitch) * auth * f.speed * 0.14 * loopK * dt;
  f.speed = clamp(f.speed, 1.5, f.sonic ? SONIC_MAX : Math.max(17, f.speed - 8 * dt));   // bleed off after supersonic
  f.vel.copy(fwd).multiplyScalar(f.speed);
  if (f.speed < STALL) f.vel.y -= (STALL - f.speed) * 0.8;
  return fwd;
}
// Mouse-aim "instructor": converts a desired world direction into stick inputs (War Thunder style)
function instructor(f, dir, out) {
  _qi.copy(f.q).invert();
  _lt.copy(dir).applyQuaternion(_qi);
  const ang = _lt.angleTo(FWD);
  const bankNow = Math.atan2(rightOf(f, _rt).y, upOf(f, _ui).y);   // + = right wing up (±PI when inverted)
  if (ang < 0.45) {
    out.pitch = clamp(_lt.y * 3, -1, 1);
    // bank-to-angle: lean towards the target up to ~57° and hold it; target dead ahead -> wings snap level
    const want = clamp(_lt.x * 2.4, -1, 1);
    out.roll = clamp((bankNow + want) * 3.5, -1, 1);
    out.yaw = clamp(_lt.x * 2, -1, 1);
  } else {
    const rollErr = Math.atan2(_lt.x, _lt.y);
    out.roll = clamp(rollErr * 1.3, -1, 1);
    out.pitch = clamp(Math.cos(rollErr) * 1.4, -0.15, 1);
    out.yaw = clamp(_lt.x, -1, 1) * 0.3;
  }
  return out;
}

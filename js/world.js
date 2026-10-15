'use strict';
// Máy Bay Giấy · world building helpers, the school (both factions' wings and the shared yard), trees, collision grid
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  World building helpers
// =====================================================================
function gableRoof(x0, x1, z0, z1, y, rh, alongZ) {
  const o = 1.2, W = alongZ ? Math.abs(x1 - x0) : Math.abs(z1 - z0), L = alongZ ? Math.abs(z1 - z0) : Math.abs(x1 - x0);
  const sh = new THREE.Shape(); sh.moveTo(-W / 2 - o, -0.3); sh.lineTo(W / 2 + o, -0.3); sh.lineTo(0, rh); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: L + 2 * o, bevelEnabled: false });
  geo.translate(0, 0, -(L + 2 * o) / 2);
  put(geo, MAT.roof, (x0 + x1) / 2, y, (z0 + z1) / 2, { ry: alongZ ? 0 : PI / 2 });
  // roofs are solid too (approximate the gable with two stacked boxes)
  if (alongZ) { addBox(x0 + W * 0.15, y, z0, x1 - W * 0.15, y + rh * 0.6, z1); }
  else { addBox(x0, y, z0 + W * 0.15, x1, y + rh * 0.6, z1 - W * 0.15); }
}
function building(x0, x1, z0, z1, h, roofAlongZ, collide = true) {
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  put(new THREE.BoxGeometry(w, h, d), bldgMats(w, d, h), (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  if (collide) addBox(x0, 0, z0, x1, h, z1);
  radarRects.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  if (roofAlongZ !== null) gableRoof(x0, x1, z0, z1, h, 4.5, roofAlongZ);
}
function plaque(text, x, y, z, ry, w = 6, h = 1.4, bg = '#c8102e', fg = '#ffd93b') {
  const tex = signTex([text], { w: 512, h: Math.round(512 * h / w), bg, fg, size: 90 });
  return put(new THREE.PlaneGeometry(w, h), signMat(tex), x, y, z, { ry, cast: false });
}
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function studentGeo(kind) {
  const P = [];
  const skin = 0xf1c7a0, hair = 0x1a1410;
  if (kind === 'boy') {
    P.push(part(BOX(0.16, 0.8, 0.18), 0x1f2a4d, -0.1, 0.4, 0), part(BOX(0.16, 0.8, 0.18), 0x1f2a4d, 0.1, 0.4, 0));
    P.push(part(BOX(0.46, 0.62, 0.26), 0xf7f7f2, 0, 1.1, 0));
    P.push(part(BOX(0.12, 0.56, 0.13), 0xf7f7f2, -0.3, 1.1, 0), part(BOX(0.12, 0.56, 0.13), 0xf7f7f2, 0.3, 1.1, 0));
    P.push(part(new THREE.ConeGeometry(0.11, 0.26, 3), 0xd61f26, 0, 1.24, -0.14, PI, 0, 0));
    P.push(part(new THREE.SphereGeometry(0.185, 10, 8, 0, PI * 2, 0, PI * 0.55), hair, 0, 1.56, 0.01));
  } else {
    const c = kind === 'teacher' ? 0x6b4fbf : kind === 'vendor' ? 0x8a6a4a : 0xfafafa;
    const pants = kind === 'vendor' ? 0x2a2a2a : 0xf0f0f0;
    P.push(part(new THREE.CylinderGeometry(0.2, 0.22, 0.8, 10), pants, 0, 0.4, 0));
    P.push(part(new THREE.CylinderGeometry(0.19, 0.31, 0.98, 10), c, 0, 0.9, 0));
    P.push(part(BOX(0.11, 0.55, 0.12), c, -0.27, 1.12, 0), part(BOX(0.11, 0.55, 0.12), c, 0.27, 1.12, 0));
    P.push(part(BOX(0.3, 0.55, 0.08), hair, 0, 1.36, 0.15));
    P.push(part(new THREE.SphereGeometry(0.185, 10, 8, 0, PI * 2, 0, PI * 0.55), hair, 0, 1.56, 0.01));
    if (kind === 'vendor') P.push(part(new THREE.ConeGeometry(0.5, 0.34, 18), 0xe6d39a, 0, 1.84, 0));
  }
  P.push(part(new THREE.SphereGeometry(0.17, 12, 10), skin, 0, 1.55, 0));
  return mergeGeometries(P);
}
const GEO = {
  boy: studentGeo('boy'), girl: studentGeo('girl'), teacher: studentGeo('teacher'), vendor: studentGeo('vendor'),
  bike: mergeGeometries([
    part(new THREE.TorusGeometry(0.33, 0.035, 6, 18), 0x222222, 0, 0.36, 0.52, 0, PI / 2, 0),
    part(new THREE.TorusGeometry(0.33, 0.035, 6, 18), 0x222222, 0, 0.36, -0.52, 0, PI / 2, 0),
    part(BOX(0.05, 0.05, 0.95), 0x2f7fd0, 0, 0.62, 0),
    part(BOX(0.05, 0.55, 0.05), 0x2f7fd0, 0, 0.6, 0.32),
    part(BOX(0.05, 0.65, 0.05), 0x2f7fd0, 0, 0.66, -0.48),
    part(BOX(0.2, 0.06, 0.28), 0x222222, 0, 0.92, 0.32),
    part(BOX(0.55, 0.04, 0.04), 0x999999, 0, 1.0, -0.48),
    part(BOX(0.32, 0.22, 0.24), 0xcfd6dc, 0, 0.88, -0.68),
  ]),
  scooter: mergeGeometries([
    part(new THREE.TorusGeometry(0.27, 0.08, 6, 16), 0x1a1a1a, 0, 0.3, 0.6, 0, PI / 2, 0),
    part(new THREE.TorusGeometry(0.27, 0.08, 6, 16), 0x1a1a1a, 0, 0.3, -0.6, 0, PI / 2, 0),
    part(BOX(0.4, 0.4, 1.0), 0xb22222, 0, 0.62, 0.1),
    part(BOX(0.36, 0.14, 0.7), 0x222222, 0, 0.88, 0.2),
    part(BOX(0.12, 0.7, 0.12), 0x777777, 0, 0.85, -0.55),
    part(BOX(0.7, 0.06, 0.06), 0x333333, 0, 1.2, -0.55),
  ]),
  bench: mergeGeometries([
    part(BOX(1.8, 0.12, 0.5), 0xa9a6a0, 0, 0.48, 0),
    part(BOX(0.14, 0.45, 0.42), 0x8f8c86, -0.7, 0.225, 0), part(BOX(0.14, 0.45, 0.42), 0x8f8c86, 0.7, 0.225, 0),
  ]),
  missile: mergeGeometries([
    part(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), 0xf7f7f2, 0, 0, 0, PI / 2, 0, 0),
    part(new THREE.ConeGeometry(0.1, 0.3, 8), 0xd62828, 0, 0, -0.65, -PI / 2, 0, 0),
    part(BOX(0.45, 0.02, 0.18), 0x2f6fb5, 0, 0, 0.4),
    part(BOX(0.02, 0.45, 0.18), 0x2f6fb5, 0, 0, 0.4),
  ]),
};

const staticStudents = { boy: [], girl: [], teacher: [], vendor: [] };
// The schoolyard is empty during the dogfight (no people). Placement calls are kept so the seeded
// random layout of everything else stays exactly the same.
function student(x, z, ry = 0, kind) {
  kind = kind || (rnd() < 0.45 ? 'girl' : 'boy');
}
const bikes = [], benches = [], scooters = [];
function bench(x, z, ry = 0) {
  benches.push({ x, z, ry });
  addBox(x - 0.9, 0.42, z - 0.25, x + 0.9, 0.54, z + 0.25);
  addBox(x - 0.77, 0, z - 0.21, x - 0.63, 0.45, z + 0.21);
  addBox(x + 0.63, 0, z - 0.21, x + 0.77, 0.45, z + 0.21);
  gap('LƯỚT DƯỚI GHẾ ĐÁ!', 'ghế đá', new THREE.Vector3(x, 0.3, z), 2,
    p => Math.abs(p.x - x) < 0.62 && p.y < 0.42 && Math.abs(p.z - z) < 0.25, new THREE.Vector3(x, 0.48, z), 80);
}

// ---- Trees ----
const flowerList = [], petalList = [], leafBits = [], rootBits = [];   // leafBits/rootBits: extra detail, drawn instanced
const leafMats = [lam(0x6fae3b, { flatShading: true }), lam(0x5e9e33, { flatShading: true }), lam(0x7cbb45, { flatShading: true })];
const bangMat = lam(0x3f7f2c, { flatShading: true });
const icoGeo = new THREE.IcosahedronGeometry(1, 1);
const planterGeo = new THREE.CylinderGeometry(1, 1.06, 0.55, 20);
function planter(x, z, r) {
  put(planterGeo, MAT.brick, x, 0.275, z, { cast: false }).scale.set(r, 1, r);
  put(new THREE.CircleGeometry(r * 0.92, 18), lam(0x5a4632), x, 0.56, z, { rx: -PI / 2, cast: false });
  addBox(x - r, 0, z - r, x + r, 0.56, z + r);
}
function trunk(x, z, s, h) {
  put(new THREE.CylinderGeometry(0.32 * s, 0.5 * s, h, 9), MAT.trunk, x, h / 2, z);
  put(new THREE.CylinderGeometry(0.52 * s, 0.53 * s, 1.3, 9), MAT.lime, x, 0.95, z);
  addBox(x - 0.5 * s, 0, z - 0.5 * s, x + 0.5 * s, h, z + 0.5 * s);
}
function phuong(x, z, s = 1) {
  treeDots.push([x, z, 5.5 * s, '#ff5a3c']);
  planter(x, z, 1.7 * s);
  trunk(x, z, s, 5.6 * s);
  const n = 6; let cb = 99;
  for (let i = 0; i < n; i++) {
    const a = i / (n - 1) * PI * 2 + R(-0.3, 0.3), dist = i === 0 ? 0 : R(2.2, 3.3) * s;
    const bx = x + Math.cos(a) * dist, bz = z + Math.sin(a) * dist, by = (5.8 + R(0, 1.5)) * s, br = R(2.6, 3.4) * s;
    if (i) {
      const len = Math.hypot(dist, by - 4.5 * s);
      const br2 = put(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, len, 6), MAT.trunk, (x + bx) / 2, (4.5 * s + by) / 2, (z + bz) / 2);
      br2.lookAt(bx, by, bz); br2.rotateX(PI / 2);
    }
    const m = put(icoGeo, leafMats[i % 3], bx, by, bz); m.scale.set(br, br * 0.55, br); m.rotation.y = R(0, 3);
    ells.push({ t: 1, c: new THREE.Vector3(bx, by, bz), r: br * 0.95, sy: 0.55 });
    for (let k = 0; k < 5; k++) {   // lumpy outline: smaller clumps around each cluster
      const th = R(0, PI * 2), rr2 = br * R(0.75, 1.0), sz = br * R(0.32, 0.48);
      leafBits.push({ x: bx + Math.cos(th) * rr2, y: by + R(-0.05, 0.35) * br * 0.55, z: bz + Math.sin(th) * rr2, sv: new THREE.Vector3(sz, sz * 0.7, sz), ry: R(0, 3), color: [0x6fae3b, 0x5e9e33, 0x86c24c][k % 3] });
    }
    cb = Math.min(cb, by - br * 0.53);
    for (let k = 0; k < 18; k++) {
      const th = R(0, PI * 2), ph = R(0, PI * 0.55);
      flowerList.push({ x: bx + Math.cos(th) * Math.sin(ph) * br, y: by + Math.cos(ph) * br * 0.55, z: bz + Math.sin(th) * Math.sin(ph) * br,
        rx: R(0, 3), ry: R(0, 3), s: R(0.7, 1.3), color: rnd() < 0.7 ? 0xff3b1f : 0xe8261a });
    }
  }
  gap('XUYÊN DƯỚI TÁN PHƯỢNG!', 'thân cây phượng', new THREE.Vector3(x, 2, z), 4 * s,
    p => { const d = Math.hypot(p.x - x, p.z - z); return d > 0.9 * s && d < 3 * s && p.y > 0.9 && p.y < cb - 0.3; }, new THREE.Vector3(x, 2.5 * s, z));
  for (let k = 0; k < 26; k++) { const a = R(0, PI * 2), d = R(2, 6.5) * s; petalList.push({ x: x + Math.cos(a) * d, y: 0.03, z: z + Math.sin(a) * d, rx: -PI / 2, rz: R(0, 3) }); }
}
function bang(x, z, s = 1) {
  treeDots.push([x, z, 4.4 * s, '#3f9f3c']);
  planter(x, z, 1.6 * s);
  trunk(x, z, s, 7.6 * s);
  for (let k = 0; k < 4; k++) {
    const y = (3.6 + k * 1.35) * s, r = (4.4 - k * 0.95) * s;
    const m = put(new THREE.CylinderGeometry(r * 0.85, r, 0.75 * s, 9), bangMat, x + R(-0.3, 0.3), y, z + R(-0.3, 0.3)); m.rotation.y = R(0, 3);
    for (let j = 0; j < 8; j++) {   // leaf rosettes along the rim of each tier
      const th = j / 8 * PI * 2 + R(-0.2, 0.2), sz = R(0.45, 0.65) * s;
      leafBits.push({ x: x + Math.cos(th) * r * 0.92, y: y + R(-0.05, 0.12) * s, z: z + Math.sin(th) * r * 0.92, sv: new THREE.Vector3(sz, sz * 0.45, sz), ry: th, color: [0x3f7f2c, 0x4a8f33, 0x8a3b22][j % 7 === 6 ? 2 : j % 2] });
    }
    ells.push({ t: 1, c: new THREE.Vector3(x, y, z), r, sy: (0.4 * s) / r });
  }
  const ys = [0, 1, 2, 3].map(k => (3.6 + k * 1.35) * s);
  gap('LUỒN QUA TẦNG LÁ BÀNG!', 'tán bàng', new THREE.Vector3(x, ys[1], z), 5 * s, p => {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < 0.7 * s) return false;
    for (let k = 0; k < 3; k++) if (p.y > ys[k] + 0.42 * s && p.y < ys[k + 1] - 0.42 * s && d < (4.4 - (k + 1) * 0.95) * s) return true;
    return false;
  }, new THREE.Vector3(x, ys[1], z), 100);
}

// Cây đa cổ thụ: two trunks arch apart (fly between them) and the crown has a tunnel through it.
// Both openings are "gaps": chasing missiles/planes tend to smack into the wood or leaves.
function banyan(x, z, s = 1, ry = 0) {
  const c = Math.cos(ry), sn = Math.sin(ry);
  const W = (lx, y, lz) => new THREE.Vector3(x + lx * c + lz * sn, y, z - lx * sn + lz * c);   // local -> world
  const L = p => { const dx = p.x - x, dz = p.z - z; return [dx * c - dz * sn, dx * sn + dz * c]; };   // world -> local [lx, lz]
  treeDots.push([x, z, 7 * s, '#2f7f3a']);
  // root plate + buttress roots
  put(new THREE.CylinderGeometry(2.6 * s, 3.4 * s, 0.5 * s, 14), MAT.trunk, x, 0.25 * s, z, { cast: false });
  addBox(x - 3.2 * s, 0, z - 3.2 * s, x + 3.2 * s, 0.45 * s, z + 3.2 * s);
  for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2 + R(-0.2, 0.2); rootBits.push({ x: x + Math.cos(a) * 2.6 * s, y: 0.35 * s, z: z + Math.sin(a) * 2.6 * s, sv: new THREE.Vector3(1.6 * s, 0.5 * s, 0.35 * s), ry: -a, color: 0x5d3f2a }); }
  // twin trunks leaning into each other
  const top = 7.5 * s;
  for (const side of [-1, 1]) {
    const a = W(side * 2.8 * s, 0, 0), b = W(side * 0.7 * s, top, 0), len = a.distanceTo(b);
    const t = put(new THREE.CylinderGeometry(0.55 * s, 0.8 * s, len, 10), MAT.trunk, (a.x + b.x) / 2, top / 2, (a.z + b.z) / 2);
    t.lookAt(b); t.rotateX(PI / 2);
    for (let k = 0; k < 7; k++) {   // collision: a stack of small boxes following the lean
      const p = a.clone().lerp(b, (k + 0.5) / 7), h = 0.7 * s;
      addBox(p.x - h, p.y - top / 14, p.z - h, p.x + h, p.y + top / 14, p.z + h);
    }
    for (let k = 0; k < 3; k++) { const p = a.clone().lerp(b, 0.2 + k * 0.25); rootBits.push({ x: p.x + R(-0.2, 0.2), y: p.y, z: p.z + R(-0.2, 0.2), sv: new THREE.Vector3(0.3 * s, 0.9 * s, 0.3 * s), rz: R(-0.4, 0.4), color: 0x7a5a40 }); }
  }
  put(new THREE.CylinderGeometry(0.7 * s, 0.95 * s, 2.2 * s, 10), MAT.trunk, x, top + 0.9 * s, z);
  addBox(x - 0.9 * s, top - 0.2, z - 0.9 * s, x + 0.9 * s, top + 2 * s, z + 0.9 * s);
  // crown: leaf clusters on both sides and above a tunnel that runs along the local z axis at y = tunY
  const tunY = 10.6 * s, clusters = [];
  for (const side of [-1, 1]) for (const lz of [-3.2, 0, 3.2]) clusters.push([side * 3.7, tunY + R(-0.2, 0.3) * s, lz, 2.1, 0.72]);
  for (const side of [-1, 1]) for (const lz of [-1.6, 1.6]) clusters.push([side * 6.3, tunY - 0.6 * s, lz, 2.2, 0.6]);
  clusters.push([0, 13.6 * s, -2.6, 2.7, 0.5], [0, 13.8 * s, 2.6, 2.7, 0.5], [-2.3, 13.9 * s, 0, 2.5, 0.5], [2.3, 13.9 * s, 0, 2.5, 0.5]);
  clusters.forEach(([lx, y, lz, r, sy], i) => {
    const p = W(lx * s, y, lz * s), rr0 = r * s;
    const m = put(icoGeo, leafMats[i % 3], p.x, p.y, p.z); m.scale.set(rr0, rr0 * sy, rr0); m.rotation.y = R(0, 3);
    ells.push({ t: 1, c: p.clone(), r: rr0 * 0.95, sy });
    // limb from the trunk top to the cluster
    const from = W(0, top + 1.5 * s, 0), len = from.distanceTo(p);
    const br = put(new THREE.CylinderGeometry(0.12 * s, 0.3 * s, len, 6), MAT.trunk, (from.x + p.x) / 2, (from.y + p.y) / 2, (from.z + p.z) / 2);
    br.lookAt(p); br.rotateX(PI / 2);
    for (let k = 0; k < 5; k++) {
      const th = R(0, PI * 2), d = rr0 * R(0.75, 1), sz = rr0 * R(0.3, 0.45);
      const q = { x: p.x + Math.cos(th) * d, y: p.y + R(0, 0.4) * rr0 * sy, z: p.z + Math.sin(th) * d };
      const [qx] = L(q); if (Math.abs(qx) < 1.9 * s && Math.abs(q.y - tunY) < 1.6 * s) continue;   // keep the tunnel clear
      leafBits.push({ ...q, sv: new THREE.Vector3(sz, sz * 0.7, sz), ry: R(0, 3), color: [0x2f7f3a, 0x3d8f40, 0x4fa04a][k % 3] });
    }
  });
  // hanging aerial roots (decoration) around the outside, never across the openings
  for (let i = 0; i < 18; i++) {
    const lx = (rnd() < 0.5 ? -1 : 1) * R(3.0, 7.0) * s, lz = R(-4.5, 4.5) * s, len = R(2.5, 5.5) * s, p = W(lx, tunY - 1.2 * s - len / 2, lz);
    rootBits.push({ x: p.x, y: p.y, z: p.z, sv: new THREE.Vector3(0.06 * s, len, 0.06 * s), color: 0x8a6a4a });
  }
  // the two fly-through openings
  gap('LUỒN QUA GỐC ĐA!', 'thân cây đa', W(0, 2.5 * s, 0), 4 * s, p => {
    const [lx, lz] = L(p), hw = (2.8 - 2.1 * p.y / top) * s - 0.75 * s;   // half-width between the trunks at this height
    return p.y > 0.6 && p.y < 4.6 * s && Math.abs(lz) < 0.7 * s && Math.abs(lx) < hw - 0.1;
  }, p => { const [lx] = L(p); return W((lx < 0 ? -1 : 1) * 1.6 * s, Math.min(p.y, 4), 0); }, 110);
  gap('XUYÊN HẦM LÁ ĐA!', 'tán đa', W(0, tunY, 0), 6 * s, p => {
    const [lx, lz] = L(p);
    return Math.abs(lx) < 1.45 * s && Math.abs(p.y - tunY) < 0.95 * s && Math.abs(lz) < 4.2 * s;
  }, p => { const [lx, lz] = L(p); return W((lx < 0 ? -1 : 1) * 3.7 * s, tunY, clamp(lz, -3.2 * s, 3.2 * s)); }, 140);
}

// =====================================================================
//  WORLD: one school, two halves. Phe Xanh holds the north wing (gate side, z near -30), Phe Đỏ the south
//  wing (back gate, z near -770); the big shared schoolyard in between is the battlefield, with the
//  Giếng Trời hall in the middle. The layout is point-symmetric (x -> -x, z -> -800 - z), so neither side
//  gets the better ground. Everything is built for flying: verandas 10 m deep and 5 m tall a floor,
//  12 m passages between the blocks, and every indoor hall has a big way in AND a big way out.
// =====================================================================
const SCHOOL = { x: 80, zN: -30, zS: -770, mid: -400 };   // walls and the centre line
const mirZ = z => 2 * SCHOOL.mid - z;
const FLOOR_H = 5.5, VER_D = 10;
const roofRects = [];   // covered spaces [x0, z0, x1, z1, yTop]: indoors, and hidden from radar
function underRoof(p) { for (const r of roofRects) if (p.x > r[0] && p.x < r[2] && p.z > r[1] && p.z < r[3] && p.y < r[4]) return true; return false; }
const fans = [];
const bladeGeo = BOX(1.7, 0.03, 0.26); bladeGeo.translate(0.95, 0, 0);
function ceilingFan(x, y, z) {
  put(new THREE.CylinderGeometry(0.04, 0.04, 0.5), MAT.metal, x, y + 0.3, z, { cast: false });
  const hub = new THREE.Group(); hub.position.set(x, y, z); scene.add(hub);
  put(new THREE.CylinderGeometry(0.22, 0.18, 0.2, 14), lam(0xdedede), 0, 0, 0, { parent: hub });
  for (let k = 0; k < 3; k++) { const b = put(bladeGeo, lam(0xe9e6dc), 0, 0, 0, { parent: hub }); b.rotation.y = k * PI * 2 / 3; }
  fans.push(hub);
  discs.push({ t: 2, c: new THREE.Vector3(x, y, z), r: 1.85, th: 0.15 });
}
const corrMats = {};
const corrMat = n => corrMats[n] || (corrMats[n] = lam(0xffffff, { map: rep(corrTex, n, 1) }));

// A classroom block: classrooms at the back, a deep veranda (hiên) on every floor open to the yard in front.
// zb = back wall line, zf = the yard edge. Planes can run the length of each veranda floor between the
// columns and the classroom doors, or cut in and out between the columns anywhere.
function wingBlock(x0, x1, zb, zf, floors, name) {
  const s = Math.sign(zf - zb), H = floors * FLOOR_H, zm = zf - s * VER_D;
  const va = Math.min(zm, zf), vc = Math.max(zm, zf);
  building(x0, x1, Math.min(zb, zm), Math.max(zb, zm), H, null);
  for (let k = 1; k < floors; k++) solid(x0, k * FLOOR_H - 0.45, va, x1, k * FLOOR_H, vc, MAT.concrete);
  solid(x0, H - 0.45, va, x1, H, vc, MAT.concrete);
  gableRoof(x0, x1, Math.min(zb, zf), Math.max(zb, zf), H, 4.5, false);
  radarRects.push([x0, va, x1, vc]);
  roofRects.push([x0, va, x1, vc, H - 0.45]);
  // classroom fronts (doors, windows, class signs) on every floor
  for (let k = 0; k < floors; k++) put(new THREE.PlaneGeometry(x1 - x0, FLOOR_H - 0.45), corrMat(Math.max(1, Math.round((x1 - x0) / 10))), (x0 + x1) / 2, k * FLOOR_H + (FLOOR_H - 0.45) / 2, zm + s * 0.03, { ry: s > 0 ? 0 : PI, cast: false });
  // columns along the yard edge, a fascia board with the block's name, railings upstairs
  const colZ = zf - s * 0.45, cols = [], n = Math.max(2, Math.round((x1 - x0) / 7));
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0 + 0.4, x1 - 0.4, i / n); cols.push(x);
    put(new THREE.CylinderGeometry(0.32, 0.32, H, 10), MAT.white, x, H / 2, colZ); addBox(x - 0.32, 0, colZ - 0.32, x + 0.32, H, colZ + 0.32);
  }
  solid(x0, H - 1.25, colZ - 0.3, x1, H - 0.45, colZ + 0.3, MAT.cream);
  plaque(name, (x0 + x1) / 2, H - 0.85, colZ + s * 0.32, s > 0 ? 0 : PI, Math.min(10, (x1 - x0) * 0.4), 0.75);
  const rm = lam(0xffffff, { map: rep(railTex, (x1 - x0) / 2, 1), alphaTest: 0.5, side: THREE.DoubleSide });
  for (let k = 1; k < floors; k++) {
    put(new THREE.PlaneGeometry(x1 - x0, 1.1), rm, (x0 + x1) / 2, k * FLOOR_H + 0.55, colZ, { ry: s > 0 ? 0 : PI, cast: false });
    addBox(x0, k * FLOOR_H, colZ - 0.05, x1, k * FLOOR_H + 1.1, colZ + 0.05);
  }
  for (let x = x0 + 12; x < x1 - 6; x += 18) for (let k = 0; k < floors; k++) ceilingFan(x, (k + 1) * FLOOR_H - 0.95, (va + vc) / 2);
  gap('LUỒN HÀNH LANG LỚP HỌC!', 'cột hành lang', new THREE.Vector3((x0 + x1) / 2, H / 2, (va + vc) / 2), (x1 - x0) / 2 + 3,
    p => p.x > x0 && p.x < x1 && p.z > va && p.z < vc && p.y > 0.3 && (p.y % FLOOR_H) < FLOOR_H - 0.6 && p.y < H - 1.3,
    p => new THREE.Vector3(cols.reduce((a, b) => Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a), p.y, colZ));
}
// the centre block of a wing: a tall archway straight through it (Nhà Hiệu Bộ)
function archBlock(x0, x1, zb, zf, floors, name, slogan, ax = 5.5, ah = 8) {
  const s = Math.sign(zf - zb), H = floors * FLOOR_H, za = Math.min(zb, zf), zc = Math.max(zb, zf);
  building(x0, -ax, za, zc, H, null); building(ax, x1, za, zc, H, null);
  const top = solid(-ax, ah, za, ax, H, zc, MAT.cream); top.material = bldgMats(2 * ax, zc - za, H - ah);
  gableRoof(x0, x1, za, zc, H, 5.5, true);
  roofRects.push([-ax, za, ax, zc, ah]);
  put(new THREE.PlaneGeometry(zc - za, ah), corrMat(2), -ax + 0.03, ah / 2, (za + zc) / 2, { ry: PI / 2, cast: false });
  put(new THREE.PlaneGeometry(zc - za, ah), corrMat(2), ax - 0.03, ah / 2, (za + zc) / 2, { ry: -PI / 2, cast: false });
  put(new THREE.PlaneGeometry(2 * ax, zc - za), lam(0xffffff, { map: rep(ceilTex, 4, 8) }), 0, ah - 0.03, (za + zc) / 2, { rx: PI / 2, cast: false });
  plaque(name, 0, ah + 2, zf + s * 0.05, s > 0 ? 0 : PI, 9, 1.5, '#1d4fa3');
  plaque(slogan, 0, H - 1.6, zf + s * 0.05, s > 0 ? 0 : PI, 12, 1.4);
  ceilingFan(0, ah - 0.9, (za + zc) / 2);
  gap('XUYÊN CỔNG VÒM!', 'tường cổng vòm', new THREE.Vector3(0, ah / 2, (za + zc) / 2), (zc - za) / 2 + 3,
    p => Math.abs(p.x) < ax && p.y < ah && p.z > za && p.z < zc, p => new THREE.Vector3(p.x < 0 ? -ax - 0.5 : ax + 0.5, p.y, p.z), 60);
}
// a hall you can fly straight through: big doors in both end walls (along z)
function throughHall(x0, x1, z0, z1, h, door, mats, label) {
  const T = 0.6, dw = door.w / 2, cx = door.x ?? (x0 + x1) / 2;
  solid(x0, 0, z0, x0 + T, h, z1, mats.wall); solid(x1 - T, 0, z0, x1, h, z1, mats.wall);
  for (const z of [z0, z1 - T]) {
    solid(x0, 0, z, cx - dw, h, z + T, mats.wall); solid(cx + dw, 0, z, x1, h, z + T, mats.wall); solid(cx - dw, door.h, z, cx + dw, h, z + T, mats.wall);
  }
  solid(x0 - 0.4, h, z0 - 0.4, x1 + 0.4, h + 0.6, z1 + 0.4, mats.roof);
  put(new THREE.PlaneGeometry(x1 - x0 - 2 * T, z1 - z0 - 2 * T), mats.floor, (x0 + x1) / 2, 0.03, (z0 + z1) / 2, { rx: -PI / 2, cast: false });
  put(new THREE.PlaneGeometry(x1 - x0 - 2 * T, z1 - z0 - 2 * T), mats.ceil, (x0 + x1) / 2, h - 0.03, (z0 + z1) / 2, { rx: PI / 2, cast: false });
  radarRects.push([x0, z0, x1, z1]); roofRects.push([x0, z0, x1, z1, h]);
  for (const [z, ry] of [[z0 - 0.05, PI], [z1 + 0.05, 0]]) plaque(label, cx, door.h + (h - door.h) / 2, z, ry, Math.min(16, door.w), Math.min(2, (h - door.h) * 0.7), mats.signBg || '#1d4fa3');
  for (const z of [z0, z1]) gap(`BAY XUYÊN ${label}!`, 'khung cửa', new THREE.Vector3(cx, door.h / 2, z), door.w,
    p => Math.abs(p.x - cx) < dw && p.y < door.h && Math.abs(p.z - z) < 0.8, p => new THREE.Vector3(p.x < cx ? cx - dw - 0.5 : cx + dw + 0.5, p.y, z), 60);
}
function flagPole(x, z, tex, isRival) {
  solid(x - 3.2, 0, z - 3.2, x + 3.2, 0.4, z + 3.2, MAT.stone);
  solid(x - 2.2, 0.4, z - 2.2, x + 2.2, 0.8, z + 2.2, MAT.concrete);
  put(new THREE.CylinderGeometry(0.08, 0.14, 16, 10), MAT.metal, x, 8.8, z);
  put(new THREE.SphereGeometry(0.22, 10, 8), lam(0xffd93b), x, 16.9, z);
  addBox(x - 0.3, 0, z - 0.3, x + 0.3, 17, z + 0.3);
  const m = put(flagGeo, lam(0xffffff, { map: tex, side: THREE.DoubleSide, transparent: !!isRival, alphaTest: 0.05 }), x + 0.1, 15.2, z, { cast: false });
  gap('XUYÊN QUA LÁ CỜ!', 'cột cờ', new THREE.Vector3(x + 2, 15, z), 4, p => p.x > x + 0.2 && p.x < x + 4.3 && p.y > 13.8 && p.y < 16.6 && Math.abs(p.z - z) < 0.35, new THREE.Vector3(x, 15, z), 80);
  return m;
}

// ---- ground ----
put(new THREE.PlaneGeometry(SCHOOL.x * 2, SCHOOL.zN - SCHOOL.zS), lam(0xffffff, { map: rep(concreteTex, 40, 185) }), 0, 0, SCHOOL.mid, { rx: -PI / 2, cast: false });
put(new THREE.PlaneGeometry(170, 70), lam(0xffffff, { map: rep(asphaltTex, 170 / 8, 70 / 8) }), 0, 0, 5, { rx: -PI / 2, cast: false });
put(new THREE.PlaneGeometry(170, 30), lam(0xffffff, { map: rep(asphaltTex, 170 / 8, 30 / 8) }), 0, 0, -786, { rx: -PI / 2, cast: false });
put(new THREE.PlaneGeometry(2000, 2400), lam(0x7d8467), 0, -0.05, SCHOOL.mid, { rx: -PI / 2, cast: false });
const decal = (m, k) => Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -k * 2 });
for (let x = -80; x < 80; x += 8) put(new THREE.PlaneGeometry(4, 0.25), decal(lam(0xf2f2f2), 2), x, 0.02, 18, { rx: -PI / 2, cast: false });
const tileMat = n => decal(lam(0xffffff, { map: rep(tileTex, 4, n) }), 2);
put(new THREE.PlaneGeometry(8, 160), tileMat(80), 0, 0.02, -250, { rx: -PI / 2, cast: false });   // tiled walks from each wing to the Giếng Trời
put(new THREE.PlaneGeometry(8, 160), tileMat(80), 0, 0.02, -550, { rx: -PI / 2, cast: false });
put(new THREE.PlaneGeometry(8, 100), tileMat(50), 0, 0.02, -95, { rx: -PI / 2, cast: false });
put(new THREE.PlaneGeometry(8, 100), tileMat(50), 0, 0.02, -705, { rx: -PI / 2, cast: false });
// the two border lines painted across the yard: past them each side's own ground begins; the Giếng Trời stands in between
const BORDER_Z = -330;
for (const [z, col, txt] of [[BORDER_Z, '#1d4fa3', 'RANH GIỚI KHU XANH'], [mirZ(BORDER_Z), '#b20d24', 'RANH GIỚI KHU ĐỎ']]) {
  for (let x = -78; x < 78; x += 6) put(new THREE.PlaneGeometry(4, 0.6), decal(lam(col), 2), x + 2, 0.025, z, { rx: -PI / 2, cast: false });
  for (const x of [-45, 45]) put(new THREE.PlaneGeometry(14, 2.2), decal(lam(0xffffff, { map: signTex([txt], { w: 1024, h: 160, bg: col, fg: '#ffffff', border: '#ffffff', size: 90 }) }), 2), x, 0.03, z + (z > SCHOOL.mid ? 2 : -2), { rx: -PI / 2, rz: z > SCHOOL.mid ? PI : 0, cast: false });
}
for (const sx of [-1, 1]) for (const x of [84, 107, 130]) put(new THREE.PlaneGeometry(6, 1300), decal(lam(0xffffff, { map: rep(asphaltTex, 1, 160) }), 1), sx * x, 0.01, SCHOOL.mid, { rx: -PI / 2, cast: false });

// ---- the outer wall, with a gate at each end ----
const wallMat = lam(0xf0c75a), capMat = lam(0xb4472a);
for (const sx of [-1, 1]) {
  solid(sx * SCHOOL.x - 0.5, 0, SCHOOL.zS, sx * SCHOOL.x + 0.5, 3.2, SCHOOL.zN, wallMat);
  solid(sx * SCHOOL.x - 0.7, 3.2, SCHOOL.zS, sx * SCHOOL.x + 0.7, 3.5, SCHOOL.zN, capMat, { collide: false });
}
const railMatCache = (n) => lam(0xffffff, { map: rep(railTex, n, 1), alphaTest: 0.5, side: THREE.DoubleSide });
function gateWall(z, out, beamMat, lines, bg) {   // out: which way is outside (+1 / -1)
  for (const sx of [-1, 1]) {
    solid(sx * 7.5 - 0.7, 0, z - 0.7, sx * 7.5 + 0.7, 10, z + 0.7, MAT.cream);
    solid(sx * 7.5 - 0.9, 10, z - 0.9, sx * 7.5 + 0.9, 10.5, z + 0.9, capMat, { collide: false });
    solid(sx * 8.2, 0, z - 0.25, sx * SCHOOL.x, 2.1, z + 0.25, wallMat);
    solid(sx * 8.2, 2.1, z - 0.35, sx * SCHOOL.x, 2.3, z + 0.35, capMat, { collide: false });
    addBox(sx * 8.2, 2.3, z - 0.1, sx * SCHOOL.x, 3.4, z + 0.1);
    put(new THREE.PlaneGeometry(SCHOOL.x - 8.2, 1.1), railMatCache(36), sx * (SCHOOL.x + 8.2) / 2, 2.85, z, { cast: false });
    put(new THREE.PlaneGeometry(5, 3.2), lam(0x2f6fb5, { map: rep(railTex, 3, 3), alphaTest: 0.5, side: THREE.DoubleSide }), sx * 10.8, 1.6, z - out * 0.6, { cast: false });
  }
  solid(-8.4, 8.6, z - 0.4, 8.4, 11.2, z + 0.4, beamMat);
  put(new THREE.PlaneGeometry(16.4, 2.5), signMat(signTex(lines, { w: 1024, h: 160, bg, border: '#ffd93b' })), 0, 9.9, z + out * 0.42, { ry: out > 0 ? 0 : PI, cast: false });
}
gateWall(SCHOOL.zN, 1, MAT.blue, [{ t: 'TRƯỜNG THCS GIẤY BAY', size: 120 }, { t: '★ Cổng Đông · Khu Phe Xanh ★', size: 60, c: '#ffffff' }], '#1d4fa3');
gateWall(SCHOOL.zS, -1, MAT.red, [{ t: 'TRƯỜNG THCS GIẤY BAY', size: 120 }, { t: '★ Cổng Tây · Khu Phe Đỏ ★', size: 60, c: '#ffffff' }], '#b20d24');

// ---- outside the front gate: the bánh mì cart and parked scooters ----
student(15, -10, -PI / 2, 'vendor');
solid(16, 0, -12, 18.2, 1.1, -9, MAT.metal);
solid(16, 1.1, -12, 18.2, 2.1, -9, lam(0xbfe6f2, { transparent: true, opacity: 0.55 }), { collide: false });
put(new THREE.PlaneGeometry(2.6, 0.6), signMat(signTex(['BÁNH MÌ'], { w: 512, h: 120, bg: '#ffd93b', fg: '#c8102e', border: '#c8102e' })), 15.98, 1.6, -10.5, { ry: -PI / 2, cast: false });
put(new THREE.ConeGeometry(2.2, 0.8, 10), lam(0xe23b3b), 17, 3.2, -10.5);
put(new THREE.CylinderGeometry(0.05, 0.05, 3), MAT.metal, 17, 1.5, -10.5);
addBox(14.9, 2.8, -12.7, 19.2, 3.6, -8.3);
for (let i = 0; i < 6; i++) scooters.push({ x: -14 - i * 1.4, z: -24, ry: 0.2 });
for (let i = 0; i < 4; i++) scooters.push({ x: 24 + i * 1.4, z: -24, ry: -0.2 });

// Electric poles + tangled wires
const wireMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
function wire(a, b, sag) {
  const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t) - Math.sin(t * PI) * sag, lerp(a.z, b.z, t))); }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
}
function poleLine(points) {
  points.forEach(p => { put(new THREE.CylinderGeometry(0.15, 0.25, 11, 8), MAT.concrete, p.x, 5.5, p.z); put(BOX(1.6, 0.12, 0.12), MAT.metal, p.x, 10.2, p.z); addBox(p.x - 0.3, 0, p.z - 0.3, p.x + 0.3, 11, p.z + 0.3); });
  for (let i = 0; i < points.length - 1; i++) for (let k = 0; k < 5; k++)
    wire(new THREE.Vector3(points[i].x + (k - 2) * 0.35, 10.3 - k * 0.15, points[i].z), new THREE.Vector3(points[i + 1].x + (k - 2) * 0.35, 10.3 - k * 0.15, points[i + 1].z), 0.6 + k * 0.25);
}
poleLine([-90, -50, -10, 30, 70, 110].map(x => ({ x, z: 24 })));
poleLine([-90, -50, -10, 30, 70, 110].map(x => ({ x, z: -778 })));
for (const sx of [-1, 1]) poleLine([-20, -110, -200, -290, -380, -470, -560, -650, -740].map(z => ({ x: sx * 87, z })));

// Neighbourhood tube houses (nhà ống) – instanced, all solid
const houseList = [];
const houseCols = [0xf4d35e, 0x9ad1d4, 0xf7a072, 0xc5e1a5, 0xf2b5d4, 0xffffff, 0xb8c0ff, 0xffd6a5, 0xe8e8e8];
function house(cx, cz, w, d, h, alongZ) {   // w = frontage
  const sx = alongZ ? d : w, sz = alongZ ? w : d;
  houseList.push({ x: cx, y: h / 2, z: cz, sv: new THREE.Vector3(sx, h, sz), color: houseCols[Math.floor(rnd() * houseCols.length)] });
  houseList[houseList.length - 1].box = addBox(cx - sx / 2, 0, cz - sz / 2, cx + sx / 2, h, cz + sz / 2);
}
const tallH = () => rnd() < 0.05 ? R(28, 42) : R(8, 22);
for (const sx of [-1, 1]) for (const base of [90, 111, 134]) for (let z = 30; z > -800;) {
  const w = R(4, 6.5), d = R(8, 13);
  house(sx * (base + d / 2), z - w / 2, w - 0.25, d, tallH(), true);
  z -= w;
}
for (const zb of [30, 52, 75, 98, 121]) for (let x = -150; x < 150;) { const w = R(4, 6.5), d = R(8, 12); house(x + w / 2, zb + d / 2, w - 0.25, d, tallH(), false); x += w; }
for (const zb of [-801, -824, -847, -870, -893]) for (let x = -150; x < 150;) { const w = R(4, 6.5), d = R(8, 12); house(x + w / 2, zb - d / 2, w - 0.25, d, tallH(), false); x += w; }
const houseMesh = instances(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff, { map: houseTex }), houseList, false);

// Water tower landmark
put(new THREE.CylinderGeometry(0.6, 0.6, 26, 10), MAT.concrete, -160, 13, -400);
put(new THREE.CylinderGeometry(5, 4, 6, 18), lam(0xd9d4c4), -160, 29, -400);
addBox(-165, 0, -405, -155, 32, -395);

// ---- Hightower: two glass towers far outside the walls, one blue behind the east side, one red behind the west.
//      Both sides take their orders from "Hightower"; nobody up there has ever folded a plane. In the ending the
//      strings show: every line runs from the two crowns down into the yard.
const towerLit = Array.from({ length: 32 * 8 }, () => Math.random() < 0.22);   // which windows have their lights on
const towerTex = canvasTex(128, 512, (g, w, h) => {
  g.fillStyle = '#9aa3ad'; g.fillRect(0, 0, w, h);
  towerLit.forEach((lit, i) => { g.fillStyle = lit ? '#fff3c4' : Math.random() < 0.5 ? '#5d6670' : '#6d7782'; g.fillRect((i % 8) * 16 + 2, (i >> 3) * 16 + 3, 12, 10); });
}, true);
const towerGlowTex = canvasTex(128, 512, (g, w, h) => {   // only the lit windows glow
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
  towerLit.forEach((lit, i) => { if (lit) g.fillRect((i % 8) * 16 + 2, (i >> 3) * 16 + 3, 12, 10); });
}, true);
const towerStrings = new THREE.Group(); towerStrings.visible = false; scene.add(towerStrings);
const TOWERS = [];
function hightower(x, z, col, signBg) {
  const tint = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.35).getHex();
  const tierMat = (w, h) => lam(tint, { map: rep(towerTex, w / 6, h / 30), emissive: col, emissiveMap: rep(towerGlowTex, w / 6, h / 30), emissiveIntensity: 0.55 });
  solid(x - 18, 0, z - 18, x + 18, 14, z + 18, lam(0x6c7178));   // podium
  let y = 14;
  for (const [w, h] of [[24, 70], [19, 55], [14, 38]]) {   // three setbacks, each with a coloured band on top
    solid(x - w / 2, y, z - w / 2, x + w / 2, y + h, z + w / 2, tierMat(w, h));
    solid(x - w / 2 - 0.6, y + h, z - w / 2 - 0.6, x + w / 2 + 0.6, y + h + 1.6, z + w / 2 + 0.6, lam(col, { emissive: col, emissiveIntensity: 0.4 }));
    y += h + 1.6;
  }
  const crown = y;   // ~182: well above the clouds
  put(new THREE.CylinderGeometry(4, 7, 8, 4), lam(0x3b3f45), x, crown + 4, z, { ry: PI / 4 });
  put(new THREE.CylinderGeometry(0.35, 0.6, 24, 6), MAT.metal, x, crown + 20, z);
  const beacon = put(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: col, fog: false }), x, crown + 32.5, z, { cast: false });
  addBox(x - 12, 14, z - 12, x + 12, crown + 32, z + 12);
  // the name, lit, on all four faces of the top tier
  const sign = signMat(signTex([{ t: 'HIGHTOWER', size: 130 }], { w: 1024, h: 180, bg: signBg, fg: '#ffffff', border: '#ffffff' }));
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2, r = 7.05;
    put(new THREE.PlaneGeometry(12, 2.1), sign, x + Math.sin(a) * r, crown - 6, z + Math.cos(a) * r, { ry: a, cast: false });
  }
  const t = { x, z, crown, col, beacon };
  TOWERS.push(t);
  return t;
}
const TOWER_BLUE = hightower(-240, -170, 0x2f6fd8, '#1d4fa3'), TOWER_RED = hightower(240, mirZ(-170), 0xd83a3a, '#b20d24');
function towerString(tw, to) {
  const a = new THREE.Vector3(tw.x + rr(-6, 6), tw.crown + rr(0, 6), tw.z + rr(-6, 6)), pts = [];
  for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(new THREE.Vector3().lerpVectors(a, to, u).add(new THREE.Vector3(0, -Math.sin(u * PI) * 6, 0))); }
  towerStrings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: tw.col, transparent: true, opacity: 0.75, fog: false })));
}
// each tower holds its own side's flag, gate, workshop and chalk line... and both hold the middle of the yard
for (const [tw, s] of [[TOWER_BLUE, 1], [TOWER_RED, -1]]) {
  const Z = z => s > 0 ? z : mirZ(z);
  for (const p of [[0, 13.5, Z(-205)], [s * -53, 16, Z(-90)], [0, 11, Z(SCHOOL.zN)], [-40, 0.1, Z(-330)], [0, 0.1, Z(-330)], [40, 0.1, Z(-330)], [s * -30, 18, Z(-260)], [s * 30, 18, Z(-160)]]) towerString(tw, new THREE.Vector3(...p));
  for (const dx of [-6, 0, 6]) towerString(tw, new THREE.Vector3(dx, 4, SCHOOL.mid));
}

// Clouds
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false, emissive: 0xbbbbbb });
const cloudList = [];
for (let i = 0; i < 30; i++) {
  const cx = R(-350, 350), cy = R(125, 170), cz = R(-1000, 200);
  for (let k = 0; k < 5; k++) cloudList.push({ x: cx + R(-18, 18), y: cy + R(-3, 4), z: cz + R(-8, 8), sv: new THREE.Vector3(R(10, 20), R(5, 8), R(8, 14)) });
}
instances(icoGeo, cloudMat, cloudList, false);

// ---- the two faction flags: ours (white paper plane on blue) and theirs (black eagle on red) ----
function paperPlaneMark(g, cx, cy, s, col) {
  g.fillStyle = col; g.beginPath(); g.moveTo(cx + 1.0 * s, cy - 0.45 * s); g.lineTo(cx - 1.0 * s, cy + 0.05 * s); g.lineTo(cx - 0.2 * s, cy + 0.2 * s); g.closePath(); g.fill();
  g.globalAlpha = 0.75; g.beginPath(); g.moveTo(cx + 1.0 * s, cy - 0.45 * s); g.lineTo(cx - 0.2 * s, cy + 0.2 * s); g.lineTo(cx - 0.05 * s, cy + 0.6 * s); g.closePath(); g.fill(); g.globalAlpha = 1;
}
const flagTex = canvasTex(300, 200, (g, w, h) => {
  g.fillStyle = '#1d4fa3'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff'; g.fillRect(0, h - 26, w, 8); g.fillRect(0, 18, w, 8);   // white stripes
  paperPlaneMark(g, w / 2, h / 2, 62, '#ffffff');
});
const rivalFlagTex = canvasTex(300, 200, (g, w, h) => {
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a0505'; g.fillRect(0, h - 26, w, 8); g.fillRect(0, 18, w, 8);
  // a black eagle with spread, feathered wings
  g.fillStyle = '#1a0505'; g.beginPath(); g.moveTo(150, 70); g.lineTo(70, 92); g.lineTo(52, 84); g.lineTo(64, 100); g.lineTo(48, 104); g.lineTo(70, 112); g.lineTo(130, 110);
  g.lineTo(140, 150); g.lineTo(150, 136); g.lineTo(160, 150); g.lineTo(170, 110); g.lineTo(230, 112); g.lineTo(252, 104); g.lineTo(236, 100); g.lineTo(248, 84); g.lineTo(230, 92); g.closePath(); g.fill();
  g.beginPath(); g.arc(150, 72, 11, 0, PI * 2); g.fill();
});
const flagGeo = new THREE.PlaneGeometry(4.2, 2.8, 18, 8); flagGeo.translate(2.1, 0, 0);
const flagBase = flagGeo.attributes.position.array.slice();
const FLAG_BLUE = new THREE.Vector3(0, 9, -205), FLAG_RED = new THREE.Vector3(0, 9, mirZ(-205));
flagPole(FLAG_BLUE.x, FLAG_BLUE.z, flagTex);
const rivalFlag = flagPole(FLAG_RED.x, FLAG_RED.z, rivalFlagTex, true);

// =====================================================================
//  The two wings (mirror images): three blocks facing the yard, 12 m passages between them
// =====================================================================
const ROW_N = [-150, -172], ROW_S = [mirZ(-150), mirZ(-172)];   // [back wall, yard edge]
// Phe Xanh (north)
wingBlock(-72, -22, ROW_N[0], ROW_N[1], 2, 'DÃY A');
archBlock(-10, 10, ROW_N[0], ROW_N[1], 3, 'NHÀ HIỆU BỘ', 'TIÊN HỌC LỄ – HẬU HỌC VĂN');
wingBlock(22, 72, ROW_N[0], ROW_N[1], 2, 'DÃY B');
// Phe Đỏ (south)
wingBlock(-72, -22, ROW_S[0], ROW_S[1], 2, 'DÃY C');
wingBlock(22, 72, ROW_S[0], ROW_S[1], 2, 'DÃY D');
// Phòng Thí Nghiệm: the centre of the south wing is a tall lab hall; fly in from the yard, out the back
const LABH = { x0: -10, x1: 10, z0: Math.min(...ROW_S), z1: Math.max(...ROW_S), h: 12 };
const _lab0 = scene.children.length, _labB0 = boxes.length, _labR0 = roofRects.length;   // the lab is destroyed in Chương 6: keep hold of its parts
throughHall(LABH.x0, LABH.x1, LABH.z0, LABH.z1, LABH.h, { w: 12, h: 8.5 },
  { wall: lam(0xdedad2), roof: lam(0x6f6a60), floor: lam(0xffffff, { map: rep(tileTex, 5, 6) }), ceil: lam(0xe9ece8), signBg: '#9c1c1c' }, 'PHÒNG THÍ NGHIỆM');
{
  const top = lam(0x1c1c1f), cab = lam(0xd9cdb0);
  for (const sx of [-1, 1]) {   // benches along both side walls, flasks glowing on top
    solid(sx * 8.3 - 1.1, 2.6, LABH.z0 + 3, sx * 8.3 + 1.1, 3.0, LABH.z1 - 3, top);
    solid(sx * 8.3 - 1.0, 0, LABH.z0 + 3.1, sx * 8.3 + 1.0, 2.6, LABH.z1 - 3.1, cab);
    for (let k = 0; k < 6; k++) put(new THREE.CylinderGeometry(0.12, 0.38, 0.8, 10), lam([0x6fd0ff, 0x9effa0, 0xff8fc0, 0xffd93b][k % 4], { emissive: [0x0a3a5a, 0x0a4a1a, 0x4a0a2a, 0x4a3a00][k % 4], transparent: true, opacity: 0.8 }), sx * 8.3 + R(-0.5, 0.5), 3.4, lerp(LABH.z0 + 4, LABH.z1 - 4, k / 5), { cast: false });
  }
  // the heater the Red Faction's little planes huddle round to dry off
  const hx = -6.5, hz = LABH.z0 + 4, tinyPlane = new THREE.ConeGeometry(0.16, 0.5, 3).rotateX(-PI / 2).scale(1, 0.2, 1);
  put(BOX(1.6, 1.4, 1.0), lam(0x8a3a1a, { emissive: 0xff6a1f, emissiveIntensity: 0.9 }), hx, 0.7, hz);
  addBox(hx - 0.8, 0, hz - 0.5, hx + 0.8, 1.5, hz + 0.5);
  for (let k = 0; k < 7; k++) { const a = k / 7 * PI * 2, m = put(tinyPlane, lam([0xffb3a7, 0xffd6a5, 0xf4f1e6][k % 3], { side: THREE.DoubleSide }), hx + Math.cos(a) * 1.6, 0.08, hz + Math.sin(a) * 1.3, { cast: false }); m.rotation.y = -a + PI / 2; }
}
// the radar on the lab roof (it sweeps all the time; chapter 1 sneaks in under it)
const RADAR_POS = new THREE.Vector3(0, LABH.h + 6.5, (LABH.z0 + LABH.z1) / 2);
solid(-1.2, LABH.h + 0.6, RADAR_POS.z - 1.2, 1.2, LABH.h + 5, RADAR_POS.z + 1.2, MAT.metal);
const labDish = new THREE.Group();
labDish.position.set(0, LABH.h + 5.2, RADAR_POS.z);
{
  const dish = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 8, 0, PI * 2, 0, PI * 0.32), lam(0xeeeeee, { side: THREE.DoubleSide }));
  dish.rotation.x = -PI / 2 - 0.35; dish.position.set(0, 0.6, 0.4); dish.castShadow = true; labDish.add(dish);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), MAT.metal); feed.rotation.x = PI / 2 - 0.35; feed.position.set(0, 1.0, -0.5); labDish.add(feed);
  labDish.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), MAT.metal));
}
const labBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
labBeacon.position.set(0, 2.2, 0); labDish.add(labBeacon);
scene.add(labDish);
const labParts = scene.children.slice(_lab0), labBoxes = boxes.slice(_labB0), labRoof = roofRects[_labR0];
labParts.forEach(o => o.userData.y0 = o.position.y);
// ...and what's left of it afterwards: broken wall stubs, slabs and beams in a heap, scorched ground
const labRubble = new THREE.Group(), rubbleBoxes = [];
{
  const c0 = scene.children.length, cz = (LABH.z0 + LABH.z1) / 2;
  const chunk = (x, y, z, w, h, d, m, rx = 0, ry = 0, rz = 0, collide = true) => {
    put(new THREE.BoxGeometry(w, h, d), m, x, y, z, { rx, ry, rz });
    if (collide) { const r = Math.max(w, d) / 2; rubbleBoxes.push(addBox(x - r, 0, z - r, x + r, y + h / 2, z + r)); }
  };
  const wallM = lam(0xbdb8ae), burnt = lam(0x3a3430), slab = MAT.concrete;
  for (const [x, z] of [[LABH.x0 + 0.4, LABH.z0 + 0.4], [LABH.x1 - 0.4, LABH.z0 + 0.4], [LABH.x0 + 0.4, LABH.z1 - 0.4], [LABH.x1 - 0.4, LABH.z1 - 0.4]]) chunk(x, R(1.5, 2.6), z, 0.8, R(3, 5.2), 0.8, wallM);
  for (let i = 0; i < 9; i++) chunk(R(-8, 8), R(0.5, 1.6), cz + R(-9, 9), R(2.5, 5), 0.5, R(2, 4), i % 3 ? slab : burnt, R(-0.5, 0.5), R(0, 3), R(-0.5, 0.5));
  for (let i = 0; i < 5; i++) chunk(R(-7, 7), R(1, 2.5), cz + R(-8, 8), 0.4, 0.4, R(5, 9), MAT.metal, R(-0.4, 0.4), R(0, 3), R(-0.6, 0.6), false);
  chunk(2, 0.9, cz - 3, 1.6, 1.6, 1.6, MAT.metal, 0.4, 0.7, 1.2, false);   // the radar dish's mount, fallen
  const dish = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 8, 0, PI * 2, 0, PI * 0.32), lam(0xbbbbbb, { side: THREE.DoubleSide })); dish.position.set(4, 0.8, cz + 2); dish.rotation.set(1.9, 0.4, 0.3); scene.add(dish);
  put(new THREE.CircleGeometry(15, 24), decal(lam(0x2a2622), 3), 0, 0.04, cz, { rx: -PI / 2, cast: false });
  scene.children.slice(c0).forEach(o => labRubble.add(o)); scene.add(labRubble);
}
let labRuined = false;
function setLabRuined(r) {
  labRuined = r;
  labParts.forEach(o => { o.visible = !r; o.position.y = o.userData.y0; });
  labBoxes.forEach(b => b.off = r);
  labRubble.visible = r; rubbleBoxes.forEach(b => b.off = !r);
  labRoof[4] = r ? -1 : LABH.h;
}
setLabRuined(false);

// =====================================================================
//  Giếng Trời: the hall in the middle of the yard. A ring building on an open arcade: fly round the
//  arcade under the ring, or dive into the well and climb out through the open sky. Two footbridges
//  cross the well at different heights.
// =====================================================================
{
  const cz = SCHOOL.mid, RO = 22, RI = 12, AH = 6, H = 21;
  const ring = [[-RO, cz - RO, RO, cz - RI], [-RO, cz + RI, RO, cz + RO], [-RO, cz - RI, -RI, cz + RI], [RI, cz - RI, RO, cz + RI]];
  for (const [x0, z0, x1, z1] of ring) {
    const m = solid(x0, AH, z0, x1, H, z1, MAT.cream); m.material = bldgMats(x1 - x0, z1 - z0, H - AH);
    solid(x0, AH - 0.5, z0, x1, AH, z1, MAT.concrete, { collide: false });
    put(new THREE.PlaneGeometry(x1 - x0, z1 - z0), lam(0xffffff, { map: rep(ceilTex, (x1 - x0) / 4, (z1 - z0) / 4) }), (x0 + x1) / 2, AH - 0.52, (z0 + z1) / 2, { rx: PI / 2, cast: false });
    radarRects.push([x0, z0, x1, z1]); roofRects.push([x0, z0, x1, z1, AH - 0.5]);
  }
  solid(-RO - 0.4, H, cz - RO - 0.4, RO + 0.4, H + 0.8, cz - RI, MAT.brick, { collide: false });   // parapets
  solid(-RO - 0.4, H, cz + RI, RO + 0.4, H + 0.8, cz + RO + 0.4, MAT.brick, { collide: false });
  // the arcade: columns round the outside and round the well
  const cols = [];
  const colAt = (x, z) => { put(new THREE.CylinderGeometry(0.4, 0.4, AH, 10), MAT.white, x, AH / 2, z); addBox(x - 0.4, 0, z - 0.4, x + 0.4, AH, z + 0.4); cols.push([x, z]); };
  for (const r of [RO - 0.5, RI + 0.5]) { const n = r > 15 ? 7 : 4; for (let i = 0; i < n; i++) { const u = lerp(-r, r, i / n); colAt(u, cz - r); colAt(r, cz + u); colAt(-u, cz + r); colAt(-r, cz - u); } }
  ceilingFan(0, AH - 1.4, cz - (RO + RI) / 2); ceilingFan(0, AH - 1.4, cz + (RO + RI) / 2); ceilingFan(-(RO + RI) / 2, AH - 1.4, cz); ceilingFan((RO + RI) / 2, AH - 1.4, cz);
  // footbridges across the well and a little fountain at the bottom
  solid(-RI, 10.6, cz - 1.5, RI, 11.2, cz + 1.5, MAT.concrete); solid(-RI, 11.2, cz - 1.6, RI, 12.2, cz - 1.45, MAT.metal, { collide: false }); solid(-RI, 11.2, cz + 1.45, RI, 12.2, cz + 1.6, MAT.metal, { collide: false });
  solid(-1.5, 15.6, cz - RI, 1.5, 16.2, cz + RI, MAT.concrete);
  put(new THREE.CylinderGeometry(3, 3.3, 0.8, 24), MAT.stone, 0, 0.4, cz); addBox(-3, 0, cz - 3, 3, 0.8, cz + 3);
  put(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 24), lam(0x3f86c8, { emissive: 0x0a2a4a }), 0, 0.82, cz, { cast: false });
  put(new THREE.CylinderGeometry(0.25, 0.4, 2.2, 10), MAT.stone, 0, 1.9, cz); addBox(-0.4, 0, cz - 0.4, 0.4, 3, cz + 0.4);
  for (const [z, ry] of [[cz - RO - 0.05, PI], [cz + RO + 0.05, 0]]) { plaque('GIẾNG TRỜI', 0, AH + 2, z, ry, 9, 1.5, '#1d4fa3'); plaque('NHÀ ĐA NĂNG', 0, H - 2, z, ry, 10, 1.4); }
  for (const [x, ry] of [[-RO - 0.05, -PI / 2], [RO + 0.05, PI / 2]]) plaque('GIẾNG TRỜI', x, AH + 2, cz, ry, 9, 1.5, '#1d4fa3');
  gap('LUỒN VÒNG CỘT GIẾNG TRỜI!', 'cột', new THREE.Vector3(0, AH / 2, cz), RO + 2,
    p => p.y < AH - 0.6 && Math.max(Math.abs(p.x), Math.abs(p.z - cz)) < RO && Math.max(Math.abs(p.x), Math.abs(p.z - cz)) > RI,
    p => { let b = cols[0], bd = 1e9; for (const c of cols) { const d = Math.hypot(c[0] - p.x, c[1] - p.z); if (d < bd) { bd = d; b = c; } } return new THREE.Vector3(b[0], p.y, b[1]); }, 70);
  gap('VÚT LÊN GIẾNG TRỜI!', 'thành giếng', new THREE.Vector3(0, H - 3, cz), RI + 2,
    p => Math.abs(p.x) < RI && Math.abs(p.z - cz) < RI && p.y > H - 4 && p.y < H, p => new THREE.Vector3(p.x < 0 ? -RI - 1 : RI + 1, p.y, p.z), 90);
  gap('LUỒN DƯỚI CẦU GIẾNG TRỜI!', 'cầu', new THREE.Vector3(0, 9, cz), RI + 2,
    p => Math.abs(p.x) < RI && Math.abs(p.z - cz) < 1.5 && p.y > 6 && p.y < 10.5, new THREE.Vector3(0, 10.9, cz), 60);
}

// =====================================================================
//  The north courtyard (Phe Xanh): Thư Viện, the canteen, the bike shed, the opening-day stage
// =====================================================================
const woodFloorTex = canvasTex(256, 256, (g, w, h) => {
  for (let y = 0; y < h; y += 32) for (let x = (y / 32 % 2) * 64; x < w + 128; x += 128) { g.fillStyle = ['#a8763f', '#9c6c38', '#b07d44'][((x + y) / 32 | 0) % 3]; g.fillRect(x - 128, y, 127, 31); }
  speckle(g, w, h, 1500, 'rgba(60,30,10,0.12)');
}, true);
const bookTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3b2414'; g.fillRect(0, 0, w, h);
  const cols = ['#8c2f2f', '#2f5c8c', '#2f7a4a', '#c9a227', '#6b3f8c', '#b5651d', '#e8e0c8', '#1f3b5c', '#a83c5a'];
  for (let row = 0; row < 4; row++) {
    const y0 = row * 64 + 6;
    for (let x = 2; x < w - 4;) { const bw = 6 + Math.random() * 12, bh = 40 + Math.random() * 16; g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(x, y0 + 56 - bh, bw - 1, bh); x += bw; }
    g.fillStyle = '#5a3820'; g.fillRect(0, y0 + 56, w, 6);
  }
}, true);
const LIB = { x0: -72, x1: -34, z0: -132, z1: -48, h: 16 };
throughHall(LIB.x0, LIB.x1, LIB.z0, LIB.z1, LIB.h, { w: 16, h: 10.5 },
  { wall: lam(0x8c5a3c), roof: MAT.brick, floor: lam(0xffffff, { map: rep(woodFloorTex, 10, 21) }), ceil: lam(0xe8dcc2) }, 'THƯ VIỆN');
{
  const shelfSide = lam(0x5a3820);
  for (const x of [-68.5, -37.5]) for (const [a, b] of [[-54, -74], [-80, -100], [-106, -126]]) {   // tall shelves down both walls
    const face = lam(0xffffff, { map: rep(bookTex, 1, 1.2) }), end = lam(0xffffff, { map: rep(bookTex, (a - b) / 8, 1.2) });
    const m = solid(x - 2, 0, b, x + 2, 9.5, a, shelfSide); m.material = [end, end, shelfSide, shelfSide, face, face];
  }
  const tableTop = lam(0x7a4a26), lampMat = lam(0x2f7a4a, { emissive: 0x0f3a20 }), glow = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const z of [-64, -116]) {   // reading tables in the aisle (fly over them, or between their legs)
    solid(-58, 2.2, z - 5, -48, 2.6, z + 5, tableTop);
    for (const [sx, sz] of [[-57.5, -4.5], [-48.5, -4.5], [-57.5, 4.5], [-48.5, 4.5]]) solid(sx - 0.2, 0, z + sz - 0.2, sx + 0.2, 2.2, z + sz + 0.2, tableTop);
    for (const sx of [-55, -51]) { put(new THREE.ConeGeometry(0.5, 0.5, 12, 1, true), lampMat, sx, 3.4, z); put(new THREE.SphereGeometry(0.18, 8, 6), glow, sx, 3.2, z, { cast: false }); }
  }
  put(new THREE.CylinderGeometry(0.25, 0.9, 3.5, 10), lam(0x5a3820), -53, 1.75, -90);   // the globe
  put(new THREE.SphereGeometry(2, 20, 14), lam(0x4a8fc8, { emissive: 0x0a1a2a }), -53, 5.4, -90);
  addBox(-55, 0, -92, -51, 7.4, -88);
  for (const z of [-70, -110]) {   // chandeliers on long cords
    put(new THREE.CylinderGeometry(0.04, 0.04, 3), MAT.metal, -53, 14.5, z, { cast: false });
    put(new THREE.CylinderGeometry(1.6, 2.1, 0.8, 16), lam(0xc9a227, { emissive: 0x3a2a00 }), -53, 12.6, z);
    addBox(-55.1, 12.2, z - 2.1, -50.9, 16, z + 2.1);
  }
}
building(48, 74, -108, -58, 7, true);   // căn tin
plaque('CĂN TIN', 47.95, 5.4, -83, -PI / 2, 7, 1.4, '#2f6e55');
for (let x = 50; x <= 72; x += 5.5) for (const z of [-116, -142]) solid(x - 0.12, 0, z - 0.12, x + 0.12, 3, z + 0.12, MAT.metal);   // nhà xe
solid(48, 3, -143.5, 74, 3.25, -114.5, lam(0x3d7fc1));
gap('LUỒN DƯỚI MÁI NHÀ XE!', 'cột nhà xe', new THREE.Vector3(61, 2, -129), 18, p => p.x > 48 && p.x < 74 && p.z < -114.5 && p.z > -143.5 && p.y > 1.15 && p.y < 2.85, p => new THREE.Vector3(clamp(Math.round((p.x - 50) / 5.5) * 5.5 + 50, 50, 72), 2, p.z < -129 ? -142 : -116), 60);
for (let r = 0; r < 3; r++) for (let i = 0; i < 22; i++) bikes.push({ x: 49.5 + i * 1.05, z: -121 - r * 8, ry: 0 });
// the opening-day stage against the front wall
solid(14, 0, -43, 44, 1.2, -33, MAT.wood);
solid(14, 1.2, -33.6, 44, 8.5, -33, MAT.red);
put(new THREE.PlaneGeometry(28, 5), signMat(signTex([{ t: 'LỄ KHAI GIẢNG', size: 130 }, { t: 'NĂM HỌC MỚI 2026 – 2027', size: 70, c: '#fff' }], { w: 1024, h: 190, bg: '#b20d24' })), 29, 5, -33.7, { ry: PI, cast: false });
put(new THREE.CylinderGeometry(0.75, 0.75, 1.0, 20), [lam(0xa3201b), lam(0xe8d5a8), lam(0xe8d5a8)], 18, 2.1, -36, { rz: PI / 2 });
phuong(-22, -72, 1); bang(24, -125, 0.9); phuong(-20, -128, 0.9); phuong(34, -70, 0.85);
bench(-22, -78); bench(24, -132); bench(34, -76);
// basketball hoop
solid(14.3, 0, -100.2, 14.7, 3.9, -99.8, MAT.blue);
solid(12.9, 3.0, -101.2, 13.0, 4.3, -98.8, MAT.white);
put(new THREE.TorusGeometry(0.4, 0.04, 6, 20), lam(0xff6a00), 12.45, 3.3, -100, { rx: PI / 2 });
gap('XUYÊN RỔ BÓNG RỔ!', 'bảng rổ', new THREE.Vector3(12.45, 3.3, -100), 2, p => Math.hypot(p.x - 12.45, p.z + 100) < 0.36 && Math.abs(p.y - 3.3) < 0.3, new THREE.Vector3(12.95, 3.6, -100), 250);

// =====================================================================
//  The south courtyard (Phe Đỏ): Nhà Thi Đấu, the warhead store, their football pitch
// =====================================================================
const courtTex = canvasTex(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x += 16) { g.fillStyle = ['#c89458', '#bd8a50', '#d09c60'][(x / 16) % 3]; g.fillRect(x, 0, 15, h); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(80,40,10,0.25)'; g.fillRect(((Math.random() * 16) | 0) * 16, Math.random() * h, 15, 2); }
}, true);
const GYM = { x0: 34, x1: 72, z0: mirZ(-48), z1: mirZ(-132), h: 18 };   // point-mirror of the library
[GYM.z0, GYM.z1] = [Math.min(GYM.z0, GYM.z1), Math.max(GYM.z0, GYM.z1)];
throughHall(GYM.x0, GYM.x1, GYM.z0, GYM.z1, GYM.h, { w: 18, h: 12 },
  { wall: lam(0x8a8f96), roof: lam(0x55595f), floor: lam(0xffffff, { map: rep(courtTex, 6, 14) }), ceil: lam(0x3a3d42), signBg: '#9c1c1c' }, 'NHÀ THI ĐẤU');
{
  const gz = (GYM.z0 + GYM.z1) / 2, seat = lam(0x2f5c8c);
  for (let i = 0; i < 4; i++) solid(GYM.x1 - 0.6 - 8 + 2 * i, 0, GYM.z0 + 12, GYM.x1 - 0.6, 1.6 * (i + 1), GYM.z1 - 12, i % 2 ? seat : lam(0x3d6fa8));   // bleachers
  for (const sx of [GYM.x0 + 4, GYM.x1 - 12]) solid(sx - 0.25, 0, gz - 0.25, sx + 0.25, 9.5, gz + 0.25, MAT.metal);   // volleyball net: under it or over it
  put(new THREE.PlaneGeometry(GYM.x1 - 12 - GYM.x0 - 4, 2.6), lam(0xffffff, { map: rep(netTex, 7, 1), alphaTest: 0.4, side: THREE.DoubleSide }), (GYM.x0 + GYM.x1 - 8) / 2, 8, gz, { cast: false });
  addBox(GYM.x0 + 4, 6.7, gz - 0.1, GYM.x1 - 12, 9.3, gz + 0.1);
  gap('LUỒN DƯỚI LƯỚI BÓNG CHUYỀN!', 'lưới', new THREE.Vector3((GYM.x0 + GYM.x1 - 8) / 2, 3, gz), 18, p => p.x > GYM.x0 + 4 && p.x < GYM.x1 - 12 && p.y < 6.6 && Math.abs(p.z - gz) < 0.4, new THREE.Vector3((GYM.x0 + GYM.x1 - 8) / 2, 8, gz), 80);
  for (const z of [GYM.z0 + 14, GYM.z1 - 14]) {   // hoops on the long wall
    solid(GYM.x0 + 0.6, 9, z - 1.8, GYM.x0 + 0.8, 12, z + 1.8, MAT.white);
    put(new THREE.TorusGeometry(0.9, 0.07, 6, 24), lam(0xff6a00), GYM.x0 + 1.9, 9.6, z, { rx: PI / 2 });
    gap('XUYÊN RỔ BÓNG RỔ!', 'bảng rổ', new THREE.Vector3(GYM.x0 + 1.9, 9.6, z), 3, p => Math.hypot(p.x - GYM.x0 - 1.9, p.z - z) < 0.8 && Math.abs(p.y - 9.6) < 0.35, new THREE.Vector3(GYM.x0 + 0.7, 10, z), 250);
  }
  for (let z = GYM.z0 + 10; z < GYM.z1 - 6; z += 16) solid(GYM.x0, GYM.h - 1.6, z - 0.5, GYM.x1, GYM.h - 0.6, z + 0.5, lam(0x55595f));   // roof trusses
  put(new THREE.PlaneGeometry(14, 4), signMat(signTex([{ t: 'XANH 0 — ĐỎ 0', size: 120 }], { w: 1024, h: 260, bg: '#111', fg: '#ff5a3c', border: '#444' })), (GYM.x0 + GYM.x1) / 2, 15, GYM.z1 - 0.65, { ry: PI, cast: false });
}
// the warhead store, its wide door facing the back of their lab
const STORE = { x0: -66, x1: -26, z0: -735, z1: -690, h: 9, door: new THREE.Vector3(-46, 3.5, -690) };
{
  const { x0, x1, z0, z1, h } = STORE, wallM = lam(0x8d8f7e), T = 0.5, hz = lam(0xffd23f);
  solid(x0, 0, z0, x0 + T, h, z1, wallM); solid(x1 - T, 0, z0, x1, h, z1, wallM); solid(x0, 0, z0, x1, h, z0 + T, wallM);
  solid(x0, 0, z1 - T, x0 + 4, h, z1, wallM); solid(x1 - 4, 0, z1 - T, x1, h, z1, wallM); solid(x0 + 4, 7, z1 - T, x1 - 4, h, z1, wallM);   // wide door
  solid(x0 - 0.5, h, z0 - 0.5, x1 + 0.5, h + 0.5, z1 + 0.5, lam(0x5f6355));
  radarRects.push([x0, z0, x1, z1]); roofRects.push([x0, z0, x1, z1, h]);
  for (let i = 0; i < 16; i++) solid(x0 + 4 + i * 2, 6.4, z1 - 0.1, x0 + 5 + i * 2, 7, z1 + 0.05, i % 2 ? lam(0x222222) : hz, { collide: false });   // hazard stripes
  put(new THREE.PlaneGeometry(16, 1.6), signMat(signTex(['KHO ĐẦU ĐẠN · CẤM VÀO'], { w: 1024, h: 132, size: 80 })), STORE.door.x, 8.0, z1 + 0.06, { cast: false });
  const body = new THREE.CylinderGeometry(0.42, 0.42, 2.4, 12).rotateX(PI / 2), tip = new THREE.ConeGeometry(0.42, 0.9, 12).rotateX(-PI / 2).translate(0, 0, -1.65);
  const fins = new THREE.BoxGeometry(1.3, 0.06, 0.5).translate(0, 0, 1.1);
  const list = [];
  for (const rx of [x0 + 6, x0 + 13.5, x0 + 21, x0 + 28.5, x0 + 34]) {
    solid(rx - 1.7, 0, z0 + 3, rx + 1.7, 0.5, z1 - 4, MAT.metal, { collide: false });
    addBox(rx - 1.7, 0, z0 + 3, rx + 1.7, 2.2, z1 - 4);
    for (let z = z0 + 5; z < z1 - 5; z += 3.2) for (const [ox, oy] of [[-0.9, 0.95], [0.9, 0.95], [0, 1.75]]) list.push([rx + ox, oy, z]);
  }
  const mk = (geo, color) => { const m = new THREE.InstancedMesh(geo, lam(color), list.length); list.forEach((p, i) => m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...p))); m.castShadow = true; scene.add(m); };
  mk(body, 0x55603a); mk(tip, 0xc8102e); mk(fins, 0x3a3f2a);
}
// their football pitch
const PITCH = new THREE.Vector3(-2, 0.5, -712);
put(new THREE.PlaneGeometry(40, 52), decal(lam(0x4f9a43), 3), PITCH.x, 0.04, PITCH.z, { rx: -PI / 2, cast: false });
for (const gzz of [PITCH.z - 25, PITCH.z + 25]) for (const sx of [-3, 3]) solid(PITCH.x + sx - 0.1, 0, gzz - 0.1, PITCH.x + sx + 0.1, 2.4, gzz + 0.1, MAT.white);
phuong(27, -748, 0.9); bang(-24, mirZ(-125), 0.9); phuong(20, mirZ(-128), 0.9);
bench(27, -742); bench(-24, mirZ(-132));

// =====================================================================
//  The shared schoolyard: trees, benches and games laid out point-symmetrically on both halves
// =====================================================================
for (const s of [1, -1]) {
  const X = x => s * x, Z = z => s > 0 ? z : mirZ(z), ry = r => s > 0 ? r : r + PI;
  phuong(X(-32), Z(-218), 1.1); phuong(X(36), Z(-240), 1); bang(X(-56), Z(-292), 1); bang(X(58), Z(-262), 0.9);
  banyan(X(-38), Z(-338), 1, ry(0.5)); phuong(X(44), Z(-318), 1); bang(X(-12), Z(-275), 0.8);
  bench(X(-32), Z(-224)); bench(X(36), Z(-246)); bench(X(44), Z(-324));
  // volleyball net: fly under it
  const nx0 = Math.min(X(-50), X(-34)), nx1 = Math.max(X(-50), X(-34)), nz = Z(-250);
  for (const x of [nx0, nx1]) solid(x - 0.08, 0, nz - 0.08, x + 0.08, 3.2, nz + 0.08, MAT.metal);
  put(new THREE.PlaneGeometry(14, 1.0), lam(0xffffff, { map: rep(netTex, 4, 1), alphaTest: 0.4, side: THREE.DoubleSide }), (nx0 + nx1) / 2, 2.6, nz, { cast: false });
  addBox(nx0, 2.1, nz - 0.1, nx1, 3.1, nz + 0.1);
  gap('LUỒN DƯỚI LƯỚI BÓNG CHUYỀN!', 'lưới', new THREE.Vector3((nx0 + nx1) / 2, 1, nz), 9, p => p.x > nx0 && p.x < nx1 && p.y < 2.05 && Math.abs(p.z - nz) < 0.35, new THREE.Vector3((nx0 + nx1) / 2, 2.6, nz), 80);
  // the festival gate arch over the walk to the Giếng Trời
  const az = Z(-345);
  for (const sx of [-1, 1]) { solid(sx * 7 - 0.25, 0, az - 0.25, sx * 7 + 0.25, 9.6, az + 0.25, s > 0 ? MAT.blue : MAT.red); put(new THREE.SphereGeometry(0.35, 10, 8), lam(0xffd93b), sx * 7, 9.9, az); }
  const gb = put(new THREE.PlaneGeometry(14, 2), signMat(signTex([s > 0 ? 'HỘI KHOẺ PHÙ ĐỔNG · PHE XANH' : 'HỘI KHOẺ PHÙ ĐỔNG · PHE ĐỎ'], { w: 1024, h: 140, size: 70, bg: s > 0 ? '#1d4fa3' : '#b20d24' })), 0, 8.4, az, { cast: false });
  gb.material.side = THREE.DoubleSide;
  addBox(-7, 7.4, az - 0.1, 7, 9.4, az + 0.1);
  gap('XUYÊN CỔNG HỘI KHOẺ!', 'cổng', new THREE.Vector3(0, 4, az), 8, p => Math.abs(p.x) < 6.7 && p.y < 7.3 && Math.abs(p.z - az) < 0.5, new THREE.Vector3(6.9, 4, az), 40);
}

for (const k of Object.keys(staticStudents)) instances(GEO[k], vcMat, staticStudents[k]);
instances(GEO.bike, vcMat, bikes);
instances(GEO.scooter, vcMat, scooters);
instances(GEO.bench, vcMat, benches);
instances(new THREE.IcosahedronGeometry(0.24, 0), lam(0xffffff, { emissive: 0x551100 }), flowerList, false);
instances(new THREE.IcosahedronGeometry(1, 1), lam(0xffffff, { flatShading: true }), leafBits, true);
instances(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), rootBits, true);
instances(new THREE.PlaneGeometry(0.16, 0.12), lam(0xffffff, { side: THREE.DoubleSide }), petalList.map(p => ({ ...p, color: 0xe8331f })), false);
const shuttle = new THREE.Group();   // (no badminton players, so the shuttlecock is never shown)
const walkers = [];

// =====================================================================
//  Spatial grid for world collision
// =====================================================================
const CELL = 16, grid = new Map(), EMPTY = [];
const gkey = (ix, iz) => (ix + 4096) * 8192 + (iz + 4096);
function gridInsert(item, x0, z0, x1, z1) {
  const m = 3;
  for (let ix = Math.floor((x0 - m) / CELL); ix <= Math.floor((x1 + m) / CELL); ix++)
    for (let iz = Math.floor((z0 - m) / CELL); iz <= Math.floor((z1 + m) / CELL); iz++) {
      const k = gkey(ix, iz); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(item);
    }
}
boxes.forEach(b => gridInsert(b, b.min.x, b.min.z, b.max.x, b.max.z));
ells.forEach(e => gridInsert(e, e.c.x - e.r, e.c.z - e.r, e.c.x + e.r, e.c.z + e.r));
discs.forEach(d => gridInsert(d, d.c.x - d.r, d.c.z - d.r, d.c.x + d.r, d.c.z + d.r));
const cellAt = (x, z) => grid.get(gkey(Math.floor(x / CELL), Math.floor(z / CELL))) || EMPTY;

// True if point p (optionally inflated by margin) is inside world geometry
function pointBlocked(p, margin = 0) {
  if (p.y < 0.2 + margin * 0.3) return true;
  const items = cellAt(p.x, p.z);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.off) continue;
    if (it.t === 0) {
      if (p.x > it.min.x - margin && p.x < it.max.x + margin && p.y > it.min.y - margin && p.y < it.max.y + margin && p.z > it.min.z - margin && p.z < it.max.z + margin) return true;
    } else if (it.t === 1) {
      const dx = p.x - it.c.x, dy = (p.y - it.c.y) / it.sy, dz = p.z - it.c.z, r = it.r + margin;
      if (dx * dx + dy * dy + dz * dz < r * r) return true;
    } else {
      const dx = p.x - it.c.x, dz = p.z - it.c.z;
      if (dx * dx + dz * dz < (it.r + margin) ** 2 && Math.abs(p.y - it.c.y) < it.th + margin) return true;
    }
  }
  for (const b of dynBoxes) if (p.x > b.min.x - margin && p.x < b.max.x + margin && p.y > b.min.y - margin && p.y < b.max.y + margin && p.z > b.min.z - margin && p.z < b.max.z + margin) return true;
  return false;
}

// Sphere vs world: pushes pos out, returns {n, ground} or null
const _n = new THREE.Vector3(), _d = new THREE.Vector3();
function collideSphere(pos, PR) {
  let hit = null;
  if (pos.y < PR) { pos.y = PR; hit = { n: new THREE.Vector3(0, 1, 0), ground: true }; }
  const items = cellAt(pos.x, pos.z);
  const testBox = (b) => {
    if (pos.x < b.min.x - PR || pos.x > b.max.x + PR || pos.y < b.min.y - PR || pos.y > b.max.y + PR || pos.z < b.min.z - PR || pos.z > b.max.z + PR) return;
    const qx = clamp(pos.x, b.min.x, b.max.x), qy = clamp(pos.y, b.min.y, b.max.y), qz = clamp(pos.z, b.min.z, b.max.z);
    _d.set(pos.x - qx, pos.y - qy, pos.z - qz);
    const l2 = _d.lengthSq();
    if (l2 >= PR * PR) return;
    if (l2 > 1e-8) { const l = Math.sqrt(l2); _n.copy(_d).divideScalar(l); pos.set(qx, qy, qz).addScaledVector(_n, PR); }
    else {
      const pen = [pos.x - b.min.x, b.max.x - pos.x, pos.y - b.min.y, b.max.y - pos.y, pos.z - b.min.z, b.max.z - pos.z];
      let k = 0; for (let j = 1; j < 6; j++) if (pen[j] < pen[k]) k = j;
      _n.set(0, 0, 0); const ax = k >> 1, sgn = k & 1 ? 1 : -1;
      _n.setComponent(ax, sgn);
      pos.setComponent(ax, sgn > 0 ? b.max.getComponent(ax) + PR : b.min.getComponent(ax) - PR);
    }
    hit = { n: _n.clone() };
  };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.off) continue;
    if (it.t === 0) testBox(it);
    else if (it.t === 1) {
      const dx = pos.x - it.c.x, dy = (pos.y - it.c.y) / it.sy, dz = pos.z - it.c.z, r2 = it.r + PR;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r2 * r2) {
        const d = Math.sqrt(d2) || 1e-4, k = r2 / d;
        pos.set(it.c.x + dx * k, it.c.y + dy * k * it.sy, it.c.z + dz * k);
        hit = { n: new THREE.Vector3(dx, dy * it.sy, dz).normalize(), soft: true };
      }
    } else {
      const dx = pos.x - it.c.x, dz = pos.z - it.c.z, dy = pos.y - it.c.y;
      if (dx * dx + dz * dz < (it.r + PR) ** 2 && Math.abs(dy) < it.th + PR) {
        const sg = dy >= 0 ? 1 : -1; pos.y = it.c.y + sg * (it.th + PR);
        hit = { n: new THREE.Vector3(0, sg, 0), fan: true };
      }
    }
  }
  dynBoxes.forEach(testBox);
  return hit;
}

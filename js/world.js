'use strict';
// Máy Bay Giấy · world building helpers, the schoolyard, trees, the rival school, collision grid
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
function classBlock(x0, x1, za, zb, face, name) {
  const z0 = Math.min(za, zb), z1 = Math.max(za, zb), len = z1 - z0, cz = (z0 + z1) / 2;
  building(x0, x1, z0, z1, 14, true, false);
  addBox(x0, 0, z0, x1, 14, z1);
  const fx = face > 0 ? x1 : x0, bx1 = fx + face * 2.8, bl = Math.min(fx, bx1), bh = Math.max(fx, bx1);
  put(new THREE.BoxGeometry(2.8, 0.35, len), MAT.concrete, (fx + bx1) / 2, 7, cz); addBox(bl, 6.82, z0, bh, 7.18, z1);
  put(new THREE.BoxGeometry(2.8, 0.35, len), MAT.concrete, (fx + bx1) / 2, 13.9, cz); addBox(bl, 13.72, z0, bh, 14.08, z1);
  const colGeo = new THREE.CylinderGeometry(0.22, 0.22, 14, 10), colX = bx1 - face * 0.3;
  for (let z = z0 + 1; z <= z1 - 1; z += 6) { put(colGeo, MAT.white, colX, 7, z); addBox(colX - 0.22, 0, z - 0.22, colX + 0.22, 14, z + 0.22); }
  const rm = lam(0xffffff, { map: rep(railTex, len / 2, 1), alphaTest: 0.5, side: THREE.DoubleSide });
  const railX = bx1 - face * 0.1;
  put(new THREE.PlaneGeometry(len, 1.1), rm, railX, 7.7, cz, { ry: PI / 2, cast: false });
  addBox(railX - 0.05, 7.18, z0, railX + 0.05, 8.25, z1);
  gap('LUỒN HÀNH LANG LỚP HỌC!', 'cột hành lang', new THREE.Vector3((bl + bh) / 2, 7, cz), len / 2 + 3,
    p => p.x > bl && p.x < bh && p.z > z0 && p.z < z1 && ((p.y > 0.3 && p.y < 6.6) || (p.y > 8.4 && p.y < 13.5)),
    p => new THREE.Vector3(colX, p.y, clamp(z0 + 1 + Math.round((p.z - z0 - 1) / 6) * 6, z0 + 1, z1 - 1)));
  plaque(name, bx1 + face * 0.05, 12, cz, face > 0 ? PI / 2 : -PI / 2, 7, 1.5);
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
//  WORLD
// =====================================================================
put(new THREE.PlaneGeometry(130, 1000), lam(0xffffff, { map: rep(concreteTex, 130 / 4, 1000 / 4) }), 0, 0, -530, { rx: -PI / 2, cast: false });
put(new THREE.PlaneGeometry(130, 70), lam(0xffffff, { map: rep(asphaltTex, 130 / 8, 70 / 8) }), 0, 0, 5, { rx: -PI / 2, cast: false });
put(new THREE.PlaneGeometry(2000, 2200), lam(0x7d8467), 0, -0.05, -500, { rx: -PI / 2, cast: false });
const decal = (m, k) => Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -k * 2 });
for (let x = -60; x < 60; x += 8) put(new THREE.PlaneGeometry(4, 0.25), decal(lam(0xf2f2f2), 2), x, 0.02, 18, { rx: -PI / 2, cast: false });
put(new THREE.PlaneGeometry(10, 320), decal(lam(0xffffff, { map: rep(tileTex, 5, 160) }), 2), 0, 0.02, -480, { rx: -PI / 2, cast: false });
// neighbourhood streets
for (const sx of [-1, 1]) for (const x of [84, 107, 130]) put(new THREE.PlaneGeometry(6, 1240), decal(lam(0xffffff, { map: rep(asphaltTex, 1, 150) }), 1), sx * x, 0.01, -500, { rx: -PI / 2, cast: false });

const wallMat = lam(0xf0c75a), capMat = lam(0xb4472a);
for (const sx of [-1, 1]) {
  solid(sx * 60 - 0.5, 0, -30, sx * 60 + 0.5, 3.2, -1030, wallMat);
  solid(sx * 60 - 0.7, 3.2, -30, sx * 60 + 0.7, 3.5, -1030, capMat, { collide: false });
}
solid(-60, 0, -1030, 60, 4, -1031, wallMat);

// ---- School gate ----
const railMatCache = (n) => lam(0xffffff, { map: rep(railTex, n, 1), alphaTest: 0.5, side: THREE.DoubleSide });
for (const sx of [-1, 1]) {
  solid(sx * 7.5 - 0.7, 0, -30.7, sx * 7.5 + 0.7, 10, -29.3, MAT.cream);
  solid(sx * 7.5 - 0.9, 10, -30.9, sx * 7.5 + 0.9, 10.5, -29.1, capMat, { collide: false });
  solid(sx * 8.2, 0, -30.25, sx * 60, 2.1, -29.75, wallMat);
  solid(sx * 8.2, 2.1, -30.35, sx * 60, 2.3, -29.65, capMat, { collide: false });
  addBox(sx * 8.2, 2.3, -30.1, sx * 60, 3.4, -29.9);
  put(new THREE.PlaneGeometry(51.8, 1.1), railMatCache(26), sx * 34.1, 2.85, -30, { cast: false });
  put(new THREE.PlaneGeometry(5, 3.2), lam(0x2f6fb5, { map: rep(railTex, 3, 3), alphaTest: 0.5, side: THREE.DoubleSide }), sx * 10.8, 1.6, -30.6, { cast: false });
}
solid(-8.4, 8.6, -30.4, 8.4, 11.2, -29.6, MAT.blue);
put(new THREE.PlaneGeometry(16.4, 2.5), signMat(signTex([{ t: 'TRƯỜNG THCS GIẤY BAY', size: 120 }, { t: '★ Năm học 2026 – 2027 ★', size: 60, c: '#ffffff' }],
  { w: 1024, h: 160, bg: '#1d4fa3', border: '#ffd93b' })), 0, 9.9, -29.58, { cast: false });

student(15, -10, -PI / 2, 'vendor');
solid(16, 0, -12, 18.2, 1.1, -9, MAT.metal);
solid(16, 1.1, -12, 18.2, 2.1, -9, lam(0xbfe6f2, { transparent: true, opacity: 0.55 }), { collide: false });
put(new THREE.PlaneGeometry(2.6, 0.6), signMat(signTex(['BÁNH MÌ'], { w: 512, h: 120, bg: '#ffd93b', fg: '#c8102e', border: '#c8102e' })), 15.98, 1.6, -10.5, { ry: -PI / 2, cast: false });
put(new THREE.ConeGeometry(2.2, 0.8, 10), lam(0xe23b3b), 17, 3.2, -10.5);
put(new THREE.CylinderGeometry(0.05, 0.05, 3), MAT.metal, 17, 1.5, -10.5);
addBox(14.9, 2.8, -12.7, 19.2, 3.6, -8.3);
for (let i = 0; i < 6; i++) scooters.push({ x: -14 - i * 1.4, z: -24, ry: 0.2 });
for (let i = 0; i < 4; i++) scooters.push({ x: 24 + i * 1.4, z: -24, ry: -0.2 });
student(-22, -20, 0.5, 'girl'); student(-23, -21, 2.5, 'boy'); student(26, -18, -1, 'boy');

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
poleLine([-70, -40, -10, 20, 50, 80].map(x => ({ x, z: 24 })));
for (const sx of [-1, 1]) poleLine([-20, -110, -200, -290, -380, -470, -560, -650, -740, -830, -920, -1010].map(z => ({ x: sx * 64, z })));

// Neighbourhood tube houses (nhà ống) – instanced, all solid
const houseList = [];
const houseCols = [0xf4d35e, 0x9ad1d4, 0xf7a072, 0xc5e1a5, 0xf2b5d4, 0xffffff, 0xb8c0ff, 0xffd6a5, 0xe8e8e8];
function house(cx, cz, w, d, h, alongZ) {   // w = frontage
  const sx = alongZ ? d : w, sz = alongZ ? w : d;
  houseList.push({ x: cx, y: h / 2, z: cz, sv: new THREE.Vector3(sx, h, sz), color: houseCols[Math.floor(rnd() * houseCols.length)] });
  houseList[houseList.length - 1].box = addBox(cx - sx / 2, 0, cz - sz / 2, cx + sx / 2, h, cz + sz / 2);
}
const tallH = () => rnd() < 0.05 ? R(28, 42) : R(8, 22);
for (const sx of [-1, 1]) for (const base of [67, 87, 110, 133]) for (let z = 30; z > -1036;) {
  const w = R(4, 6.5), d = R(8, 14);
  house(sx * (base + d / 2), z - w / 2, w - 0.25, d, tallH(), true);
  z -= w;
}
for (const zb of [30, 52, 75, 98, 121]) for (let x = -150; x < 150;) { const w = R(4, 6.5), d = R(8, 12); house(x + w / 2, zb + d / 2, w - 0.25, d, tallH(), false); x += w; }
for (const zb of [-1036, -1059, -1082, -1105, -1128]) for (let x = -150; x < 150;) { const w = R(4, 6.5), d = R(8, 12); house(x + w / 2, zb - d / 2, w - 0.25, d, tallH(), false); x += w; }
const houseMesh = instances(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff, { map: houseTex }), houseList, false);
// houses standing where the river and the Red Faction's school go (escort finale): cleared for that chapter only
const rivalSiteHouses = houseList.map((h, i) => ({ h, i })).filter(({ h }) => h.z < -1030 && Math.abs(h.x) < 75);
function setRivalSiteHouses(show) {
  const m4 = new THREE.Matrix4();
  for (const { h, i } of rivalSiteHouses) {
    if (show) m4.compose(_p.set(h.x, h.y, h.z), _q.identity(), h.sv); else m4.makeScale(0, 0, 0);
    houseMesh.setMatrixAt(i, m4); h.box.off = !show;
  }
  houseMesh.instanceMatrix.needsUpdate = true;
}

// Water tower landmark
put(new THREE.CylinderGeometry(0.6, 0.6, 26, 10), MAT.concrete, -100, 13, -480);
put(new THREE.CylinderGeometry(5, 4, 6, 18), lam(0xd9d4c4), -100, 29, -480);
addBox(-105, 0, -485, -95, 32, -475);

// Clouds
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false, emissive: 0xbbbbbb });
const cloudList = [];
for (let i = 0; i < 30; i++) {
  const cx = R(-350, 350), cy = R(125, 170), cz = R(-1200, 200);
  for (let k = 0; k < 5; k++) cloudList.push({ x: cx + R(-18, 18), y: cy + R(-3, 4), z: cz + R(-8, 8), sv: new THREE.Vector3(R(10, 20), R(5, 8), R(8, 14)) });
}
instances(icoGeo, cloudMat, cloudList, false);

// ---- Front yard ----
classBlock(-58, -42, -60, -290, 1, 'NHÀ A');
classBlock(42, 58, -60, -290, -1, 'NHÀ B');
solid(-3.2, 0, -116.8, 3.2, 0.4, -123.2, MAT.stone);
solid(-2.2, 0.4, -117.8, 2.2, 0.8, -122.2, MAT.concrete);
put(new THREE.CylinderGeometry(0.08, 0.14, 16, 10), MAT.metal, 0, 8.8, -120);
put(new THREE.SphereGeometry(0.22, 10, 8), lam(0xffd93b), 0, 16.9, -120);
addBox(-0.3, 0, -120.3, 0.3, 17, -119.7);
// faction flags: our side is the Blue Faction (white paper plane on blue), theirs the Red Faction (black eagle on red)
function paperPlaneMark(g, cx, cy, s, col) {
  g.fillStyle = col; g.beginPath(); g.moveTo(cx + 1.0 * s, cy - 0.45 * s); g.lineTo(cx - 1.0 * s, cy + 0.05 * s); g.lineTo(cx - 0.2 * s, cy + 0.2 * s); g.closePath(); g.fill();
  g.globalAlpha = 0.75; g.beginPath(); g.moveTo(cx + 1.0 * s, cy - 0.45 * s); g.lineTo(cx - 0.2 * s, cy + 0.2 * s); g.lineTo(cx - 0.05 * s, cy + 0.6 * s); g.closePath(); g.fill(); g.globalAlpha = 1;
}
const flagTex = canvasTex(300, 200, (g, w, h) => {
  g.fillStyle = '#1d4fa3'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff'; g.fillRect(0, h - 26, w, 8); g.fillRect(0, 18, w, 8);   // white stripes
  paperPlaneMark(g, w / 2, h / 2, 62, '#ffffff');
});
const flagGeo = new THREE.PlaneGeometry(4.2, 2.8, 18, 8); flagGeo.translate(2.1, 0, 0);
const flagBase = flagGeo.attributes.position.array.slice();
put(flagGeo, lam(0xffffff, { map: flagTex, side: THREE.DoubleSide }), 0.1, 15.2, -120);
gap('XUYÊN QUA LÁ CỜ!', 'cột cờ', new THREE.Vector3(2, 15, -120), 4, p => p.x > 0.2 && p.x < 4.3 && p.y > 13.8 && p.y < 16.6 && Math.abs(p.z + 120) < 0.35, new THREE.Vector3(0, 15, -120), 80);
for (const sx of [-1, 1]) for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) student(sx * (13 + r * 2.2), -113 - c * 3, sx > 0 ? PI / 2 : -PI / 2);
student(-6, -126, PI / 2 + 0.3, 'teacher');
phuong(18, -70, 1); phuong(-20, -95, 1.1); phuong(28, -150, 1); bang(-14, -190, 1);
phuong(16, -232, 1.1); bang(-28, -262, 1); banyan(3, -205, 1, 0); banyan(-29, -142, 0.9, 0.5); phuong(-34, -48, 0.9); phuong(34, -280, 0.9); bang(35, -110, 0.9);
bench(18, -76); bench(-20, -101.5); bench(28, -156); bench(16, -238.5); bench(-14, -196);
for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) bikes.push({ x: -36 + i * 0.9, z: -40 - r * 2.2, ry: 0 });
student(10, -60, 2.5); student(11, -61, -1); student(-10, -230, 1); student(-11, -231, 3); student(24, -200, 0); student(25, -201, 2);
solid(-11.5, 0, -311.5, -11.2, 2.4, -311.2, MAT.wood); solid(-8.3, 0, -311.5, -8.0, 2.4, -311.2, MAT.wood);
solid(-11.5, 2.4, -311.6, -8.0, 2.6, -311.1, MAT.wood, { collide: false });
put(new THREE.CylinderGeometry(0.75, 0.75, 1.0, 20), [lam(0xa3201b), lam(0xe8d5a8), lam(0xe8d5a8)], -9.75, 1.7, -311.35, { rz: PI / 2 });
solid(9, 0, -315.2, 9.2, 2.9, -314.9, MAT.wood); solid(13.8, 0, -315.2, 14, 2.9, -314.9, MAT.wood);
solid(8.9, 1.2, -315.3, 14.1, 3.2, -315.0, MAT.wood);
put(new THREE.PlaneGeometry(5, 1.8), signMat(signTex([{ t: 'BẢNG TIN', size: 80 }, { t: 'Thời khoá biểu · Nội quy', size: 40, c: '#222' }], { w: 512, h: 190, bg: '#f4f1e4', fg: '#c8102e', border: '#2f6e55' })), 11.5, 2.2, -314.98, { cast: false });

// ---- Main hall building with the corridor ----
building(-15, -5, HALL_Z0, HALL_Z1, 14, null);
building(5, 15, HALL_Z0, HALL_Z1, 14, null);
put(new THREE.BoxGeometry(10, 6, 320), MAT.yellow, 0, 11, -480);
addBox(-5, 8, HALL_Z0, 5, 14, HALL_Z1);
gableRoof(-15, 15, HALL_Z0, HALL_Z1, 14, 5, true);
building(-60, -15, HALL_Z0 - 25, HALL_Z0, 14, false);
building(15, 60, HALL_Z0 - 25, HALL_Z0, 14, false);
building(-60, -15, HALL_Z1, HALL_Z1 + 25, 14, false);
building(15, 60, HALL_Z1, HALL_Z1 + 25, 14, false);
for (const z of [HALL_Z0, HALL_Z1]) {
  const dz = z === HALL_Z0 ? 1 : -1;
  for (const sx of [-1, 1]) solid(sx * 5.9 - 0.6, 0, z, sx * 5.9 + 0.6, 14, z + dz * 0.7, MAT.cream);
  solid(-6.5, 8, z, 6.5, 8.6, z + dz * 0.8, MAT.cream);
}
put(new THREE.PlaneGeometry(10.4, 2.2), signMat(signTex(['TIÊN HỌC LỄ – HẬU HỌC VĂN'], { w: 1024, h: 170, size: 100 })), 0, 10.6, HALL_Z0 + 0.05, { cast: false });
put(new THREE.PlaneGeometry(10.4, 2.2), signMat(signTex(['VÌ NGÀY MAI LẬP NGHIỆP'], { w: 1024, h: 170, size: 100 })), 0, 10.6, HALL_Z1 - 0.05, { ry: PI, cast: false });
plaque('NHÀ HIỆU BỘ', -37, 11, HALL_Z0 + 0.05, 0, 9, 1.5, '#1d4fa3');
plaque('THƯ VIỆN', 37, 11, HALL_Z0 + 0.05, 0, 9, 1.5, '#1d4fa3');
const corrMat = lam(0xffffff, { map: rep(corrTex, 32, 1) });
put(new THREE.PlaneGeometry(320, 8), corrMat, -4.95, 4, -480, { ry: PI / 2, cast: false });
put(new THREE.PlaneGeometry(320, 8), corrMat, 4.95, 4, -480, { ry: -PI / 2, cast: false });
put(new THREE.PlaneGeometry(10, 320), lam(0xffffff, { map: rep(ceilTex, 5, 160) }), 0, 7.95, -480, { rx: PI / 2, cast: false });
const tubes = [];
for (let z = HALL_Z0 - 6; z > HALL_Z1 + 3; z -= 10) for (const x of [-2.6, 2.6]) tubes.push({ x, y: 7.9, z });
instances(BOX(0.14, 0.08, 1.3), MAT.emissive, tubes, false);
const grades = ['6', '7', '8', '9'];
for (let i = 0; i < 32; i++) for (const side of [-1, 1]) {
  const z = side < 0 ? HALL_Z0 - 10 * i - 2.2 : HALL_Z1 + 10 * i + 2.2;
  const tex = signTex([`Lớp ${grades[Math.floor(i / 8)]}${side < 0 ? 'A' : 'B'}${i % 8 + 1}`], { w: 256, h: 112, bg: '#1d4fa3', fg: '#fff', border: '#fff', size: 64 });
  const sm = lam(0xffffff, { map: tex });
  const x = side * 4.5;
  put(BOX(0.9, 0.45, 0.06), [MAT.wood, MAT.wood, MAT.wood, MAT.wood, sm, sm], x, 3.55, z, { cast: false });
  addBox(x - 0.45, 3.3, z - 0.05, x + 0.45, 3.8, z + 0.05);
}
for (const [x, z] of [[-4.3, -350], [4.3, -395], [-4.3, -452], [4.3, -515], [-4.3, -568], [4.3, -625]]) {
  put(new THREE.CylinderGeometry(0.4, 0.3, 0.7, 12), lam(0x9b4a2c), x, 0.35, z);
  const b = put(icoGeo, leafMats[1], x, 1.2, z); b.scale.set(0.6, 0.7, 0.6);
  addBox(x - 0.5, 0, z - 0.5, x + 0.5, 1.8, z + 0.5);
}
const fans = [];
const bladeGeo = BOX(1.7, 0.03, 0.26); bladeGeo.translate(0.95, 0, 0);
for (const z of [-365, -410, -470, -530, -615]) {
  put(new THREE.CylinderGeometry(0.04, 0.04, 0.8), MAT.metal, 0, 7.55, z, { cast: false });
  const hub = new THREE.Group(); hub.position.set(0, 7.0, z); scene.add(hub);
  put(new THREE.CylinderGeometry(0.22, 0.18, 0.2, 14), lam(0xdedede), 0, 0, 0, { parent: hub });
  for (let k = 0; k < 3; k++) { const b = put(bladeGeo, lam(0xe9e6dc), 0, 0, 0, { parent: hub }); b.rotation.y = k * PI * 2 / 3; }
  fans.push(hub);
  discs.push({ t: 2, c: new THREE.Vector3(0, 7.0, z), r: 1.85, th: 0.15 });
}
function hallBanner(z, text) {
  put(new THREE.PlaneGeometry(9.9, 1.9), signMat(signTex([text], { w: 1024, h: 200, size: 80 })), 0, 6.95, z, { cast: false });
  put(new THREE.PlaneGeometry(9.9, 1.9), signMat(signTex([text], { w: 1024, h: 200, size: 80 })), 0, 6.95, z - 0.02, { ry: PI, cast: false });
  addBox(-5, 6.0, z - 0.1, 5, 8, z + 0.1);
}
hallBanner(-445, 'CHÀO MỪNG NGÀY NHÀ GIÁO VIỆT NAM 20-11');
gap('LAO VÀO HÀNH LANG!', 'tường', new THREE.Vector3(0, 4, HALL_Z0), 8, p => Math.abs(p.x) < 5 && p.y < 8 && Math.abs(p.z - HALL_Z0) < 0.7, new THREE.Vector3(5.9, 4, HALL_Z0), 60);
gap('LAO RA SÂN SAU!', 'tường', new THREE.Vector3(0, 4, HALL_Z1), 8, p => Math.abs(p.x) < 5 && p.y < 8 && Math.abs(p.z - HALL_Z1) < 0.7, new THREE.Vector3(5.9, 4, HALL_Z1), 60);
gap('LUỒN DƯỚI BĂNG RÔN!', 'băng rôn', new THREE.Vector3(0, 4, -445), 6, p => Math.abs(p.x) < 5 && p.y < 5.9 && Math.abs(p.z + 445) < 0.4, new THREE.Vector3(0, 6.9, -445), 40);
hallBanner(-590, 'THI ĐUA DẠY TỐT – HỌC TỐT');
const walkers = [];
function walker(z, kind, phase, speed) {}   // no people walking the corridor
walker(-485, 'boy', 0, 0.7); walker(-487, 'girl', 2.2, 0.55); walker(-572, 'teacher', 1, 0.45); walker(-575, 'boy', 4, 0.8);

// ---- Back yard ----
classBlock(-58, -42, -680, -960, 1, 'NHÀ C');
classBlock(42, 58, -890, -990, -1, 'CĂN TIN');
for (let x = 30; x <= 50; x += 5) for (const z of [-660, -700]) solid(x - 0.12, 0, z - 0.12, x + 0.12, 3, z + 0.12, MAT.metal);
solid(29, 3, -658.5, 51, 3.25, -701.5, lam(0x3d7fc1));
gap('LUỒN DƯỚI MÁI NHÀ XE!', 'cột nhà xe', new THREE.Vector3(40, 2, -680), 26, p => p.x > 29 && p.x < 51 && p.z < -658.5 && p.z > -701.5 && p.y > 1.15 && p.y < 2.85, p => new THREE.Vector3(clamp(Math.round(p.x / 5) * 5, 30, 50), 2, p.z < -680 ? -700 : -660), 60);
for (let r = 0; r < 4; r++) for (let i = 0; i < 18; i++) bikes.push({ x: 31 + i * 1.05, z: -665 - r * 9, ry: 0 });
phuong(0, -760, 1.3); phuong(30, -742, 1); phuong(-30, -720, 1); bang(-28, -880, 1.1); phuong(26, -935, 1); phuong(-20, -975, 0.9);
bang(32, -800, 0.9);
banyan(-2, -868, 1.1, 0.25);
bench(0, -768.5); bench(30, -748); bench(-30, -726); bench(-28, -886.5);
for (const x of [-22, -8]) solid(x - 0.08, 0, -790.08, x + 0.08, 3.2, -789.92, MAT.metal);
put(new THREE.PlaneGeometry(14, 1.0), lam(0xffffff, { map: rep(netTex, 4, 1), alphaTest: 0.4, side: THREE.DoubleSide }), -15, 2.6, -790, { cast: false });
addBox(-22, 2.1, -790.1, -8, 3.1, -789.9);
gap('LUỒN DƯỚI LƯỚI BÓNG CHUYỀN!', 'lưới', new THREE.Vector3(-15, 1, -790), 9, p => p.x > -22 && p.x < -8 && p.y < 2.05 && Math.abs(p.z + 790) < 0.35, new THREE.Vector3(-15, 2.6, -790), 80);
student(-18, -786, 0); student(-12, -794, PI); student(-16, -795, PI);
solid(16.3, 0, -850.2, 16.7, 3.9, -849.8, MAT.blue);
solid(14.9, 3.0, -851.2, 15.0, 4.3, -848.8, MAT.white);
put(new THREE.TorusGeometry(0.4, 0.04, 6, 20), lam(0xff6a00), 14.45, 3.3, -850, { rx: PI / 2 });
gap('XUYÊN RỔ BÓNG RỔ!', 'bảng rổ', new THREE.Vector3(14.45, 3.3, -850), 2, p => Math.hypot(p.x - 14.45, p.z + 850) < 0.36 && Math.abs(p.y - 3.3) < 0.3, new THREE.Vector3(14.95, 3.6, -850), 250);
student(-20, -830, 0); student(-20, -836, PI);
const shuttle = new THREE.Group();
put(new THREE.ConeGeometry(0.1, 0.22, 8), lam(0xff4fa3), 0, 0.1, 0, { parent: shuttle, rx: PI });
put(new THREE.SphereGeometry(0.05, 8, 6), MAT.white, 0, 0, 0, { parent: shuttle });
// (no badminton players, so no shuttlecock either)
student(14, -905, 1); student(15, -906, -2); student(-10, -930, 0.4, 'girl'); student(-11, -931, 2.6);
solid(-15, 0, -1018, 15, 1.2, -1008, MAT.wood);
solid(-15, 1.2, -1018, 15, 8.5, -1017.4, MAT.red);
put(new THREE.PlaneGeometry(28, 5), signMat(signTex([{ t: 'LỄ KHAI GIẢNG', size: 130 }, { t: 'NĂM HỌC MỚI 2026 – 2027', size: 70, c: '#fff' }], { w: 1024, h: 190, bg: '#b20d24' })), 0, 5, -1017.3, { cast: false });
for (const sx of [-1, 1]) {
  solid(sx * 10 - 0.25, 0, -1000.25, sx * 10 + 0.25, 11.6, -999.75, MAT.red);
  put(new THREE.SphereGeometry(0.4, 10, 8), lam(0xffd93b), sx * 10, 11.9, -1000);
}
const gateBanner = put(new THREE.PlaneGeometry(20, 2.6), signMat(signTex(['HỘI KHOẺ PHÙ ĐỔNG 2026'], { w: 1024, h: 140, size: 80 })), 0, 10.2, -1000, { cast: false });
gateBanner.material.side = THREE.DoubleSide;
addBox(-10, 8.9, -1000.1, 10, 11.5, -999.9);
gap('XUYÊN CỔNG HỘI KHOẺ!', 'cổng', new THREE.Vector3(0, 4, -1000), 12, p => Math.abs(p.x) < 9.7 && p.y < 8.8 && Math.abs(p.z + 1000) < 0.5, new THREE.Vector3(9.9, 4, -1000), 40);
put(new THREE.CylinderGeometry(0.75, 0.75, 1.0, 20), [lam(0xa3201b), lam(0xe8d5a8), lam(0xe8d5a8)], -10, 2.1, -1013, { rz: PI / 2 });

for (const k of Object.keys(staticStudents)) instances(GEO[k], vcMat, staticStudents[k]);
instances(GEO.bike, vcMat, bikes);
instances(GEO.scooter, vcMat, scooters);
instances(GEO.bench, vcMat, benches);
instances(new THREE.IcosahedronGeometry(0.24, 0), lam(0xffffff, { emissive: 0x551100 }), flowerList, false);
instances(new THREE.IcosahedronGeometry(1, 1), lam(0xffffff, { flatShading: true }), leafBits, true);
instances(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), rootBits, true);
instances(new THREE.PlaneGeometry(0.16, 0.12), lam(0xffffff, { side: THREE.DoubleSide }), petalList.map(p => ({ ...p, color: 0xe8331f })), false);

// ---- Trường Bên Kia Sông: across the river behind our back wall (escort-mode target) ----
// Everything built here is gathered into rivalGroup and only shown in escort mode.
const _rivalChild0 = scene.children.length, _rivalRect0 = radarRects.length;
put(new THREE.PlaneGeometry(400, 38), decal(lam(0x3f86c8, { emissive: 0x0a2a4a }), 3), 0, 0.03, -1057, { rx: -PI / 2, cast: false });   // the river
for (const sx of [-1, 1]) solid(sx * 2.2 - 0.25, 0, -1076, sx * 2.2 + 0.25, 1.2, -1038, MAT.stone, { collide: false });
put(new THREE.BoxGeometry(5, 0.3, 40), MAT.wood, 0, 1.3, -1057, { cast: false });   // little footbridge
put(new THREE.PlaneGeometry(120, 430), decal(lam(0xffffff, { map: rep(concreteTex, 30, 107) }), 2), 0, 0.02, -1291, { rx: -PI / 2, cast: false });
const rivalMat = lam(0xc9785f), rivalTrim = lam(0x7a2e2e);
function rivalBlock(x0, x1, z0, z1, h) {
  solid(x0, 0, z0, x1, h, z1, rivalMat);
  for (let y = 3; y < h; y += 3.5) put(new THREE.BoxGeometry(Math.abs(x1 - x0) + 0.1, 0.25, Math.abs(z1 - z0) + 0.1), rivalTrim, (x0 + x1) / 2, y, (z0 + z1) / 2, { cast: false });
  gableRoof(x0, x1, Math.min(z0, z1), Math.max(z0, z1), h, 4, Math.abs(z1 - z0) > Math.abs(x1 - x0));
  radarRects.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
}
rivalBlock(-58, -42, -1110, -1290, 14); rivalBlock(42, 58, -1150, -1330, 14); rivalBlock(-40, 40, -1462, -1480, 12);
for (const sx of [-1, 1]) solid(sx * 60 - 0.5, 0, -1080, sx * 60 + 0.5, 3.2, -1500, lam(0x9c4a3a));
solid(-60, 0, -1500, 60, 4, -1501, lam(0x9c4a3a));
put(new THREE.PlaneGeometry(20, 3), signMat(signTex([{ t: 'TRƯỜNG BÊN KIA SÔNG', size: 110 }], { w: 1024, h: 150, bg: '#7a2e2e', fg: '#ffd93b' })), 0, 15.5, -1461.9, { cast: false });
const rivalFlagTex = canvasTex(300, 200, (g, w, h) => {
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a0505'; g.fillRect(0, h - 26, w, 8); g.fillRect(0, 18, w, 8);
  // a black eagle with spread, feathered wings
  g.fillStyle = '#1a0505'; g.beginPath(); g.moveTo(150, 70); g.lineTo(70, 92); g.lineTo(52, 84); g.lineTo(64, 100); g.lineTo(48, 104); g.lineTo(70, 112); g.lineTo(130, 110);
  g.lineTo(140, 150); g.lineTo(150, 136); g.lineTo(160, 150); g.lineTo(170, 110); g.lineTo(230, 112); g.lineTo(252, 104); g.lineTo(236, 100); g.lineTo(248, 84); g.lineTo(230, 92); g.closePath(); g.fill();
  g.beginPath(); g.arc(150, 72, 11, 0, PI * 2); g.fill();
});
solid(-0.15, 0, -1200.15, 0.15, 16, -1199.85, MAT.metal);
const rivalFlag = put(new THREE.PlaneGeometry(4, 2.6), lam(0xffffff, { map: rivalFlagTex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.05 }), 2.1, 14.6, -1200, { cast: false });
put(new THREE.PlaneGeometry(36, 22), decal(lam(0x4f9a43), 3), 18, 0.04, -1390, { rx: -PI / 2, cast: false });   // football pitch
for (const sx of [-1, 1]) solid(18 + sx * 18 - 0.1, 0, -1393, 18 + sx * 18 + 0.1, 2.4, -1387, MAT.white);
const rivalGroup = new THREE.Group();
scene.children.slice(_rivalChild0).forEach(o => rivalGroup.add(o));
scene.add(rivalGroup); rivalGroup.visible = false;
const RIVAL_RECTS = [_rivalRect0, radarRects.length];   // radar outlines that belong to the rival school

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

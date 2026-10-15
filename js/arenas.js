'use strict';
// Máy Bay Giấy · the indoor battlefields: Thư viện, Nhà thi đấu, Giếng trời 5 tầng, Phòng thí nghiệm
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)
// Each hall is a closed room built far beyond the schoolyard (along -z, centred on x = 0, floor at y = 0),
// so the zone / AI / radar code keeps working unchanged; only the hall of the current chapter is shown.

const ARENAS = {};
const ZONE0 = { ...ZONE }, AREA0 = { ...AREA };
// a solid box that was built after the collision grid: register it in the grid by hand
function arenaBox(x0, y0, z0, x1, y1, z1, mat, o = {}) {
  const m = solid(x0, y0, z0, x1, y1, z1, mat, { ...o, collide: false });
  if (o.collide !== false) { const b = addBox(x0, y0, z0, x1, y1, z1); gridInsert(b, b.min.x, b.min.z, b.max.x, b.max.z); }
  return m;
}
// a series of small boxes following a sloped beam (stair flights), so its collision hugs the slope
function slopeBeam(a, b, w, t, mat, n = 10) {
  const len = a.distanceTo(b), m = put(BOX(w, t, len), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.lookAt(b);
  for (let k = 0; k < n; k++) {
    const p = a.clone().lerp(b, (k + 0.5) / n), hl = len / n / 2 + 0.2;
    const bx = addBox(p.x - w / 2, p.y - t, p.z - hl, p.x + w / 2, p.y + t, p.z + hl); gridInsert(bx, bx.min.x, bx.min.z, bx.max.x, bx.max.z);
  }
}
// o: { dz, z0, z1 (local, z0 > z1), hw (half width), h (ceiling), floor, wall, ceil, startY }
function hall(key, o, build) {
  const c0 = scene.children.length;
  const Z0 = o.dz + o.z0, Z1 = o.dz + o.z1, L = Z0 - Z1, cz = (Z0 + Z1) / 2, hw = o.hw, h = o.h;
  put(new THREE.PlaneGeometry(hw * 2, L), o.floor, 0, 0.01, cz, { rx: -PI / 2, cast: false });
  arenaBox(-hw - 1, 0, Z1 - 1, -hw, h, Z0 + 1, o.wall, { cast: false }); arenaBox(hw, 0, Z1 - 1, hw + 1, h, Z0 + 1, o.wall, { cast: false });
  arenaBox(-hw, 0, Z1 - 1, hw, h, Z1, o.wall, { cast: false }); arenaBox(-hw, 0, Z0, hw, h, Z0 + 1, o.wall, { cast: false });
  arenaBox(-hw - 1, h, Z1 - 1, hw + 1, h + 1, Z0 + 1, o.ceil, { cast: false });
  const A = ARENAS[key] = { key, ...o, Z0, Z1, cz, L };
  build(A, (lz) => o.dz + lz);
  A.group = new THREE.Group(); scene.children.slice(c0).forEach(ch => A.group.add(ch)); scene.add(A.group); A.group.visible = false;
}
function setArena(key) {
  const A = key ? ARENAS[key] : null;
  if (curArena) curArena.group.visible = false;
  curArena = A;
  if (A) {
    A.group.visible = true;
    Object.assign(ZONE, { x: A.hw - 1, zMax: A.Z0 - 1, zMin: A.Z1 + 1, y: A.h - 3 });
    Object.assign(AREA, { x: A.hw - 6, zMax: A.Z0 - 6, zMin: A.Z1 + 6, y: A.h - 7 });
  } else { Object.assign(ZONE, ZONE0); Object.assign(AREA, AREA0); }
}
const lightShaftMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const windowMat = (col) => new THREE.MeshBasicMaterial({ color: col, fog: false });

// =====================================================================
//  Thư viện (Chương 2): bookshelves standing like skyscrapers, reading tables down the nave
// =====================================================================
const bookTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3b2414'; g.fillRect(0, 0, w, h);
  const cols = ['#8c2f2f', '#2f5c8c', '#2f7a4a', '#c9a227', '#6b3f8c', '#b5651d', '#e8e0c8', '#1f3b5c', '#a83c5a'];
  for (let row = 0; row < 4; row++) {
    const y0 = row * 64 + 6;
    for (let x = 2; x < w - 4;) {
      const bw = 6 + Math.random() * 12, bh = 40 + Math.random() * 16;
      g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(x, y0 + 56 - bh, bw - 1, bh);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 1, y0 + 56 - bh + 6, bw - 3, 2); g.fillRect(x + 1, y0 + 56 - 12, bw - 3, 2);
      x += bw;
    }
    g.fillStyle = '#5a3820'; g.fillRect(0, y0 + 56, w, 6);
  }
}, true);
const woodFloorTex = canvasTex(256, 256, (g, w, h) => {
  for (let y = 0; y < h; y += 32) for (let x = (y / 32 % 2) * 64; x < w + 128; x += 128) {
    g.fillStyle = ['#a8763f', '#9c6c38', '#b07d44'][((x + y) / 32 | 0) % 3]; g.fillRect(x - 128, y, 127, 31);
  }
  speckle(g, w, h, 1500, 'rgba(60,30,10,0.12)');
}, true);
hall('library', { dz: -2200, z0: -40, z1: -300, hw: 50, h: 40, startY: 10,
  floor: lam(0xffffff, { map: rep(woodFloorTex, 25, 65) }), wall: lam(0x6b4a32), ceil: lam(0xe8dcc2) }, (A, Z) => {
  const shelfSide = lam(0x5a3820), segs = [[-58, -108], [-122, -172], [-186, -236], [-250, -288]];
  for (const x of [-40, -26, -12, 12, 26, 40]) {
    const hgt = Math.abs(x) === 12 ? 18 : 27;
    for (const [a, b] of segs) {
      const len = a - b, face = lam(0xffffff, { map: rep(bookTex, 1, hgt / 8) }), end = lam(0xffffff, { map: rep(bookTex, len / 8, hgt / 8) });
      const m = arenaBox(x - 2, 0, Z(b), x + 2, hgt, Z(a), shelfSide);
      m.material = [end, end, shelfSide, shelfSide, face, face];
      radarRects.push([x - 2, Z(b), x + 2, Z(a)]);
      put(BOX(4.6, 0.6, len + 0.6), shelfSide, x, hgt + 0.3, Z((a + b) / 2));
    }
  }
  // the nave: long reading tables with green lamps, and a globe
  const tableTop = lam(0x7a4a26), lampMat = lam(0x2f7a4a, { emissive: 0x0f3a20 }), glow = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lz of [-70, -100, -130, -200, -230, -260]) {
    arenaBox(-6, 2.6, Z(lz + 6), 6, 3.0, Z(lz - 6), tableTop);
    for (const [sx, sz] of [[-5.5, 5.5], [5.5, 5.5], [-5.5, -5.5], [5.5, -5.5]]) arenaBox(sx - 0.25, 0, Z(lz + sz) - 0.25, sx + 0.25, 2.6, Z(lz + sz) + 0.25, tableTop);
    for (const sx of [-3, 3]) { put(new THREE.ConeGeometry(0.6, 0.6, 12, 1, true), lampMat, sx, 4.1, Z(lz)); put(new THREE.SphereGeometry(0.22, 8, 6), glow, sx, 3.85, Z(lz), { cast: false }); }
  }
  put(new THREE.CylinderGeometry(0.3, 1.2, 6, 10), lam(0x5a3820), 0, 3, Z(-165));
  put(new THREE.SphereGeometry(3.2, 24, 16), lam(0x4a8fc8, { emissive: 0x0a1a2a }), 0, 9.2, Z(-165));
  addBox(-3.2, 0, Z(-165) - 3.2, 3.2, 12.4, Z(-165) + 3.2); gridInsert(boxes[boxes.length - 1], -3.2, Z(-165) - 3.2, 3.2, Z(-165) + 3.2);
  // hanging chandeliers on long cords
  for (const lz of [-90, -150, -215, -270]) {
    put(new THREE.CylinderGeometry(0.05, 0.05, 8), MAT.metal, 0, 36, Z(lz), { cast: false });
    put(new THREE.CylinderGeometry(2.6, 3.4, 1.2, 16), lam(0xc9a227, { emissive: 0x3a2a00 }), 0, 31.6, Z(lz));
    put(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 16), glow, 0, 31, Z(lz), { cast: false });
    arenaBox(-3.4, 31, Z(lz) - 3.4, 3.4, 40, Z(lz) + 3.4, MAT.metal, { collide: true }).visible = false;
  }
  // tall arched windows on the end walls, warm late light
  for (const x of [-30, 0, 30]) put(new THREE.PlaneGeometry(9, 18), windowMat(0xffe0a8), x, 22, A.Z1 + 0.05, { cast: false });
  put(new THREE.PlaneGeometry(36, 3.4), signMat(signTex(['THƯ VIỆN KHU ĐÔNG · GIỮ TRẬT TỰ'], { w: 1024, h: 100, bg: '#5a3820', fg: '#ffd93b', size: 64 })), 0, 34, A.Z1 + 0.06, { cast: false });
});

// =====================================================================
//  Nhà thi đấu (Chương 4): a dark sports hall full of chalk dust, light shafts from the high windows
// =====================================================================
const courtTex = canvasTex(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x += 16) { g.fillStyle = ['#c89458', '#bd8a50', '#d09c60'][(x / 16) % 3]; g.fillRect(x, 0, 15, h); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(80,40,10,0.25)'; g.fillRect(((Math.random() * 16) | 0) * 16, Math.random() * h, 15, 2); }
}, true);
hall('gym', { dz: -2600, z0: -40, z1: -310, hw: 42, h: 48, startY: 14,
  floor: lam(0xffffff, { map: rep(courtTex, 10, 34) }), wall: lam(0x8a8f96), ceil: lam(0x3a3d42) }, (A, Z) => {
  const lineMat = decal(lam(0xf4f4ee), 2);
  const line = (w, d, x, lz) => put(new THREE.PlaneGeometry(w, d), lineMat, x, 0.03, Z(lz), { rx: -PI / 2, cast: false });
  line(60, 0.4, 0, -175); for (const sx of [-1, 1]) line(0.4, 240, sx * 30, -175); line(60, 0.4, 0, -55); line(60, 0.4, 0, -295);
  put(new THREE.RingGeometry(7.6, 8, 40), lineMat, 0, 0.03, Z(-175), { rx: -PI / 2, cast: false });
  // bleachers along the left wall: a stepped stand
  const seat = lam(0x2f5c8c);
  for (let i = 0; i < 6; i++) arenaBox(-42, 0, Z(-70), -42 + 12 - 2 * i, 2 * (i + 1), Z(-280), i % 2 ? seat : lam(0x3d6fa8));
  radarRects.push([-42, Z(-280), -30, Z(-70)]);
  // basketball hoops at both ends (thread the hoop!)
  for (const [lz, s] of [[-50, -1], [-300, 1]]) {
    const z = Z(lz);
    arenaBox(-0.4, 0, z - 0.4 + s * 2, 0.4, 13, z + 0.4 + s * 2, MAT.metal);
    arenaBox(-4, 11, z - 0.2, 4, 15.5, z + 0.2, MAT.white);
    put(new THREE.TorusGeometry(1.3, 0.08, 6, 24), lam(0xff6a00), 0, 11, z + s * 1.5, { rx: PI / 2 });
    gap('XUYÊN RỔ BÓNG RỔ!', 'bảng rổ', new THREE.Vector3(0, 11, z + s * 1.5), 3, p => Math.hypot(p.x, p.z - (z + s * 1.5)) < 1.2 && Math.abs(p.y - 11) < 0.4, new THREE.Vector3(0, 13, z), 250);
  }
  // volleyball net across the middle: fly under it
  for (const sx of [-1, 1]) arenaBox(sx * 20 - 0.3, 0, Z(-175) - 0.3, sx * 20 + 0.3, 9.5, Z(-175) + 0.3, MAT.metal);
  put(new THREE.PlaneGeometry(40, 2.6), lam(0xffffff, { map: rep(netTex, 10, 1), alphaTest: 0.4, side: THREE.DoubleSide }), 0, 8, Z(-175), { cast: false });
  addBox(-20, 6.7, Z(-175) - 0.1, 20, 9.3, Z(-175) + 0.1); gridInsert(boxes[boxes.length - 1], -20, Z(-175) - 0.1, 20, Z(-175) + 0.1);
  gap('LUỒN DƯỚI LƯỚI BÓNG CHUYỀN!', 'lưới', new THREE.Vector3(0, 3, Z(-175)), 22, p => Math.abs(p.x) < 19.6 && p.y < 6.6 && Math.abs(p.z - Z(-175)) < 0.4, new THREE.Vector3(0, 8, Z(-175)), 80);
  // roof trusses, climbing ropes, gymnastic rings
  for (let lz = -58; lz > -300; lz -= 27) arenaBox(-42, 43.5, Z(lz) - 0.6, 42, 45, Z(lz) + 0.6, lam(0x55595f));
  for (const [x, lz] of [[30, -110], [33, -112], [-24, -240], [-21, -238]]) arenaBox(x - 0.12, 20, Z(lz) - 0.12, x + 0.12, 48, Z(lz) + 0.12, lam(0xc9b48a));
  for (const [x, lz] of [[18, -230], [21, -230]]) { put(new THREE.CylinderGeometry(0.04, 0.04, 22), MAT.metal, x, 37, Z(lz), { cast: false }); put(new THREE.TorusGeometry(0.7, 0.1, 6, 18), lam(0xd9c39a), x, 25.4, Z(lz), { ry: PI / 2 }); }
  // high windows on the right wall, each throwing a dusty shaft of light down across the hall
  for (let lz = -70; lz > -300; lz -= 27) {
    put(new THREE.PlaneGeometry(9, 7), windowMat(0xfff4d6), A.hw - 0.05, 39, Z(lz), { ry: -PI / 2, cast: false });
    const s = put(BOX(7, 62, 6), lightShaftMat, A.hw - 18, 22, Z(lz), { cast: false, recv: false }); s.rotation.z = -0.62; s.renderOrder = 2;
  }
  put(new THREE.PlaneGeometry(22, 6), signMat(signTex([{ t: 'XANH 0 — ĐỎ 0', size: 120 }], { w: 1024, h: 260, bg: '#111', fg: '#ff5a3c', border: '#444' })), 0, 30, A.Z1 + 0.06, { cast: false });
  put(new THREE.PlaneGeometry(30, 3), signMat(signTex(['NHÀ THI ĐẤU ĐA NĂNG · KHU ĐÔNG'], { w: 1024, h: 100, bg: '#2a2d33', fg: '#d9d2c0', size: 60 })), 0, 30, A.Z0 - 0.06, { ry: PI, cast: false });
});

// =====================================================================
//  Giếng trời cầu thang 5 tầng (Chương 6): a long skylit well, galleries on five floors, stair flights across the void
// =====================================================================
const glassTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#cfe8f6'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(0, h * 0.7); g.lineTo(w * 0.7, 0); g.lineTo(w * 0.9, 0); g.lineTo(0, h * 0.9); g.fill();
  g.strokeStyle = '#5a6670'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
}, true);
hall('atrium', { dz: -3000, z0: -40, z1: -370, hw: 37, h: 62, startY: 22,
  floor: lam(0xffffff, { map: rep(tileTex, 18, 165) }), wall: lam(0xf1e6c4), ceil: new THREE.MeshBasicMaterial({ map: rep(glassTex, 12, 110), fog: false }) }, (A, Z) => {
  const slab = MAT.concrete, rail = lam(0xffffff, { map: rep(railTex, A.L / 2, 1), alphaTest: 0.5, side: THREE.DoubleSide });
  const floorFace = lam(0xffffff, { map: rep(corrTex, A.L / 10, 1.5) });
  for (const sx of [-1, 1]) {
    // classroom doors on every floor of the side walls
    put(new THREE.PlaneGeometry(A.L, 60), floorFace, sx * (A.hw - 0.05), 30, A.cz, { ry: -sx * PI / 2, cast: false });
    for (let f = 1; f <= 4; f++) {
      const y = f * 12;
      arenaBox(sx * 24, y - 1, A.Z1, sx * A.hw, y, A.Z0, slab, { cast: false });
      put(new THREE.PlaneGeometry(A.L, 1.2), rail, sx * 24, y + 0.6, A.cz, { ry: PI / 2, cast: false });
      addBox(sx * 24 - 0.1, y, A.Z1, sx * 24 + 0.1, y + 1.2, A.Z0); gridInsert(boxes[boxes.length - 1], sx * 24 - 0.1, A.Z1, sx * 24 + 0.1, A.Z0);
      plaque(`TẦNG ${f + 1}`, sx * 24.1, y + 2.6, Z(-55), sx > 0 ? -PI / 2 : PI / 2, 4, 1, '#c8102e');
    }
    radarRects.push([Math.min(sx * 24, sx * A.hw), A.Z1, Math.max(sx * 24, sx * A.hw), A.Z0]);
    for (let lz = -50; lz > -370; lz -= 25) { put(new THREE.CylinderGeometry(0.6, 0.6, 62, 10), MAT.white, sx * 24.6, 31, Z(lz)); addBox(sx * 24.6 - 0.6, 0, Z(lz) - 0.6, sx * 24.6 + 0.6, 62, Z(lz) + 0.6); gridInsert(boxes[boxes.length - 1], sx * 24.6 - 0.6, Z(lz) - 0.6, sx * 24.6 + 0.6, Z(lz) + 0.6); }
  }
  // stair flights zig-zagging across the void, floor to floor
  const stair = lam(0xd8cdb0);
  slopeBeam(new THREE.Vector3(-24, 0.5, Z(-300)), new THREE.Vector3(24, 12, Z(-300)), 4, 0.5, stair);
  slopeBeam(new THREE.Vector3(24, 12, Z(-318)), new THREE.Vector3(-24, 24, Z(-318)), 4, 0.5, stair);
  slopeBeam(new THREE.Vector3(-24, 24, Z(-72)), new THREE.Vector3(24, 36, Z(-72)), 4, 0.5, stair);
  slopeBeam(new THREE.Vector3(24, 36, Z(-54)), new THREE.Vector3(-24, 48, Z(-54)), 4, 0.5, stair);
  const sun = new THREE.MeshBasicMaterial({ color: 0xfffbe8, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let lz = -80; lz > -360; lz -= 60) { const s = put(BOX(14, 70, 10), sun, 6, 30, Z(lz), { cast: false, recv: false }); s.rotation.z = 0.35; s.renderOrder = 2; }
});

// =====================================================================
//  Phòng thí nghiệm (Chương 8): rows of lab benches, glowing flasks, a window wall at dusk...
//  and, under the last bench, the heater that Phe Đỏ's little planes huddle around to dry off
// =====================================================================
const labTileTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#dfe3e2'; g.fillRect(0, 0, w, h); speckle(g, w, h, 600, 'rgba(0,0,0,0.06)');
  g.strokeStyle = '#a9b2b0'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(64, 0); g.lineTo(64, h); g.moveTo(0, 64); g.lineTo(w, 64); g.stroke();
}, true);
hall('lab', { dz: -3400, z0: -40, z1: -230, hw: 46, h: 34, startY: 14,
  floor: lam(0xffffff, { map: rep(labTileTex, 23, 95) }), wall: lam(0xb9d3c4), ceil: lam(0xe9ece8) }, (A, Z) => {
  const top = lam(0x1c1c1f), cab = lam(0xd9cdb0), segs = [[-60, -98], [-114, -152], [-168, -206]];
  for (const x of [-27, -9, 9, 27]) for (const [a, b] of segs) {
    arenaBox(x - 3.5, 7.2, Z(b), x + 3.5, 8, Z(a), top);
    for (const [ex, ez] of [[-3, a - 1], [3, a - 1], [-3, b + 1], [3, b + 1]]) arenaBox(x + ex - 0.35, 0, Z(ez) - 0.35, x + ex + 0.35, 7.2, Z(ez) + 0.35, cab);
    radarRects.push([x - 3.5, Z(b), x + 3.5, Z(a)]);
    gap('LUỒN DƯỚI BÀN THÍ NGHIỆM!', 'chân bàn', new THREE.Vector3(x, 3.5, Z((a + b) / 2)), 22, p => Math.abs(p.x - x) < 2.6 && p.y > 0.4 && p.y < 6.8 && p.z < Z(a) && p.z > Z(b), p => new THREE.Vector3(x + (p.x < x ? -3 : 3), p.y, p.z), 70);
    // flasks and burners on the bench top
    for (let k = 0; k < 5; k++) {
      const fx = x + rr(-2.5, 2.5), fz = Z(lerp(a, b, (k + 0.5) / 5));
      put(new THREE.CylinderGeometry(0.25, 0.9, 1.8, 10), lam([0x6fd0ff, 0x9effa0, 0xff8fc0, 0xffd93b][k % 4], { emissive: [0x0a3a5a, 0x0a4a1a, 0x4a0a2a, 0x4a3a00][k % 4], transparent: true, opacity: 0.8 }), fx, 8.9, fz);
    }
  }
  // shelves of chemicals along the left wall, fume hoods at the far end
  arenaBox(-A.hw, 0, A.Z1 + 4, -A.hw + 4, 22, A.Z0 - 4, lam(0x8a6a4a));
  for (let y = 4; y < 22; y += 4.5) for (let lz = -48; lz > -226; lz -= 3) put(new THREE.CylinderGeometry(0.4, 0.4, 1.8, 8), lam([0xc8102e, 0x2f6fb5, 0xf1c24e, 0x2a9d8f][((lz + y) | 0) & 3]), -A.hw + 4.6, y + 0.9, Z(lz), { cast: false });
  for (const x of [-24, -6, 12, 30]) arenaBox(x - 6, 0, A.Z1, x + 6, 20, A.Z1 + 7, lam(0xcfd6dc));
  // the window wall: dusk outside
  for (let lz = -55; lz > -225; lz -= 22) put(new THREE.PlaneGeometry(16, 14), windowMat(0xf2a07a), A.hw - 0.05, 18, Z(lz), { ry: -PI / 2, cast: false });
  // the heater under the far bench, with Phe Đỏ's little ones huddled round it and wet paper hung up to dry
  const hx = 27, hz = Z(-187);
  put(BOX(2.4, 2.2, 1.6), lam(0x8a3a1a, { emissive: 0xff6a1f, emissiveIntensity: 0.9 }), hx, 1.1, hz);
  put(BOX(2.6, 0.3, 1.8), MAT.metal, hx, 2.35, hz);
  addBox(hx - 1.3, 0, hz - 0.9, hx + 1.3, 2.5, hz + 0.9); gridInsert(boxes[boxes.length - 1], hx - 1.3, hz - 0.9, hx + 1.3, hz + 0.9);
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * PI * 2, m = put(PLANE_GEOS.dart, lam([0xffb3a7, 0xffd6a5, 0xf4f1e6][k % 3], { map: paperTex, side: THREE.DoubleSide }), hx + Math.cos(a) * 2.6, 0.12, hz + Math.sin(a) * 2.2, { cast: false });
    m.scale.setScalar(0.22); m.rotation.y = -a + PI / 2;
  }
  put(new THREE.CylinderGeometry(0.02, 0.02, 6), MAT.metal, hx, 5.2, hz - 2, { rz: PI / 2, cast: false });
  for (let k = 0; k < 5; k++) put(new THREE.PlaneGeometry(0.7, 0.9), lam(0xf4f1e6, { map: paperTex, side: THREE.DoubleSide }), hx - 2.2 + k * 1.1, 4.7, hz - 2, { cast: false });
  A.heater = new THREE.Vector3(hx, 1.5, hz);
  // Nguyên Mẫu Hạc-01: Phe Xanh's giant black crane, circling up under the ceiling with its sphere of matches
  const crane = new THREE.Group();
  crane.add(new THREE.Mesh(PLANE_GEOS.crane, lam(0x1a1a1e, { side: THREE.DoubleSide })), new THREE.LineSegments(PLANE_EDGES.crane, new THREE.LineBasicMaterial({ color: 0x55585e })));
  const ball = new THREE.Mesh(PLANE_GEOS.crumple, lam(0x9b1c14, { flatShading: true })); ball.position.set(0, -0.55, 0); ball.scale.setScalar(0.55); crane.add(ball);
  crane.scale.setScalar(4.2); scene.add(crane); A.crane = crane;
});
// a giant black crane sweeping in low over the flight from behind (Chương 7: Hạc-01 shows itself)
const flyovers = [];
function craneFlyover(from, dir, scale, speed, life = 18) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(PLANE_GEOS.crane, lam(0x1a1a1e, { side: THREE.DoubleSide })), new THREE.LineSegments(PLANE_EDGES.crane, new THREE.LineBasicMaterial({ color: 0x55585e })));
  const ball = new THREE.Mesh(PLANE_GEOS.crumple, lam(0x9b1c14, { flatShading: true })); ball.position.set(0, -0.55, 0); ball.scale.setScalar(0.55); g.add(ball);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(scale); g.position.copy(from); g.quaternion.setFromUnitVectors(FWD, dir.clone().normalize()); scene.add(g);
  flyovers.push({ g, v: dir.clone().normalize().multiplyScalar(speed), life });
  if (AU.ctx) { tone(55, 38, 3, 0.25, 'sawtooth'); noiseHit(AU.ctx.currentTime, 120, 0.5, 3); }
}
function clearFlyovers() { for (const f of flyovers) scene.remove(f.g); flyovers.length = 0; }
// the lab's crane drifts in a slow circle while its hall is shown
function animateArenas(dt) {
  for (let i = flyovers.length - 1; i >= 0; i--) { const f = flyovers[i]; f.life -= dt; f.g.position.addScaledVector(f.v, dt); if (f.life <= 0) { scene.remove(f.g); flyovers.splice(i, 1); } }
  if (curArena !== ARENAS.lab) return;
  const A = ARENAS.lab, a = clock * 0.12;
  A.crane.position.set(Math.cos(a) * 22, 27 + Math.sin(clock * 0.5) * 0.6, A.cz + Math.sin(a) * 55);
  A.crane.rotation.set(0, Math.atan2(Math.sin(a) * 22, -Math.cos(a) * 55), 0.18);   // nose along the circle (forward is -z)
}

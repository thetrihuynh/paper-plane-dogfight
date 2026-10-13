'use strict';
// Máy Bay Giấy · confetti, smoke and fire puffs
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Effects: confetti, smoke/fire puffs
// =====================================================================
const PN = 500;
const pMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.07), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), PN);
pMesh.frustumCulled = false;
const confetti = [];
for (let i = 0; i < PN; i++) { confetti.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), rv: new THREE.Vector3() }); pMesh.setColorAt(i, new THREE.Color(1, 1, 1)); }
scene.add(pMesh);
let pIdx = 0;
const _col = new THREE.Color();
function burst(pos, n, colors, spd = 8, life = 1.4, up = 2) {
  for (let i = 0; i < n; i++) {
    const q = confetti[pIdx]; pMesh.setColorAt(pIdx, _col.set(colors[i % colors.length])); pIdx = (pIdx + 1) % PN;
    q.life = life * rr(0.6, 1.1); q.p.copy(pos);
    q.v.set(rr(-1, 1), rr(-0.5, 1) + up / spd, rr(-1, 1)).normalize().multiplyScalar(spd * rr(0.4, 1));
    q.r.set(rr(0, 6), rr(0, 6), rr(0, 6)); q.rv.set(rr(-8, 8), rr(-8, 8), rr(-8, 8));
  }
  pMesh.instanceColor.needsUpdate = true;
}
function updateConfetti(dt) {
  for (let i = 0; i < PN; i++) {
    const q = confetti[i];
    if (q.life > 0) {
      q.life -= dt; q.v.y -= 6 * dt; q.v.multiplyScalar(1 - 1.5 * dt); q.p.addScaledVector(q.v, dt);
      if (q.p.y < 0.05) { q.p.y = 0.05; q.v.set(0, 0, 0); q.rv.set(0, 0, 0); }
      q.r.x += q.rv.x * dt; q.r.y += q.rv.y * dt; q.r.z += q.rv.z * dt;
      _q.setFromEuler(q.r); _s.setScalar(Math.min(1, q.life * 2)); _m4.compose(q.p, _q, _s);
    } else _m4.makeScale(0, 0, 0);
    pMesh.setMatrixAt(i, _m4);
  }
  pMesh.instanceMatrix.needsUpdate = true;
}
function makePuffPool(mat, max) {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, max);
  mesh.frustumCulled = false;
  const list = [];
  for (let i = 0; i < max; i++) { list.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s0: 1, s1: 1 }); mesh.setColorAt(i, new THREE.Color(1, 1, 1)); mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
  scene.add(mesh);
  return { mesh, list, idx: 0, max, dirtyC: false };
}
const smoke = makePuffPool(lam(0xffffff), 900);
const fire = makePuffPool(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }), 300);
function puff(pool, pos, vel, life, s0, s1, color) {
  const q = pool.list[pool.idx]; pool.mesh.setColorAt(pool.idx, _col.set(color)); pool.idx = (pool.idx + 1) % pool.max; pool.dirtyC = true;
  q.p.copy(pos); q.v.copy(vel); q.life = q.max = life; q.s0 = s0; q.s1 = s1;
}
function updatePuffs(pool, dt, rise) {
  for (let i = 0; i < pool.max; i++) {
    const q = pool.list[i];
    if (q.life <= 0) continue;
    q.life -= dt;
    if (q.life <= 0) { _m4.makeScale(0, 0, 0); pool.mesh.setMatrixAt(i, _m4); continue; }
    q.v.multiplyScalar(1 - 1.8 * dt); q.v.y += rise * dt; q.p.addScaledVector(q.v, dt);
    const a = 1 - q.life / q.max, s = lerp(q.s0, q.s1, Math.sqrt(a)) * (a > 0.7 ? (1 - a) / 0.3 : 1);
    _s.setScalar(s); _q.identity(); _m4.compose(q.p, _q, _s); pool.mesh.setMatrixAt(i, _m4);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
  if (pool.dirtyC) { pool.mesh.instanceColor.needsUpdate = true; pool.dirtyC = false; }
}
const _pv = new THREE.Vector3();
function explosion(pos, s = 1, loud = 1) {
  s *= 0.45;
  for (let i = 0; i < 14; i++) puff(fire, pos, _pv.set(rr(-1, 1), rr(-0.5, 1), rr(-1, 1)).multiplyScalar(9 * s), rr(0.35, 0.7), 0.6 * s, rr(1.6, 2.8) * s, [0xffd23f, 0xff8c1a, 0xff5a1f][i % 3]);
  for (let i = 0; i < 12; i++) puff(smoke, pos, _pv.set(rr(-1, 1), rr(-0.3, 1), rr(-1, 1)).multiplyScalar(6 * s), rr(1.2, 2.4), 0.8 * s, rr(2.2, 3.6) * s, [0x555555, 0x777777, 0x999999][i % 3]);
  boom(pos, loud);
}

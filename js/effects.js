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
// smoke and fire are soft camera-facing sprites, not solid balls: a wispy puff texture (four variants in a 2x2
// atlas), each one turning slowly, fading in fast and thinning out as it spreads. Per-sprite opacity and variant
// ride along as instance attributes, patched into a basic material
const puffTex = (() => {
  const S = 256, H = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * H, oy = (k >> 1) * H;
    g.save(); g.beginPath(); g.rect(ox, oy, H, H); g.clip();
    for (let i = 0; i < 22; i++) {   // lumpy clusters of soft blobs: a billow with a ragged edge
      const a = Math.random() * PI * 2, r = Math.random() * 22, x = ox + 64 + Math.cos(a) * r, y = oy + 64 + Math.sin(a) * r, rad = rr(12, 38);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(255,255,255,${rr(0.18, 0.4)})`); gr.addColorStop(0.55, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(ox, oy, H, H);
    }
    g.globalCompositeOperation = 'destination-in';   // and a soft round falloff so no square edge ever shows
    const m = g.createRadialGradient(ox + 64, oy + 64, 8, ox + 64, oy + 64, 62); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(ox, oy, H, H);
    g.restore();
  }
  return new THREE.CanvasTexture(cv);
})();
function puffMaterial(additive) {
  const m = new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float aAlpha;\nattribute float aVar;\nvarying float vAlpha;\n' + sh.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\n  vMapUv = vMapUv * 0.5 + vec2(mod(aVar, 2.0), floor(aVar / 2.0)) * 0.5;\n  vAlpha = aAlpha;');
    sh.fragmentShader = 'varying float vAlpha;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.a *= vAlpha;');
  };
  return m;
}
function makePuffPool(mat, max, opacity) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4, 2.4), mat, max);
  mesh.frustumCulled = false;
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1), aVar = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  mesh.geometry.setAttribute('aAlpha', aAlpha); mesh.geometry.setAttribute('aVar', aVar);
  const list = [];
  for (let i = 0; i < max; i++) { list.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s0: 1, s1: 1, rot: 0, rs: 0, vis: false }); mesh.setColorAt(i, new THREE.Color(1, 1, 1)); mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
  scene.add(mesh);
  return { mesh, list, idx: 0, max, dirtyC: false, aAlpha, aVar, opacity };
}
const smoke = makePuffPool(puffMaterial(false), 900, 0.62);
const fire = makePuffPool(puffMaterial(true), 300, 1);
function puff(pool, pos, vel, life, s0, s1, color) {
  const i = pool.idx, q = pool.list[i]; pool.mesh.setColorAt(i, _col.set(color)); pool.idx = (i + 1) % pool.max; pool.dirtyC = true;
  q.p.copy(pos); q.v.copy(vel); q.life = q.max = life; q.s0 = s0 * 1.15; q.s1 = s1 * 1.25; q.rot = Math.random() * PI * 2; q.rs = rr(-0.8, 0.8); q.vis = true;
  pool.aVar.array[i] = (Math.random() * 4) | 0; pool.aVar.needsUpdate = true;
}
const _pq = new THREE.Quaternion(), _pz = new THREE.Vector3(0, 0, 1);
function updatePuffs(pool, dt, rise) {
  const A = pool.aAlpha.array, t = clock;
  for (let i = 0; i < pool.max; i++) {
    const q = pool.list[i];
    if (q.life <= 0) { if (q.vis) { q.vis = false; A[i] = 0; _m4.makeScale(0, 0, 0); pool.mesh.setMatrixAt(i, _m4); } continue; }
    q.life -= dt;
    if (q.life <= 0) { q.vis = false; A[i] = 0; _m4.makeScale(0, 0, 0); pool.mesh.setMatrixAt(i, _m4); continue; }
    // drag, buoyancy, and a slow lazy drift so a column of puffs curls instead of stacking straight up
    q.v.multiplyScalar(1 - 1.8 * dt); q.v.y += rise * dt;
    q.v.x += Math.sin(t * 0.9 + i * 1.7) * 0.35 * dt; q.v.z += Math.cos(t * 0.7 + i * 2.3) * 0.35 * dt;
    q.p.addScaledVector(q.v, dt); q.rot += q.rs * dt;
    const a = 1 - q.life / q.max, s = lerp(q.s0, q.s1, Math.sqrt(a));
    A[i] = pool.opacity * Math.min(1, a / 0.08) * Math.pow(1 - a, 1.3);   // pops in, then thins out as it spreads
    _s.setScalar(s); _q.copy(camera.quaternion).multiply(_pq.setFromAxisAngle(_pz, q.rot)); _m4.compose(q.p, _q, _s); pool.mesh.setMatrixAt(i, _m4);
  }
  pool.mesh.instanceMatrix.needsUpdate = true; pool.aAlpha.needsUpdate = true;
  if (pool.dirtyC) { pool.mesh.instanceColor.needsUpdate = true; pool.dirtyC = false; }
}
const _pv = new THREE.Vector3();
function explosion(pos, s = 1, loud = 1) {
  s *= 0.45;
  for (let i = 0; i < 14; i++) puff(fire, pos, _pv.set(rr(-1, 1), rr(-0.5, 1), rr(-1, 1)).multiplyScalar(9 * s), rr(0.35, 0.7), 0.6 * s, rr(1.6, 2.8) * s, [0xffd23f, 0xff8c1a, 0xff5a1f][i % 3]);
  for (let i = 0; i < 12; i++) puff(smoke, pos, _pv.set(rr(-1, 1), rr(-0.3, 1), rr(-1, 1)).multiplyScalar(6 * s), rr(1.2, 2.4), 0.8 * s, rr(2.2, 3.6) * s, [0x555555, 0x777777, 0x999999][i % 3]);
  boom(pos, loud);
}

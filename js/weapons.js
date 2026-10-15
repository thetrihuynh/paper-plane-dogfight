'use strict';
// Máy Bay Giấy · guns, missiles, bombs, supply crates, ring course, flares
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Weapons: guns, missiles, flares
// =====================================================================
const BMAX = 700;
const bMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.025, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }), BMAX);
bMesh.frustumCulled = false;
const bullets = [];
for (let i = 0; i < BMAX; i++) { bullets.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, team: '', owner: null, dmg: 0 }); bMesh.setColorAt(i, _col.set(0xffffff)); bMesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
scene.add(bMesh);
let bIdx = 0;
const TRACER = { blue: 0xfff3a0, red: 0xff4d4d, ally: 0x8fe8ff };
const _bp = new THREE.Vector3(), _bd = new THREE.Vector3();
function fireGun(f, spread) {
  const fwd = fwdOf(f, _fw), right = rightOf(f, _rt);
  f.gunSide = -f.gunSide;
  _bp.copy(f.pos).addScaledVector(right, 0.45 * f.K.scale * f.gunSide).addScaledVector(fwd, 1.2 * f.K.scale);
  _bd.copy(fwd);
  // gun assist for the player: if the target is close to the nose, bend the stream onto its lead point
  if (f === P && P.target && P.target.alive) {
    const t = P.target, d = t.pos.distanceTo(_bp);
    if (d < 45) {
      const tt = d / BULLET_SPEED;
      _md.copy(t.vel).sub(f.vel).multiplyScalar(tt).add(t.pos).sub(_bp).normalize();
      if (_md.angleTo(fwd) < 0.17) _bd.copy(_md);
    }
  }
  _bd.add(_ax.set(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(spread)).normalize();
  const b = bullets[bIdx]; bMesh.setColorAt(bIdx, _col.set(f === P ? TRACER.blue : f.team === 'blue' ? TRACER.ally : TRACER.red)); bMesh.instanceColor.needsUpdate = true;
  bIdx = (bIdx + 1) % BMAX;
  b.alive = true; b.p.copy(_bp); b.v.copy(_bd).multiplyScalar(BULLET_SPEED).add(f.vel); b.life = 1.0; b.team = f.team; b.owner = f;
  b.dmg = f === P ? 4 * (P.K.gunMul || 1) * (P.rush > 0.5 ? 1.5 : 1) : f.K.gunDmg;   // player dive attack: +50% at high speed
  if (f === P) { stats.shots++; gunSound(); }
  else if (f.pos.distanceToSquared(P.pos) < 900) gunSound(0.35);
}
// a single round from anywhere (turrets): same pool and rules as fireGun
function fireBullet(owner, from, dir, dmg) {
  const b = bullets[bIdx]; bMesh.setColorAt(bIdx, _col.set(owner.team === 'blue' ? TRACER.ally : TRACER.red)); bMesh.instanceColor.needsUpdate = true;
  bIdx = (bIdx + 1) % BMAX;
  b.alive = true; b.p.copy(from); b.v.copy(dir).multiplyScalar(BULLET_SPEED).add(owner.vel); b.life = 1.2; b.team = owner.team; b.owner = owner; b.dmg = dmg;
  if (from.distanceToSquared(P.pos) < 1600) gunSound(0.3);
}
const _a = new THREE.Vector3(), _ab = new THREE.Vector3(), _ac = new THREE.Vector3();
function segHit(a, b, c, r) {
  _ab.subVectors(b, a); _ac.subVectors(c, a);
  const t = clamp(_ac.dot(_ab) / Math.max(1e-6, _ab.lengthSq()), 0, 1);
  return _ac.addScaledVector(_ab, -t).lengthSq() < r * r;
}
const _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(1, 1, 1), _z = new THREE.Vector3(0, 0, 1);
function updateBullets(dt) {
  for (let i = 0; i < BMAX; i++) {
    const b = bullets[i];
    if (!b.alive) continue;
    b.life -= dt;
    _a.copy(b.p); b.p.addScaledVector(b.v, dt); b.v.y -= 2 * dt;
    let dead = b.life <= 0;
    if (!dead) for (const f of flyers) {
      if (!f.alive || f.team === b.team) continue;
      if (segHit(_a, b.p, f.pos, f.K.hitR * (f.evadeT > 0 ? 0.35 : 1) * (b.owner === P ? 1.7 : 1))) {
        // your guns: hits from behind tear more paper, head-on passes much less (sitting on the tail pays)
        let mult = 1;
        if (b.owner === P) { const asp = _tmp.copy(b.v).normalize().dot(fwdOf(f, _tmp2)); mult = asp > 0.5 ? 1.4 : asp < -0.5 ? 0.55 : 1; }
        damage(f, b.dmg * mult, b.owner);
        if (b.owner === P) stats.hits++;
        burst(b.p, 3, [f.colorHex, 0xffffff], 1.5, 0.6, 0.5);
        dead = true; break;
      }
    }
    if (!dead && b.owner && b.owner.team === 'blue' && gameMode === 'escort') for (const u of groundUnits) if (u.alive && segHit(_a, b.p, u.pos, 1.5)) {
      damageGround(u, b.dmg); burst(b.p, 3, [0xffc040, 0x555555], 2, 0.5, 0.5); dead = true; break;
    }
    if (!dead && b.owner === P) for (const bm of bombs) if (bm.alive && segHit(_a, b.p, bm.p, 0.55)) {
      bm.alive = false; scene.remove(bm.mesh); splash(bm.p, false); score += 30; popup('BẮN VỠ BOM NƯỚC +30', '#7fb8ff'); dead = true; break;
    }
    if (!dead && pointBlocked(b.p)) { dead = true; puff(smoke, b.p, _pv.set(0, 0.4, 0), 0.5, 0.05, 0.25, 0xcfc6b0); }
    if (dead) { b.alive = false; _m4.makeScale(0, 0, 0); }
    else { _bq.setFromUnitVectors(_z, _bd.copy(b.v).normalize()); _m4.compose(b.p, _bq, _bs); }
    bMesh.setMatrixAt(i, _m4);
  }
  bMesh.instanceMatrix.needsUpdate = true;
}

const missiles = [];
const mslMat = lam(0xffffff, { vertexColors: true });
function launchMissile(f, target) {
  const fwd = fwdOf(f, _fw).clone(), down = upOf(f, _rt).clone().negate(), right = rightOf(f, _ax).clone();
  f.gunSide = -f.gunSide;
  const m = {
    p: f.pos.clone().addScaledVector(down, 0.5 * f.K.scale).addScaledVector(right, 0.35 * f.gunSide), dir: fwd, speed: f.speed + 2,
    target, team: f.team, owner: f, life: 7, alive: true, armed: 0.25, mesh: new THREE.Mesh(GEO.missile, mslMat), puffD: 0,
    vel: new THREE.Vector3(), turn: f === P ? 3.2 : (f.K.mslTurn || 1.9), vmax: f === P ? 21 : (f.K.mslSpeed || 17.5), dmg: f === P ? 60 : (f.K.mslDmg || 34), flareChecked: false,
  };
  m.mesh.castShadow = true; m.mesh.scale.setScalar(0.35); scene.add(m.mesh);
  missiles.push(m);
  launchSound(f === P ? 1 : clamp(1 - f.pos.distanceTo(P.pos) / 150, 0.1, 1));
  if (f === P) stats.msl++;
  if (target === P) radioOnce('mslWarn', 'Bảng Đen', 'Tên lửa đang bám theo cậu! Bẻ lái gắt hoặc thả pháo sáng (V)!', 12);
  return m;
}
function explodeMissile(m) {
  m.alive = false; scene.remove(m.mesh);
  explosion(m.p, 0.8, 0.8);
  let killed = null;
  for (const f of flyers) {
    if (!f.alive || f.team === m.team) continue;
    const d = f.pos.distanceTo(m.p);
    if (d < 1.2 + f.K.hitR) { damage(f, m.dmg * (d < 0.6 + f.K.hitR ? 1 : 0.5), m.owner); if (!f.alive && m.owner === P) killed = f; }
  }
  if (gameMode === 'escort' && m.team === 'blue') for (const u of groundUnits) if (u.alive && u.pos.distanceTo(m.p) < 4) damageGround(u, m.dmg);
  if (killed) startCine('kill', { subject: killed, dir: m.dir, dur: 1.4, ts: 0.25, cd: 2.5 });
  else if (m.target && m.target.isPoint && m.team === 'red') startCine('strike', { subject: { pos: m.p.clone() }, dir: m.dir, dur: 1.0, ts: 0.3, cd: 2, label: `TÊN LỬA ĐÂM VÀO ${m.target.name.toUpperCase()}!` });
}
const _md = new THREE.Vector3(), _lead = new THREE.Vector3();
function updateMissiles(dt) {
  for (const m of missiles) {
    if (!m.alive) continue;
    m.life -= dt; m.armed -= dt;
    const t = m.target;
    if (t && t.alive) {
      const d = t.pos.distanceTo(m.p);
      _lead.copy(t.vel || _md.set(0, 0, 0)).multiplyScalar(Math.min(1.5, d / Math.max(12, m.speed))).add(t.pos);
      _md.subVectors(_lead, m.p).normalize();
      const ang = m.dir.angleTo(_md);
      if (ang > 1.4) { m.target = null; if (m.owner === P && t.K) popup('ĐỊCH NÉ ĐƯỢC TÊN LỬA!', '#cfcfcf'); }   // overshot: lost lock
      else if (ang > 1e-4) {
        const step = Math.min(1, m.turn * dt / ang);
        m.dir.lerp(_md, step).normalize();
      }
      if (d < 0.6 + (t.K ? t.K.hitR * 0.6 : 0.3) && m.armed <= 0) { explodeMissile(m); continue; }
    } else if (t && !t.alive) m.target = null;
    m.speed = Math.min(m.vmax, m.speed + 12 * dt);   // enemy missiles are usually a little slower: dodgeable
    m.vel.copy(m.dir).multiplyScalar(m.speed);
    m.p.addScaledVector(m.vel, dt);
    m.mesh.position.copy(m.p); m.mesh.quaternion.setFromUnitVectors(FWD, m.dir);
    m.puffD += m.speed * dt;
    while (m.puffD > 0.18) {
      m.puffD -= 0.18;
      _pv.copy(m.p).addScaledVector(m.dir, -m.puffD - 0.22);
      // thin pencil-line trail; skipped right around the player so it never hides the plane
      if (!P || _pv.distanceToSquared(P.pos) > 2.5 * 2.5) puff(smoke, _pv, _md.set(rr(-0.02, 0.02), rr(0, 0.03), rr(-0.02, 0.02)), rr(0.45, 0.65), 0.012, 0.05, 0xeeeeee);
    }
    if (Math.random() < 0.5) puff(fire, _pv.copy(m.p).addScaledVector(m.dir, -0.25), _md.set(0, 0, 0), 0.08, 0.09, 0.04, 0xffc040);
    if (m.life <= 0 || (m.armed <= 0 && pointBlocked(m.p))) { explodeMissile(m); continue; }
    // proximity fuse against any enemy
    for (const f of flyers) if (f.alive && f.team !== m.team && m.armed <= 0 && f.pos.distanceToSquared(m.p) < (0.5 + f.K.hitR * 0.5) ** 2) { explodeMissile(m); break; }
  }
  for (let i = missiles.length - 1; i >= 0; i--) if (!missiles[i].alive) missiles.splice(i, 1);
}

// ---- water-balloon bombs (Vòng Ống) and the school landmarks they target ----
const bombs = [], objectives = [];
const bombGeo = new THREE.SphereGeometry(0.22, 12, 8), bombMat = new THREE.MeshLambertMaterial({ color: 0x3f8cff });
const OBJECTIVE_DEFS = {
  flag: { name: 'Cột cờ', pos: FLAG_BLUE, r: 4.5 },
  roofA: { name: 'Mái Dãy A', pos: new THREE.Vector3(-47, 14, -161), r: 7 },
  roofB: { name: 'Mái Dãy B', pos: new THREE.Vector3(47, 14, -161), r: 7 },
  canteen: { name: 'Mái Căn Tin', pos: new THREE.Vector3(61, 9, -83), r: 7 },
  roofC: { name: 'Mái Thư Viện', pos: new THREE.Vector3(-53, 17, -90), r: 8 },
  stage: { name: 'Sân khấu khai giảng', pos: new THREE.Vector3(29, 8.5, -38), r: 8 },
  library: { name: 'Thư Viện', pos: new THREE.Vector3((LIB.x0 + LIB.x1) / 2, LIB.h + 0.6, (LIB.z0 + LIB.z1) / 2), r: 16 },
};
function setObjectives(keys) {
  objectives.length = 0;
  for (const k of keys || []) { const d = OBJECTIVE_DEFS[k]; objectives.push({ key: k, name: d.name, pos: d.pos, r: d.r, hp: 100, maxHp: 100, alive: true }); }
}
const paperBallMat = new THREE.MeshLambertMaterial({ color: 0xf4f1e6, flatShading: true });
function dropBomb(a, big = 1) {
  const ours = a.team === 'blue';
  const b = { p: a.pos.clone().addScaledVector(DOWN, 0.6), v: a.vel.clone().multiplyScalar(0.8), alive: true, owner: a, mesh: new THREE.Mesh(ours ? PLANE_GEOS.crumple : bombGeo, ours ? paperBallMat : bombMat) };
  if (ours) b.mesh.scale.setScalar(0.7); else b.mesh.scale.setScalar(big);
  b.mesh.castShadow = true; scene.add(b.mesh); bombs.push(b);
  if (AU.ctx && a.pos.distanceTo(P.pos) < 40) tone(900, 300, 0.5, 0.05, 'sine');
}
function splash(p, big) {
  for (let i = 0; i < (big ? 40 : 16); i++) puff(smoke, p, _pv.set(rr(-1, 1), rr(0.3, 1.5), rr(-1, 1)).multiplyScalar(big ? 5 : 3), rr(0.5, 1.1), 0.08, big ? 0.6 : 0.3, [0x3f8cff, 0x8fc4ff, 0xffffff][i % 3]);
  if (AU.ctx) noiseHit(AU.ctx.currentTime, 600, big ? 0.6 : 0.3, 0.4);
}
function updateBombs(dt) {
  for (const b of bombs) {
    if (!b.alive) continue;
    b.v.y -= 9.8 * dt; b.v.multiplyScalar(1 - 0.2 * dt); b.p.addScaledVector(b.v, dt); b.mesh.position.copy(b.p);
    let hit = null;
    if (b.owner.team === 'blue') {   // our paper balls vs the rival school's targets
      b.mesh.rotation.x += dt * 5; b.mesh.rotation.z += dt * 3;
      for (const t of strikeTargets) if (t.alive && Math.hypot(b.p.x - t.pos.x, b.p.z - t.pos.z) < t.r && b.p.y < t.pos.y + 0.8) { hit = t; break; }
      if (hit) { b.alive = false; strikeHit(hit, b.p); }
      else if (b.p.y < 0.2 || pointBlocked(b.p)) { b.alive = false; burst(b.p, 18, [0xf4f1e6, 0xffffff], 4, 1.2, 1.5); }
      if (!b.alive) scene.remove(b.mesh);
      continue;
    }
    for (const o of objectives) if (o.alive && Math.hypot(b.p.x - o.pos.x, b.p.z - o.pos.z) < o.r && b.p.y < o.pos.y + 0.8) { hit = o; break; }
    if (hit) {
      b.alive = false; splash(b.p, true); hit.hp -= 34;
      popup(`${hit.name.toUpperCase()} TRÚNG BOM NƯỚC!`, '#7fb8ff', 1.4);
      if (hit.hp <= 0) objectiveLost(hit);
      else radioOnce('objHit' + hit.key, 'Bảng Đen', `${hit.name} đang bị ném bom! Chặn Vòng Ống lại!`, 8);
    } else if (b.p.y < 0.2 || pointBlocked(b.p)) { b.alive = false; splash(b.p, false); }
    if (!b.alive) scene.remove(b.mesh);
  }
  for (let i = bombs.length - 1; i >= 0; i--) if (!bombs[i].alive) bombs.splice(i, 1);
}
function objectiveLost(o) {
  stats.objLost++;
  o.alive = false; o.hp = 0; splash(o.pos, true); splash(_tmp.copy(o.pos).add(_pv.set(1.5, 0, 1)), true);
  flash('', `${o.name} đã bị phá huỷ!`, 1.8);
  radio('Bảng Đen', `${o.name} ướt sũng rồi! Bảo vệ những chỗ còn lại!`, true);
  if (state === 'play' && o.key === 'library') missionFail('Tàu Mẹ đã ném bom Thư Viện, xưởng gấp máy bay của Phe Xanh…');
  else if (state === 'play' && objectives.every(x => !x.alive)) missionFail('Sân trường đã bị ném bom nước tơi bời…');
}
function missionFail(reason) {
  state = 'dead'; endT = 0; P.failReason = reason;
  if (document.pointerLockElement) document.exitPointerLock();
  flash('NHIỆM VỤ THẤT BẠI', reason, 3);
}
// ---- supply crates: fly through one to reload missiles & flares ----
const pickups = [];
const MSL_MAX = 9, FLR_MAX = 15;
const PICKUP_TYPES = {
  msl:    { label: 'TÊN LỬA', hud: 'TIẾP TẾ', col: '#d62828', ring: 0xffd93b, css: '#ffd93b' },
  repair: { label: 'BĂNG KEO', hud: 'BĂNG KEO +HP', col: '#2a9d4a', ring: 0x5fd35f, css: '#7dff9a' },
  rapid:  { label: 'SÚNG NHANH', hud: 'SÚNG NHANH', col: '#e8590c', ring: 0xff9f1a, css: '#ff9f1a' },
  shield: { label: 'KHIÊN BÌA', hud: 'KHIÊN BÌA', col: '#1d4fa3', ring: 0x6fd0ff, css: '#6fd0ff' },
};
for (const k in PICKUP_TYPES) {
  const T = PICKUP_TYPES[k];
  T.tex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fdfcf6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a9c8ec'; g.lineWidth = 2; for (let y = 14; y < h; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = T.col; g.lineWidth = 8; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = T.col; g.fillRect(52, 26, 24, 54); g.fillRect(37, 41, 54, 24);
    g.font = '800 17px sans-serif'; g.textAlign = 'center'; g.fillText(T.label, 64, 108);
  });
  T.mat = new THREE.MeshLambertMaterial({ map: T.tex, emissive: 0x332200 });
  T.ringMat = new THREE.MeshBasicMaterial({ color: T.ring, transparent: true, opacity: 0.85, fog: false });
  T.beamMat = new THREE.MeshBasicMaterial({ color: T.ring, transparent: true, opacity: 0.22, depthWrite: false, fog: false });
}
const crateGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
const ringGeo = new THREE.TorusGeometry(1.2, 0.06, 6, 28);
const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 40, 8, 1, true).translate(0, 20, 0);
function spawnPickup(pos, why, type = 'msl') {
  const T = PICKUP_TYPES[type];
  const g = new THREE.Group(), box = new THREE.Mesh(crateGeo, T.mat), ring = new THREE.Mesh(ringGeo, T.ringMat), beam = new THREE.Mesh(beamGeo, T.beamMat);
  box.castShadow = true; g.add(box, ring, beam); g.position.copy(pos); scene.add(g);
  const pk = { pos: g.position, base: pos.y, obj: g, box, ring, life: 45, alive: true, why, type };
  pickups.push(pk);
  return pk;
}
function updatePickups(dt) {
  for (const pk of pickups) {
    if (!pk.alive) continue;
    pk.life -= dt;
    pk.pos.y = pk.base + Math.sin(clock * 2 + pk.base) * 0.25;
    pk.box.rotation.y += dt * 1.6; pk.ring.rotation.set(PI / 2 + Math.sin(clock) * 0.3, 0, clock);
    pk.obj.visible = pk.life > 5 || Math.floor(clock * 6) % 2 === 0;   // blink before it vanishes
    if (state === 'play' && P.alive && P.pos.distanceTo(pk.pos) < 2.3) {
      pk.alive = false; stats.pickups++;
      if (pk.type === 'msl') {
        const gm = Math.min(3, MSL_MAX - P.msl), gf = Math.min(3, FLR_MAX - P.flares);
        P.msl += Math.max(0, gm); P.flares += Math.max(0, gf);
        if (P.msl > 0 && P.gunMode && !P.wpnGun) popup('TRỞ LẠI CHẾ ĐỘ TÊN LỬA', LOCKG, 1);
        popup(`TIẾP TẾ: +${Math.max(0, gm)} TÊN LỬA · +${Math.max(0, gf)} PHÁO SÁNG`, '#ffd93b', 1.8);
      } else if (pk.type === 'repair') { const h = Math.min(35, P.maxHp - P.hp); P.hp += h; popup(`BĂNG KEO: +${Math.round(h)} ĐỘ BỀN`, '#7dff9a', 1.8); }
      else if (pk.type === 'rapid') { P.rapidT = 10; P.heat = 0; P.overheat = false; popup('SÚNG NHANH 10 GIÂY — KHÔNG NÓNG!', '#ff9f1a', 1.8); }
      else if (pk.type === 'shield') { P.shieldT = 8; popup('KHIÊN BÌA 8 GIÂY — GIẢM 70% SÁT THƯƠNG', '#6fd0ff', 1.8); }
      burst(pk.pos, 30, [0xffd93b, 0xffffff, 0xd62828], 5, 1.4, 1.5);
      if (AU.ctx) { tone(600, 1200, 0.15, 0.08, 'triangle'); tone(900, 1800, 0.2, 0.07, 'triangle', 0.1); }
    }
    if (pk.life <= 0) pk.alive = false;
    if (!pk.alive) scene.remove(pk.obj);
  }
  for (let i = pickups.length - 1; i >= 0; i--) if (!pickups[i].alive) pickups.splice(i, 1);
  // running low? the school drops a crate somewhere nearby (sooner when completely empty)
  if (state === 'play' && P.alive && P.msl <= 2 && !pickups.some(pk => pk.why === 'drop')) {
    P.supplyT = (P.supplyT || 0) + dt;
    if (P.supplyT >= (P.msl === 0 ? 4 : 10)) {
      P.supplyT = 0;
      spawnPickup(findSpawn(25, 60), 'drop');
      radio('Bảng Đen', 'Đã thả hộp tiếp tế tên lửa! Theo cột sáng vàng mà bay xuyên qua hộp.', true);
    }
  } else P.supplyT = 0;
}

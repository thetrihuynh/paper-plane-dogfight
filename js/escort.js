'use strict';
// Máy Bay Giấy · escort finale: the bomber Hạc Lớn, flak, SAM sites
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  ESCORT MODE: protect the bomber "Hạc Lớn" while it drops paper balls on the rival school,
//  through flak guns and surface-to-air missile sites.
// =====================================================================
let gameMode = 'campaign';
const strikeTargets = [], groundUnits = [], flakShells = [];
const STRIKE_DEFS = [
  { name: 'Sân cờ đối thủ', pos: new THREE.Vector3(0, 0.5, -1200), r: 6 },
  { name: 'Mái Nhà Đỏ', pos: new THREE.Vector3(-50, 14, -1200), r: 7 },
  { name: 'Sân bóng đối thủ', pos: new THREE.Vector3(18, 0.5, -1390), r: 8 },
];
const GROUND_DEFS = [
  ['flak', -24, -1160], ['flak', 30, -1235], ['flak', -20, -1340], ['flak', 32, -1425], ['flak', -6, -1110],
  ['sam', 0, -1300], ['sam', -36, -1440], ['sam', 36, -1100],
];
const gunMetal = lam(0x5a5f55), samMat = lam(0x6b6e3e);
for (const [kind, x, z] of GROUND_DEFS) {   // build the emplacements once (scenery); they only fight in escort mode
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.1, 0.7, 12), MAT.stone); ring.position.y = 0.35; g.add(ring);
  const top = new THREE.Group(); top.position.y = 0.9; g.add(top);
  if (kind === 'flak') {
    top.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), gunMetal));
    for (const sx of [-0.25, 0.25]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), gunMetal); b.rotation.x = -PI / 2; b.position.set(sx, 0.3, -1.1); top.add(b); }
  } else {
    top.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), samMat));
    for (const sx of [-0.45, 0.45]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.4, 10), samMat); t.rotation.x = -PI / 2; t.position.set(sx, 0.5, -0.3); top.add(t); }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.visible = false; scene.add(g);
  { const b = addBox(x - 1.4, 0, z - 1.4, x + 1.4, 2, z + 1.4); gridInsert(b, b.min.x, b.min.z, b.max.x, b.max.z); }   // built after the grid, so register it by hand
  groundUnits.push({ kind, pos: new THREE.Vector3(x, 1.4, z), obj: g, top, hp: 0, maxHp: kind === 'flak' ? 60 : 90, alive: false, cd: 0, lockT: 0, ammo: 0,
    // a stand-in "aircraft" so the normal missile code can launch from the SAM site
    q: new THREE.Quaternion(), vel: new THREE.Vector3(), K: { scale: 1, hitR: 1 }, gunSide: 1, speed: 6, team: 'red', name: kind === 'flak' ? 'Pháo phòng không' : 'Tên lửa phòng không' });
}
let heron = null, escortT = 0, interceptT = 0, escortDone = false;
function startEscort() {
  gameMode = 'escort'; escortDone = false; escortT = 0; interceptT = 12;
  ZONE.zMin = -1520; AREA.zMin = -1510;
  strikeTargets.length = 0;
  for (const d of STRIKE_DEFS) strikeTargets.push({ ...d, pos: d.pos.clone(), alive: true, hp: 1 });
  rivalGroup.visible = true; resetRivalFlag(); setRivalSiteHouses(false);
  for (const u of groundUnits) { u.alive = true; u.hp = u.maxHp; u.obj.visible = true; u.obj.rotation.set(0, 0, 0); u.cd = rr(0, 2); u.lockT = 0; u.ammo = u.kind === 'sam' ? 3 : 0; }
  flakShells.length = 0;
  // everyone starts over the back yard, the bomber in the middle of the formation
  P.pos.set(-6, 16, -700); orient(P, FWD); aim.set(0, 0, -1); P.speed = 8;
  flyers.filter(f => f.team === 'blue' && f !== P).forEach((f, i) => { f.pos.set(i ? 7 : -9, 15 + i, -690); orient(f, FWD); });
  heron = makeFlyer('heron', 'blue', 'Hạc Lớn'); heron.pos.set(0, 19, -680); orient(heron, FWD); heron.speed = 7; heron.bombCD = 0;
  waveState = 'escort';
  skyTo = PALETTES.sunset;
  P.hp = P.maxHp; P.msl = Math.max(P.msl, MSL_PER_WAVE); P.flares = Math.max(P.flares, FLR_PER_WAVE);
  interceptT = 22;
  startEscortCut();
}
function escortBriefing() {
  radio('Bảng Đen', 'Hộ tống Hạc Lớn vượt sông, thả bóng giấy xuống 3 mục tiêu. Bên đó còn pháo phòng không và trạm tên lửa đất đối không, bắn hạ được bằng súng!', true);
  radio('Lan', 'Mấy chiếc còn sót lại của Phe Đỏ sẽ liều mạng nhắm vào Hạc Lớn. Đừng bỏ nó quá xa nhé!');
  flash(WAVES[wave] ? WAVES[wave].title : 'PHẢN CÔNG', 'Hộ tống Hạc Lớn · ném bóng giấy xuống Trường Bên Kia Sông', 3.2);
}
function endEscortWorld() {   // back to the normal campaign layout
  gameMode = 'campaign'; ZONE.zMin = -1030; AREA.zMin = -1026; heron = null;
  strikeTargets.length = 0; flakShells.length = 0;
  rivalGroup.visible = false; resetRivalFlag(); setRivalSiteHouses(true);
  for (const u of groundUnits) { u.alive = false; u.obj.visible = false; u.obj.rotation.set(0, 0, 0); }
}
function strikeHit(t, at) {
  t.alive = false; score += 300;
  for (let i = 0; i < 3; i++) burst(_tmp.copy(t.pos).add(_pv.set(rr(-3, 3), rr(0, 2), rr(-3, 3))), 50, [0xf4f1e6, 0xffffff, 0xd8d2c0], 9, 2.5, 3);
  if (AU.ctx) { noiseHit(AU.ctx.currentTime, 400, 0.7, 0.8); tone(500, 1200, 0.4, 0.08, 'triangle'); }
  const left = strikeTargets.filter(x => x.alive).length;
  flash('TRÚNG ĐÍCH!', `${t.name} ngập bóng giấy · +300 · còn ${left}`, 2);
  radio('Bảng Đen', left ? `Hạc Lớn ném trúng ${t.name}! Còn ${left} mục tiêu.` : 'Tất cả mục tiêu đã ngập bóng giấy! Nhiệm vụ hoàn thành!', true);
  if (!left && state === 'play') { escortDone = true; startEnding(); }
}
// the bomber: fly to the next live target at bombing height, release when the predicted impact is on it
function updateHeron(a, dt) {
  const fwd = fwdOf(a, _fa), next = strikeTargets.find(t => t.alive);
  if (next) {
    const h = Math.max(1, a.pos.y - next.pos.y), tf = Math.sqrt(2 * h / 9.8);
    const vh = _tmp2.set(a.vel.x, 0, a.vel.z).multiplyScalar(0.8);
    const impact = _tmp.copy(a.pos).addScaledVector(vh, tf);
    const miss = Math.hypot(impact.x - next.pos.x, impact.z - next.pos.z);
    _des.set(next.pos.x - a.pos.x, 0, next.pos.z - a.pos.z).normalize(); _des.y = (Math.max(next.pos.y + 13, 19) - a.pos.y) * 0.08; _des.normalize();
    a.bombCD -= dt;
    if (miss < next.r * 0.7 && a.bombCD <= 0) { dropBomb(a); a.bombCD = 0.45; radioOnce('heronDrop', 'Hạc Lớn', 'Thả bóng giấy!', 6); }
  } else _des.set(0, 0.05, 1).normalize();   // job done: head home
  // self-defence: flares when a missile gets close
  a.flareCD = (a.flareCD || 0) - dt;
  if (a.flares > 0 && a.flareCD <= 0 && missiles.some(m => m.alive && m.target === a && m.p.distanceTo(a.pos) < 14)) { popFlares(a); radioOnce('heronFlare', 'Hạc Lớn', 'Thả pháo sáng!', 8); }
  for (const o of flyers) if (o !== a && o.alive && o.team === a.team) { const d = a.pos.distanceTo(o.pos); if (d < 6 && d > 0.01) _des.addScaledVector(_tmp.subVectors(a.pos, o.pos).normalize(), (6 - d) / 6); }
  if (a.pos.y < 8) _des.y += 0.5;
  _des.normalize();
  instructor(a, _des, ctlA); ctlA.throttle = 0.7;
  flyPhysics(a, ctlA, dt);
  a.pos.addScaledVector(a.vel, dt);
  a.pos.x = clamp(a.pos.x, -AREA.x, AREA.x);
}
function damageGround(u, amt) {
  if (!u.alive) return;
  u.hp -= amt;
  if (u.hp <= 0) {
    u.alive = false; explosion(u.pos, 1.2, 0.8); score += u.kind === 'flak' ? 150 : 200; stats.ground++;
    u.obj.rotation.set(rr(-0.4, 0.4), 0, rr(-0.4, 0.4)); for (let i = 0; i < 12; i++) puff(smoke, u.pos, _pv.set(rr(-1, 1), rr(1, 3), rr(-1, 1)), 2.5, 0.4, 1.6, 0x333333);
    popup(u.kind === 'flak' ? 'PHÁO PHÒNG KHÔNG BỊ PHÁ +150' : 'TRẠM TÊN LỬA BỊ PHÁ +200', '#ffb36b', 1.6);
  }
}
function updateGround(dt) {
  const blues = flyers.filter(f => f.alive && f.team === 'blue');
  for (const u of groundUnits) {
    if (!u.alive) continue;
    let best = null, bd = u.kind === 'flak' ? 48 : 75;
    for (const f of blues) { const d = f.pos.distanceTo(u.pos); const w = f === heron ? d * 0.7 : d; if (f.pos.y > 3 && w < bd) { bd = w; best = f; } }
    u.cd -= dt;
    if (!best) { u.lockT = Math.max(0, u.lockT - dt); continue; }
    const yaw = Math.atan2(best.pos.x - u.pos.x, best.pos.z - u.pos.z) + PI;
    u.top.rotation.y += Math.atan2(Math.sin(yaw - u.top.rotation.y), Math.cos(yaw - u.top.rotation.y)) * Math.min(1, dt * 4);
    if (u.kind === 'flak' && u.cd <= 0) {
      // lead the target and burst a shell near it after the flight time
      u.cd = rr(0.55, 0.9);
      const d = best.pos.distanceTo(u.pos), tf = d / 32;
      const at = best.pos.clone().addScaledVector(best.vel, tf).add(_pv.set(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(2.6));
      flakShells.push({ at, t: tf });
      puff(fire, _tmp.copy(u.pos).add(_pv.set(0, 1, 0)), _pv.set(0, 2, 0), 0.12, 0.25, 0.1, 0xffc040);
      if (AU.ctx && d < 60 && u.pos.distanceTo(P.pos) < 70) noiseHit(AU.ctx.currentTime, 300, 0.08, 0.15);
    } else if (u.kind === 'sam' && u.ammo > 0 && u.cd <= 0) {
      u.lockT += dt;
      if (best === P) { P.lockedBy = u; P.lockedByT = 0.25; }
      if (u.lockT >= 2.2) {
        u.lockT = 0; u.cd = 9; u.ammo--;
        u.pos.y = 2.2; orient(u, _ax.subVectors(best.pos, u.pos).add(_pv.set(0, 8, 0)));
        launchMissile(u, best); u.pos.y = 1.4;
        puff(smoke, u.pos, _pv.set(0, 2, 0), 1.5, 0.5, 1.4, 0xdddddd);
        if (best === P) radio('Bảng Đen', 'SAM phóng tên lửa vào cậu! Né ngay!', true);
        else if (best === heron) radioOnce('samHeron', 'Hạc Lớn', 'Tên lửa đất đối không bám theo tôi! Ai đó phá trạm SAM đi!', 10);
      }
    }
  }
  for (let i = flakShells.length - 1; i >= 0; i--) {
    const sh = flakShells[i]; sh.t -= dt;
    if (sh.t > 0) continue;
    flakShells.splice(i, 1);
    for (let k = 0; k < 6; k++) puff(smoke, sh.at, _pv.set(rr(-1, 1), rr(-0.5, 1), rr(-1, 1)).multiplyScalar(1.5), rr(1.2, 2), 0.25, 0.9, 0x2b2b2b);
    puff(fire, sh.at, _pv.set(0, 0, 0), 0.15, 0.5, 0.2, 0xffa53a);
    for (const f of blues) { const d = f.pos.distanceTo(sh.at); if (d < 2.6) damage(f, 9 * (1 - d / 2.6) + 2, null); }
    const dp = sh.at.distanceTo(P.pos); if (dp < 12) shake = Math.min(0.6, shake + 0.25 * (1 - dp / 12));
  }
}
function updateEscort(dt) {
  escortT += dt;
  updateGround(dt);
  if (state !== 'play') return;
  if (heron && !heron.alive && !escortDone) { escortDone = true; missionFail('Hạc Lớn đã bị bắn hạ…'); return; }
  // interceptors scramble from the rival school, more as the bomber gets closer
  interceptT -= dt;
  const reds = flyers.filter(f => f.alive && f.team === 'red').length;
  if (interceptT <= 0 && reds < 7) {
    const near = heron && heron.pos.z < -1000;
    interceptT = near ? 16 : 24;
    const pool = near ? ['swallow', 'nakamura', 'dart', 'stunt', 'crumple'] : ['dart', 'swallow', 'dart'];
    for (let i = 0; i < 3; i++) { const k = pick(pool), e = makeFlyer(k, 'red', `${KINDS[k].label} chặn đường`); e.pos.copy(findSpawn(35, 80, 'rival')); orient(e, _ax.subVectors(heron ? heron.pos : P.pos, e.pos)); e.speed = e.K.veq; }
    radioOnce('scramble' + (near ? 1 : 0), 'Bảng Đen', near ? 'Thêm máy bay đánh chặn cất cánh từ trường đối thủ!' : 'Radar thấy máy bay đánh chặn đang lao tới Hạc Lớn!', 20);
  }
  const left = strikeTargets.filter(t => t.alive).length;
  $('objective').textContent = `HỘ TỐNG HẠC LỚN · Độ bền ${heron ? Math.max(0, Math.round(heron.hp / heron.maxHp * 100)) : 0}% · Mục tiêu còn ${left}/${strikeTargets.length} · ĐIỂM ${score}`;
}

// gold rings to fly through while waiting for the next level
const course = { rings: [], next: 0, got: 0 };
const cRingGeo = new THREE.TorusGeometry(1.7, 0.09, 8, 36);
function clearCourse() { for (const r of course.rings) scene.remove(r.mesh); course.rings.length = 0; course.next = 0; course.got = 0; }
function startCourse() {
  clearCourse();
  const dir = fwdOf(P, new THREE.Vector3()).setY(0).normalize(), p = P.pos.clone().addScaledVector(dir, 16);
  p.y = clamp(p.y, 5, 28);
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 10 && (pointBlocked(p, 2) || !inSchool(p)); k++) { p.y += 3; if (!inSchool(p)) { dir.negate(); p.addScaledVector(dir, 14); } }
    const mesh = new THREE.Mesh(cRingGeo, new THREE.MeshBasicMaterial({ color: 0xffd93b, transparent: true, opacity: 0.35, fog: false }));
    mesh.position.copy(p); mesh.lookAt(_tmp.copy(p).add(dir)); scene.add(mesh);
    course.rings.push({ pos: p.clone(), n: dir.clone(), mesh, done: false });
    dir.applyAxisAngle(UP, (i % 2 ? -1 : 1) * rr(0.25, 0.5)); dir.y = 0; dir.normalize();
    p.addScaledVector(dir, 13); p.y = clamp(p.y + rr(-3, 3), 5, 28);
  }
  popup('VÒNG THƯỞNG! BAY XUYÊN QUA 6 VÒNG VÀNG', '#ffd93b', 2.2);
}
function updateCourse() {
  if (!course.rings.length) return;
  if (waveState !== 'wait' || state !== 'play') { clearCourse(); return; }
  const r = course.rings[course.next];
  course.rings.forEach((x, i) => { x.mesh.material.opacity = x.done ? 0 : i === course.next ? 0.95 : 0.3; x.mesh.rotation.z += 0.02; });
  if (r && P.pos.distanceTo(r.pos) < 2.1) {
    r.done = true; course.next++; course.got++; score += 50;
    if (AU.ctx) tone(700 + course.got * 120, 1100 + course.got * 150, 0.15, 0.07, 'triangle');
    if (course.got === course.rings.length) {
      score += 200; P.msl = Math.min(MSL_MAX, P.msl + 1); stats.courses++;
      popup('HOÀN HẢO! +200 · +1 TÊN LỬA', '#ffd93b', 2); burst(P.pos, 60, [0xffd93b, 0xffffff], 8, 2, 2);
    } else popup(`VÒNG ${course.got}/${course.rings.length} +50`, '#ffd93b', 0.9);
  }
}
function clearPickups() { for (const pk of pickups) scene.remove(pk.obj); pickups.length = 0; }
function clearBombs() { for (const b of bombs) scene.remove(b.mesh); bombs.length = 0; }

const flares = [];
const flareGeo = new THREE.SphereGeometry(0.08, 8, 6), flareMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
function popFlares(f) {
  if (f.flares <= 0) return false;
  f.flares--; f.flareCD = 1.2;
  const right = rightOf(f, _rt).clone(), up = upOf(f, _ax).clone();
  const made = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const fl = { isFlare: true, alive: true, life: rr(2.2, 3), pos: f.pos.clone(), vel: f.vel.clone().multiplyScalar(0.5).addScaledVector(right, side * rr(3, 5)).addScaledVector(up, rr(-1.5, 2)), mesh: new THREE.Mesh(flareGeo, flareMat) };
    scene.add(fl.mesh); flares.push(fl); made.push(fl);
  }
  // spoof missiles tracking this aircraft
  let fooled = 0;
  for (const m of missiles) if (m.alive && m.target === f && Math.random() < (f === P ? 0.85 : 0.6)) { m.target = made[Math.floor(Math.random() * made.length)]; if (m.owner === P) fooled++; }
  if (fooled) popup('ĐỊCH THẢ PHÁO SÁNG — TÊN LỬA BỊ LỪA!', '#cfcfcf');
  flareSound(f === P ? 1 : 0.4);
  return true;
}
function updateFlares(dt) {
  for (const fl of flares) {
    fl.life -= dt; fl.vel.y -= 2.5 * dt; fl.vel.multiplyScalar(1 - 0.8 * dt); fl.pos.addScaledVector(fl.vel, dt);
    fl.mesh.position.copy(fl.pos);
    if (Math.random() < 0.8) puff(fire, fl.pos, _pv.set(0, 0, 0), 0.25, 0.18, 0.07, 0xffd060);
    if (Math.random() < 0.5) puff(smoke, fl.pos, _pv.set(0, 0.15, 0), 0.9, 0.035, 0.16, 0xf2f2f2);
    if (fl.life <= 0 || fl.pos.y < 0.2) { fl.alive = false; scene.remove(fl.mesh); }
  }
  for (let i = flares.length - 1; i >= 0; i--) if (!flares[i].alive) flares.splice(i, 1);
}

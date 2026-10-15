'use strict';
// Máy Bay Giấy · escort finale: the bomber Hạc Lớn, flak, SAM sites
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  ESCORT MODE: protect the bomber "Hạc Lớn" across the yard while it drops paper balls on Phe Đỏ's
//  half of the school, through flak guns and surface-to-air missile sites.
// =====================================================================
let gameMode = 'campaign';
const strikeTargets = [], groundUnits = [], flakShells = [];
const STRIKE_DEFS = [
  { name: 'Sân cờ Phe Đỏ', pos: FLAG_RED.clone().setY(0.5), r: 6 },
  { name: 'Mái Nhà Thi Đấu', pos: new THREE.Vector3((GYM.x0 + GYM.x1) / 2, GYM.h + 0.6, (GYM.z0 + GYM.z1) / 2), r: 9 },   // the lab is rubble since Chương 6
  { name: 'Sân bóng Phe Đỏ', pos: PITCH.clone(), r: 8 },
];
const GROUND_DEFS = [
  ['flak', -28, -478], ['flak', 30, -540], ['flak', -50, -610], ['flak', 26, -700], ['flak', 6, -752],
  ['sam', -20, -560], ['sam', 60, -470], ['sam', -10, -680],
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
  const box = addBox(x - 1.4, 0, z - 1.4, x + 1.4, 2, z + 1.4); box.off = true; gridInsert(box, box.min.x, box.min.z, box.max.x, box.max.z);   // built after the grid, so register it by hand; solid only in escort mode
  groundUnits.push({ kind, pos: new THREE.Vector3(x, 1.4, z), obj: g, top, box, hp: 0, maxHp: kind === 'flak' ? 60 : 90, alive: false, cd: 0, lockT: 0, ammo: 0,
    // a stand-in "aircraft" so the normal missile code can launch from the SAM site
    q: new THREE.Quaternion(), vel: new THREE.Vector3(), K: { scale: 1, hitR: 1 }, gunSide: 1, speed: 6, team: 'red', name: kind === 'flak' ? 'Pháo phòng không' : 'Tên lửa phòng không' });
}
let heron = null, herons = [], escortT = 0, interceptT = 0, escortDone = false;   // heron = the lead bomber (the finale flies three)
const isHeron = f => herons.includes(f);
// two escort missions: 'lab' (Chương 6: Hạc Lớn's first sortie, one bomb on their lab with the second Tàu Mẹ
// inside) and the finale (three of them, three bombs on their whole wing, then the flag burns)
let escortMode = 'finale', escortEv = {};
const LAB_TARGET = new THREE.Vector3(0, LABH.h + 0.6, (LABH.z0 + LABH.z1) / 2);
// the finale's three aim points: Dãy C, Dãy D, and the Nhà Thi Đấu behind them
const FINALE_TARGETS = [new THREE.Vector3(-47, 11.5, -639), new THREE.Vector3(47, 11.5, -639), new THREE.Vector3((GYM.x0 + GYM.x1) / 2 - 20, GYM.h + 0.6, (GYM.z0 + GYM.z1) / 2)];
const FINALE_POINT = new THREE.Vector3(0, 12, -650);   // where the run begins (the middle of their wing)
const missionPoint = () => escortMode === 'lab' ? LAB_TARGET : FINALE_POINT;
function startEscort(mode) {
  escortMode = mode === 'lab' ? 'lab' : 'finale'; escortEv = {};
  gameMode = 'escort'; escortDone = false; escortT = 0; interceptT = 12; endingFires.length = 0; restoreSouth();
  strikeTargets.length = 0;
  if (escortMode === 'lab') { strikeTargets.push({ name: 'Phòng Thí Nghiệm', pos: LAB_TARGET.clone(), r: 14, alive: true, hp: 1, lab: true }); setLabRuined(false); showLabWeapon(true, false); }
  else strikeTargets.push({ name: 'Khu Tây', pos: FINALE_POINT.clone(), r: 40, alive: true, hp: 1 });
  resetRivalFlag();
  for (const u of groundUnits) { u.alive = true; u.hp = u.maxHp; u.obj.visible = true; u.box.off = false; u.obj.rotation.set(0, 0, 0); u.cd = rr(0, 2); u.lockT = 0; u.ammo = u.kind === 'sam' ? 3 : 0; }
  flakShells.length = 0;
  // everyone starts over our own courtyard, the bomber in the middle of the formation
  P.pos.set(-6, 22, -120); orient(P, FWD); aim.set(0, 0, -1); P.speed = 8;
  flyers.filter(f => f.team === 'blue' && f !== P).forEach((f, i) => { f.pos.set(i ? 7 : -9, 21 + i, -110); orient(f, FWD); });
  heron = makeFlyer('heron', 'blue', escortMode === 'lab' ? 'Crane' : 'Crane 1'); heron.pos.set(0, 25, -100); orient(heron, FWD); heron.speed = 7; heron.bombCD = 0;
  herons = [heron];
  if (escortMode === 'finale') for (const sx of [-1, 1]) {   // two more on its wings, in a V
    const h = makeFlyer('heron', 'blue', `Crane ${sx < 0 ? 2 : 3}`); h.formLead = heron; h.formOff = new THREE.Vector3(sx * 16, -1, 12);
    h.pos.copy(heron.pos).add(h.formOff); orient(h, FWD); h.speed = 7; herons.push(h);
  }
  waveState = 'escort';
  skyTo = PALETTES.sunset;
  P.hp = P.maxHp; P.msl = Math.max(P.msl, MSL_PER_WAVE); P.flares = Math.max(P.flares, FLR_PER_WAVE);
  interceptT = 22;
  startEscortCut();
}
function escortBriefing() {
  if (escortMode === 'lab') {
    radio('Blackboard', 'Nhiệm vụ: hộ tống Crane tới Phòng Thí Nghiệm khu Tây, nơi chiếc Tàu Mẹ thứ hai đang nằm. Pháo phòng không và trạm SAM hạ được bằng súng.', true);
    radio('Alpha 3', 'Một chiếc chậm thế kia mà phá được cả toà nhà sao?');
    flash(WAVES[wave] ? WAVES[wave].title : 'BOM NHIỆT HẠCH', 'Hộ tống Hạc Lớn · phá huỷ Phòng Thí Nghiệm và Tàu Mẹ II', 3.2);
    return;
  }
  // the whole briefing holds the channel, and the first attack waits for it (labEvents: talkUntil)
  radioChain([
    ['Blackboard', 'Lần này là Crane 1, 2, 3, mỗi chiếc một quả. Đưa chúng tới giữa khu Tây. Chỉ cần một chiếc tới nơi.'],
    ['Alpha 2', 'Ba quả...? Blackboard, lần trước một quả đã xoá sổ cả Phòng Thí Nghiệm...'],
    ['Blackboard', 'Để chúng không bao giờ gấp nổi một chiếc Tàu Mẹ nào nữa. Kết thúc chuyện này một lần cho xong, Alpha 2.'],
    // and the empty slot in the formation
    ['Alpha 1', 'Blackboard... Wingman đâu? Sao anh ấy không bay cùng?'],
    ['Blackboard', 'Wingman đã từ chối tham gia ném bom. Anh ta bị đình chỉ vì chống lệnh cấp trên... và hiện đang bị giam.'],
    ['Alpha 2', '...Bị giam? Chỉ vì không chịu ném bom?'],
    ['Blackboard', 'Tập trung vào nhiệm vụ, Alpha 2.'],
  ], true);
  escortEv.talkUntil = escortT + radioHushT;
  flash(WAVES[wave] ? WAVES[wave].title : 'PHẢN CÔNG', 'Hộ tống ba Hạc Lớn tới giữa khu Phe Đỏ', 3.2);
}
function endEscortWorld() {   // back to the normal campaign layout
  gameMode = 'campaign'; heron = null; herons = [];
  strikeTargets.length = 0; flakShells.length = 0;
  resetRivalFlag();
  for (const u of groundUnits) { u.alive = false; u.obj.visible = false; u.box.off = true; u.obj.rotation.set(0, 0, 0); }
}
function strikeHit(t, at) {
  t.alive = false; score += 300;
  for (let i = 0; i < 3; i++) burst(_tmp.copy(t.pos).add(_pv.set(rr(-3, 3), rr(0, 2), rr(-3, 3))), 50, [0xf4f1e6, 0xffffff, 0xd8d2c0], 9, 2.5, 3);
  if (AU.ctx) { noiseHit(AU.ctx.currentTime, 400, 0.7, 0.8); tone(500, 1200, 0.4, 0.08, 'triangle'); }
  const left = strikeTargets.filter(x => x.alive).length;
  flash('TRÚNG ĐÍCH!', `${t.name} ngập bóng giấy · +300 · còn ${left}`, 2);
  radio('Blackboard', left ? `Bom trúng ${t.name}! Còn ${left} mục tiêu.` : 'Tất cả mục tiêu đã bị phá huỷ. Nhiệm vụ hoàn thành!', true);
  if (!left && state === 'play') { escortDone = true; startEnding(); }
}
// the bomber: fly to the next live target at bombing height, release when the predicted impact is on it
function updateHeron(a, dt) {
  const fwd = fwdOf(a, _fa), next = strikeTargets.find(t => t.alive);
  if (a.formLead && a.formLead.alive) {   // a wingman bomber: hold its slot in the V, matching the lead's speed
    const slot = _tmp.copy(a.formOff).applyQuaternion(_qi.setFromAxisAngle(UP, Math.atan2(-fwdOf(a.formLead, _tmp2).x, -_tmp2.z))).add(a.formLead.pos);
    _des.subVectors(slot, a.pos); const gap = _des.length(); _des.normalize().lerp(fwdOf(a.formLead, _tmp2), gap < 3 ? 0.8 : 0.2).normalize();
    instructor(a, _des, ctlA); ctlA.throttle = 0.7 + clamp(gap * 0.03, 0, 0.3);
    flyPhysics(a, ctlA, dt); a.pos.addScaledVector(a.vel, dt); a.pos.x = clamp(a.pos.x, -AREA.x, AREA.x);
    return;
  }
  if (next && escortMode === 'finale') { _des.set(next.pos.x - a.pos.x, 0, next.pos.z - a.pos.z).normalize(); _des.y = (28 - a.pos.y) * 0.08; _des.normalize(); }
  else if (next) {
    const h = Math.max(1, a.pos.y - next.pos.y), tf = Math.sqrt(2 * h / 9.8);
    const vh = _tmp2.set(a.vel.x, 0, a.vel.z).multiplyScalar(0.8);
    const impact = _tmp.copy(a.pos).addScaledVector(vh, tf);
    const miss = Math.hypot(impact.x - next.pos.x, impact.z - next.pos.z);
    _des.set(next.pos.x - a.pos.x, 0, next.pos.z - a.pos.z).normalize(); _des.y = (Math.max(next.pos.y + 13, 26) - a.pos.y) * 0.08;   // cruise above the Giếng Trời and the wings _des.normalize();
    a.bombCD -= dt;
    if (miss < next.r * 0.7 && a.bombCD <= 0) { dropBomb(a); a.bombCD = 0.45; radioOnce('heronDrop', a.name, 'Bombs away!', 6); }
  } else _des.set(0, 0.05, 1).normalize();   // job done: head home
  if (a === heron && escortEv.hold) {   // holding pattern: a wide circle round where it stopped, same height
    const c = escortEv.hold; _tmp.set(a.pos.x - c.x, 0, a.pos.z - c.z); const rad = _tmp.length() || 1; _tmp.divideScalar(rad);
    _des.set(-_tmp.z, 0, _tmp.x).addScaledVector(_tmp, (22 - rad) * 0.05); _des.y = (c.y - a.pos.y) * 0.08; _des.normalize();
  }
  // self-defence: flares when a missile gets close
  a.flareCD = (a.flareCD || 0) - dt;
  if (a.flares > 0 && a.flareCD <= 0 && missiles.some(m => m.alive && m.target === a && m.p.distanceTo(a.pos) < 14)) { popFlares(a); radioOnce('heronFlare', a.name, 'Flare, flare!', 8); }
  for (const o of flyers) if (o !== a && o.alive && o.team === a.team) { const d = a.pos.distanceTo(o.pos); if (d < 6 && d > 0.01) _des.addScaledVector(_tmp.subVectors(a.pos, o.pos).normalize(), (6 - d) / 6); }
  if (a.pos.y < 8) _des.y += 0.5;
  _des.normalize();
  instructor(a, _des, ctlA); ctlA.throttle = 0.7;
  flyPhysics(a, ctlA, dt);
  a.pos.addScaledVector(a.vel, dt);
  a.pos.x = clamp(a.pos.x, -AREA.x, AREA.x);
}
// wingmen in an escort: the paper ball nearest to hitting a bomber, preferring one nobody else is already on
function escortThreat(a) {
  let best = null, bs = 1e9;
  for (const f of flyers) {
    if (!f.alive || !f.kamikaze) continue;
    const h = isHeron(f.target) ? f.target : heron; if (!h) continue;
    const dh = f.pos.distanceTo(h.pos); if (dh > 90) continue;
    const taken = flyers.some(o => o !== a && o !== P && o.alive && o.team === 'blue' && o.target === f);
    const sc = dh + f.pos.distanceTo(a.pos) * 0.5 + (taken ? 45 : 0);
    if (sc < bs) { bs = sc; best = f; }
  }
  if (best && a.target !== best) radioOnce('ballCall' + a.name, a.name, pick(['Tôi lo quả này!', 'Giấy Vo hướng Crane, tôi chặn!', 'Thấy một quả, vào bắn!']), 14);
  return best;
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
    for (const f of blues) { const d = f.pos.distanceTo(u.pos); const w = isHeron(f) ? d * 0.7 : d; if (f.pos.y > 3 && w < bd) { bd = w; best = f; } }
    if (u.kind === 'sam') {   // the SAM sites wake up late in the run, and then they only want a bomber
      if (!escortEv.samOn) { u.lockT = 0; continue; }
      let hd = 110; for (const h of herons) if (h.alive && h.pos.distanceTo(u.pos) < hd) { hd = h.pos.distanceTo(u.pos); best = h; }
    }
    u.lockTgt = best;
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
      if (u.lockT >= (isHeron(best) ? 4.5 : 2.2)) {
        u.lockT = 0; u.cd = 9; u.ammo--;
        u.pos.y = 2.2; orient(u, _ax.subVectors(best.pos, u.pos).add(_pv.set(0, 8, 0)));
        launchMissile(u, best); u.pos.y = 1.4;
        puff(smoke, u.pos, _pv.set(0, 2, 0), 1.5, 0.5, 1.4, 0xdddddd);
        if (best === P) radio('Blackboard', 'Alpha 1, SAM phóng! Break, pháo sáng!', true);
        else if (isHeron(best)) radioOnce('samHeron', best.name, 'SAM bám theo tôi! Cần người phá trạm SAM!', 10);
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
  if (heron && !heron.alive && !escortDone) {   // the lead is down: the next one takes over, and the wingmen re-form on it
    const next = herons.find(h => h.alive);
    if (!next) { escortDone = true; missionFail(herons.length > 1 ? 'Cả ba Hạc Lớn đã bị bắn hạ…' : 'Hạc Lớn đã bị bắn hạ…'); return; }
    heron = next; heron.formLead = null; for (const h of herons) if (h !== heron && h.alive) h.formLead = heron;
    radio('Blackboard', `${heron.name} dẫn đầu đội hình! Còn ${herons.filter(h => h.alive).length} chiếc, bảo vệ bằng mọi giá!`, true);
  }
  // the finale's briefing: everyone holds formation round the bombers at their pace until Blackboard is done talking
  if (escortMode === 'finale' && heron && heron.alive && !cut && escortT < (escortEv.talkUntil || 0)) cruise(dt);
  else if (escortEv.cruising) endCruise();
  if (heron && heron.alive && !escortDone && !cut) labEvents(dt);
  // interceptors scramble from the rival school, more as the bomber gets closer (Chương 6 has its own script)
  interceptT -= dt * 0.4;
  const reds = flyers.filter(f => f.alive && f.team === 'red').length;
  if (interceptT <= 0 && reds < 7 && !escortDone && !cut) {
    const near = heron && heron.pos.z < SCHOOL.mid;
    interceptT = near ? 16 : 24;
    const fin = escortMode === 'finale';
    const pool = fin ? ['dart', 'dart', 'swallow', 'stunt'] : near ? ['swallow', 'nakamura', 'dart', 'stunt', 'crumple'] : ['dart', 'swallow', 'dart'];
    for (let i = 0; i < (fin ? 4 : 3); i++) {
      const k = pick(pool), e = makeFlyer(k, 'red', `${KINDS[k].label} chặn đường`); e.pos.copy(findSpawn(35, 80, 'rival')); orient(e, _ax.subVectors(heron ? heron.pos : P.pos, e.pos)); e.speed = e.K.veq;
      if (fin) { const ram = Math.random() < 0.65; if (ram && heron) e.huntHeron = e.target = pick(herons.filter(h => h.alive)) || heron; rookie(e, ram); }   // the finale: green pilots, most of them rammers
    }
    radioOnce('scramble' + (near ? 1 : 0), 'Blackboard', fin ? 'Thêm tân binh cất cánh từ khu Tây!' : near ? 'Bandit mới cất cánh từ khu Tây!' : 'Radar: tiêm kích đánh chặn đang lao tới Crane!', 20);
  }
  if (heron && heron.alive && !escortDone && !cut && Math.hypot(heron.pos.x - missionPoint().x, heron.pos.z - missionPoint().z) < (escortMode === 'lab' ? 70 : 85)) { startNukeCut(); return; }
  const left = strikeTargets.filter(t => t.alive).length;
  { const d = heron ? Math.max(0, Math.round(Math.hypot(heron.pos.x - missionPoint().x, heron.pos.z - missionPoint().z) - (escortMode === 'lab' ? 70 : 85))) : 0;
    $('objective').textContent = escortMode === 'lab' ? `HỘ TỐNG HẠC LỚN · tới Phòng Thí Nghiệm còn ${d} m · ĐIỂM ${score}` : `HỘ TỐNG ${herons.filter(h => h.alive).length}/3 HẠC LỚN · tới giữa khu Tây còn ${d} m · ĐIỂM ${score}`; return; }
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

// =====================================================================
//  The bomb run. Chương 6: one Hạc Lớn, one huge paper bomb on their lab; the lab and the second Tàu Mẹ inside
//  it are simply gone. The finale: three of them abreast, three bombs on their whole wing. A white flash, a
//  shockwave rolling out across the yard, a mushroom cloud per bomb.
// =====================================================================
const NUKE_LEN = 11.5, NUKE_DROP = 3.0, NUKE_FALL = 1.7;
// the bomb: slim and folded-paper white, an ogive nose, a boat tail, four swept fins inside a thin ring and one
// blue band. Built nose along +Z, so lookAt() points it where it's going. About as long as a Hạc Lớn's body is wide.
const nukeBombGeo = (() => {
  const prof = [[0, -0.9], [0.1, -0.9], [0.17, -0.74], [0.25, -0.46], [0.27, -0.1], [0.26, 0.28], [0.21, 0.56], [0.13, 0.76], [0.05, 0.87], [0, 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const parts = [new THREE.LatheGeometry(prof, 18)];
  for (let i = 0; i < 4; i++) parts.push(new THREE.BoxGeometry(0.2, 0.26, 0.012).translate(0.3, -0.7, 0).rotateY(i * PI / 2 + PI / 4));
  parts.push(new THREE.TorusGeometry(0.39, 0.012, 6, 28).rotateX(PI / 2).translate(0, -0.78, 0));
  return mergeGeometries(parts.map(g => g.toNonIndexed())).rotateX(PI / 2);
})();
const nukeBandGeo = new THREE.CylinderGeometry(0.273, 0.273, 0.07, 18, 1, true).rotateX(PI / 2).translate(0, 0, 0.18), nukeBandMat = lam(0x3d6fd8, { side: THREE.DoubleSide });
function makeNukeBomb() {
  const g = new THREE.Group(), body = new THREE.Mesh(nukeBombGeo, nukeBombMat); body.castShadow = true;
  g.add(body, new THREE.Mesh(nukeBandGeo, nukeBandMat)); g.userData.dyn = true; scene.add(g); return g;
}
const nukeBombMat = lam(0xe8e2d0, { map: paperTex }), nukeRingMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
function startNukeCut() {
  const finale = escortMode === 'finale';
  const bombers = herons.filter(h => h.alive);
  // each bomber takes a target; the run starts 46 m short of it, south-bound
  const targets = finale ? FINALE_TARGETS.slice(0, Math.max(1, bombers.length)) : [LAB_TARGET];
  const runs = bombers.slice(0, targets.length).map((b, i) => ({ b, tgt: targets[i], start: new THREE.Vector3(targets[i].x, 28 + i * 0.6, targets[i].z + 46 + i * 4), drop: NUKE_DROP + i * 0.45, m: makeNukeBomb(), bomb: null, hit: -1, ring: null }));   // every bomber carries its own, slung under the belly
  const crew = flyers.filter(f => f.alive && f.team === 'blue' && !isHeron(f));
  cut = { kind: 'nuke', t: 0, boss: heron, crew: herons.concat(crew.filter(f => f !== P)), said: {}, finale, runs, start: runs[0].start, hit: -1,
    slow: t => t > NUKE_DROP && t < NUKE_DROP + NUKE_FALL + 0.3 + (runs.length - 1) * 0.45 ? 0.35 : 1 };
  for (const r of runs) { r.b.pos.copy(r.start); orient(r.b, _ax.set(0.001, 0, -1)); }
  for (const h of herons) if (h.alive && !runs.some(r => r.b === h)) h.pos.copy(runs[0].start).add(_pv.set(0, 4, 20));
  for (const f of flyers) if (f.alive && f.team === 'red') f.flee = true;   // their fighters scatter from under them
  P.invulnT = 99; document.body.classList.add('cine');
}
// =====================================================================
//  The finale's aftermath: everything standing on their side within reach of a bomb comes down as the shockwave
//  passes (sinks into a heap, tilting), with a wall of dust; and their parked and fleeing planes are thrown
//  across the ground, tumbling over and over before they come to rest, some of them burning
// =====================================================================
let southParts = null;   // [{ o, y0, rx, rz, h, x, z }], gathered the first time it's needed
const ruin = { falls: [], boxesOff: [], wrecks: [] };
function gatherSouth() {
  if (southParts) return southParts;
  // only the buildings, trees and props: not the lab (it has its own ruin), not anything that flies or moves
  const skip = new Set([...labParts, labRubble, rivalFlag, rivalFlag.parent, ...groundUnits.map(u => u.obj), ...flyers.map(f => f.obj), ...missiles.map(m => m.mesh), ...bombs.map(b => b.mesh), ...flares.map(f => f.mesh)]), bb = new THREE.Box3(), sz = new THREE.Vector3(), cn = new THREE.Vector3();
  southParts = [];
  for (const o of scene.children) {
    if (skip.has(o) || o.userData.dyn || o.isInstancedMesh || o.isLight || !(o.isMesh || o.isGroup)) continue;
    bb.setFromObject(o); if (bb.isEmpty()) continue;
    bb.getSize(sz); bb.getCenter(cn);
    if (cn.z > SCHOOL.mid - 30 || sz.x > 160 || sz.z > 140 || bb.max.y < 1.5) continue;   // their half; not the ground, not the paint on it
    southParts.push({ o, y0: o.position.y, rx: o.rotation.x, rz: o.rotation.z, h: sz.y, x: cn.x, z: cn.z });
  }
  return southParts;
}
function restoreSouth() {   // a new game, or another try at the finale: the school stands again
  for (const s of southParts || []) { s.o.position.y = s.y0; s.o.rotation.x = s.rx; s.o.rotation.z = s.rz; }
  for (const b of ruin.boxesOff) b.off = false;
  for (const w of ruin.wrecks) scene.remove(w.m);
  ruin.falls.length = 0; ruin.boxesOff.length = 0; ruin.wrecks.length = 0;
}
// a bomb went off at T: queue up the collapse of everything in reach, nearest first, as the ring rolls outward
function bringDown(T) {
  for (const s of gatherSouth()) {
    const d = Math.hypot(s.x - T.x, s.z - T.z);
    if (d > 105 || ruin.falls.some(f => f.s === s)) continue;
    ruin.falls.push({ s, at: clock + d / 45 + rr(0, 0.5), dur: rr(1.6, 2.8), tx: rr(-0.22, 0.22), tz: rr(-0.22, 0.22), dust: false });
  }
  for (const b of boxes) if (!b.off && b.min.z < SCHOOL.mid - 30 && Math.hypot((b.min.x + b.max.x) / 2 - T.x, (b.min.z + b.max.z) / 2 - T.z) < 105 && !labBoxes.includes(b) && !rubbleBoxes.includes(b)) { b.off = true; ruin.boxesOff.push(b); }
  // their planes: thrown out from the blast, tumbling
  const kinds = ['dart', 'swallow', 'nakamura', 'stunt', 'boomerang', 'glider'];
  for (let i = 0; i < 9; i++) {
    const a = rr(0, PI * 2), r = rr(8, 30), m = new THREE.Mesh(PLANE_GEOS[pick(kinds)], i % 3 ? wreckMat : wreckBurnt);
    m.scale.setScalar(rr(0.38, 0.6)); m.castShadow = true; scene.add(m);
    const p = new THREE.Vector3(T.x + Math.cos(a) * r, rr(0.5, 5), T.z + Math.sin(a) * r);
    m.position.copy(p);
    ruin.wrecks.push({ m, p, v: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(rr(8, 15)).setY(rr(3, 7)), w: new THREE.Vector3(rr(-9, 9), rr(-6, 6), rr(-9, 9)), at: clock + r / 45, burn: Math.random() < 0.4 ? rr(4, 9) : 0 });
  }
}
const wreckMat = lam(0xc8473d, { map: paperTex, side: THREE.DoubleSide }), wreckBurnt = lam(0x4a2a24, { map: paperTex, side: THREE.DoubleSide });
function updateRuins(dt) {
  for (let i = ruin.falls.length - 1; i >= 0; i--) {
    const f = ruin.falls[i], k = (clock - f.at) / f.dur;
    if (k < 0) continue;
    const e = Math.min(1, k) ** 2, s = f.s;
    if (!f.dust) {   // the wall of dust as it goes
      f.dust = true;
      for (let j = 0; j < 7; j++) puff(smoke, _tmp.set(s.x + rr(-6, 6), rr(0.5, 2), s.z + rr(-6, 6)), _pv.set(rr(-3, 3), rr(1, 3), rr(-3, 3)), rr(3, 5), 2, rr(6, 10), [0x8a7a6a, 0x9c8e7c, 0x6e6254][j % 3]);
    }
    s.o.position.y = s.y0 - s.h * 0.72 * e; s.o.rotation.x = s.rx + f.tx * e; s.o.rotation.z = s.rz + f.tz * e;
    if (k < 1 && Math.random() < dt * 6) puff(smoke, _tmp.set(s.x + rr(-5, 5), rr(0.5, s.h * (1 - e) + 1), s.z + rr(-5, 5)), _pv.set(0, rr(0.5, 1.5), 0), rr(2, 3.5), 1.5, rr(4, 7), 0x8a7a6a);
    if (k >= 1) ruin.falls.splice(i, 1);
  }
  for (const w of ruin.wrecks) {
    if (clock < w.at) { w.m.visible = false; continue; }
    w.m.visible = true;
    if (w.v.lengthSq() > 0.02 || w.p.y > 0.12) {   // flung, then bouncing and rolling along the yard
      w.v.y -= 9.8 * dt; w.p.addScaledVector(w.v, dt);
      if (w.p.y < 0.1) { w.p.y = 0.1; w.v.y = Math.abs(w.v.y) * 0.35; w.v.x *= 0.7; w.v.z *= 0.7; w.w.multiplyScalar(0.7); if (w.v.y < 0.6) w.v.y = 0; }
      w.m.rotation.x += w.w.x * dt; w.m.rotation.y += w.w.y * dt; w.m.rotation.z += w.w.z * dt;
      w.m.position.copy(w.p);
    } else if (!w.rest) { w.rest = true; w.m.rotation.x = Math.random() < 0.5 ? 0 : PI; w.m.rotation.z = rr(-0.4, 0.4); }   // come to rest flat, right way up or on its back
    if (w.burn > 0) { w.burn -= dt; if (Math.random() < dt * 8) puff(Math.random() < 0.5 ? fire : smoke, w.p, _pv.set(0, rr(0.5, 1.2), 0), rr(0.6, 1.2), 0.25, 0.7, Math.random() < 0.5 ? 0xff8c1a : 0x555555); }
  }
}
function detonate(c, r, t) {
  r.hit = t; scene.remove(r.m); if (c.hit < 0) c.hit = t;
  camFlashEl.style.transition = 'none'; camFlashEl.style.opacity = 1; requestAnimationFrame(() => { camFlashEl.style.transition = 'opacity 1.8s'; camFlashEl.style.opacity = 0; });
  if (AU.ctx) { noiseHit(AU.ctx.currentTime, 60, 1.2, 3.5); noiseHit(AU.ctx.currentTime + 0.15, 140, 0.9, 2.5); tone(55, 30, 3, 0.3, 'sawtooth'); }
  for (let i = 0; i < 6; i++) explosion(_tmp.copy(r.tgt).add(_pv.set(rr(-6, 6), rr(-2, 4), rr(-6, 6))), 5, 0);
  r.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), nukeRingMat.clone()); r.ring.userData.dyn = true; r.ring.rotation.x = -PI / 2; r.ring.position.set(r.tgt.x, 1.5, r.tgt.z); scene.add(r.ring);
  for (const u of groundUnits) if (u.alive && u.pos.distanceTo(r.tgt) < 90) damageGround(u, 999);
  shake = 1.2;
  if (c.finale) bringDown(r.tgt);   // and everything around it comes down
  if (c.finale) for (let i = 0; i < 4; i++) endingFires.push(r.tgt.clone().add(_pv.set(rr(-14, 14), 0, rr(-8, 8))).setY(rr(1, 12)));   // it keeps burning
}
function updateNukeCut(dt) {
  const c = cut; c.t += dt; const t = c.t;
  for (const r of c.runs) {
    r.b.pos.copy(r.start).add(_pv.set(0, Math.max(0, t - r.drop) * 1.2, -7.5 * t)); orient(r.b, _ax.set(0.001, 0.08 * (t > r.drop ? 1 : 0), -1)); r.b.speed = 7.5; r.b.vel.set(0, 0, -7.5);
    if (!r.bomb && r.hit < 0) { r.m.position.copy(r.b.pos).add(_pv.set(0, -1.15, 0)); r.m.lookAt(_tmp.copy(r.m.position).add(_pv.set(0, 0, -1))); }
    if (t > r.drop && !r.bomb) {   // one bomb each: off the hook, nose down, straight onto its target
      const p = r.m.position.clone();
      r.bomb = { m: r.m, p, v: new THREE.Vector3((r.tgt.x - p.x) / NUKE_FALL, -2, (r.tgt.z - p.z) / NUKE_FALL) };
      if (AU.ctx) tone(320, 90, 1.6, 0.06, 'sine');
    }
    if (r.bomb && r.hit < 0) {
      const b = r.bomb; b.v.y -= 9.8 * dt; b.p.addScaledVector(b.v, dt); b.m.position.copy(b.p); b.m.lookAt(_tmp.copy(b.p).add(b.v));
      if (Math.random() < dt * 30) puff(smoke, _tmp.copy(b.p).addScaledVector(_pv.copy(b.v).normalize(), -0.9), _pv.set(0, 0, 0), rr(0.25, 0.4), 0.6, 0.6, 0xf2f2f2);   // a thin paper-dust trail
      if (b.p.y < r.tgt.y || pointBlocked(b.p)) detonate(c, r, t);
    }
    if (r.hit >= 0) {
      const k = t - r.hit, T = r.tgt;
      if (r.ring) { r.ring.scale.setScalar(4 + k * 55); r.ring.material.opacity = Math.max(0, 0.8 - k * 0.35); if (k > 2.5) { scene.remove(r.ring); r.ring = null; } }
      if (k < 1.2) for (let i = 0; i < 4; i++) puff(fire, _tmp.copy(T).add(_pv.set(rr(-8, 8), rr(0, 10), rr(-8, 8))), _pv.set(rr(-4, 4), rr(3, 9), rr(-4, 4)), rr(0.6, 1.1), 3, 9, [0xfff1b0, 0xffb347, 0xff6a1f][i % 3]);
      if (k < 5 && Math.random() < dt * 40) puff(smoke, _tmp.copy(T).add(_pv.set(rr(-3, 3), rr(0, 6), rr(-3, 3))), _pv.set(rr(-0.5, 0.5), rr(8, 12), rr(-0.5, 0.5)), rr(3, 4), 3, 6, [0x5a4a3a, 0x7a6a5a, 0x3a3430][(Math.random() * 3) | 0]);
      if (k > 1 && k < 6 && Math.random() < dt * 30) { const a = rr(0, PI * 2), rad = rr(4, 16); puff(smoke, _tmp.set(T.x + Math.cos(a) * rad, rr(34, 42), T.z + Math.sin(a) * rad), _pv.set(Math.cos(a) * 3, rr(0.5, 2), Math.sin(a) * 3), rr(4, 6), 6, 12, [0x8a7a6a, 0xa09080, 0x6a5a4a][(Math.random() * 3) | 0]); }
    }
  }
  P.pos.copy(c.runs[0].b.pos).add(_pv.set(-7, -2, 6)); orient(P, _ax.set(0.001, 0, -1)); P.vel.set(0, 0, -7.5);
  c.crew.forEach((f, i) => { if (!isHeron(f)) { f.pos.copy(c.runs[0].b.pos).add(_pv.set(i % 2 ? 8 : -9, -1 + i * 0.5, 4 + i * 2)); orient(f, _ax.set(0.001, 0, -1)); f.vel.set(0, 0, -7.5); } });
  // Chương 6: the lab caves in
  if (!c.finale && c.hit >= 0) {
    const s = Math.min(1, (t - c.hit) / 1.4);
    labParts.forEach(o => { o.position.y = o.userData.y0 - s * s * 14; o.rotation.z = (o.userData.tilt ??= rr(-0.06, 0.06)) * s; });
    labWeapon.position.y = LABW.y - s * s * 14;
    if (s >= 1 && !c.said.ruin) { c.said.ruin = 1; setLabRuined(true); showLabWeapon(false); labWeapon.position.y = LABW.y; labParts.forEach(o => o.rotation.z = 0); }
  }
  const line = (n, at, who, text) => { if (t > at && !c.said[n]) { c.said[n] = 1; sayNow(who, text); } };
  if (!c.finale) {
    line(1, 0.4, 'Crane', 'Crane vào hướng ném. Mở khoang bom.');
    line(2, 2.0, 'Alpha 2', 'Chỉ một quả thôi sao? Có đủ không?');
    line(3, NUKE_DROP + 0.2, 'Crane', 'Bombs away. Tất cả... quay mặt đi.');
    if (c.hit >= 0) { line(4, c.hit + 2.6, 'Alpha 3', '...Trời ơi.'); line(5, c.hit + 4.6, 'Blackboard', 'Phòng Thí Nghiệm và Tàu Mẹ II... không còn gì nữa. Crane, RTB.'); }
  } else {
    line(1, 0.4, 'Crane 1', 'Đội Crane vào hướng ném. Mở khoang bom.');
    line(2, 2.0, 'Alpha 2', c.runs.length > 1 ? `${c.runs.length} quả... cùng một lúc sao?` : 'Chỉ còn một chiếc... nhưng một quả cũng đủ rồi.');
    line(3, NUKE_DROP + 0.2, 'Crane 1', 'Thả.');
    if (c.hit >= 0) { line(4, c.hit + 2.8, 'Alpha 3', 'Đủ rồi... thế là đủ rồi mà...'); line(5, c.hit + 5.2, 'Alpha 1', '(Bên dưới đó... là nơi những chiếc như mình được gấp ra.)'); }
  }
  if (t >= NUKE_LEN + (c.runs.length - 1) * 0.45 || pressed.Enter || pressed.NumpadEnter) endNukeCut();
}
function endNukeCut() {
  const c = cut; cut = null; document.body.classList.remove('cine');
  for (const r of c.runs) { scene.remove(r.m); if (r.ring) scene.remove(r.ring); }
  escortDone = true; strikeTargets.forEach(t => t.alive = false); score += 1500;
  const keep = Math.round(herons.reduce((s, h) => s + (h.alive ? h.hp / h.maxHp : 0), 0) / herons.length * 100); score += keep * 10;   // bonus for bringing the bombers through
  for (const u of groundUnits) u.alive && damageGround(u, 999);
  for (const f of flyers) if (f.alive && f.team === 'red') f.flee = true;
  if (c.finale) { startEnding(); return; }   // and the war is over
  setLabRuined(true); showLabWeapon(false); labWeapon.position.y = LABW.y;
  flash('PHÒNG THÍ NGHIỆM ĐÃ BỊ XOÁ SỔ', `Tàu Mẹ II bị chôn vùi · +1500 · Hạc Lớn còn ${keep}%: +${keep * 10}`, 3.4);
  radio('Phe Đỏ (bắt sóng)', 'Phòng Thí Nghiệm... sập hết rồi. Mấy chiếc đang gấp dở trong đó... có chiếc nào còn bay được không? Trả lời đi!', true);
  if (heron) removeFlyer(heron);   // banks away for home
  P.invulnT = 1.5; P.pos.copy(c.start).add(_pv.set(-7, -2, -60)); orient(P, _ax.set(0.001, 0, 1)); P.speed = 9; aim.set(0, 0, 1); camPos.copy(P.pos).add(_pv.set(0, 0.5, -2.5)); camAimS.copy(aim);
  endEscortWorld(); waveState = 'active';   // the normal flow ends the chapter once their stragglers are gone
}
function nukeCamera(dt) {
  const c = cut, t = c.t, r0 = c.runs[0];
  let shot, fov = 55;
  if (t < NUKE_DROP) { shot = 1; _cd.set(r0.tgt.x + 14, 3, r0.tgt.z + 8); _cl.copy(r0.b.pos); fov = lerp(40, 55, t / NUKE_DROP); }   // low by the target: the bomber looming over it
  else if (c.hit < 0) {   // riding down with the bomb; in the finale, cut to each bomber's bomb as it lets go, all three of them
    const rf = c.runs.filter(r => r.bomb).pop() || r0, b = rf.bomb ? rf.bomb.p : rf.b.pos;
    shot = 2 + c.runs.indexOf(rf) * 0.1; _cd.copy(b).add(_pv.set(2, 1.2, 3)); _cl.copy(b).add(_pv.set(0, -5, -3)); fov = 48;
  }
  else if (!c.finale) { shot = 3; _cd.set(55, 24, LAB_TARGET.z + 105); _cl.copy(LAB_TARGET).add(_pv.set(0, 14, 0)); fov = 58; }   // across the yard: flash, shockwave, mushroom cloud
  else { shot = 3; _cd.set(0, 30, -430); _cl.set(0, 16, -660); fov = 62; }   // from the middle of the yard: their whole wing under the clouds
  camera.position.lerp(_cd, shot !== c.shot ? 1 : 1 - Math.exp(-dt * 8)); c.shot = shot;
  camera.up.set(0, 1, 0); camera.lookAt(_cl);
  camera.fov += (fov - camera.fov) * (shot !== c.fovS ? 1 : Math.min(1, dt * 3)); c.fovS = shot; camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}

// =====================================================================
//  Chương 6's route, as a string of set pieces keyed to how far Hạc Lớn has got:
//  hunters on the bomber -> crumpled-paper rammers -> a big swarm of rammers from both sides -> SAM sites
//  locking it -> a last throw of rammers from above. Plus its own radio as it takes damage.
// =====================================================================
// close formation round the lead bomber, the same slots as in the take-off scene (ESC_FORM); the player's plane is
// flown for them, everyone at the bomber's speed. They ease in from wherever they were over the first 2.5 s
function cruise(dt) {
  const E = escortEv, crew = [P, ...flyers.filter(f => f.alive && f.team === 'blue' && f !== P && !isHeron(f))];
  if (!E.cruising) { E.cruising = true; E.cruiseT = 0; E.from = new Map(crew.map(f => [f, f.pos.clone()])); flash('', 'GIỮ ĐỘI HÌNH · BAY CÙNG ĐỘI CRANE', 2.4); }
  E.cruiseT += dt;
  const s = clamp(E.cruiseT / 2.5, 0, 1), k = s * s * (3 - 2 * s);
  const fw = fwdOf(heron, _tmp2).setY(0).normalize(), rt = _ax.crossVectors(fw, UP).normalize(), v = heron.speed || 7;
  crew.forEach((f, i) => {
    const o = ESC_FORM[i] || [(i % 2 ? 1 : -1) * (14 + 2 * i), 1 + 0.3 * i, 4 + i];
    const slot = _tmp.copy(heron.pos).addScaledVector(rt, o[0]).addScaledVector(fw, -o[2]).add(_pv.set(0, o[1] + Math.sin(escortT * 1.3 + i) * 0.15, 0));
    const from = E.from.get(f) || f.pos.clone(); from.addScaledVector(fw, v * dt);   // the start point keeps pace too
    f.pos.lerpVectors(from, slot, k); orient(f, fw); f.speed = v; f.vel.copy(fw).multiplyScalar(v);
    if (f !== P) f.scripted = true;
  });
  aim.copy(fw);
  $('objective').textContent = `HỘ TỐNG 3/3 HẠC LỚN · giữ đội hình, nghe chỉ thị · ĐIỂM ${score}`;
}
function endCruise() {
  const E = escortEv; E.cruising = false;
  for (const f of flyers) if (f.team === 'blue' && f.scripted) f.scripted = false;
  if (heron) E.z0 = heron.pos.z;   // the route's set pieces are spread over what's left from here
  P.speed = Math.max(P.speed, 8);
}
function huntersOn(kind, n, label, from, tag, mod) {
  for (let i = 0; i < n; i++) {
    const prey = pick(herons.filter(h => h.alive)) || heron;
    const f = makeFlyer(kind, 'red', `${KINDS[kind].label} ${label} ${i + 1}`); f.huntHeron = prey; f.target = prey; f.wave = tag;
    f.pos.copy(from()); orient(f, _ax.subVectors(heron.pos, f.pos)); f.speed = f.K.veq + 2;
    if (kind === 'crumple') {   // a paper ball: one short burst pops it, but one that gets through tears a big hole in a Hạc Lớn
      f.hp = f.maxHp = 6; f.ramDmg = 45; f.kamikaze = true; f.speed = f.K.veq;
      f.K = Object.assign({}, f.K, { hitR: 0.8 });
    }
    if (mod) mod(f, i);
  }
}
// the finale: Phe Đỏ has no pilots left, only planes folded last week. Thin paper, shaky hands, no missiles, and
// most of them don't even try to dogfight: they aim themselves at a Hạc Lớn
function rookie(f, ram) {
  f.rookie = true; f.name = `Tân binh ${f.K.label}`; f.hp = f.maxHp = Math.round(f.maxHp * 0.35); f.mslLeft = 0;
  f.K = Object.assign({}, f.K, { gunDmg: f.K.gunDmg * 0.6, gunCone: f.K.gunCone * 0.6, evade: 0.3, points: Math.round((f.K.points || 100) * 0.6) });
  if (ram) { f.K.ai = 'ram'; f.kamikaze = true; f.ramDmg = 35; f.speed = f.K.veq + 1; f.name = `Tân binh cảm tử`; }
}
const rookieOf = ram => f => rookie(f, typeof ram === 'function' ? ram(f) : ram);
// a few lines of radio, each at its own moment (radio() puts urgent lines at the front of the queue, so a burst of
// them would play backwards)
function sayLater(E, lines) { const t0 = escortT; for (const [dt, who, text] of lines) (E.lines ||= []).push({ at: t0 + dt, who, text }); }
// a set piece that feeds its attackers in one at a time, from well ahead so you see them coming
const feed = (E, n, gap, spawn) => { E.feedN = n; E.feedT = 0; E.feedGap = gap; E.feed = spawn; };
const side = (h, k, near, far, dx0, dx1, dy = 3) => () => _tmp.set(clamp(h.pos.x + (k % 2 ? 1 : -1) * rr(dx0, dx1), -70, 70), clamp(h.pos.y + rr(-dy, dy), 8, 40), h.pos.z - rr(near, far)).clone();
// each set piece waits for the one before it to be cleared (or for its time to run out); if Hạc Lớn reaches the
// next one first, it orbits where it is so the escort can finish the job
const SAM_PHASE = { id: 'sam', at: 0.62, maxT: 0, go(E) {
  E.samOn = 1;
  for (const u of groundUnits) if (u.kind === 'sam' && u.alive) u.ammo = Math.max(u.ammo, 2);
  flash('SAM KHOÁ HẠC LỚN', 'Phá trạm tên lửa trước khi nó khoá xong!', 2.6);
  radio('Blackboard', 'Trạm SAM đang khoá Crane! Thanh khoá đầy là nó phóng. Phá trạm, ngay!', true);
} };
const LAB_PHASES = [   // Chương 6
  { id: 'hunt', at: 0.08, maxT: 60, go(E, h, ahead) {
    huntersOn('dart', 4, 'săn Hạc', ahead(120, 30), 'hunt');
    flash('ĐÀN SĂN HẠC', 'Tiêm kích nhắm thẳng vào Hạc Lớn · bắn hạ chúng!', 2.4);
    radio('Blackboard', 'Bốn Phi Tiêu nhắm thẳng Crane, bỏ qua tiêm kích của ta! Chặn lại!', true);
  } },
  { id: 'ram', at: 0.3, maxT: 30, go(E, h) {
    feed(E, 5, 1.8, k => huntersOn('crumple', 1, 'cảm tử', side(h, k, 100, 120, 20, 35, 3), 'ram'));
    flash('GIẤY VO CẢM TỬ', 'Một loạt đạn là vỡ · đừng để quả nào chạm vào Hạc Lớn!', 2.6);
    radio('Alpha 2', 'Giấy Vo cảm tử phía trước! Mỏng lắm, bắn là vỡ, nhưng đâm trúng Crane là thủng một mảng!', true);
  } },
  { id: 'swarm', at: 0.45, maxT: 35, go(E, h) {
    feed(E, 8, 1.4, k => huntersOn('crumple', 1, 'cảm tử', side(h, k, 80, 100, 35, 50), 'swarm'));
    flash('BẦY GIẤY VO', 'Cả bầy cảm tử ập tới từ hai phía · bảo vệ Hạc Lớn!', 2.6);
    radio('Alpha 3', 'Bầy Giấy Vo, hai bên sườn! Hạ hết, không quả nào được chạm vào Crane!', true);
  } },
  SAM_PHASE,
  { id: 'last', at: 0.82, maxT: 0, go(E, h) {   // the last throw: rammers dropping on it from above
    huntersOn('crumple', 4, 'bổ nhào', () => _tmp.set(h.pos.x + rr(-15, 15), h.pos.y + rr(18, 26), h.pos.z - rr(50, 70)).clone(), 'last');
    radio(h.name, 'Sắp tới điểm ném! Giấy Vo bổ nhào từ trên cao, giữ chúng tránh xa thêm vài giây!', true);
  } },
];
const FINALE_PHASES = [   // Chương 12: many of them, all green, most of them flying at a Crane to die
  { id: 'hunt', at: 0.06, maxT: 60, go(E, h, ahead) {
    huntersOn('dart', 3, '', ahead(120, 35), 'hunt', rookieOf(false));
    huntersOn('swallow', 1, '', ahead(130, 35), 'hunt', rookieOf(false));
    huntersOn('dart', 3, '', ahead(115, 35), 'hunt', rookieOf(true));
    flash('PHE ĐỎ CẤT CÁNH', 'Bảy chiếc nhắm vào đội Crane · hạ chúng!', 2.4);
    radio('Blackboard', 'Bảy bandit cất cánh từ khu Tây, hướng thẳng đội Crane!', true);
    sayLater(E, [[6, 'Alpha 2', 'Bay loạng choạng thế kia... đội hình vỡ hết trước cả khi giáp trận.'],
      [11, 'Alpha 4', 'Chiếc kia còn chưa gấp phẳng cánh. Toàn tân binh à?'],
      [16, 'Alpha 3', 'Coi chừng! Mấy chiếc không thèm bắn, cứ thế lao thẳng vào Crane!']]);
  } },
  { id: 'ram', at: 0.25, maxT: 35, go(E, h) {
    feed(E, 8, 1.5, k => huntersOn(k % 3 ? 'dart' : 'swallow', 1, '', side(h, k, 100, 120, 20, 40), 'ram', rookieOf(true)));
    flash('TÂN BINH CẢM TỬ', 'Chúng không bắn · chúng lao thẳng vào Hạc Lớn!', 2.6);
    radio('Alpha 3', 'Lại nữa! Cả chuỗi lao vào Crane, không chiếc nào định quay đầu!', true);
    sayLater(E, [[5, 'Blackboard', 'Phe Đỏ hết phi công rồi. Thứ duy nhất chúng còn là thân mình. Hạ từng chiếc trước khi chúng chạm Crane.'],
      [12, 'Alpha 2', 'Chúng... còn non hơn cả bọn mình hồi mới gấp ra. Cùng một thứ giấy, cùng một thứ tiếng.'],
      [18, 'Alpha 5', 'Đừng nghĩ nữa, Alpha 2. Một chiếc lọt qua là Crane thủng một mảng.']]);
  } },
  { id: 'swarm', at: 0.45, maxT: 40, go(E, h) {
    feed(E, 12, 1.1, k => k % 3 === 2 ? huntersOn('crumple', 1, 'cảm tử', side(h, k, 80, 100, 35, 55), 'swarm')
      : huntersOn('dart', 1, '', side(h, k, 90, 110, 30, 55), 'swarm', rookieOf(k % 4 !== 0)));
    flash('CẢ BẦY LIỀU CHẾT', 'Tân binh và Giấy Vo ập tới từ hai phía · giữ chúng xa đội Crane!', 2.6);
    radio('Alpha 5', 'Hai bên sườn, cả bầy! Tân binh lẫn Giấy Vo!', true);
    sayLater(E, [[6, 'Phe Đỏ (bắt sóng)', 'Đừng bắn nữa, bắn không trúng đâu! Cứ lao vào! Một chiếc Hạc thôi cũng được!'],
      [11, 'Alpha 4', '...Chúng ta nghe hết cả rồi.'],
      [16, 'Alpha 1', '(Chúng biết mình sẽ không quay về. Vậy mà vẫn lao vào.)']]);
  } },
  SAM_PHASE,
  { id: 'last', at: 0.8, maxT: 0, go(E, h) {   // everyone they have left, from every side and from above
    huntersOn('dart', 6, '', () => _tmp.set(clamp(h.pos.x + rr(-50, 50), -70, 70), h.pos.y + rr(-3, 8), h.pos.z - rr(70, 100)).clone(), 'last', rookieOf(true));
    huntersOn('crumple', 4, 'bổ nhào', () => _tmp.set(h.pos.x + rr(-15, 15), h.pos.y + rr(18, 26), h.pos.z - rr(50, 70)).clone(), 'last');
    radio('Phe Đỏ (bắt sóng)', 'Ai còn bay được thì cất cánh hết! Không còn ai nữa... không còn ai nữa cả!', true);
    sayLater(E, [[5, 'Crane 1', 'Sắp tới điểm ném! Giữ chúng tránh xa thêm vài giây!'], [10, 'Alpha 3', 'Đây là tất cả những gì chúng còn lại sao...']]);
  } },
];
function labEvents(dt) {
  const E = escortEv, h = heron, endZ = missionPoint().z + (escortMode === 'lab' ? 70 : 85);
  if (escortMode === 'finale' && E.z0 == null && escortT >= (E.talkUntil || 0)) E.z0 = h.pos.z;   // (in case the cruise never ran)
  const z0 = E.z0 ?? (escortMode === 'finale' ? null : -100);   // the finale counts from where the briefing cruise ended
  const p = z0 == null ? 0 : clamp((z0 - h.pos.z) / (z0 - endZ), 0, 1);
  const ahead = (dz, spread, dy = 0) => () => _tmp.set(clamp(h.pos.x + rr(-spread, spread), -70, 70), clamp(h.pos.y + dy + rr(-4, 4), 8, 40), h.pos.z - dz - rr(0, 15)).clone();
  const PH = escortMode === 'lab' ? LAB_PHASES : FINALE_PHASES;
  E.i ??= 0; E.curT = (E.curT || 0) + dt;
  if (E.feedN > 0 && (E.feedT -= dt) <= 0) { E.feedT = E.feedGap; E.feedN--; E.feed(E.feedN); }
  if (E.lines) for (let i = E.lines.length - 1; i >= 0; i--) if (escortT >= E.lines[i].at) { const l = E.lines.splice(i, 1)[0]; radio(l.who, l.text, true); }
  const cur = PH[E.i - 1], next = PH[E.i];
  const left = cur ? flyers.filter(f => f.alive && f.wave === cur.id).length + (E.feedN || 0) : 0;
  const busy = left > 0 && E.curT < cur.maxT;
  if (cur && !busy && !E.cleared) { E.cleared = 1; E.gap = 3; if (cur.maxT && !left) popup('ĐÃ DỌN SẠCH ĐỢT TẤN CÔNG', '#9fe0ff', 1.6); }
  if (E.gap > 0) E.gap -= dt;
  // Hạc Lớn holds while the last wave is still on it
  // Hạc Lớn never flies past a set piece that hasn't happened yet: while the next one is held up (the last wave still
  // on it, the breather after it, or the briefing still on the radio) it circles where it is
  const talking = escortT < (E.talkUntil || 0), blocked = busy || E.gap > 0 || talking;
  const hold = !!next && p >= next.at && blocked;
  if (hold && !E.hold) { E.hold = h.pos.clone(); E.holdLoud = busy; if (busy) radio(h.name, `${h.name} vào vòng chờ. Dọn sạch chúng đi rồi tôi đi tiếp!`, true); }
  else if (!hold && E.hold) { if (E.holdLoud) radio(h.name, left ? 'Không chờ được nữa, tôi phải đi tiếp!' : 'Đường sạch rồi. Crane tiếp tục hướng bay.', true); E.hold = null; }
  if (next && p >= next.at && !blocked) { E.i++; E.curT = 0; E.cleared = 0; E.feedN = 0; next.go(E, h, ahead); }
  // the bombers' own voices as they get hurt
  for (const b of herons) for (const [lim, txt] of [[0.75, 'trúng đạn, vẫn giữ hướng bay.'], [0.5, 'hư hại cánh! Cần yểm hộ!'], [0.25, 'hư hại nặng! Không trụ được lâu nữa!']])
    if (b.alive && b.hp / b.maxHp < lim && !E[b.name + lim]) { E[b.name + lim] = 1; radio(b.name, `${b.name} ${txt}`, true); }
}

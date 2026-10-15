'use strict';
// Máy Bay Giấy · player control
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Player control
// =====================================================================
const ctlP = { pitch: 0, roll: 0, yaw: 0, throttle: 0.6 };
const _toT = new THREE.Vector3();
function enemiesSorted() {
  const fwd = fwdOf(P, _fw);
  return flyers.filter(f => f.alive && f.team === 'red').map(f => ({ f, a: _toT.subVectors(f.pos, P.pos).normalize().angleTo(fwd), d: f.pos.distanceTo(P.pos) }))
    .sort((a, b) => (a.a + a.d / 600) - (b.a + b.d / 600));
}
function updatePlayer(dt) {
  let kp = 0, kr = 0, ky = 0;
  if (keys.KeyW || keys.ArrowUp) kp += 1;
  if (keys.KeyS || keys.ArrowDown) kp -= 1;
  if (invertY) kp = -kp;
  if (keys.KeyD || keys.ArrowRight) kr += 1;
  if (keys.KeyA || keys.ArrowLeft) kr -= 1;
  if (keys.KeyE) ky += 1;
  if (keys.KeyQ) ky -= 1;
  if (touch) { kr = clamp((touch.x - touch.x0) / 70, -1, 1); kp = clamp(-(touch.y - touch.y0) / 70, -1, 1) * (invertY ? -1 : 1); }
  const fwd = fwdOf(P, _fw);
  const manual = kp || kr || ky;
  const locked = !!document.pointerLockElement;
  P.assist = false; P.looping = false;
  if (keys.KeyR && P.target && P.target.alive) {
    // pursuit assist: steer toward where the target will be
    const d = P.target.pos.distanceTo(P.pos), tt = d / (BULLET_SPEED + P.speed);
    _toT.copy(P.target.vel).multiplyScalar(tt).add(P.target.pos).sub(P.pos).normalize();
    aim.lerp(_toT, 1 - Math.exp(-dt * 4)).normalize();
    instructor(P, aim, ctlP);
    P.assist = true;
  } else if (simCtl && manual) {
    ctlP.pitch = kp; ctlP.roll = kr; ctlP.yaw = ky;
    aim.lerp(fwd, 1 - Math.exp(-dt * 12)).normalize();
  } else if (!simCtl && kp && !touch) {
    // arcade W/S: pitch the nose directly so holding the key flies a full loop
    // A/D (or ←/→) together with W/S: bank to ~45° and hold it (climbing / diving turn) instead of
    // rolling round and round. Upside down (top of a loop) there is no "level" to hold, so plain roll.
    const upY = upOf(P, _ui).y, bank = Math.atan2(rightOf(P, _rt).y, upY);
    const hold = clamp((bank + kr * 0.5) * 2.5, -1, 1), w = clamp(upY * 3, 0, 1);
    ctlP.pitch = kp; ctlP.roll = hold * w; ctlP.yaw = ky * 0.5;
    if (kr && w > 0) {
      // climbing/diving turn: pitch about the world-horizontal axis (not the banked wing axis), so the
      // up/down part never swings the nose sideways; falls back to normal pitch when steep/inverted
      P.cmbP = lerp(P.cmbP || 0, kp, 1 - Math.exp(-dt * 6));
      const fw = fwdOf(P, _tmp), hr = _tmp2.crossVectors(fw, UP);
      if (hr.lengthSq() > 1e-4) {
        hr.normalize().lerp(rightOf(P, _ar), 1 - w).normalize();
        P.q.premultiply(_qa.setFromAxisAngle(hr, P.cmbP * P.K.rates[0] * (P.sonic ? 0.55 : 1) * dt)); P.q.normalize();
        ctlP.pitch = kp * (1 - w);
      }
    } else P.cmbP = 0;
    // arcade turn: left/right swings the heading around the world's vertical axis, so
    // up+left and down+left BOTH go left (a real bank + push would swing the nose the wrong way)
    if (kr) { _qa.setFromAxisAngle(UP, -kr * 1.15 * dt * (P.sonic ? 0.55 : 1)); P.q.premultiply(_qa); P.q.normalize(); }
    aim.lerp(fwd, 1 - Math.exp(-dt * 6)).normalize();   // ease the mouse-aim onto the nose (snapping it jerked the camera)
    P.looping = true; P.keyAim = true;
    P.speed = Math.max(P.speed, STALL + 1);
  } else {
    if (!simCtl && manual) {
      // arcade keyboard: keys move the desired heading, the plane banks & turns by itself
      const turn = kr + ky;
      if (turn) { _qa.setFromAxisAngle(UP, -turn * 1.15 * dt); aim.applyQuaternion(_qa); }
      if (kp) {
        _ar.crossVectors(aim, UP); if (_ar.lengthSq() < 1e-4) _ar.set(1, 0, 0); _ar.normalize();
        _qa.setFromAxisAngle(_ar, kp * 0.9 * dt); aim.applyQuaternion(_qa);
      }
      P.keyAim = true;
    }
    // keyboard-driven aim (also with the mouse captured, until the mouse moves): keep it close to the
    // nose, and when the keys are released pull it back level and straight ahead so the plane settles fast
    if (!simCtl && (!locked || P.keyAim)) {
      if (!kp) aim.y = lerp(aim.y, 0, Math.min(1, dt * 2.6));   // auto level when W/S released
      aim.y = clamp(aim.y, -0.72, 0.72);
      aim.normalize();
      if (!kr && !ky) {
        const h = Math.hypot(fwd.x, fwd.z);
        if (h > 0.2) { const c = Math.sqrt(1 - aim.y * aim.y) / h; _tmp.set(fwd.x * c, aim.y, fwd.z * c); aim.lerp(_tmp, 1 - Math.exp(-dt * 6)).normalize(); }
      }
      // keep the desired heading near the nose so the plane answers quickly
      const off = aim.angleTo(fwd);
      if (off > 0.42) aim.lerp(fwd, 1 - 0.42 / off).normalize();   // keyboard turns stay coordinated (no near-knife-edge banks)
    }
    instructor(P, aim, ctlP);
  }
  if (!P.looping) P.cmbP = 0;   // combo pitch state only lives while W/S is held
  // ---- out of the school: G-LOC style blackout ----
  updateBlackout(dt, fwd);
  // ---- B: supersonic (wings fold back, very fast, wide turns; heats the paper) ----
  if (pressed.KeyB) {
    if (P.sonic) { P.sonic = false; popup('THOÁT SIÊU THANH', '#9fd8ff', 0.9); }
    else if (P.sonicHeat < 0.8 && P.boT <= 0) { P.sonic = true; P.boomDone = false; P.sonicDmg = 0; popup('SIÊU THANH — GẬP CÁNH!', '#9fd8ff', 1.2); if (AU.ctx) tone(200, 900, 0.6, 0.08, 'sawtooth'); }
    else popup('GIẤY CÒN NÓNG — CHỜ NGUỘI', YEL, 0.9);
  }
  if (P.sonic) {
    P.sonicHeat += dt / 7;
    // supersonic wears the paper out: a steady tear, worse when pulling hard or when the paper is hot
    if (P.speed > SONIC_SPEED && P.invulnT <= 0) {
      const sm = P.sm || { pitch: 0, roll: 0 }, load = Math.abs(sm.pitch) + Math.abs(sm.roll) * 0.6 + (P.looping ? 0.6 : 0);
      let tear = (1.2 + load * 3 + (P.sonicHeat > 0.75 ? 3 : 0)) * dt;
      if (P.shieldT > 0) tear *= 0.3;
      P.hp -= tear; P.sonicDmg = (P.sonicDmg || 0) + tear; stats.dmg += tear; stats.sonicDmg += tear; P.lastDmgT = clock;
      // shreds of paper peel off the wingtips; creak now and then
      if (Math.random() < dt * (3 + load * 6)) { _tmp.set((Math.random() < 0.5 ? -1 : 1) * 0.6, 0.1, 0.4); P.obj.localToWorld(_tmp); burst(_tmp, 2, [P.colorHex, 0xffffff], 2, 0.8, 0.5); }
      if (AU.ctx && Math.random() < dt * (0.8 + load * 2)) noiseHit(AU.ctx.currentTime, 2600 + Math.random() * 1500, 0.06 + load * 0.04, 0.12, 'highpass');
      if (load > 0.8) radioOnce('sonicStress', 'Alpha 2', 'Alpha 1, quá tải! Bẻ gắt lúc siêu thanh là rách cánh!', 20);
      if (P.hp <= 0) { P.hp = 0; destroy(P, null); return; }
    }
    if (P.sonicHeat >= 1) { P.sonic = false; popup('QUÁ NHIỆT — HẠ TỐC!', RED, 1.4); }
    if (!P.boomDone && P.speed > SONIC_SPEED) {   // sonic boom: vapour cone + bang
      P.boomDone = true; shake = Math.min(0.8, shake + 0.45); stats.booms++;
      const fw = fwdOf(P, new THREE.Vector3()), up = upOf(P, new THREE.Vector3()), rt = rightOf(P, new THREE.Vector3());
      for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2; _tmp.copy(P.pos).addScaledVector(up, Math.sin(a) * 0.55).addScaledVector(rt, Math.cos(a) * 0.55).addScaledVector(fw, -0.2); puff(smoke, _tmp, _pv.copy(up).multiplyScalar(Math.sin(a) * 1.5).addScaledVector(rt, Math.cos(a) * 1.5), 0.7, 0.06, 0.22, 0xffffff); }
      if (AU.ctx) { noiseHit(AU.ctx.currentTime, 180, 1.0, 0.9); noiseHit(AU.ctx.currentTime + 0.08, 90, 0.8, 1.1); }
      popup('BÙM! PHÁ BỨC TƯỜNG ÂM THANH', '#ffffff', 1.4);
    }
  } else P.sonicHeat = Math.max(0, P.sonicHeat - dt / 10);
  // ---- V: evasive roll ----
  P.evadeCD -= dt;
  if (pressed.KeyV && P.evadeCD <= 0 && P.boT <= 0) doEvade(kr);
  if (P.evadeT > 0) { P.evadeT -= dt; ctlP.roll = 0; ctlP.pitch = 0.15; ctlP.yaw = 0; if (P.sm) P.sm.roll = 0; }
  P.boostT = Math.max(0, (P.boostT || 0) - dt);
  ctlP.throttle = keys.ShiftLeft || keys.ShiftRight || P.boostT > 0 || P.sonic ? 1.0 : keys.KeyX ? 0.12 : 0.6;
  P.afterburner = ctlP.throttle === 1;
  flyPhysics(P, ctlP, dt);
  if (P.boostT > 0) P.speed = Math.min(17, P.speed + P.boostAcc * dt);
  // ceiling: past ZONE.y the air "pushes" the nose down, hard cap a few metres above
  if (P.pos.y > ZONE.y - 2 && P.boT <= 0) {
    const k = clamp((P.pos.y - (ZONE.y - 2)) / 8, 0, 1), fw = fwdOf(P, _fw);
    if (fw.y > -0.35) {
      _ax.crossVectors(fw, DOWN); const l = _ax.length();
      if (l > 1e-3) { P.q.premultiply(_q.setFromAxisAngle(_ax.divideScalar(l), k * 1.6 * dt)); P.q.normalize(); }
    }
    if (!P.looping && !document.pointerLockElement) aim.y = Math.min(aim.y, -0.25 * k);
    if (document.pointerLockElement && aim.y > 0) aim.y *= 1 - k; aim.normalize();
    if (P.pos.y > ZONE.y + 6) { P.pos.y = ZONE.y + 6; if (P.vel.y > 0) P.vel.y = 0; }
    radioOnce('ceiling', 'Blackboard', 'Alpha 1, chạm trần bay. Giảm độ cao!', 12);
  }
  if (P.evadeDur) {
    // barrel roll: exactly one turn around the nose, eased in and out
    const k = clamp(1 - Math.max(0, P.evadeT) / P.evadeDur, 0, 1), e = k * k * (3 - 2 * k);
    const ang = e * PI * 2;
    P.q.multiply(_q.setFromAxisAngle(FWD, (ang - P.evadeRolled) * P.evadeSide));
    P.evadeRolled = ang;
    if (k >= 1) P.evadeDur = 0;
    // wingtip vapour while rolling
    if (k < 0.9) for (const sx of [-1, 1]) { _tmp.set(sx * 0.8, 0.1, 0.5); P.obj.localToWorld(_tmp); puff(smoke, _tmp, _pv.set(0, 0, 0), 0.5, 0.05, 0.12, 0xffffff); }
  }
  {
    if (!P.prevVel) P.prevVel = P.vel.clone();
    const acc = _v1.subVectors(P.vel, P.prevVel).divideScalar(Math.max(dt, 1e-3)); acc.y += 9.81;
    P.prevVel.copy(P.vel);
    P.g = lerp(P.g ?? 1, clamp(acc.dot(upOf(P, _v2)) / 9.81, -3, 9), 0.08);
    P.gMax = Math.max(P.gMax || 1, P.g);
  }

  // move with sub-steps + collision
  const dist = P.speed * dt, steps = Math.max(1, Math.ceil(dist / 0.1));
  let hit = null;
  for (let i = 0; i < steps; i++) {
    P.pos.addScaledVector(P.vel, dt / steps);
    if (P.evadeT > 0 && !pointBlocked(_tmp.copy(P.pos).addScaledVector(P.evadeVec, 0.6), 0.25))   // stop sliding sideways if something is right there
      P.pos.addScaledVector(P.evadeVec, 6 * (P.evadeLatK ?? 1) * Math.sin(PI * clamp(1 - P.evadeT / 1.0, 0, 1)) * dt / steps);  // sideways arc of the barrel roll
    const h = collideSphere(P.pos, P.K.pr); if (h) hit = h;
  }
  P.hitCD -= dt;
  if (hit) {
    const f2 = fwdOf(P, _fw);
    const dot = f2.dot(hit.n);
    if (dot < -0.25 && P.hitCD <= 0) {   // hard impact: bounce and take damage
      const dmg = clamp(P.speed * 2.4 * -dot, 5, 35) * (hit.soft ? 0.5 : 1);
      damage(P, dmg, null);
      P.hitCD = 0.35; P.speed *= 0.6;
      burst(P.pos, 14, [0xffffff, 0xdfe8f5], 2, 0.8, 1);
      if (P.alive) flash('', hit.fan ? 'Ối! Quạt trần!' : hit.soft ? 'Vướng cây!' : hit.ground ? 'Chạm đất!' : 'Đâm tường!', 0.8);
      const nf = f2.clone().addScaledVector(hit.n, -2 * dot).normalize().lerp(hit.n, 0.2).normalize();
      _q.setFromUnitVectors(f2, nf); P.q.premultiply(_q);
      aim.copy(nf);
    } else if (hit.ground) { P.speed -= 2 * dt; if (Math.random() < 0.3) puff(smoke, P.pos, _pv.set(0, 0.4, 0), 0.6, 0.07, 0.3, 0xcfc6b0); }
  }
  // ---- cinematic pass-throughs ----
  for (const g of gaps) {
    if (Math.abs(P.pos.x - g.c.x) > g.r || Math.abs(P.pos.z - g.c.z) > g.r) { g.inside = false; continue; }
    const inside = g.test(P.pos);
    if (inside && !g.inside) onGapPass(g);
    g.inside = inside;
  }

  // ---- weapons ----
  P.gunT = (P.gunT || 0) - dt;
  const firing = (mouse.l || keys.Space || (touch && touch.n === 2)) && !P.overheat;
  P.invulnT = Math.max(0, (P.invulnT || 0) - dt);
  P.rapidT = Math.max(0, (P.rapidT || 0) - dt); P.shieldT = Math.max(0, (P.shieldT || 0) - dt);
  if (P.shieldMesh) { P.shieldMesh.visible = P.shieldT > 0 && (P.shieldT > 1.5 || Math.floor(clock * 8) % 2 === 0); P.shieldMesh.rotation.y += dt * 2; }
  if (firing && P.gunT <= 0) { fireGun(P, 0.008); P.gunT = P.rapidT > 0 ? 1 / 16 : 1 / 10; P.heat += P.rapidT > 0 ? 0 : 0.024; if (P.heat >= 1) { P.overheat = true; flash('', 'Súng quá nhiệt!', 0.9); } }
  if (!firing) P.heat = Math.max(0, P.heat - 0.4 * dt);
  else P.heat = Math.max(0, P.heat - 0.05 * dt);
  if (P.overheat && P.heat < 0.35) P.overheat = false;
  if (P.overheat) P.heat = Math.max(0, P.heat - 0.3 * dt);
  P.pylons[0] -= dt; P.pylons[1] -= dt;
  P.flareCD = (P.flareCD || 0) - dt;

  // weapon mode: G toggles; with no missiles left we're always on guns (no lock-on needed)
  if (pressed.KeyG) {
    if (P.msl <= 0) popup('HẾT TÊN LỬA — CHỈ CÒN SÚNG', YEL, 1);
    else { P.wpnGun = !P.wpnGun; popup(P.wpnGun ? 'CHẾ ĐỘ SÚNG' : `CHẾ ĐỘ TÊN LỬA ×${P.msl}`, P.wpnGun ? YEL : LOCKG, 1); }
  }
  const wasGun = P.gunMode;
  P.gunMode = P.msl <= 0 || !!P.wpnGun;
  if (P.gunMode && !wasGun && P.msl <= 0) popup('HẾT TÊN LỬA → CHẾ ĐỘ SÚNG', YEL, 1.6);
  // targeting
  if (pressed.Tab) {
    const list = enemiesSorted();
    if (list.length) { const i = list.findIndex(o => o.f === P.target); P.target = list[(i + 1) % list.length].f; P.lockP = 0; P.manualTgtT = 4; }
  }
  P.manualTgtT = (P.manualTgtT || 0) - dt;
  if (!P.target || !P.target.alive) { const list = enemiesSorted(); P.target = list.length ? list[0].f : null; P.lockP = 0; P.prevTgtD = null; }
  // nose targeting: always track the enemy closest to where the nose points (inside the lock cone)
  if (P.manualTgtT <= 0) {
    const can = enemiesSorted().filter(o => o.d < LOCK_RANGE && o.a < LOCK_CONE);
    const best = can[0], cur = can.find(o => o.f === P.target);
    let pick = null;
    if (best && !cur) pick = best.f;                                              // current one left the cone: take the one in front
    else if (best && cur && best.f !== cur.f && P.lockP < 1 && best.a < cur.a - 0.1) pick = best.f;  // a clearly more centred one
    else if (best && cur && best.f !== cur.f && best.a < 0.08 && cur.a > 0.25) pick = best.f;        // one is dead ahead: take it even if locked
    if (!best && !P.inEnv) {                                                      // nothing lockable: point at the enemy nearest the nose
      const all = enemiesSorted(), c = all.find(o => o.f === P.target);
      if (all[0] && (!c || all[0].a < c.a - 0.2)) pick = all[0].f;
    }
    if (pick && pick !== P.target) { P.target = pick; P.lockP = 0; P.prevTgtD = null; P.tgtSwitchFx = 0.4; }
  }
  P.tgtSwitchFx = Math.max(0, (P.tgtSwitchFx || 0) - dt);
  if (P.target) {
    const d = P.target.pos.distanceTo(P.pos), a = _toT.subVectors(P.target.pos, P.pos).normalize().angleTo(fwdOf(P, _fw));
    P.closing = P.prevTgtD != null ? lerp(P.closing || 0, (P.prevTgtD - d) / Math.max(dt, 1e-3), 0.1) : 0;
    P.prevTgtD = d; P.tgtD = d; P.tgtA = a;
    { const behind = _tmp.subVectors(P.pos, P.target.pos).dot(fwdOf(P.target, _tmp2)) < 0;   // am I on its six?
      P.tailT = behind && d < 30 && a < 0.4 ? (P.tailT || 0) + dt : Math.max(0, (P.tailT || 0) - dt * 3);
      if (P.tailT > 2.5 && P.target.kind === 'ace') eaglePraise(P.target, 'tail'); }
    P.inEnv = d < LOCK_RANGE && a < LOCK_CONE;
    if (P.gunMode) { P.lockP = 0; P.inEnv = d < GUN_RANGE && a < LOCK_CONE; }   // guns: no seeker, just "in range"
    const was = P.lockP;
    if (P.gunMode) { /* no lock-on with guns */ }
    else if (P.inEnv) { P.lockGrace = 0.8; P.lockP = Math.min(1, P.lockP + dt * (towerSees(P.target.pos) ? 1 : 0.5) / (0.3 + 0.45 * a / LOCK_CONE)); }  // faster near the centre, slower on a target hiding low
    else if (P.lockP >= 1 && P.lockGrace > 0) P.lockGrace -= dt;                                         // hold the lock briefly
    else P.lockP = Math.max(0, P.lockP - dt * 1.5);
    if (was < 1 && P.lockP >= 1) { P.lockFx = 0.5; lockedSound(); }
  } else { P.lockP = 0; P.inEnv = false; }
  P.lockFx = Math.max(0, (P.lockFx || 0) - dt);
  P.lockedByT = Math.max(0, (P.lockedByT || 0) - dt);
  if ((pressed.KeyF || pressed.Mouse2) && P.msl <= 0) popup('HẾT TÊN LỬA', RED, 0.9);
  if ((pressed.KeyF || pressed.Mouse2) && P.msl > 0 && P.wpnGun) { P.wpnGun = false; popup(`CHẾ ĐỘ TÊN LỬA ×${P.msl}`, LOCKG, 1); }
  else if ((pressed.KeyF || pressed.Mouse2) && P.msl > 0) {
    const slot = P.pylons[0] <= 0 ? 0 : P.pylons[1] <= 0 ? 1 : -1;
    if (slot >= 0 && P.lockP >= 1 && P.target && P.target.alive) { launchMissile(P, P.target); P.pylons[slot] = 2.6; P.msl--; if (P.msl === 0) popup('HẾT TÊN LỬA — DÙNG SÚNG!', RED, 1.6); }
    else if (slot >= 0) { popup('CHƯA KHOÁ MỤC TIÊU', YEL, 0.9); if (AU.ctx) tone(300, 220, 0.12, 0.06, 'square'); }
  }
  if (pressed.KeyC) camMode = (camMode + 1) % 3;

  // ---- speed rush: how "fast" it feels (speed, plus a bit extra when diving) ----
  {
    const fy = fwdOf(P, _fw).y;
    const target = clamp((P.speed - 8.5) / 6.5, 0, 1) * (1 + clamp(-fy - 0.25, 0, 0.6) * 0.5) + (P.speed > SONIC_SPEED ? 0.3 : 0);
    P.rush = lerp(P.rush || 0, clamp(target, 0, 1.3), 1 - Math.exp(-dt * 3));
    // air particles that whip past the camera: static in the world, so speed gives them parallax
    if (P.rush > 0.15) {
      P.airAcc = (P.airAcc || 0) + dt * P.rush * 140;
      while (P.airAcc >= 1) {
        P.airAcc--;
        const fw = fwdOf(P, _fw), a = rr(0, PI * 2), rad = rr(0.5, 2.2);
        _tmp.copy(P.pos).addScaledVector(fw, rr(3, 9)).addScaledVector(upOf(P, _tmp2), Math.sin(a) * rad).addScaledVector(rightOf(P, _tmp2), Math.cos(a) * rad);
        puff(smoke, _tmp, _pv.set(0, 0, 0), 0.45, 0.012, 0.02, 0xffffff);
      }
    }
    P.trails.forEach(t => { t.line.material.opacity = 0.45 + P.rush * 0.5; });
  }
  // ---- ground skim: fast & very low pays off ----
  if (P.pos.y < 3.2 && P.speed > 9.5 && P.boT <= 0) {
    P.skimT = (P.skimT || 0) + dt;
    if (P.skimT >= 1.5) { P.skimT = 0; score += 40; stats.skim++; popup('LƯỚT SÁT ĐẤT +40', YEL); }
  } else P.skimT = Math.max(0, (P.skimT || 0) - dt * 2);
  P.comboT = Math.max(0, (P.comboT || 0) - dt);
  if (P.comboT <= 0) P.combo = 0;

  // regen when out of combat for a while (sticky tape repairs)
  if (clock - P.lastDmgT > 6 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 2.5 * dt);
}

function inSchool(p) { return Math.abs(p.x) < ZONE.x && p.z < ZONE.zMax && p.z > ZONE.zMin && p.y < ZONE.y; }
function outDistance(p) {
  return Math.max(0, Math.abs(p.x) - ZONE.x) + Math.max(0, p.z - ZONE.zMax) + Math.max(0, ZONE.zMin - p.z);   // horizontal only: the ceiling is a soft barrier, not a blackout
}
function updateBlackout(dt, fwd) {
  const out = outDistance(P.pos);
  if (P.boT > 0) {                                   // fully blacked out: the plane tumbles, no control
    P.boT -= dt;
    ctlP.pitch = -0.4; ctlP.roll = 1; ctlP.yaw = 0.3;
    if (P.boT <= 0) wakeUp();
    return;
  }
  if (out > WARN_BAND) {
    P.bo = Math.min(1, P.bo + dt * (0.12 + (out - WARN_BAND) * 0.01));
    radioOnce('outZone', 'Blackboard', 'Alpha 1, đã vào vùng choáng! Quay đầu ngay, sẽ mất ý thức!', 10);
  } else if (out > 0) {
    P.bo = Math.max(0, P.bo - dt * 0.15);
    radioOnce('warnZone', 'Blackboard', 'Alpha 1, đang ở rìa khu vực tác chiến. Quay lại!', 14);
  } else P.bo = Math.max(0, P.bo - dt * 0.45);
  P.ctlAuth = 1 - P.bo * 0.75;
  if (P.bo > 0.15) {                                 // the pilot's hands get shaky
    const k = P.bo * P.bo;
    ctlP.pitch += Math.sin(clock * 7.3) * 0.6 * k + rr(-0.3, 0.3) * k;
    ctlP.roll += Math.sin(clock * 5.1 + 1) * 0.8 * k + rr(-0.3, 0.3) * k;
    if (Math.floor(clock * (1.2 + P.bo)) !== Math.floor((clock - dt) * (1.2 + P.bo))) heartbeat(0.3 + P.bo * 0.7);
  }
  if (P.bo >= 1) {
    P.boT = 1.8; P.ctlAuth = 0.3;
    flash('', 'MẤT KIỂM SOÁT…', 1.6);
    radio('Blackboard', 'Mất liên lạc với Alpha 1! Alpha 1, trả lời?!', true);
  }
}
function wakeUp() {
  P.sonic = false;
  const safe = arenaCenter(P.pos.z, new THREE.Vector3());
  P.pos.copy(safe); P.pos.y = 7; orient(P, _tmp.set(0, 0, safe.z > SCHOOL.mid ? -1 : 1)); aim.copy(fwdOf(P, _fw));
  P.speed = 7; P.bo = 0.55; P.ctlAuth = 1;
  for (const m of missiles) if (m.target === P) m.target = null;
  damage(P, 30, null);
  if (P.alive) { flash('', 'Bạn tỉnh lại… (-30 độ bền)', 2); radio('Alpha 2', 'Alpha 1 tỉnh lại rồi! Giữ trong khu vực tác chiến!'); }
}
function doEvade(dirHint) {
  P.evadeCalm = !underPursuit();   // chased -> no slow-mo / swinging camera for this roll
  P.evadeCD = 3; P.evadeT = P.evadeDur = 1.0; P.evadeRolled = 0; P.evadeFx = 1;
  const lx = _tmp.copy(aim).applyQuaternion(_q.copy(P.q).invert()).x;
  let side = dirHint ? Math.sign(dirHint) : Math.abs(lx) > 0.05 ? Math.sign(lx) : (Math.random() < 0.5 ? -1 : 1);
  // look before you leap: trace the sideways arc (plus the forward travel) on both sides and pick a clear one
  const fw = fwdOf(P, new THREE.Vector3()), lat = new THREE.Vector3().crossVectors(fw, UP);
  if (lat.lengthSq() < 1e-3) lat.copy(rightOf(P, _tmp)).setY(0);
  lat.normalize();   // horizontal: a banked plane must not dodge down into the ground
  const blockedAlong = sd => {
    let b = 0;
    for (const t of [0.15, 0.3, 0.45, 0.6, 0.8, 1.0]) {
      const disp = 6 / PI * (1 - Math.cos(PI * t));
      _tmp.copy(P.pos).addScaledVector(fw, (P.speed + 2) * t).addScaledVector(lat, sd * disp);
      if (pointBlocked(_tmp, 0.45)) b += 1.3 - t;   // early hits count more
    }
    return b;
  };
  const bs = blockedAlong(side), bo = blockedAlong(-side);
  if (bs > 0 && bo < bs) side = -side;
  P.evadeLatK = Math.min(bs, bo) > 0 ? 0.35 : 1;   // boxed in: mostly roll in place
  P.evadeSide = side;
  P.evadeVec.copy(lat).multiplyScalar(side);
  let nearest = 1e9;
  const chasing = missiles.filter(m => m.alive && m.target === P);   // taken before the flares pull some of them off onto a decoy
  for (const m of chasing) nearest = Math.min(nearest, m.p.distanceTo(P.pos));
  if (P.flares > 0) popFlares(P);
  whoosh();
  // speed boost: bigger when a missile is chasing or when we're slow
  const need = nearest < 30 || P.speed < 7;
  P.boostT = need ? 1.6 : 1.0; P.boostAcc = need ? 7 : 4;
  P.speed = Math.min(17, Math.max(P.speed + (need ? 2.5 : 1.2), 8));
  shake = Math.min(0.7, shake + 0.25);
  if (nearest < 10 && nearest > 1.0) {             // perfect timing: missiles overshoot
    for (const m of chasing) if (m.alive && m.p.distanceTo(P.pos) < 25) { m.target = null; m.spare = P; }   // dodged clean: it can't fuse on you or catch you in its blast
    score += 100; stats.evades++;
    startCine('evade', { subject: P, dur: 1.4, ts: 0.22, cd: 2, label: 'NÉ TÊN LỬA HOÀN HẢO! +100' });
  } else if (nearest < 1e9) flash('', P.flares > 0 ? 'Lộn vòng + pháo sáng!' : 'Lộn vòng né!', 0.8);
}
function onGapPass(g) {
  const now = clock;
  const hitP = g.hit(P.pos);
  const threats = missiles.filter(m => m.alive && m.target === P && m.p.distanceTo(P.pos) < 22);
  const chasers = flyers.filter(f => f.alive && f.team === 'red' && f.pos.distanceTo(P.pos) < 12 && _tmp.subVectors(P.pos, f.pos).dot(fwdOf(f, _tmp2)) > 0);
  for (const m of threats) m.target = { pos: hitP.clone(), vel: new THREE.Vector3(), alive: true, isPoint: true, name: g.name };
  for (const c of chasers) if (!c.K.tough && Math.random() < (c.kind === 'ace' || c.kind === 'elite' ? 0.15 : 0.55))   // aces rarely fall for it { c.forceCrash = hitP.clone(); c.forceCrashT = 2.5; }
  if (now - g.lastT > 6) { score += g.bonus; stats.passes++; }
  g.lastT = now;
  const dramatic = threats.length + chasers.length > 0;
  const extra = threats.length ? ` · tên lửa sẽ đâm vào ${g.name}!` : chasers.length ? ' · cắt đuôi địch!' : '';
  if (dramatic) startCine('pass', { subject: P, dur: 1.3, ts: 0.25, cd: 3, label: `${g.label} +${g.bonus}${extra}` });
  else flash('', `${g.label} +${g.bonus}`, 1.0);
}

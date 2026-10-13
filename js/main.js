'use strict';
// Máy Bay Giấy · world animation and the main loop
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  World animation
// =====================================================================
function animateWorld(dt) {
  fans.forEach((f, i) => f.rotation.y += dt * (7 + i * 0.4));
  const pa = flagGeo.attributes.position.array;
  for (let i = 0; i < pa.length; i += 3) { const x = flagBase[i]; pa[i + 2] = Math.sin(x * 1.7 - clock * 5.5 + flagBase[i + 1] * 0.5) * 0.22 * (x / 4.2); }
  flagGeo.attributes.position.needsUpdate = true; flagGeo.computeVertexNormals();
  walkers.forEach(w => {
    const x = Math.sin(clock * w.speed + w.phase) * w.amp, vx = Math.cos(clock * w.speed + w.phase);
    w.m.position.set(x, Math.abs(Math.sin(clock * 7 + w.phase)) * 0.05, w.z);
    w.m.rotation.y = vx > 0 ? -PI / 2 : PI / 2;
    w.box.min.set(x - 0.35, 0, w.z - 0.35); w.box.max.set(x + 0.35, 1.75, w.z + 0.35);
  });
  const sp = (clock * 0.9) % 2, st = sp < 1 ? sp : 2 - sp;
  shuttle.position.set(-20, 1.2 + Math.sin(st * PI) * 3.2, -830 - st * 6);
}

// =====================================================================
//  Main loop
// =====================================================================
let last = performance.now();
let fps = 60, slowT = 0, quality = 2;
function frame(now) {
  requestAnimationFrame(frame);
  try { frameInner(now); }
  catch (e) {
    window.reportErr && window.reportErr((e && e.message) + ' | ' + String(e && e.stack || '').split('\n')[1]);
    cine.t = 0; document.body.classList.remove('cine');
    try { renderer.render(scene, camera); } catch (e2) {}
  }
}
function autoQuality(realDt) {
  fps = lerp(fps, 1 / Math.max(realDt, 1e-3), 0.05);
  if (state !== 'play' || quality === 0) return;
  slowT = fps < 32 ? slowT + realDt : Math.max(0, slowT - realDt);
  if (slowT > 4) {
    slowT = 0; quality--;
    if (quality === 1) { renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); }
    else { sun.castShadow = false; }
  }
}
function frameInner(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (paused) { for (const k in pressed) delete pressed[k]; renderer.render(scene, camera); return; }
  const realDt = dt;
  autoQuality(realDt);
  cineCD -= realDt;
  if (cut && state === 'play' && cut.slow) dt *= cut.slow(cut.t);   // each cutscene brings its own slow motion
  if (cine.t > 0) { cine.t -= realDt; dt *= cine.ts; if (cine.t <= 0) document.body.classList.remove('cine'); }
  else if (state === 'play' && P && P.evadeDur > 0 && P.evadeCalm) { const k = 1 - P.evadeT / P.evadeDur; dt *= lerp(0.4, 1, clamp((k - 0.15) / 0.6, 0, 1)); }  // evade slow-mo
  clock += dt;
  animateWorld(dt);

  if (state === 'menu') {
    // idle formation flying over the school
    for (const f of flyers) {
      const i = flyers.indexOf(f), a = clock * 0.3 + i * 0.35;
      f.pos.set(Math.sin(a) * 5 + (i - 1) * 0.6, 3.5 + i * 0.5 + Math.sin(clock + i) * 0.2, -60 + Math.cos(a) * 5);
      const tangent = _tmp.set(Math.cos(a), 0, -Math.sin(a));
      orient(f, tangent); f.q.multiply(_q.setFromEuler(_e.set(0, 0, -0.5)));
      f.vel.copy(tangent).multiplyScalar(3);
    }
  } else if (!paused) {
    if (state === 'play') { missionTime += dt; if (cut) updateCutscene(dt); else updatePlayer(dt); updateWaves(dt); }
    for (const f of [...flyers]) {
      if (f === P) { if (P.falling) updateFalling(P, dt); continue; }
      if (f.alive && cut && (cut.kind === 'ending' || f === cut.boss || cut.crew.includes(f))) continue;   // scripted during the cutscene
      if (f.alive) { updateAI(f, dt); if (f.team === 'blue' && f.alive) f.hp = Math.min(f.maxHp, f.hp + 1.5 * dt); }
      else if (f.falling) updateFalling(f, dt);
      // damaged aircraft trail smoke
      if (f.alive && f.hp < f.maxHp * 0.5) { f.smokeT -= dt; if (f.smokeT <= 0) { f.smokeT = 0.06; puff(smoke, f.pos, _pv.set(0, 0.12, 0), 0.9, 0.04, 0.17, 0x666666); } }
    }
    if (P.alive && P.hp < P.maxHp * 0.4) { P.smokeT -= dt; if (P.smokeT <= 0) { P.smokeT = 0.05; puff(smoke, P.pos, _pv.set(0, 0.12, 0), 0.8, 0.035, 0.15, 0x777777); } }
    updateBullets(dt);
    updateMissiles(dt);
    updateFlares(dt);
    updateBombs(dt);
    updatePickups(dt);
    updateCourse();
    applyWind(dt);
    if (state === 'dead' || state === 'won') {
      endT += dt;
      if (state === 'won') { // autopilot: lazy circle
        const a = clock * 0.3; instructor(P, _tmp.set(Math.cos(a), 0.05, -Math.sin(a)), ctlP); ctlP.throttle = 0.6;
        if (P.alive) { flyPhysics(P, ctlP, dt); P.pos.addScaledVector(P.vel, dt); P.pos.y = Math.max(P.pos.y, 6); P.pos.x = clamp(P.pos.x, -50, 50); }
      }
      if (endT > 3.5 && $('result').classList.contains('hidden')) showResult(state === 'won');
    }
  }
  for (const f of flyers) if (f.obj.visible) f.trails.forEach((t, i) => updTrail(t, f.obj, (i ? 0.78 : -0.78) * (1 - 0.45 * f.sweep), 0.6 + 0.43 * f.sweep));
  // wing flutter: speed shakes both wings; pulling up loads both, rolling/turning hammers the outer wing
  for (const f of flyers) {
    const sm = f.sm || { pitch: 0, roll: 0 }, ok = f.alive ? 1 : 0;
    const spd = clamp((f.speed - 8.5) / 5, 0, 1), q = clamp((f.speed - 3) / 6, 0.2, 1.3);   // dynamic pressure-ish
    const pull = Math.abs(sm.pitch) * q, rollR = Math.max(0, sm.roll) * q, rollL = Math.max(0, -sm.roll) * q;
    const tL = ok * clamp(spd * 0.55 + pull * 0.6 + rollR * 0.9, 0, 1.4), tR = ok * clamp(spd * 0.55 + pull * 0.6 + rollL * 0.9, 0, 1.4);
    if (!f.flv) f.flv = { l: 0, r: 0, bl: 0, br: 0 };
    const k = Math.min(1, dt * 8);
    f.flv.l += (tL - f.flv.l) * k; f.flv.r += (tR - f.flv.r) * k;
    // wing bend grows steeply with how hard the plane is pulling: barely there in gentle turns, deep curl in
    // high-g U-turns and loops (sustained looping adds more); it builds up gradually rather than snapping
    const curve = v => v * (1 + 4 * clamp(Math.abs(v) - 0.45, 0, 1));
    const loopLoad = f.looping ? 1.8 : 0;   // a held loop / U-turn: deep curl whatever the airspeed (it slows as it climbs)
    const kb = Math.min(1, dt * 3);
    f.flv.bl += (ok * clamp(curve((sm.pitch * 0.8 + rollR * 0.6) * q) + loopLoad, -2, 2.6) - f.flv.bl) * kb;
    f.flv.br += (ok * clamp(curve((sm.pitch * 0.8 + rollL * 0.6) * q) + loopLoad, -2, 2.6) - f.flv.br) * kb;
    f.flutter = Math.max(f.flv.l, f.flv.r);
    f.sweep += ((f.sonic ? 1 : 0) - f.sweep) * Math.min(1, dt * 3);
    const sup = f.sonic ? 0.35 : 1;   // swept wings flutter less
    // turn rate (heading change, + = turning right) drives the wing fold: inside wing tucks in, outside wing stretches
    const fw = fwdOf(f, _tmp), hd = Math.atan2(fw.x, -fw.z);
    let dh = f.prevHd === undefined ? 0 : hd - f.prevHd; if (dh > PI) dh -= 2 * PI; if (dh < -PI) dh += 2 * PI; f.prevHd = hd;
    const horiz = Math.hypot(fw.x, fw.z), turn = horiz > 0.3 && dt > 0 ? clamp(dh / dt / 1.1, -1, 1) : 0;
    f.turnS = lerp(f.turnS || 0, ok * turn, Math.min(1, dt * 5));
    const tn = f.turnS, foldL = Math.max(0, -tn) * 0.9 - Math.max(0, tn) * 0.25, foldR = Math.max(0, tn) * 0.9 - Math.max(0, -tn) * 0.25;
    for (const u of f.flU) { u.uFl.value.set(f.flv.l * sup, f.flv.r * sup); u.uBend.value.set(f.flv.bl * sup, f.flv.br * sup); u.uT.value = clock + f.curl * 3.1; u.uSweep.value = f.sweep; u.uFold.value.set(foldL, foldR); }
  }
  updateConfetti(dt);
  updatePuffs(smoke, dt, 0.6);
  updatePuffs(fire, dt, 1.0);
  shake = Math.max(0, shake - dt * 1.5);
  hitMarkT -= dt;
  dmgFlash = Math.max(0, dmgFlash - dt * 1.2);
  $('vignette').style.opacity = state === 'play' ? Math.min(1, dmgFlash + (P.hp < 30 ? 0.35 + Math.sin(clock * 6) * 0.15 : 0)) : 0;
  // blackout: tunnel vision closing in, colour draining, then full black
  {
    const b = state === 'play' && P ? (P.boT > 0 ? 1 : P.bo) : 0;
    const bo = $('blackout');
    if (b > 0.01) {
      const hole = (1 - b) * 70, pulse = Math.sin(clock * 5) * 3 * b;
      bo.style.opacity = 1;
      bo.style.background = P.boT > 0 ? '#000' : `radial-gradient(circle at center, rgba(0,0,0,0) ${Math.max(0, hole + pulse)}%, rgba(0,0,0,${0.55 + 0.45 * b}) ${Math.max(5, hole + 30 + pulse)}%)`;
      $('greyout').style.opacity = Math.min(1, b * 1.3).toFixed(2);
    } else if (bo.style.opacity !== '0') { bo.style.opacity = 0; $('greyout').style.opacity = 0; }
  }

  updateSky(realDt);
  if (state === 'menu' && !$('menu').classList.contains('hidden')) hangar.render(realDt);
  const focus = P ? P.pos : CENTER;
  // snap the shadow camera to whole shadow-map texels so shadow edges don't crawl/shimmer as we fly
  {
    const a = Math.round(focus.dot(SUN_X) / SUN_TEXEL) * SUN_TEXEL, b = Math.round(focus.dot(SUN_Y) / SUN_TEXEL) * SUN_TEXEL, c = focus.dot(SUN_Z);
    _sunF.copy(SUN_X).multiplyScalar(a).addScaledVector(SUN_Y, b).addScaledVector(SUN_Z, c);
  }
  sun.position.copy(_sunF).add(SUN_OFF); sun.target.position.copy(_sunF);
  updateCamera(dt);

  if (AU.ctx) {
    const inHall = P && P.pos.z < HALL_Z0 && P.pos.z > HALL_Z1 && Math.abs(P.pos.x) < 15;
    const live = state === 'play' && P.alive;
    if (AU.master && !AU.muted) AU.master.gain.value = 0.7 * (cine.t > 0 ? 0.6 : 1) * (P && P.boT > 0 ? 0.25 : 1 - (P ? P.bo : 0) * 0.5);
    AU.wind.gain.value = lerp(AU.wind.gain.value, live ? 0.04 + (P.speed / 80) * 0.25 + (P.rush || 0) * 0.3 : 0.015, 0.1);
    AU.windF.frequency.value = 300 + (P ? P.speed : 20) * 16 + (P ? (P.rush || 0) * 900 : 0);
    AU.cicada.gain.value = lerp(AU.cicada.gain.value, inHall || state === 'menu' ? 0 : 0.01 * (0.6 + 0.4 * Math.sin(clock * 0.4)), 0.05);
    const locking = live && P.target && P.lockP > 0;
    AU.lock.o.frequency.value = P && P.lockP >= 1 ? 1250 : 950;
    AU.lock.g.gain.value = locking ? (P.lockP >= 1 ? 0.035 : (Math.floor(clock * (5 + P.lockP * 14)) % 2 ? 0.03 : 0)) : 0;
    const alert = live && missiles.some(m => m.alive && m.target === P);
    AU.alert.o.frequency.value = Math.floor(clock * 8) % 2 ? 1500 : 1100;
    const lockWarn = live && !alert && P.lockedByT > 0;
    if (lockWarn) AU.alert.o.frequency.value = 880;
    AU.alert.g.gain.value = alert ? 0.045 : lockWarn ? (Math.floor(clock * 6) % 2 ? 0.03 : 0) : 0;
  }
  bigT -= realDt; if (bigT <= 0) $('big').style.opacity = 0;
  updateRadio(realDt);
  drawHUD();
  for (const k in pressed) delete pressed[k];
  renderer.render(scene, camera);
}
setupScene();
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  resizeHud();
});

// Deep link straight to a chapter: index.html?chuong=9 turns the start button into "CHƠI CHƯƠNG 9"
{
  const ch = parseInt(new URLSearchParams(location.search).get('chuong'), 10);
  if (ch >= 1 && ch <= WAVES.length) {
    $('startBtn').textContent = `CHƠI CHƯƠNG ${ch} ▶`;
    $('startBtn').title = WAVES[ch - 1].title;
    $('startBtn').onclick = () => startGame(ch - 1, true);
  }
}

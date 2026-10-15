'use strict';
// Máy Bay Giấy · cinematic camera, boss intro, cutscenes and the ending
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Cinematic camera / slow motion
// =====================================================================
const cine = { t: 0, dur: 0, ts: 1, kind: '', anchor: new THREE.Vector3(), look: new THREE.Vector3(), subject: null };
let cineCD = 0;
// Being chased? (a missile tracking you, an enemy locking you, or one sitting on your tail pointing at you)
// Then the camera stays with you: no cinematic angles / slow motion while you need to fly.
function underPursuit() {
  if (!P || !P.alive) return false;
  if (P.lockedByT > 0 || missiles.some(m => m.alive && m.target === P)) return true;
  for (const f of flyers) {
    if (!f.alive || f.team !== 'red' || f.forceCrash) continue;
    _tmp.subVectors(P.pos, f.pos); const d = _tmp.length();
    if (d > 0.1 && d < 25 && _tmp.dot(fwdOf(f, _tmp2)) / d > 0.85) return true;
  }
  return false;
}
// Boss entrance: the camera swoops in from wide to a close-up on the boss, with a title card.
// Time crawls and the player can't be hurt while it plays.
function bossIntro(f, title, sub, dur = 3.2) {
  flash(`⚠ ${title}`, sub, dur + 0.6);
  if (AU.ctx) { tone(110, 82, 1.4, 0.16, 'sawtooth'); tone(220, 164, 1.4, 0.07, 'square', 0.05); noiseHit(AU.ctx.currentTime, 140, 0.5, 1.2); }
  P.invulnT = (cineOn ? dur * 0.16 : 0) + 0.5;   // game-time: covers the slowed-down intro plus half a second
  if (!cineOn || state !== 'play') return;
  const fw = fwdOf(f, new THREE.Vector3()), side = new THREE.Vector3().crossVectors(fw, UP).normalize();
  cine.kind = 'boss'; cine.t = cine.dur = dur; cine.ts = 0.16; cine.subject = f;
  cine.dir = fw.clone().multiplyScalar(0.75).addScaledVector(side, 0.55).addScaledVector(UP, 0.32).normalize();   // front-quarter view
  cine.anchor.copy(f.pos).addScaledVector(cine.dir, 22); cine.look.copy(f.pos);
  cineCD = 1.5; document.body.classList.add('cine');
}
function startCine(kind, o) {
  if (!cineOn || state !== 'play' || cineCD > 0 || cine.t > 0 || underPursuit()) { if (o.label) flash('', o.label, 1.2); return; }
  cine.kind = kind; cine.t = cine.dur = o.dur; cine.ts = o.ts; cine.subject = o.subject || P;
  const sp = cine.subject.pos;
  const dir = (o.dir ? o.dir.clone() : fwdOf(P, new THREE.Vector3())).normalize();
  const side = new THREE.Vector3().crossVectors(dir, UP); if (side.lengthSq() < 0.01) side.set(1, 0, 0);
  side.normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1);
  if (kind === 'pass') cine.anchor.copy(sp).addScaledVector(dir, 1.6).addScaledVector(side, 0.9).addScaledVector(UP, 0.25);
  else if (kind === 'kill') cine.anchor.copy(sp).addScaledVector(side, 2.6).addScaledVector(UP, 0.8).addScaledVector(dir, -1.2);
  else if (kind === 'strike') cine.anchor.copy(sp).addScaledVector(side, 2.2).addScaledVector(UP, 0.6).addScaledVector(dir, -2);
  else cine.anchor.copy(sp).addScaledVector(side, 1.1).addScaledVector(dir, -0.6).addScaledVector(UP, 0.35);
  if (cine.anchor.y < 0.1) cine.anchor.y = 0.1;
  for (let i = 0; i < 12 && pointBlocked(cine.anchor, 0.05); i++) cine.anchor.lerp(sp, 0.25);
  cine.look.copy(sp);
  cineCD = o.cd ?? 3.5;
  if (o.label) flash('', o.label, o.dur + 0.8);
  document.body.classList.add('cine');
  whoosh();
}

// =====================================================================
//  AI
// =====================================================================
const ctlA = { pitch: 0, roll: 0, yaw: 0, throttle: 0.7 };
const _des = new THREE.Vector3(), _leadDir = new THREE.Vector3(), _fa = new THREE.Vector3(), _tmp = new THREE.Vector3(), _tmp2 = new THREE.Vector3();
// =====================================================================
//  Cutscene: "Chỉ một chiếc thôi sao?" -- five of ours fly in, a single silhouette appears, and with a
//  couple of basic moves the Red Eagle drops two of them. Then the 3-vs-1 fight begins.
// =====================================================================
let cut = null;
const CUT_LEN = 15.8;
const FORM = [[0, 0, 0], [-4, 0.3, 3], [4, 0.3, 3], [-8, 0.6, 6], [8, 0.6, 6], [2, 0.7, 1.8]];   // P, Alpha 2, Alpha 3, Alpha 4, Alpha 5, Wingman just off Alpha 1's right wing (heading -z)
// the whole scene plays out at CUT_Y: above every tree, the flagpole and the roofs, so nothing blocks the shots
const CUT_Y = 26;
const EAGLE_KEYS = [   // [t, x, dy, z] (dy relative to the flight): head-on dash, pass by Alpha 4 with a roll, half-loop behind the flight, onto Alpha 5's tail
  [0, 0, 8, -280], [5.5, -3, 4, -175], [6.9, -5, 1, -141], [8.0, -2, 7, -120], [9.0, 2, 11, -128], [10.2, 8, 2, -158],
  // ...then it pulls ahead, hairpins round, and comes back to shave past Alpha 1's left wing (in slow motion)
  [11.4, 6, 4, -196], [12.4, 1, 5, -222], [13.3, -2.6, 1.6, -214], [14.0, -1.4, 0.35, -202], [14.8, -3, 1.2, -188], [15.8, -4, 2.5, -172],
].map(([t, x, dy, z]) => [t, x, CUT_Y + dy, z]);
// ---- Chương 9 intro: one white plane coming at us... which splits into two. Hắc Nhạn was hiding in
//      Bạch Nhạn's shadow, right behind it, nose to tail.
const TW_LEN = 9.2, TW_SPLIT = 5.0, TW_V = 22;
const twinsSlow = t => t > 5.15 && t < 6.35 ? lerp(0.25, 0.7, Math.abs(t - 5.75) / 0.6) : 1;
function startTwinsCut(white, black) {
  const names = WAVES[wave].flight || ALLIES.map(a => a.name);   // only the planes actually on this mission
  const crew = [P, ...names.map(n => flyers.find(f => f.alive && f.name === n)).filter(Boolean)];
  cut = { kind: 'twins', slow: twinsSlow, t: 0, boss: white, black, crew: [...crew, black], flight: crew, said: {} };
  P.invulnT = TW_LEN; document.body.classList.add('cine');
  if (!cineOn) endTwinsCut();
}
const twinPos = (side, t, out) => {   // side 0 = white (leader), 1 = black (hidden behind it)
  const z0 = -330 + TW_V * Math.min(t, TW_SPLIT), u = Math.max(0, t - TW_SPLIT);
  const sx = side ? 1 : -1, k = clamp(u / 3, 0, 1), ease = k * k * (3 - 2 * k);   // peel apart gently: left / right only
  return out.set(sx * (9 * ease + Math.max(0, u - 3) * 4), CUT_Y + 1, z0 + TW_V * u - (side ? 0.9 : 0));
};
function updateTwinsCut(dt) {
  const c = cut; c.t += dt; const t = c.t, cz = -100 - 8 * t;
  c.flight.forEach((f, i) => { if (!f || !f.alive) return; const o = FORM[i]; f.pos.set(o[0], CUT_Y + o[1] + Math.sin(t * 1.3 + i) * 0.15, cz + o[2]); orient(f, FWD); f.vel.set(0, 0, -8); f.speed = 8; });
  aim.set(0, 0, -1);
  [c.boss, c.black].forEach((f, side) => {
    const p0 = twinPos(side, t, new THREE.Vector3()), p1 = twinPos(side, t + 0.05, new THREE.Vector3());
    const d = _tmp.subVectors(p1, p0); f.pos.copy(p0); orient(f, d); f.vel.copy(d).divideScalar(0.05); f.speed = f.vel.length();
    if (t > TW_SPLIT) f.q.multiply(_q.setFromAxisAngle(FWD, (side ? 1 : -1) * 0.45 * Math.sin(Math.min(PI, (t - TW_SPLIT) * 1.2))));   // a gentle bank away and back
  });
  const line = (k, at, who, text) => { if (t > at && !c.said[k]) { c.said[k] = 1; sayNow(who, text); } };
  line(1, 0.4, 'Blackboard', 'Một tín hiệu... một chiếc máy bay màu trắng.');
  line(2, 2.6, 'Blackboard', 'Alpha 1, Wingman: radar chỉ thấy một chiếc. Một bandit thôi, nhưng đừng chủ quan.');
  line(3, 5.35, mateName(), mateName() === 'Wingman' ? 'Không phải một. Chiếc đen bay núp sau chiếc trắng... vẫn là trò cũ.' : 'Khoan... tally HAI bandit!');
  if (t > 5.6 && !c.said.card) { c.said.card = 1; flash('⚠ SONG NHẠN', 'Hắc Nhạn & Bạch Nhạn · cặp át nhanh nhất của Phe Đỏ', 2.6); whoosh(); if (AU.ctx) tone(110, 82, 1.2, 0.14, 'sawtooth'); }
  line(4, 7.2, 'Blackboard', 'Chúng tách hai bên! Coi chừng gọng kìm!');
  if (t >= TW_LEN || pressed.Enter || pressed.NumpadEnter) endTwinsCut();
}
function endTwinsCut() {
  const c = cut; cut = null; document.body.classList.remove('cine');
  [c.boss, c.black].forEach((f, side) => {
    twinPos(side, TW_LEN, f.pos); orient(f, _tmp.set(side ? 0.6 : -0.6, 0, 1)); f.speed = f.K.veq; f.mode = 'attack';
    f.role = side ? 'hammer' : 'bait';
  });
  P.invulnT = 1; aim.copy(fwdOf(P, _tmp)); camPos.copy(P.pos).add(_pv.set(0, 0.5, 2.5)); camAimS.copy(aim);
  for (const [w, t] of WAVES[wave].radio) radio(w, t);
}
function twinsCamera(dt) {
  const t = cut.t, w = cut.boss.pos;
  let pos = _cd, look = _cl, fov = 50, shot;
  if (t < 3.0) { shot = 1; pos.copy(P.pos).add(_pv.set(1.8, 1.0, 4.5)); look.copy(w); fov = lerp(46, 26, clamp(t / 3.0, 0, 1)); }   // over the shoulder: one white dot
  else if (t < 7.4) {
    // 2: the camera flies backwards just in front of them: a close-up of ONE white plane coming at us...
    //    at the split the black one slides out from behind it and they peel apart, then we pull back to see both
    shot = 2;
    // dead on the nose axis and at the same height, so the black one stays completely behind the white one
    const axis = _tmp2.set(0, CUT_Y + 1, Math.max(w.z, cut.black.pos.z));
    const close = lerp(7, 3.6, clamp((t - 3.0) / 2.0, 0, 1)), kb = clamp((t - TW_SPLIT - 0.3) / 2.4, 0, 1), back = kb * kb * (3 - 2 * kb);
    pos.copy(axis).add(_pv.set(0, back * 1.2, close + back * 22));
    look.copy(axis).add(_pv.set(0, back * 0.3, 0));
    fov = lerp(36, 58, back);
  }
  else { shot = 3; pos.copy(P.pos).add(_pv.set(0, 9, 16)); look.copy(P.pos).add(_pv.set(0, -1, -18)); fov = 62; }   // high and wide: one on each flank
  // shot 2 rides exactly with planes doing 22 m/s, so it is pinned rather than eased (easing would lag into them)
  camera.position.lerp(pos, shot !== cut.shot || shot === 2 ? 1 : 1 - Math.exp(-dt * 8)); cut.shot = shot;
  camera.up.set(0, 1, 0); camera.lookAt(look);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * (shot === 2 ? 10 : 4)); camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}
const cutSlow = t => t > 13.45 && t < 14.45 ? lerp(0.22, 0.6, Math.abs(t - 13.95) / 0.5) : 1;   // the close pass crawls
// =====================================================================
//  ENDING: Hạc Lớn's last run over the Red Faction's base, the view from high above Alpha 1,
//  and the Red Faction's flag burning away. Then the war is over.
// =====================================================================
const END_LEN = 75;   // a safety cap: the ending really ends once its last line has been read
const endingFires = [];   // where the finale's bombs fell: they burn through the ending
// Alpha 1's farewell pass: down from the orbit, low across the burning south courtyard, over the lab, right past
// the burning flag, and up over the yard towards home.  [t, x, y, z]
const END_PATH = [[8.5, 25, 40, -800], [10.0, 14, 22, -765], [11.5, 8, 11, -722], [13.0, 6, 21, -662], [14.5, -1.6, 14.2, FLAG_RED.z - 8], [16.0, -6, 18, -545], [17.5, -4, 30, -480], [19.5, 0, 46, -380], [22, 0, 56, -320], [34, 0, 92, -120], [75, 0, 100, -60]];
const endCurve = new THREE.CatmullRomCurve3(END_PATH.map(k => new THREE.Vector3(k[1], k[2], k[3])));
const endPathAt = (t, out) => {
  let k = 0; while (k < END_PATH.length - 2 && t > END_PATH[k + 1][0]) k++;
  const a = END_PATH[k][0], b = END_PATH[k + 1][0], u = (k + clamp((t - a) / (b - a), 0, 1)) / (END_PATH.length - 1);
  return out.copy(endCurve.getPoint(u));
};
const burnCvs = document.createElement('canvas'); burnCvs.width = 300; burnCvs.height = 200;
const burnTex = new THREE.CanvasTexture(burnCvs);
function resetRivalFlag() { rivalFlag.material.map = rivalFlagTex; rivalFlag.material.needsUpdate = true; rivalFlag.visible = true; }
function burnFlag(p) {   // p 0..1: the fire eats the flag from the fly end (x = 1) towards the pole (x = 0)
  const g = burnCvs.getContext('2d'), w = 300, h = 200;
  if (!g || !g.drawImage) return;
  if (p <= 0.001) { g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h); g.drawImage(rivalFlagTex.image, 0, 0, w, h); rivalFlag.material.map = burnTex; rivalFlag.material.needsUpdate = true; }
  const front = w * (1 - p);
  for (let y = 0; y < h; y += 8) {
    const fx = front + Math.sin(y * 0.09 + p * 20) * 14 + Math.sin(y * 0.031) * 10;
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(fx + 6, y, w, 8);   // burnt away
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(fx - 26, 0, fx + 6, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(30,10,0,0.9)'); gr.addColorStop(1, 'rgba(255,140,30,1)');
    g.fillStyle = gr; g.fillRect(fx - 26, y, 32, 8);   // charred, glowing edge
  }
  g.globalCompositeOperation = 'source-over';
  burnTex.needsUpdate = true;
  return front / w;
}
const END_FIRES = [[-50, 12, -640], [-30, 12, -645], [48, 12, -640], [0, 13, -639], [53, 19, -712], [-46, 10, -712], [-2, 1, -712], [0, 1, FLAG_RED.z], [-30, 1, -600], [34, 1, -560]];
function startEnding() {
  // the remnants turn tail; guns fall silent
  for (const f of [...flyers]) if (f.alive && f.team === 'red') removeFlyer(f);
  for (const u of groundUnits) u.alive = false;
  for (const m of missiles) { m.alive = false; scene.remove(m.mesh); } missiles.length = 0;
  flakShells.length = 0;
  const crew = flyers.filter(f => f.alive && f.team === 'blue' && f !== P && !isHeron(f));
  cut = { kind: 'ending', t: 0, boss: heron, crew, said: {}, drops: 99, fires: [], flagP: 0 };   // the bombs have already fallen: no more drops
  P.invulnT = 99; burnFlag(0);
  document.body.classList.add('cine');
  if (!cineOn) finishEnding();
}
function updateEnding(dt) {
  const c = cut; c.t += dt; const t = c.t;
  // 1 (0-4 s): the last bombing run along the base
  if (t < 4.2) {
    const hz = -660 - 50 * (t / 4.2);
    heron.pos.set(0, 24, hz); orient(heron, FWD); heron.vel.set(0, 0, -9.5); heron.speed = 9.5;
    if (t > 0.6 + c.drops * 0.38 && c.drops < 9) { c.drops++; const b = { p: heron.pos.clone().add(_pv.set(rr(-1, 1), -1, 0)), v: _pv.set(rr(-1.5, 1.5), -2, -7).clone(), alive: true, owner: heron, mesh: new THREE.Mesh(PLANE_GEOS.crumple, paperBallMat) }; b.mesh.scale.setScalar(0.9); scene.add(b.mesh); bombs.push(b); }
  } else { heron.pos.addScaledVector(_pv.set(0, 0.15, -1).normalize(), 9 * dt); }
  // paper balls hitting the base: paper bursts, fire, smoke columns
  for (const b of bombs) if (b.alive && b.owner === heron && (b.p.y < 1 || pointBlocked(b.p))) {
    b.alive = false; scene.remove(b.mesh);
    burst(b.p, 50, [0xf4f1e6, 0xffffff, 0xc8102e], 9, 2.5, 3); explosion(b.p, 1.1, 0.7);
    c.fires.push(b.p.clone().setY(Math.max(1, b.p.y)));
  }
  // the base keeps burning
  const spots = c.fires.concat(endingFires, t > 2 ? END_FIRES.map(a => new THREE.Vector3(...a)) : []);
  herons.forEach((h, i) => { if (h !== heron && h.alive) { h.pos.copy(heron.pos).add(_pv.set(i === 1 ? -16 : 16, -1, 12)); h.q.copy(heron.q); } });   // the other bombers keep station on the lead
  for (const sp of spots) {
    if (Math.random() < dt * 9) puff(fire, _tmp.copy(sp).add(_pv.set(rr(-1.5, 1.5), rr(0, 1), rr(-1.5, 1.5))), _pv.set(0, rr(1, 2.5), 0), rr(0.5, 0.9), 0.5, 1.4, [0xffa53a, 0xff6a1f, 0xffd23f][(Math.random() * 3) | 0]);
    if (Math.random() < dt * 5) puff(smoke, _tmp.copy(sp).add(_pv.set(rr(-1, 1), 2, rr(-1, 1))), _pv.set(rr(-0.3, 0.3), rr(2.5, 4), rr(-0.3, 0.3)), rr(3, 5), 0.8, 3.2, [0x2b2b2b, 0x444444, 0x555555][(Math.random() * 3) | 0]);
    if (Math.random() < dt * 2) burst(_tmp.copy(sp).add(_pv.set(0, 3, 0)), 2, [0xf4f1e6, 0xd8d2c0], 2, 3, 2);   // drifting scraps of paper
  }
  if (t < 8.5) {
    // 2 (4-8.5 s): Alpha 1 circles high above, the flight in a loose echelon
    const a0 = 0.6 + t * 0.09, cx = 0, cz = -690, R = 42;
    P.pos.set(cx + Math.cos(a0) * R, 46, cz + Math.sin(a0) * R);
    orient(P, _tmp.set(-Math.sin(a0), 0, Math.cos(a0))); P.q.multiply(_q.setFromAxisAngle(FWD, -0.35)); P.speed = 8; aim.copy(fwdOf(P, _tmp));
    c.crew.forEach((f, i) => { const a = a0 - 0.08 * (i + 1); f.pos.set(cx + Math.cos(a) * (R + 4 + i * 3), 45 - i * 0.8, cz + Math.sin(a) * (R + 4 + i * 3)); orient(f, _tmp.set(-Math.sin(a), 0, Math.cos(a))); f.q.multiply(_q.setFromAxisAngle(FWD, -0.35)); f.speed = 8; });
  } else {
    // 3 (8.5-19.5 s): the farewell pass, banking into the turns; the flight trails behind in line
    const p0 = endPathAt(t, new THREE.Vector3()), p1 = endPathAt(t + 0.05, new THREE.Vector3()), p2 = endPathAt(t + 0.1, new THREE.Vector3());
    const d1 = _tmp.subVectors(p1, p0), d2 = _tmp2.subVectors(p2, p1);
    const turn = Math.atan2(d1.x * d2.z - d1.z * d2.x, d1.x * d2.x + d1.z * d2.z);   // signed heading change -> bank into it
    c.bank = lerp(c.bank || 0, clamp(-turn * 18, -0.8, 0.8), 0.1);
    P.pos.copy(p0); orient(P, d1); P.q.multiply(_q.setFromAxisAngle(FWD, c.bank)); P.speed = d1.length() / 0.05; P.vel.copy(d1).divideScalar(0.05);
    aim.copy(fwdOf(P, _tmp));
    c.crew.forEach((f, i) => {
      const q0 = endPathAt(Math.max(8.5, t - 0.55 * (i + 1)), new THREE.Vector3()), q1 = endPathAt(Math.max(8.5, t - 0.55 * (i + 1)) + 0.05, new THREE.Vector3());
      f.pos.copy(q0).add(_pv.set((i % 2 ? 1 : -1) * (2 + i), 1 + i * 0.6, 0)); orient(f, _ar.subVectors(q1, q0)); f.speed = 9;
    });
  }
  // the flag catches and burns as Alpha 1 sweeps past it
  if (t > 12.6) {
    c.flagP = Math.min(1, (t - 12.6) / 3.6);
    const frontU = burnFlag(c.flagP);
    if (frontU !== undefined) {
      const fxw = 0.1 + 4 * frontU;
      for (let k = 0; k < 3; k++) puff(fire, _tmp.set(FLAG_RED.x + fxw + rr(-0.2, 0.2), 13.4 + Math.random() * 2.5, FLAG_RED.z + rr(-0.1, 0.1)), _pv.set(rr(-0.2, 0.2), rr(0.8, 1.6), 0), rr(0.3, 0.6), 0.12, 0.35, [0xffa53a, 0xff6a1f, 0xffd23f][k]);
      if (Math.random() < 0.5) puff(smoke, _tmp.set(FLAG_RED.x + fxw, 15.5, FLAG_RED.z), _pv.set(0, 1.5, 0), 2, 0.15, 0.7, 0x333333);
    }
    if (c.flagP >= 1) rivalFlag.visible = false;
  }
  // the lines wait for each other (c.free), so each one stays up long enough to read; the ending runs until the last is said
  const line = (k, at, who, text) => { if (t > at && t >= (c.free || 0) && !c.said[k]) { c.said[k] = 1; sayNow(who, text); c.free = t + readTime(text) * 0.8; return true; } };
  line(1, 0.4, 'Crane 1', 'Nhiệm vụ hoàn thành. Crane, RTB.');
  line(2, 4.6, 'Alpha 2', 'Xong rồi... cuộc chiến kết thúc rồi.');
  line(3, 7.0, 'Alpha 3', 'Nhìn từ trên này... sao chẳng thấy vui gì cả.');
  line(4, 12.8, 'Blackboard', 'Lá cờ Phe Đỏ đã cháy. Chiến tranh kết thúc. Tất cả... về trường thôi.');
  line(6, 15.4, 'Alpha 1', '(Một mảnh cờ cháy bay ngang qua cánh. Giấy kẻ ô... giống hệt giấy của mình.)');
  line(5, 18.4, 'Blackboard', 'Blackboard gọi Wingman, báo cáo vị trí— ...À. Phải rồi.');   // habit: there's nobody on that channel any more
  if (line(10, 21, 'Alpha 1', '(Xa ngoài tường rào, hai toà tháp vẫn sáng đèn. Một xanh. Một đỏ.)')) c.towerT = t;
  if (c.towerT != null && t > c.towerT + 0.5) towerStrings.visible = true;
  line(11, 21, 'Phe Đỏ (bắt sóng)', '...Hightower gọi các đơn vị còn lại. Chờ chỉ thị mới.');
  line(12, 21, 'Alpha 1', '(Bên kia cũng nghe lệnh từ Hightower. Vạch phấn, hai lá cờ... chỉ là những sợi dây.)');
  line(13, 21, 'Alpha 1', '(Trên hai toà tháp ấy, chưa ai từng gấp một chiếc máy bay.)');
  if ((c.said[13] && t >= c.free + 2.5) || t >= END_LEN || pressed.Enter || pressed.NumpadEnter) finishEnding();
}
function finishEnding() {
  if (cut && cut.kind === 'ending') { burnFlag(1); rivalFlag.visible = false; }
  cut = null; document.body.classList.remove('cine'); towerStrings.visible = false;
  missionComplete();
}
function endingCamera(dt) {
  const t = cut.t, h = heron.pos;
  let pos = _cd, look = _cl, fov = 55, shot;
  if (t < 4.2) { shot = 1; pos.set(16, 4, -735); look.copy(h).lerp(_tmp.set(0, 4, -712), 0.35); fov = 58; }   // low in their courtyard, the bomber roaring over
  else if (t < 8.5) {   // high above, behind Alpha 1, looking down on the burning school
    shot = 2; pos.copy(P.pos).addScaledVector(fwdOf(P, _tmp2), -7).add(_pv.set(0, 3.5, 0)); look.set(0, 0, -690); fov = 60;
  } else if (cut.towerT != null) {   // 4: pull far back and up: the two Hightowers, and the strings running from them into the yard
    shot = 4; const u = clamp((t - cut.towerT) / 14, 0, 1), e = u * u * (3 - 2 * u);
    pos.set(lerp(117, 228, e), lerp(90, 150, e), lerp(-278, -162, e)); look.set(0, 80, -400); fov = 72;   // broadside to the line between the towers, so both stay in frame
  } else {   // Alpha 1's view: tight behind the plane as it skims the ruins and climbs away
    shot = 3; const fw = fwdOf(P, _tmp2);
    pos.copy(P.pos).addScaledVector(fw, -2.3).addScaledVector(upOf(P, _ar).lerp(UP, 0.6).normalize(), 0.55);
    look.copy(P.pos).addScaledVector(fw, 22); fov = 64 + clamp((P.speed - 8) * 0.8, 0, 8);
  }
  camera.position.lerp(pos, shot !== cut.shot ? 1 : 1 - Math.exp(-dt * (shot === 3 ? 14 : 6))); cut.shot = shot;
  camera.up.set(0, 1, 0); if (shot === 3) camera.up.copy(upOf(P, _ui)).lerp(UP, 0.7).normalize();   // lean a little with the banks
  camera.lookAt(look);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}

// ---- Chương 12 intro: the giant bomber lumbers past, the five fighters ease in around it, then
//      open the throttles and surge ahead across the yard.
const ESC_V = 5;
// the finale's intro runs 3.8 s longer: Alpha 1 has a question before the throttles open
const escD = () => escortMode === 'lab' ? 0 : 3.8, escLen = () => 11.5 + escD(), escGo = () => 6.8 + escD();
const ESC_FORM = [[0, 3, -5], [-6, 0, 2], [6, 0, 2], [-10, 1, -3], [10, 1, -3]];   // P, Alpha 2, Alpha 3, Alpha 4, Alpha 5 around the bomber
function startEscortCut() {
  for (const a of ALLIES) if (!flyers.some(f => f.alive && f.name === a.name)) makeFlyer('ally', 'blue', a.name, a.color);
  const lan = flyers.find(f => f.alive && f.name === 'Alpha 2'), minh = flyers.find(f => f.alive && f.name === 'Alpha 3');
  const tuan = escortMode === 'lab' ? null : makeFlyer('ally', 'blue', 'Alpha 4', 0x9be37a), ha = escortMode === 'lab' ? null : makeFlyer('ally', 'blue', 'Alpha 5', 0xffb35c);   // Alpha 4 and Alpha 5 only fly the finale
  cut = { kind: 'escort', t: 0, boss: heron, crew: [P, lan, minh, tuan, ha], said: {} };
  P.invulnT = escLen(); document.body.classList.add('cine');
  if (!cineOn) endEscortCut();
}
const escHeronZ = t => -60 - ESC_V * t;   // lifts off over our courtyard
function updateEscortCut(dt) {
  const c = cut; c.t += dt; const t = c.t, hz = escHeronZ(t), y = 26;
  heron.pos.set(Math.sin(t * 0.4) * 0.6, y + Math.sin(t * 0.7) * 0.3, hz); orient(heron, FWD);
  heron.q.multiply(_q.setFromAxisAngle(FWD, Math.sin(t * 0.5) * 0.05)); heron.vel.set(0, 0, -ESC_V); heron.speed = ESC_V;
  // after the order to go, the fighters accelerate (a = 4 m/s²) and pull away ahead of the bomber
  const go = Math.max(0, t - escGo()), ahead = 0.5 * 4 * go * go;
  c.crew.forEach((f, i) => {
    if (!f || !f.alive) return;
    const o = ESC_FORM[i];
    f.pos.set(o[0] * (1 + go * 0.05), y + o[1] + Math.sin(t * 1.3 + i) * 0.15, hz + o[2] - ahead - (go > 0 ? i * 0.6 * go : 0));
    orient(f, FWD); f.speed = ESC_V + 4 * go; f.vel.set(0, 0, -f.speed);
    f.afterburner = go > 0;
  });
  if (go > 0 && Math.random() < 0.6) for (const f of c.crew) if (f && f.alive) puff(fire, _tmp.copy(f.pos).add(_pv.set(0, 0, 0.35)), _pv.set(0, 0, 3), 0.18, 0.12, 0.04, 0xffb347);
  aim.set(0, 0, -1);
  const line = (k, at, who, text) => { if (t > at && !c.said[k]) { c.said[k] = 1; sayNow(who, text); } };
  if (escortMode === 'lab') { line(1, 0.5, 'Blackboard', 'Crane đã cất cánh. Máy bay lớn nhất Phe Xanh từng gấp.'); line(2, 3.6, 'Alpha 2', 'To thật... nhưng chậm như rùa vậy.'); line(3, 5.0, 'Alpha 3', 'Chậm thế này, phòng không bắn trúng mất...'); }
  else talk(c, t, [   // the finale: flying beside the bombers, Alpha 1 asks the one question nobody else will
    ['Blackboard', 'Crane 1, 2, 3 đã cất cánh. Lần này là chuyến cuối.', 0.5],
    ['Alpha 1', 'Chúng ta... thực sự làm điều này sao?'],
    ['Blackboard', '...Đó là chỉ thị. Từ Hightower.'],
  ]);
  line(4, 6.6 + escD() + (escD() ? 0.2 : 0), 'Blackboard', 'Phi đội Alpha, tăng tốc! Mở đường phía trước cho Crane!');
  line(5, 8.4 + escD(), 'Alpha 3', 'Alpha 3, wilco! Theo tôi!');
  line(6, 10.2 + escD(), 'Crane', 'Crane bám theo sau. Trông cậy vào Alpha!');
  if (t > escGo() && !c.said.boost) { c.said.boost = 1; whoosh(); if (AU.ctx) tone(200, 700, 0.8, 0.07, 'sawtooth'); }
  if (t >= escLen() || pressed.Enter || pressed.NumpadEnter) endEscortCut();
}
function endEscortCut() {
  const c = cut; cut = null; document.body.classList.remove('cine');
  // jump to the end state: fighters out in front, bomber cruising behind
  const hz = escHeronZ(escLen()), ahead = 0.5 * 4 * (escLen() - escGo()) ** 2;
  heron.pos.set(0, 26, hz); orient(heron, FWD); heron.speed = 7;
  c.crew.forEach((f, i) => { if (!f || !f.alive) return; const o = ESC_FORM[i]; f.pos.set(o[0] * 1.2, 26 + o[1], hz + o[2] - ahead - i * 2.5); orient(f, FWD); f.speed = 9; });
  P.invulnT = 1; aim.set(0, 0, -1); camPos.copy(P.pos).add(_pv.set(0, 0.5, 2.5)); camAimS.copy(aim);
  escortBriefing();
}
function escortCutCamera(dt) {
  const t = cut.t, h = heron.pos;
  let pos = _cd, look = _cl, fov = 50;
  if (t < 3.6) {   // 1: low and ahead: the bomber lumbers overhead, huge against the sky
    pos.set(13, 21.5, -74); look.copy(h).add(_pv.set(0, 0.4, 0)); fov = lerp(46, 58, clamp(t / 3.6, 0, 1));   // low over our courtyard
  } else if (t < 6.6 + escD()) {   // 2: tracking alongside: the five fighters throttled back around it
    pos.copy(h).add(_pv.set(16, 1.5, 3)); look.copy(h).add(_pv.set(-2, 0, -2)); fov = 46;
  } else if (t < 9.6 + escD()) {   // 3: from behind and above the bomber: the fighters surge ahead
    pos.copy(h).add(_pv.set(0, 4, 13)); look.copy(h).add(_pv.set(0, 0, -40)); fov = 52;
  } else {   // 4: wide: the yard and the Red Faction's wing ahead
    pos.copy(h).add(_pv.set(-12, 9, 16)); look.set(0, 16, h.z - 120); fov = 55;
  }
  const shot = t < 3.6 ? 1 : t < 6.6 + escD() ? 2 : t < 9.6 + escD() ? 3 : 4;   // hard cut when the shot changes, smooth within a shot
  camera.position.lerp(pos, shot !== cut.shot ? 1 : 1 - Math.exp(-dt * 8)); cut.shot = shot;
  camera.up.set(0, 1, 0); camera.lookAt(look);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}
function sayNow(who, text) { radioQ.length = 0; radioQ.push({ who, text }); radioT = 0; }
// ---- Chương 11 intro, in three beats:
//  1. far ahead, low in the setting sun, a red speck rises slowly into the disc, shimmering in the heat haze
//  2. close in the formation: Wingman knows who it is, and starts to tell Alpha 1...
//  3. ...and mid-sentence he lights his burner: the old dash through the flight (EAGLE_KEYS), its first leg
//     squeezed from 5.5 s into 2, tearing Alpha 4's and Alpha 5's wings and shaving past Alpha 1
// Before the dash the timeline is c.t; from the dash on, EAGLE_KEYS' own timeline runs as eagleT (ot), and the
// path is shifted to follow the formation, which never stops flying north-to-south at 8 m/s
const EAGLE_TALK = [
  ['Blackboard', 'Radar bắt một tín hiệu... hướng mười hai giờ, ngay trong nắng.', 1.2],
  ['Alpha 3', 'Red Eagle vượt vạch ranh giới?! Chính hắn từng nói không ai được qua lằn ranh mà!'],
  ['Red Eagle', 'Tôi biết. Nhưng lệnh đã ban xuống. Hôm nay tôi phải phá lời hứa đó.'],
  ['Wingman', '...Là Red thật.'],
  ['Alpha 1', 'Anh quen hắn?'],
  ['Wingman', 'Từ hồi giữa sân còn chưa có vạch phấn nào... và ngoài kia còn chưa mọc lên hai cái tháp đó.'],
  ['Wingman', 'Nghe này, lính mới: đừng bao giờ đối đầu trực diện với cậu ta. Cậu ta sẽ—'],
];
const eagleT = (c, t) => { const u = t - c.D; return u < 2 ? u * 2.75 : u + 3.5; };   // dash time -> EAGLE_KEYS time
// the low sun behind him: a big soft disc, only drawn for this scene
const sunDisc = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.28, 'rgba(255,226,160,1)'); gr.addColorStop(0.36, 'rgba(255,170,90,0.75)'); gr.addColorStop(0.6, 'rgba(255,120,60,0.22)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  m.visible = false; m.renderOrder = -1; m.userData.dyn = true; scene.add(m); return m;
})();
// heat haze: an SVG turbulence displacement over the whole frame, only while we look into the sun
const heatEl = (() => {
  const d = document.createElement('div'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML = '<svg><filter id="heatHaze" x="0" y="0" width="100%" height="100%"><feTurbulence id="heatTurb" type="fractalNoise" baseFrequency="0.008 0.05" numOctaves="2" seed="1" result="n"/><feDisplacementMap id="heatDisp" in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';
  document.body.appendChild(d); return d;
})();
function heatHaze(on, t) {
  const cv = renderer.domElement;
  if (!on) { if (cv.style.filter) cv.style.filter = ''; return; }
  cv.style.filter = 'url(#heatHaze)';
  document.getElementById('heatTurb').setAttribute('baseFrequency', `${0.006 + Math.sin(t * 0.6) * 0.001} ${0.03 + Math.sin(t * 0.9) * 0.004}`);
  document.getElementById('heatDisp').setAttribute('scale', '2.5');
}
function startEagleCutscene(boss) {
  for (const a of ALLIES) if (!flyers.some(f => f.alive && f.name === a.name)) makeFlyer('ally', 'blue', a.name, a.color);   // the whole flight is here for this one
  const allies = ALLIES.map(a => flyers.find(f => f.alive && f.name === a.name));
  const tuan = makeFlyer('ally', 'blue', 'Alpha 4', 0x9be37a), ha = makeFlyer('ally', 'blue', 'Alpha 5', 0xffb35c);
  tuan.noReturn = ha.noReturn = true;
  const crew = [P, allies[0], allies[1], tuan, ha, wingmanUp()];
  cut = { kind: 'eagle', slow: t => cut && cut.D != null && t >= cut.D ? cutSlow(eagleT(cut, t)) : 1, t: 0, D: null, boss, crew, tuan, ha,
    path: new THREE.CatmullRomCurve3(EAGLE_KEYS.map(k => new THREE.Vector3(k[1], k[2], k[3]))), said: {}, prevB: new THREE.Vector3() };
  P.invulnT = 99; boss.hp = boss.maxHp;
  document.body.classList.add('cine');
  if (!cineOn) skipCutscene();
}
const eaglePos = (t, out) => {   // time -> point on the Catmull-Rom path through the keyframes
  let k = 0; while (k < EAGLE_KEYS.length - 2 && t > EAGLE_KEYS[k + 1][0]) k++;
  const a = EAGLE_KEYS[k][0], b = EAGLE_KEYS[k + 1][0], u = (k + clamp((t - a) / (b - a), 0, 1)) / (EAGLE_KEYS.length - 1);
  return out.copy(cut.path.getPoint(u));
};
function updateCutscene(dt) {
  if (cut.kind === 'lab') { updateLabCut(dt); return; }
  if (cut.kind === 'eagleArrive') { updateEagleArrive(dt); return; }
  if (cut.kind === 'eagleHold') { updateEagleHold(dt); return; }
  if (cut.kind === 'eagleFall') { updateEagleFall(dt); return; }
  if (cut.kind === 'nuke') { updateNukeCut(dt); return; }
  if (cut.kind === 'rescue') { updateRescueCut(dt); return; }
  if (cut.kind === 'ending') { updateEnding(dt); return; }
  if (cut.kind === 'escort') { updateEscortCut(dt); return; }
  if (cut.kind === 'twins') { updateTwinsCut(dt); return; }
  const c = cut; c.t += dt;
  const t = c.t, cz = -90 - 8 * t;
  // our flight: straight and level, gentle bobbing
  c.crew.forEach((f, i) => {
    if (!f || !f.alive) return;
    const o = FORM[i]; f.pos.set(o[0], CUT_Y + o[1] + Math.sin(t * 1.3 + i) * 0.15, cz + o[2]);
    orient(f, FWD); f.vel.set(0, 0, -8); f.speed = 8;
    if (f.downT != null) {   // wings shot through, not shot down: it peels off and glides for the ground, trailing a thin wisp
      const k = t - f.downT, s = o[0] < 0 ? -1 : 1;
      f.pos.add(_pv.set(s * k * 1.6, -k * k * 0.9, k * 3.5)); orient(f, _tmp.set(s * 0.35, -0.12 - k * 0.08, -1)); f.q.multiply(_q.setFromAxisAngle(FWD, -s * Math.min(0.9, k * 0.6)));
      if (Math.random() < dt * 12) puff(smoke, f.pos, _pv.set(0, 0.3, 0), 0.5, 0.05, 0.6, 0x9a9a9a);
      if (k > 4.5) { removeFlyer(f); f.alive = false; }
    }
  });
  aim.set(0, 0, -1);
  const b = c.boss;
  if (c.D == null) {
    const i = talk(c, t, EAGLE_TALK);
    c.spk = i >= 0 ? EAGLE_TALK[i][0] : null;
    // beat 1: out of the sun, straight at us. He flies north, steady, unhurried, rising slowly out of the glare; the
    // camera backs away in front of his nose a little slower than he comes, so he grows in the frame. Dead calm:
    // no wobble, no jinking, wings level
    // beat 2 (the talk in the formation): he is back where the dash starts, 190 m ahead of the flight
    const k = clamp(t / 8, 0, 1), e = k * k * (3 - 2 * k);
    const close = c.spk !== 'Wingman' && c.spk !== 'Alpha 1';
    if (close !== c.close) b.trails.forEach(tr => tr.init = false);   // he jumps between the two places: don't drag a vapour trail across the sky
    c.close = close;
    if (c.close) { b.pos.set(0, CUT_Y + 8 - 1.6 * (1 - e), -560 + 6 * t); b.vel.set(0, 0, 6); b.speed = 6; }
    else { b.pos.set(0, CUT_Y + 8, cz - 190); b.vel.set(0, 0, -8); b.speed = 8; }
    orient(b, _tmp.set(0.001, 0, 1));
    if (i === 2 && !c.said.card) { c.said.card = 1; flash('⚠ RED EAGLE', '', 2.6); if (AU.ctx) { tone(110, 82, 1.4, 0.16, 'sawtooth'); noiseHit(AU.ctx.currentTime, 140, 0.5, 1.2); } }
    if (i === EAGLE_TALK.length - 1 && t - c.lSaid > 2.2) {   // cut off mid-sentence: he goes
      c.D = t; sayNow('Blackboard', 'Hắn tăng tốc! Break, break!'); whoosh(); shake = 0.4;
      if (AU.ctx) tone(180, 900, 0.9, 0.09, 'sawtooth');
    }
    if (pressed.Enter || pressed.NumpadEnter) skipCutscene();
    return;
  }
  // beat 3: the dash. ot = EAGLE_KEYS time; the old path is moved along with the formation
  const ot = eagleT(c, t), off = 8 * (ot - t);
  const bp = eaglePos(ot, _v3).add(_pv.set(0, 0, off)), prev = c.prevB.copy(eaglePos(Math.max(0, ot - 0.05), new THREE.Vector3()));
  const dir = _tmp.subVectors(eaglePos(ot, new THREE.Vector3()), prev); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  b.vel.copy(dir).divideScalar(0.05); b.speed = b.vel.length(); b.pos.copy(bp); orient(b, dir);
  if (ot < 5.5 && Math.random() < 0.8) puff(fire, _tmp.copy(b.pos).addScaledVector(fwdOf(b, _tmp2), -0.4), _pv.set(0, 0, 0), 0.2, 0.15, 0.05, 0xffb347);   // the burner
  if (ot > 6.0 && ot < 7.4) b.q.multiply(_q.setFromAxisAngle(FWD, (ot - 6.0) / 1.4 * PI * 2));   // barrel roll through the formation
  // guns: short bursts at Alpha 4, then at Alpha 5
  const burstAt = (victim, t0, t1) => {
    if (ot < t0 || ot > t1 || !victim.alive) return;
    c.gunT = (c.gunT || 0) - dt; if (c.gunT > 0) return;
    c.gunT = 0.07; const keep = b.q.clone(); orient(b, _tmp2.subVectors(victim.pos, b.pos)); fireGun(b, 0.01); b.q.copy(keep);
  };
  burstAt(c.tuan, 6.3, 6.9); burstAt(c.ha, 9.9, 10.5);
  // he tears their wings and lets them go: it's the Hạc he came for, not them
  for (const [f, at] of [[c.tuan, 6.9], [c.ha, 10.5]]) if (ot > at && f.alive && f.downT == null) { f.downT = t; shake = 0.5; burst(f.pos, 24, [f.colorHex, 0xffffff], 3, 1, 0.8); }
  // dialogue
  const line = (k, at, who, text) => { if (ot > at && !c.said[k]) { c.said[k] = 1; sayNow(who, text); } };
  line(5, 7.2, 'Alpha 4', 'Alpha 4 trúng đạn! Rách cả hai cánh, phải hạ cánh khẩn cấp!');
  line(10, 8.6, 'Red Eagle', 'Các anh về đi. Tôi chỉ cần mấy chiếc Hạc.');
  line(6, 10.8, 'Alpha 2', 'Alpha 5 cũng phải hạ cánh... Hắn bắn rách cánh, mà không bắn rơi?');
  line(7, 12.3, 'Blackboard', 'Hắn quay lại! Alpha 1, hắn đối đầu trực diện!');
  if (ot > 13.95 && !c.said.pass) {   // the shave: wind blast, a shudder, paper flutter
    c.said.pass = 1; whoosh(); shake = 0.6;
    for (let i = 0; i < 16; i++) puff(smoke, _tmp.copy(P.pos).add(_pv.set(rr(-2.5, -0.5), rr(-0.4, 0.6), rr(-1, 1))), _pv.set(rr(-1, 0), 0, rr(1, 3)), 0.6, 0.02, 0.06, 0xffffff);
  }
  line(9, 14.9, 'Alpha 3', 'Alpha 1, hắn sượt qua chỉ cách một gang tay!');
  if (ot >= CUT_LEN || pressed.Enter || pressed.NumpadEnter) skipCutscene();
}
function skipCutscene() {
  const c = cut; if (!c) return;
  if (c.kind === 'lab') { endLabCut(); return; }
  if (c.kind === 'eagleArrive') { endEagleArrive(); return; }
  if (c.kind === 'eagleHold') { endEagleHold(); return; }
  if (c.kind === 'eagleFall') { endEagleFall(); return; }
  if (c.kind === 'nuke') { endNukeCut(); return; }
  if (c.kind === 'rescue') { endRescueCut(); return; }
  if (c.kind === 'ending') { finishEnding(); return; }
  if (c.kind === 'escort') { endEscortCut(); return; }
  if (c.kind === 'twins') { endTwinsCut(); return; }
  for (const f of [c.tuan, c.ha]) if (f.alive) { removeFlyer(f); f.alive = false; }   // both are on the ground by now, out of the fight
  sunDisc.visible = false; heatHaze(false);
  const b = c.boss; eaglePos(CUT_LEN, b.pos); b.pos.z += 8 * (CUT_LEN - c.t); orient(b, _tmp.set(0.1, 0, -1));   // where the dash ends, next to the formation as it is now b.speed = 11; b.mode = 'attack'; b.preyT = 0;
  P.invulnT = 1; P.speed = 8; aim.copy(fwdOf(P, _tmp)); camPos.copy(P.pos).add(_pv.set(0, 0.5, 2.5)); camAimS.copy(aim);
  cut = null; document.body.classList.remove('cine');
  radio('Blackboard', 'Alpha 1, 2, 3: chỉ còn ba chiếc. Giữ đội hình, đừng tách ra!', true);
  radio('Alpha 2', 'Khép vòng vây! Hắn leo cao thì bật siêu thanh truy kích!');
  radio('Red Eagle', 'Một quả đã đủ xoá Phòng Thí Nghiệm. Ba quả... các anh định xoá luôn cả khu Tây sao?', true);   // heard first
}
function cutsceneCamera(dt) {
  if (cut.kind === 'lab') { labCutCamera(dt); return; }
  if (cut.kind === 'eagleArrive') { eagleArriveCamera(dt); return; }
  if (cut.kind === 'eagleHold') { eagleHoldCamera(dt); return; }
  if (cut.kind === 'eagleFall') { eagleFallCamera(dt); return; }
  if (cut.kind === 'nuke') { nukeCamera(dt); return; }
  if (cut.kind === 'rescue') { rescueCamera(dt); return; }
  if (cut.kind === 'ending') { endingCamera(dt); return; }
  if (cut.kind === 'escort') { escortCutCamera(dt); return; }
  if (cut.kind === 'twins') { twinsCamera(dt); return; }
  const c = cut, t = c.t, b = c.boss.pos;
  let pos = _cd, look = _cl, fov = 55, pin = false;
  if (c.D == null) {
    const w = c.crew[5] && c.crew[5].alive ? c.crew[5] : P;
    if (c.spk === 'Wingman') { pos.copy(w.pos).add(_pv.set(0.9, 0.3, -1.6)); look.copy(w.pos); fov = 46; pin = true; }   // just ahead of Wingman, Alpha 1 over his shoulder
    else if (c.spk === 'Alpha 1') { pos.copy(P.pos).add(_pv.set(-0.9, 0.3, -1.5)); look.copy(P.pos); fov = 46; pin = true; }
    else {   // dead ahead of his nose, backing away from him: the whole sun in the frame behind him
      pos.set(0, CUT_Y + 7.9, b.z + Math.max(2.6, 7 - 0.35 * t)); look.set(0, CUT_Y + 7.9, b.z - 10); fov = 40; pin = true;
    }
    const sunShot = fov === 40 && c.spk !== 'Wingman' && c.spk !== 'Alpha 1';
    sunDisc.visible = sunShot; heatHaze(sunShot, t);
    if (sunShot) {   // the full disc, a touch above the middle: where he ends up
      sunDisc.position.set(0, CUT_Y + 7.85 + 0.055 * 900, b.z - 900); sunDisc.scale.setScalar(200); sunDisc.quaternion.copy(camera.quaternion);
    }
  } else {
    sunDisc.visible = false; heatHaze(false);
    const ot = eagleT(c, t), dz = 8 * (ot - t);
    if (ot < 5.8) {   // from behind Alpha 1: he comes out of the sun like a shot
      pos.copy(P.pos).add(_pv.set(1.8, 1.0, 4.5)); look.copy(b); fov = lerp(28, 55, clamp(ot / 5.8, 0, 1));
    } else if (ot < 7.6) {   // side-on as he slices past Alpha 4
      pos.set(-16, CUT_Y + 1.5, -90 - 8 * 6.6 + 2 + dz); look.copy(b).lerp(c.tuan.pos, 0.4); fov = 50;
    } else if (ot < 9.6) {   // from below as he pulls up and over
      pos.copy(b).add(_pv.set(7, -4, 5)); look.copy(b); fov = 50;
    } else if (ot < 11.4) {   // riding on his tail as he tears Alpha 5's wings
      pos.copy(b).addScaledVector(fwdOf(c.boss, _tmp2), -5).addScaledVector(UP, 1.3); look.copy(b).addScaledVector(fwdOf(c.boss, _tmp2), 20); fov = 58;
    } else if (ot < 13.1) {   // high behind the three left: he hairpins round up ahead
      pos.copy(P.pos).add(_pv.set(0, 4.5, 9)); look.copy(b); fov = 46;
    } else {   // tight telephoto over Alpha 1's right shoulder, slowly dollying in while he shaves past the left wing
      const k = clamp((ot - 13.1) / 1.6, 0, 1);
      pos.copy(P.pos).add(_pv.set(lerp(1.1, 0.7, k), lerp(0.42, 0.3, k), lerp(1.4, 0.9, k)));
      look.copy(P.pos).add(_pv.set(-1.2, 0.05, -2)).lerp(b, ot < 14.15 ? 0.35 : 0.12);
      fov = lerp(42, 30, k);
    }
    const shot = ot < 5.8 ? 0 : ot < 7.6 ? 1 : ot < 9.6 ? 2 : ot < 11.4 ? 3 : ot < 13.1 ? 4 : 5;
    pin = c.shotD !== shot; c.shotD = shot;   // a hard cut on each new shot, eased within it
  }
  if (pin) { camera.position.copy(pos); camera.up.set(0, 1, 0); camera.lookAt(look); camera.fov = fov; camera.updateProjectionMatrix(); camPos.copy(camera.position); return; }
  camera.position.lerp(pos, t < 0.05 ? 1 : 1 - Math.exp(-dt * 10));
  camera.up.set(0, 1, 0); camera.lookAt(look);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}

// a cutscene's dialogue played back to back: each line waits until the one before has been on screen long enough
// to read (85% of its radio time). [who, text, earliest?]; returns the index of the line being said (-1 = none yet)
function talk(c, t, lines) {
  c.li ??= 0; c.lAt ??= 0;
  const L = lines[c.li];
  if (L && t >= Math.max(c.lAt, L[2] ?? 0)) { sayNow(L[0], L[1]); c.li++; c.lAt = t + readTime(L[1]) * 0.85; c.lSaid = t; }
  return c.li - 1;
}

// ---- Chương 11, the end: Red Eagle is beaten. He glides in a wide, slow circle high over the yard (above every
//      roof, so nothing gets in the way), torn and tired; Wingman slides in on his outer wing and hears him out,
//      and asks him to land. He won't. He says goodbye, rolls over and lets the plane fall, and Wingman watches.
const FALL_R = 28, FALL_V = 4.5;
const FALL_LINES = [
  ['Red Eagle', 'Mấy quả bom đó... xin các anh đừng thả. Bên dưới đó cũng là giấy của các anh.', 0.8],
  ['Wingman', 'Tôi nghe rồi, bạn già.'],
  ['Wingman', 'Đáp xuống đi, Red. Đầu hàng đi. Hôm nay không ai phải rơi nữa.'],
  ['Red Eagle', 'Cậu biết tôi mà. Red Eagle không đáp xuống bên này lằn ranh.'],
  ['Red Eagle', 'Mà lằn ranh đó đâu phải hai đứa mình kẻ. Ngẩng lên mà xem... đèn trên đó chưa bao giờ tắt.'],
  ['Red Eagle', 'Nhớ không? Ba đứa mình từng hẹn sẽ cùng bay qua khỏi bức tường rào kia.'],
  ['Wingman', 'Cậu bay cao hơn mây. Tôi dạy bọn nhỏ bay. Còn cô ấy gấp một con Hạc đủ to chở cả ba.'],
  ['Red Eagle', 'Cuối cùng cô ấy cũng gấp được rồi... chỉ là chở thứ khác.'],
  ['Red Eagle', 'Tạm biệt, bạn già. Bay nốt tới ngày được nghỉ hưu nhé. Nhắn cô ấy... tôi không giận.'],
];
function startEagleFall(e) {
  const w = wingmanUp(), blues = flyers.filter(f => f.alive && f.team === 'blue' && f !== P && f !== w);
  for (const m of missiles) { m.alive = false; scene.remove(m.mesh); } missiles.length = 0;
  const fd = fwdOf(e, new THREE.Vector3()).setY(0); if (fd.lengthSq() < 1e-3) fd.set(0, 0, -1); fd.normalize();
  const rt = new THREE.Vector3().crossVectors(fd, UP).normalize();
  // the circle turns right, so its centre is off his right wing; kept well inside the school
  const C = e.pos.clone().addScaledVector(rt, FALL_R); C.x = clamp(C.x, -45, 45); C.z = clamp(C.z, SCHOOL.zS + 45, SCHOOL.zN - 45); C.y = 0;
  const a = e.pos.clone().sub(C).setY(0); if (a.lengthSq() < 1) a.copy(rt).negate(); a.normalize();
  const b = new THREE.Vector3().crossVectors(UP, a).negate();   // the direction of travel at the start of the circle
  cut = { kind: 'eagleFall', t: 0, boss: e, crew: [w, ...blues], said: {}, e, w, blues, C, a, b, y: Math.max(e.pos.y, CUT_Y), fallT: Infinity,
    from: [e, P, w, ...blues].map(f => f.pos.clone()) };
  P.invulnT = 99; document.body.classList.add('cine');
  if (!cineOn) endEagleFall();
}
// a point on the circle: angle phi, radius r, height y; tangent and outward come out in _fT / _fO
const _fT = new THREE.Vector3(), _fO = new THREE.Vector3();
function circlePt(c, phi, r, y, out) {
  _fO.copy(c.a).multiplyScalar(Math.cos(phi)).addScaledVector(c.b, Math.sin(phi));
  _fT.copy(c.a).multiplyScalar(-Math.sin(phi)).addScaledVector(c.b, Math.cos(phi));
  return out.copy(c.C).addScaledVector(_fO, r).setY(y);
}
// where everyone is at time t: him on the circle, Wingman just outside him, Alpha 1 and the others trailing behind
function fallPos(c, who, t, out) {
  const w = FALL_V / FALL_R, phi = w * t;
  if (who === 'e') {
    if (t <= c.fallT) return circlePt(c, phi, FALL_R, c.y, out);
    const k = t - c.fallT; circlePt(c, w * c.fallT, FALL_R, c.y, out);   // rolled over: off the circle, nose down, gone
    return out.addScaledVector(_fT, FALL_V * k).add(_pv.set(0, -2.6 * k * k, 0));
  }
  if (who === 'w') return circlePt(c, phi, FALL_R + 3.4, c.y + 0.45, out);
  return circlePt(c, phi - (9 + who * 4) / FALL_R, FALL_R + (who % 2 ? 4 : -1.5), c.y + 1.5 + who * 0.4, out);
}
function updateEagleFall(dt) {
  const c = cut; c.t += dt; const t = c.t, e = c.e;
  const s = clamp(t / 2.5, 0, 1), j = s * s * (3 - 2 * s);   // everyone eases from where they were onto the circle
  const place = (f, who, i) => {
    const p0 = fallPos(c, who, t, new THREE.Vector3()), p1 = fallPos(c, who, t + 0.05, new THREE.Vector3());
    if (j < 1) { p0.lerpVectors(c.from[i], p0, j); p1.lerpVectors(c.from[i], p1, Math.min(1, j + 0.02)); }
    f.pos.copy(p0); orient(f, _tmp.subVectors(p1, p0)); f.vel.copy(_tmp).divideScalar(0.05); f.speed = f.vel.length();
  };
  place(e, 'e', 0);
  if (t > c.fallT) e.q.multiply(_q.setFromAxisAngle(FWD, Math.min(PI, (t - c.fallT) * 2.2)));   // the roll onto his back
  else e.q.multiply(_q.setFromAxisAngle(FWD, 0.18 + Math.sin(t * 1.7) * 0.08));   // banked into the (right-hand) turn, a tired wobble
  if (Math.random() < dt * 6) puff(smoke, e.pos, _pv.set(0, 0.3, 0), 0.6, 0.05, 0.5, 0x8a8a8a);
  place(P, 0, 1); aim.copy(fwdOf(P, _tmp));
  if (c.w && c.w.alive) { place(c.w, 'w', 2); c.w.q.multiply(_q.setFromAxisAngle(FWD, t > c.fallT ? 0.18 + Math.min(0.45, (t - c.fallT) * 0.4) : 0.18)); }   // tipping a wing to watch him go
  c.blues.forEach((f, i) => { if (f.alive) { place(f, i + 1, i + 3); f.q.multiply(_q.setFromAxisAngle(FWD, 0.18)); } });
  const i = talk(c, t, FALL_LINES);
  c.spk = i >= 0 && t - c.lSaid < readTime(FALL_LINES[i][1]) * 0.85 + 0.6 ? FALL_LINES[i][0] : null;
  if (i === FALL_LINES.length - 1 && c.fallT === Infinity && t - c.lSaid > readTime(FALL_LINES[i][1]) * 0.7) c.fallT = t;   // the goodbye said: he lets go
  if (t > c.fallT + 2.6 && !c.said.bb) { c.said.bb = 1; sayNow('Blackboard', 'Red Eagle... đã rơi.'); }
  if (t > c.fallT + 5.4 && !c.said.bb2) { c.said.bb2 = 1; sayNow('Blackboard', '...Red vẫn luôn thích bay lúc hoàng hôn.'); }   // off-script, and she knows it
  if (t >= c.fallT + 8.6 || pressed.Enter || pressed.NumpadEnter) endEagleFall();
}
function endEagleFall() {
  const c = cut; cut = null; document.body.classList.remove('cine');
  if (c.e.alive) { c.e.pos.y = Math.max(c.e.pos.y, 1); destroy(c.e, c.e.lastHitBy || P); }   // far below by now: the burst is down in the yard
  const fd = fwdOf(P, new THREE.Vector3()).setY(0).normalize();
  P.invulnT = 1; P.speed = 8; orient(P, fd); aim.copy(fd); camPos.copy(P.pos).addScaledVector(fd, -2.5).add(_pv.set(0, 0.5, 0)); camAimS.copy(aim);
  if (c.w && c.w.alive) c.w.mode = 'attack';
}
function eagleFallCamera(dt) {
  const c = cut, t = c.t, e = c.e, w = c.w && c.w.alive ? c.w : P;
  let fov = 44;
  const fe = fwdOf(e, _tmp2).setY(0).normalize(), out = _ar.crossVectors(fe, UP).negate();   // his heading, and the outside of the turn (his left: where Wingman is)
  // close-ups sit just ahead of the speaker looking back, the other one over his shoulder
  if (t > c.fallT) { _cd.copy(w.pos).addScaledVector(fwdOf(w, _tmp), -1.5).addScaledVector(out, 0.3).add(_pv.set(0, 0.6, 0)); _cl.copy(e.pos); fov = 50; }   // over Wingman's shoulder, watching him fall
  else if (c.spk === 'Wingman') { _cd.copy(w.pos).addScaledVector(fe, 1.5).addScaledVector(out, 0.9).add(_pv.set(0, 0.28, 0)); _cl.copy(w.pos); }   // Wingman, from outside the turn
  else if (c.spk === 'Red Eagle') { _cd.copy(e.pos).addScaledVector(fe, 1.6).addScaledVector(out, -0.95).add(_pv.set(0, 0.3, 0)); _cl.copy(e.pos); }   // him, from inside the turn
  else { const mid = _tmp.addVectors(e.pos, w.pos).multiplyScalar(0.5); _cd.copy(mid).addScaledVector(fe, 5).addScaledVector(out, -1.5).add(_pv.set(0, 1.2, 0)); _cl.copy(mid); fov = 46; }   // the two of them
  camera.position.copy(_cd);
  camera.up.set(0, 1, 0); camera.lookAt(_cl);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}

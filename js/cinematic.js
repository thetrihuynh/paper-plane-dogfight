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
const FORM = [[0, 0, 0], [-4, 0.3, 3], [4, 0.3, 3], [-8, 0.6, 6], [8, 0.6, 6]];   // P, Lan, Minh, Tuấn, Hà (heading -z)
// the whole scene plays out at CUT_Y: above every tree, the flagpole and the roofs, so nothing blocks the shots
const CUT_Y = 26;
const EAGLE_KEYS = [   // [t, x, dy, z] (dy relative to the flight): head-on dash, pass by Tuấn with a roll, half-loop behind the flight, onto Hà's tail
  [0, 0, 8, -280], [5.5, -3, 4, -175], [6.9, -5, 1, -141], [8.0, -2, 7, -120], [9.0, 2, 11, -128], [10.2, 8, 2, -158],
  // ...then it pulls ahead, hairpins round, and comes back to shave past Ô Li 1's left wing (in slow motion)
  [11.4, 6, 4, -196], [12.4, 1, 5, -222], [13.3, -2.6, 1.6, -214], [14.0, -1.4, 0.35, -202], [14.8, -3, 1.2, -188], [15.8, -4, 2.5, -172],
].map(([t, x, dy, z]) => [t, x, CUT_Y + dy, z]);
// ---- Chương 9 intro: one white plane coming at us... which splits into two. Hắc Ưng was hiding in
//      Bạch Ưng's shadow, right behind it, nose to tail.
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
  line(1, 0.4, 'Bảng Đen', 'Một tín hiệu... một chiếc máy bay màu trắng.');
  line(2, 2.6, 'Bảng Đen', 'Ô Li 1, Lan: chỉ có hai em ngoài đó. Một chiếc thôi, nhưng đừng chủ quan.');
  line(3, 5.35, 'Lan', 'Khoan... có HAI chiếc!');
  if (t > 5.6 && !c.said.card) { c.said.card = 1; flash('⚠ SONG ƯNG', 'Hắc Ưng & Bạch Ưng · cặp át nhanh nhất của Phe Đỏ', 2.6); whoosh(); if (AU.ctx) tone(110, 82, 1.2, 0.14, 'sawtooth'); }
  line(4, 7.2, 'Bảng Đen', 'Chúng tách ra hai bên! Đừng để bị kẹp giữa!');
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
//  ENDING: Hạc Lớn's last run over the Red Faction's base, the view from high above Ô Li 1,
//  and the Red Faction's flag burning away. Then the war is over.
// =====================================================================
const END_LEN = 19.5;
// Ô Li 1's farewell pass: down from the orbit, low across the burning base, right past the burning flag,
// over the river and up into the sky towards home.  [t, x, y, z]
const END_PATH = [[8.5, 25, 40, -1500], [10.0, 14, 20, -1440], [11.5, 10, 9, -1390], [13.0, 2, 10, -1300], [14.5, -1.6, 14.2, -1208], [16.0, -6, 18, -1120], [17.5, -4, 30, -1060], [19.5, 0, 46, -960]];
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
const END_FIRES = [[-50, 15, -1180], [-48, 15, -1240], [50, 15, -1220], [0, 13, -1470], [-20, 13, -1472], [22, 13, -1468], [18, 1, -1390], [0, 1, -1200], [-30, 1, -1320], [34, 1, -1180]];
function startEnding() {
  // the remnants turn tail; guns fall silent
  for (const f of [...flyers]) if (f.alive && f.team === 'red') removeFlyer(f);
  for (const u of groundUnits) u.alive = false;
  for (const m of missiles) { m.alive = false; scene.remove(m.mesh); } missiles.length = 0;
  flakShells.length = 0;
  const crew = flyers.filter(f => f.alive && f.team === 'blue' && f !== P && f !== heron);
  cut = { kind: 'ending', t: 0, boss: heron, crew, said: {}, drops: 0, fires: [], flagP: 0 };
  P.invulnT = 99; burnFlag(0);
  document.body.classList.add('cine');
  if (!cineOn) finishEnding();
}
function updateEnding(dt) {
  const c = cut; c.t += dt; const t = c.t;
  // 1 (0-4 s): the last bombing run along the base
  if (t < 4.2) {
    const hz = -1330 - 40 * (t / 4.2);
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
  const spots = c.fires.concat(t > 2 ? END_FIRES.map(a => new THREE.Vector3(...a)) : []);
  for (const sp of spots) {
    if (Math.random() < dt * 9) puff(fire, _tmp.copy(sp).add(_pv.set(rr(-1.5, 1.5), rr(0, 1), rr(-1.5, 1.5))), _pv.set(0, rr(1, 2.5), 0), rr(0.5, 0.9), 0.5, 1.4, [0xffa53a, 0xff6a1f, 0xffd23f][(Math.random() * 3) | 0]);
    if (Math.random() < dt * 5) puff(smoke, _tmp.copy(sp).add(_pv.set(rr(-1, 1), 2, rr(-1, 1))), _pv.set(rr(-0.3, 0.3), rr(2.5, 4), rr(-0.3, 0.3)), rr(3, 5), 0.8, 3.2, [0x2b2b2b, 0x444444, 0x555555][(Math.random() * 3) | 0]);
    if (Math.random() < dt * 2) burst(_tmp.copy(sp).add(_pv.set(0, 3, 0)), 2, [0xf4f1e6, 0xd8d2c0], 2, 3, 2);   // drifting scraps of paper
  }
  if (t < 8.5) {
    // 2 (4-8.5 s): Ô Li 1 circles high above, the flight in a loose echelon
    const a0 = 0.6 + t * 0.09, cx = 0, cz = -1300, R = 42;
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
  // the flag catches and burns as Ô Li 1 sweeps past it
  if (t > 12.6) {
    c.flagP = Math.min(1, (t - 12.6) / 3.6);
    const frontU = burnFlag(c.flagP);
    if (frontU !== undefined) {
      const fxw = 0.1 + 4 * frontU;
      for (let k = 0; k < 3; k++) puff(fire, _tmp.set(fxw + rr(-0.2, 0.2), 13.4 + Math.random() * 2.5, -1200 + rr(-0.1, 0.1)), _pv.set(rr(-0.2, 0.2), rr(0.8, 1.6), 0), rr(0.3, 0.6), 0.12, 0.35, [0xffa53a, 0xff6a1f, 0xffd23f][k]);
      if (Math.random() < 0.5) puff(smoke, _tmp.set(fxw, 15.5, -1200), _pv.set(0, 1.5, 0), 2, 0.15, 0.7, 0x333333);
    }
    if (c.flagP >= 1) rivalFlag.visible = false;
  }
  const line = (k, at, who, text) => { if (t > at && !c.said[k]) { c.said[k] = 1; sayNow(who, text); } };
  line(1, 0.4, 'Hạc Lớn', 'Thả toàn bộ bóng giấy còn lại!');
  line(2, 4.6, 'Lan', 'Xong rồi... cuộc chiến kết thúc rồi.');
  line(3, 6.8, 'Minh', 'Nhìn từ trên này... sao chẳng thấy vui gì cả.');
  line(4, 15.0, 'Bảng Đen', 'Lá cờ Phe Đỏ đã cháy. Chiến tranh máy bay giấy kết thúc.');
  line(5, 17.6, 'Bảng Đen', 'Tất cả các phi đội... về trường thôi các em.');
  if (t >= END_LEN || pressed.Enter || pressed.NumpadEnter) finishEnding();
}
function finishEnding() {
  if (cut && cut.kind === 'ending') { burnFlag(1); rivalFlag.visible = false; }
  cut = null; document.body.classList.remove('cine');
  missionComplete();
}
function endingCamera(dt) {
  const t = cut.t, h = heron.pos;
  let pos = _cd, look = _cl, fov = 55, shot;
  if (t < 4.2) { shot = 1; pos.set(16, 4, -1440); look.copy(h).lerp(_tmp.set(0, 4, -1420), 0.35); fov = 58; }   // low on the enemy base, the bomber roaring over
  else if (t < 8.5) {   // high above, behind Ô Li 1, looking down on the burning school
    shot = 2; pos.copy(P.pos).addScaledVector(fwdOf(P, _tmp2), -7).add(_pv.set(0, 3.5, 0)); look.set(0, 0, -1300); fov = 60;
  } else {   // Ô Li 1's view: tight behind the plane as it skims the ruins and climbs away
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
//      open the throttles and surge ahead towards the river.
const ESC_LEN = 11.5, ESC_V = 5;
const ESC_FORM = [[0, 3, -5], [-6, 0, 2], [6, 0, 2], [-10, 1, -3], [10, 1, -3]];   // P, Lan, Minh, Tuấn, Hà around the bomber
function startEscortCut() {
  for (const a of ALLIES) if (!flyers.some(f => f.alive && f.name === a.name)) makeFlyer('ally', 'blue', a.name, a.color);
  const lan = flyers.find(f => f.alive && f.name === 'Lan'), minh = flyers.find(f => f.alive && f.name === 'Minh');
  const tuan = makeFlyer('ally', 'blue', 'Tuấn', 0x9be37a), ha = makeFlyer('ally', 'blue', 'Hà', 0xffb35c);
  cut = { kind: 'escort', t: 0, boss: heron, crew: [P, lan, minh, tuan, ha], said: {} };
  P.invulnT = ESC_LEN; document.body.classList.add('cine');
  if (!cineOn) endEscortCut();
}
const escHeronZ = t => -560 - ESC_V * t;
function updateEscortCut(dt) {
  const c = cut; c.t += dt; const t = c.t, hz = escHeronZ(t), y = 22;
  heron.pos.set(Math.sin(t * 0.4) * 0.6, y + Math.sin(t * 0.7) * 0.3, hz); orient(heron, FWD);
  heron.q.multiply(_q.setFromAxisAngle(FWD, Math.sin(t * 0.5) * 0.05)); heron.vel.set(0, 0, -ESC_V); heron.speed = ESC_V;
  // after the order to go, the fighters accelerate (a = 4 m/s²) and pull away ahead of the bomber
  const go = Math.max(0, t - 6.8), ahead = 0.5 * 4 * go * go;
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
  line(1, 0.5, 'Bảng Đen', 'Hạc Lớn cất cánh! Máy bay lớn nhất Phe Xanh từng gấp.');
  line(2, 3.6, 'Lan', 'To thật... nhưng chậm như rùa vậy.');
  line(3, 5.0, 'Tuấn', 'Tuấn và Hà gấp xong máy bay mới rồi! Lần này cho bọn tớ đi cùng!');
  line(4, 6.6, 'Bảng Đen', 'Phi đội Ô Li, tăng tốc! Mở đường phía trước cho Hạc Lớn!');
  line(5, 8.4, 'Minh', 'Rõ! Theo tớ!');
  line(6, 10.2, 'Hạc Lớn', 'Hạc Lớn bám theo sau. Trông cậy vào các cậu!');
  if (t > 6.8 && !c.said.boost) { c.said.boost = 1; whoosh(); if (AU.ctx) tone(200, 700, 0.8, 0.07, 'sawtooth'); }
  if (t >= ESC_LEN || pressed.Enter || pressed.NumpadEnter) endEscortCut();
}
function endEscortCut() {
  const c = cut; cut = null; document.body.classList.remove('cine');
  // jump to the end state: fighters out in front, bomber cruising behind
  const hz = escHeronZ(ESC_LEN), ahead = 0.5 * 4 * (ESC_LEN - 6.8) ** 2;
  heron.pos.set(0, 22, hz); orient(heron, FWD); heron.speed = 7;
  c.crew.forEach((f, i) => { if (!f || !f.alive) return; const o = ESC_FORM[i]; f.pos.set(o[0] * 1.2, 22 + o[1], hz + o[2] - ahead - i * 2.5); orient(f, FWD); f.speed = 9; });
  P.invulnT = 1; aim.set(0, 0, -1); camPos.copy(P.pos).add(_pv.set(0, 0.5, 2.5)); camAimS.copy(aim);
  escortBriefing();
}
function escortCutCamera(dt) {
  const t = cut.t, h = heron.pos;
  let pos = _cd, look = _cl, fov = 50;
  if (t < 3.6) {   // 1: low and ahead: the bomber lumbers overhead, huge against the sky
    pos.set(13, 17.5, -574); look.copy(h).add(_pv.set(0, 0.4, 0)); fov = lerp(46, 58, clamp(t / 3.6, 0, 1));   // beside the corridor roof, not inside it
  } else if (t < 6.6) {   // 2: tracking alongside: the five fighters throttled back around it
    pos.copy(h).add(_pv.set(16, 1.5, 3)); look.copy(h).add(_pv.set(-2, 0, -2)); fov = 46;
  } else if (t < 9.6) {   // 3: from behind and above the bomber: the fighters surge ahead
    pos.copy(h).add(_pv.set(0, 4, 13)); look.copy(h).add(_pv.set(0, 0, -40)); fov = 52;
  } else {   // 4: wide: the river and the Red Faction's school ahead
    pos.copy(h).add(_pv.set(-12, 9, 16)); look.set(0, 16, h.z - 120); fov = 55;
  }
  const shot = t < 3.6 ? 1 : t < 6.6 ? 2 : t < 9.6 ? 3 : 4;   // hard cut when the shot changes, smooth within a shot
  camera.position.lerp(pos, shot !== cut.shot ? 1 : 1 - Math.exp(-dt * 8)); cut.shot = shot;
  camera.up.set(0, 1, 0); camera.lookAt(look);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}
function sayNow(who, text) { radioQ.length = 0; radioQ.push({ who, text }); radioT = 0; }
function startEagleCutscene(boss) {
  for (const a of ALLIES) if (!flyers.some(f => f.alive && f.name === a.name)) makeFlyer('ally', 'blue', a.name, a.color);   // the whole flight is here for this one
  const allies = ALLIES.map(a => flyers.find(f => f.alive && f.name === a.name));
  const tuan = makeFlyer('ally', 'blue', 'Tuấn', 0x9be37a), ha = makeFlyer('ally', 'blue', 'Hà', 0xffb35c);
  tuan.noReturn = ha.noReturn = true;
  const crew = [P, allies[0], allies[1], tuan, ha];
  cut = { kind: 'eagle', slow: cutSlow, t: 0, boss, crew, tuan, ha, path: new THREE.CatmullRomCurve3(EAGLE_KEYS.map(k => new THREE.Vector3(k[1], k[2], k[3]))), said: {}, prevB: new THREE.Vector3() };
  P.invulnT = CUT_LEN; boss.hp = boss.maxHp;
  document.body.classList.add('cine');
  if (!cineOn) skipCutscene();
}
const eaglePos = (t, out) => {   // time -> point on the Catmull-Rom path through the keyframes
  let k = 0; while (k < EAGLE_KEYS.length - 2 && t > EAGLE_KEYS[k + 1][0]) k++;
  const a = EAGLE_KEYS[k][0], b = EAGLE_KEYS[k + 1][0], u = (k + clamp((t - a) / (b - a), 0, 1)) / (EAGLE_KEYS.length - 1);
  return out.copy(cut.path.getPoint(u));
};
function updateCutscene(dt) {
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
  });
  aim.set(0, 0, -1);
  // the eagle
  const b = c.boss, bp = eaglePos(t, _v3), prev = c.prevB.copy(eaglePos(Math.max(0, t - 0.05), new THREE.Vector3()));
  const dir = _tmp.subVectors(bp, prev); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  b.vel.copy(dir).divideScalar(0.05); b.speed = b.vel.length(); b.pos.copy(bp); orient(b, dir);
  if (t > 6.0 && t < 7.4) b.q.multiply(_q.setFromAxisAngle(FWD, (t - 6.0) / 1.4 * PI * 2));   // barrel roll through the formation
  // guns: short bursts at Tuấn, then at Hà
  const burstAt = (victim, t0, t1) => {
    if (t < t0 || t > t1 || !victim.alive) return;
    c.gunT = (c.gunT || 0) - dt; if (c.gunT > 0) return;
    c.gunT = 0.07; const keep = b.q.clone(); orient(b, _tmp2.subVectors(victim.pos, b.pos)); fireGun(b, 0.01); b.q.copy(keep);
  };
  burstAt(c.tuan, 6.3, 6.9); burstAt(c.ha, 9.9, 10.5);
  if (t > 6.9 && c.tuan.alive) { damage(c.tuan, 9999, b); shake = 0.5; }
  if (t > 10.5 && c.ha.alive) { damage(c.ha, 9999, b); shake = 0.5; }
  // dialogue
  const line = (k, at, who, text) => { if (t > at && !c.said[k]) { c.said[k] = 1; sayNow(who, text); } };
  line(1, 0.4, 'Bảng Đen', 'Hạm đội Phe Đỏ đã tan tác... radar chỉ còn bắt được một tín hiệu?');
  line(2, 2.6, 'Minh', 'Một chiếc thôi sao? Phe Đỏ hết người rồi à?');
  line(3, 4.0, 'Lan', 'Khoan... sao nó lao tới nhanh vậy?!');
  if (t > 4.6 && !c.said.card) { c.said.card = 1; flash('⚠ ĐẠI BÀNG ĐỎ', 'Át chủ bài giỏi nhất của Phe Đỏ', 2.6); if (AU.ctx) { tone(110, 82, 1.4, 0.16, 'sawtooth'); noiseHit(AU.ctx.currentTime, 140, 0.5, 1.2); } }
  line(5, 7.3, 'Hà', 'Tuấn!! Nó bắn rơi Tuấn chỉ trong một lượt!');
  line(6, 10.7, 'Lan', 'Không thể nào... hắn hạ Tuấn và Hà chỉ bằng vài đường cơ bản!');
  line(7, 12.3, 'Bảng Đen', 'Nó quay lại! Nó lao thẳng vào Ô Li 1!');
  if (t > 13.95 && !c.said.pass) {   // the shave: wind blast, a shudder, paper flutter
    c.said.pass = 1; whoosh(); shake = 0.6;
    for (let i = 0; i < 16; i++) puff(smoke, _tmp.copy(P.pos).add(_pv.set(rr(-2.5, -0.5), rr(-0.4, 0.6), rr(-1, 1))), _pv.set(rr(-1, 0), 0, rr(1, 3)), 0.6, 0.02, 0.06, 0xffffff);
  }
  line(9, 14.9, 'Minh', 'Nó vừa sượt qua cậu chỉ cách một gang tay!');
  if (t >= CUT_LEN || pressed.Enter || pressed.NumpadEnter) skipCutscene();
}
function skipCutscene() {
  const c = cut; if (!c) return;
  if (c.kind === 'ending') { finishEnding(); return; }
  if (c.kind === 'escort') { endEscortCut(); return; }
  if (c.kind === 'twins') { endTwinsCut(); return; }
  if (c.tuan.alive) damage(c.tuan, 9999, c.boss);
  if (c.ha.alive) damage(c.ha, 9999, c.boss);
  const b = c.boss; eaglePos(CUT_LEN, b.pos); orient(b, _tmp.set(0.1, 0, -1)); b.speed = 11; b.mode = 'attack'; b.preyT = 0;
  P.invulnT = 1; P.speed = 8; aim.copy(fwdOf(P, _tmp)); camPos.copy(P.pos).add(_pv.set(0, 0.5, 2.5)); camAimS.copy(aim);
  cut = null; document.body.classList.remove('cine');
  radio('Bảng Đen', 'Ô Li 1, Lan, Minh: chỉ còn ba em. Đừng tách nhau ra!', true);
  radio('Lan', 'Khép vòng vây! Hắn vọt lên thì bật siêu thanh đuổi theo!');
}
function cutsceneCamera(dt) {
  if (cut.kind === 'ending') { endingCamera(dt); return; }
  if (cut.kind === 'escort') { escortCutCamera(dt); return; }
  if (cut.kind === 'twins') { twinsCamera(dt); return; }
  const c = cut, t = c.t, b = c.boss.pos;
  let pos = _cd, look = _cl, fov = 55;
  if (t < 3.2) {   // 1: the flight of five flying straight at us
    pos.set(1.5, CUT_Y + 1.2, -90 - 8 * t - 14 + t * 1.2); look.set(0, CUT_Y + 0.3, -90 - 8 * t + 3);
  } else if (t < 5.8) {   // 2: over Ô Li 1's shoulder: a lone silhouette in the distance (zoom in)
    pos.copy(P.pos).add(_pv.set(1.8, 1.0, 4.5)); look.copy(b); fov = lerp(48, 24, clamp((t - 3.2) / 2.2, 0, 1));
  } else if (t < 7.6) {   // 3: side-on as it slices past Tuấn
    pos.set(-16, CUT_Y + 1.5, -90 - 8 * 6.6 + 2); look.copy(b).lerp(c.tuan.pos, 0.4); fov = 50;
  } else if (t < 9.6) {   // 4: from below as it pulls up and over
    pos.copy(b).add(_pv.set(7, -4, 5)); look.copy(b); fov = 50;
  } else if (t < 11.4) {   // 5: riding on its tail as it guns down Hà
    pos.copy(b).addScaledVector(fwdOf(c.boss, _tmp2), -5).addScaledVector(UP, 1.3); look.copy(b).addScaledVector(fwdOf(c.boss, _tmp2), 20); fov = 58;
  } else if (t < 13.1) {   // 6: high behind the three survivors: it hairpins round up ahead
    pos.copy(P.pos).add(_pv.set(0, 4.5, 9)); look.copy(b); fov = 46;
  } else {   // 7: tight telephoto over Ô Li 1's right shoulder, slowly dollying in while it shaves past the left wing
    const k = clamp((t - 13.1) / 1.6, 0, 1);
    pos.copy(P.pos).add(_pv.set(lerp(1.1, 0.7, k), lerp(0.42, 0.3, k), lerp(1.4, 0.9, k)));
    look.copy(P.pos).add(_pv.set(-1.2, 0.05, -2)).lerp(b, t < 14.15 ? 0.35 : 0.12);
    fov = lerp(42, 30, k);
  }
  camera.position.lerp(pos, t < 0.05 ? 1 : 1 - Math.exp(-dt * 10));
  camera.up.set(0, 1, 0); camera.lookAt(look);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}

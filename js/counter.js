'use strict';
// Máy Bay Giấy · Chương 7: Phản công khu Tây, and the first sight of Đại Bàng Đỏ
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)
// Flushed with the bomb's success, the whole squadron pours into their half and sweeps their fighters away. With victory in sight, a red shape
// drops out of the sky, cuts two of ours down in one pass, and keeps on killing. Ordered back, Alpha 1 runs for
// home; at their own border line he stops dead, circles, and turns away: he only guards the Red sky.

const CT = { phase: 'off', t: 0, total: 0, eagle: null, lost: 0, lostM: 0, killCD: 0, idle: 0, man: null };
const COUNTER_WING = [['Bravo 1', 0xc9a0ff], ['Bravo 2', 0xfff176], ['Bravo 3', 0x80deea], ['Bravo 4', 0xf48fb1], ['Bravo 5', 0xa5d6a7], ['Bravo 6', 0xffcc80]];
const RED_LINE = mirZ(BORDER_Z);   // their border line, painted across the yard
function startCounter() {
  gameMode = 'counter'; waveState = 'counter';
  Object.assign(CT, { phase: 'attack', t: 0, eagle: null, lost: 0, lostM: 0, killCD: 0, idle: 0, man: null });
  // everyone, already over the middle of the yard and heading south
  P.pos.set(0, 22, -440); orient(P, _ax.set(0.001, 0, -1)); aim.set(0, 0, -1); P.speed = 9; P.prevVel = null; P.trails.forEach(t => t.init = false);
  P.hp = P.maxHp; P.msl = Math.max(P.msl, MSL_PER_WAVE + 4); P.flares = Math.max(P.flares, FLR_PER_WAVE);
  let i = 0;
  const slots = [[-7, 1, 6], [7, 1, 6], [0, 2.5, 11]];
  for (const f of flyers) if (f.alive && f.team === 'blue' && f !== P) { f.plotArmor = true; f.pos.copy(P.pos).add(_pv.set(...(slots[i++] || [0, 3, 15]))); orient(f, _ax.set(0.001, 0, -1)); f.speed = 9; }
  COUNTER_WING.forEach(([name, color], k) => {
    const f = makeFlyer('ally', 'blue', name, color); f.temp = true; f.noReturn = true;
    f.pos.copy(P.pos).add(_pv.set((k % 2 ? 1 : -1) * (14 + 5 * (k >> 1)), 1 + k * 0.5, 10 + 6 * (k >> 1))); orient(f, _ax.set(0.001, 0, -1)); f.speed = 9;
  });
  const kinds = ['dart', 'dart', 'dart', 'swallow', 'swallow', 'nakamura', 'nakamura', 'stunt', 'boomerang', 'tape'];
  CT.total = kinds.length;
  kinds.forEach((k, n) => { const e = makeFlyer(k, 'red', `${KINDS[k].label} ${n + 1}`); e.pos.copy(findSpawn(60, 160, 'rival')); orient(e, _ax.subVectors(P.pos, e.pos)); e.speed = e.K.veq; });
  flash(WAVES[wave] ? WAVES[wave].title : 'PHẢN CÔNG', 'Quét sạch không quân Phe Đỏ trên bầu trời khu Tây', 3);
  radio('Blackboard', 'Blackboard gọi Alpha, Bravo: tiến vào khu Tây. Không quân Phe Đỏ chỉ còn tàn quân. Hôm nay ta giành lấy bầu trời đó!', true);
  radio('Bravo 1', 'Bravo 1, wilco. Chín chiếc của ta đấu mười chiếc tàn quân. Dễ thôi!');
}
function endCounter() {
  if (gameMode !== 'counter') return;
  gameMode = 'campaign'; CT.phase = 'off';
}
const blueOthers = () => flyers.filter(f => f.alive && f.team === 'blue' && f !== P);
function updateCounter(dt) {
  CT.t += dt;
  if (state !== 'play' || cut) return;
  const reds = flyers.filter(f => f.alive && f.team === 'red' && f.kind !== 'ace');
  if (CT.phase === 'attack') {
    const left = reds.length;
    if (left <= CT.total / 2) radioOnce('ctHalf', 'Alpha 2', 'Bandit đang tan rã! Ép tiếp!', 999);
    if (left <= 3) radioOnce('ctNear', 'Blackboard', 'Còn vài chiếc. Bầu trời khu Tây sắp là của ta!', 999);
    const deep = P.pos.z < RED_LINE - 15;
    if (left <= 2 && CT.t > 10 && deep) { startEagleArrive(); return; }
    if (left <= 2 && !deep) radioOnce('ctDeep', 'Blackboard', 'Tàn quân rút về phía tây. Truy kích, vượt vạch ranh giới!', 15);
    $('objective').textContent = left <= 2 && !deep ? `PHẢN CÔNG: đuổi tàn quân vào sâu khu Tây · qua vạch ranh giới khu Đỏ · ĐIỂM ${score}` : `PHẢN CÔNG KHU TÂY · không quân Phe Đỏ còn ${left}/${CT.total} · ĐIỂM ${score}`;
  } else if (CT.phase === 'massacre' || CT.phase === 'retreat') {
    eagleDuel(dt);
    if (CT.phase === 'massacre' && (CT.t > 60 || CT.lostM >= 3) && !CT.man) {
      CT.phase = 'retreat';
      for (const f of blueOthers()) f.retreat = true;
      flash('RÚT LUI!', 'Bay về khu Xanh · thoát khỏi vùng trời của hắn', 2.6);
      radio('Blackboard', 'Tất cả, RTB! Rút về khu Đông, ngay! Không ai đấu tay đôi với hắn!', true);
    }
    if (CT.phase === 'retreat' && P.pos.z > RED_LINE + 4) { startEagleHold(); return; }
    $('objective').textContent = CT.phase === 'retreat' ? `RÚT LUI! Bay về qua vạch ranh giới · còn ${Math.max(0, Math.round(RED_LINE + 4 - P.pos.z))} m · mất ${CT.lost} máy bay`
      : `⚠ ĐẠI BÀNG ĐỎ · mất ${CT.lost} máy bay`;
  }
}
// our wingmen falling back to the north courtyard
function updateRetreat(a, dt) {
  const want = _tmp.set(clamp(a.pos.x, -50, 50), 18, -150).sub(a.pos); want.y *= 0.3; want.normalize();
  instructor(a, want, ctlA); ctlA.throttle = 1; flyPhysics(a, ctlA, dt); a.pos.addScaledVector(a.vel, dt);
  if (a.pos.z > -200) a.retreat = false;
}

// ---- the arrival: a red speck high in the south, a dive straight through the formation, one of ours gone ----
const _ea = new THREE.Vector3(), _eb = new THREE.Vector3();
function startEagleArrive() {
  const blues = blueOthers(), centre = blues.reduce((s, f) => s.add(f.pos), P.pos.clone()).divideScalar(blues.length + 1);
  for (const f of flyers) if (f.alive && f.team === 'red') f.flee = true;   // their stragglers get out of his way
  const victims = blues.filter(f => f.temp).sort((a, b) => a.pos.distanceTo(centre) - b.pos.distanceTo(centre)).slice(0, 1);   // one, to show what he is
  const e = makeFlyer('ace', 'red', 'Đại Bàng Đỏ'); e.leashZ = RED_LINE; e.counter = true;
  const T1 = 2.6, T2 = 3.4;
  const at = (f, t) => f.pos.clone().addScaledVector(f.vel.lengthSq() > 1 ? f.vel : _ea.set(0, 0, -9), t);
  const start = centre.clone().add(_pv.set(30, 38, -110));
  const pts = [start, centre.clone().add(_pv.set(12, 16, -40))];
  victims.forEach((v, i) => pts.push(at(v, i ? T2 : T1).add(_pv.set(0, 0.8, 3))));
  const last = pts[pts.length - 1];
  pts.push(last.clone().add(_pv.set(-6, 6, 22)), last.clone().add(_pv.set(-18, 22, 30)));
  const keys = [0, 1.4, T1, T2, T2 + 1.2, 6.5].slice(0, pts.length);
  e.pos.copy(start); orient(e, _ea.subVectors(centre, start));
  CT.eagle = e;
  cut = { kind: 'eagleArrive', t: 0, boss: e, crew: blues.concat([e]), said: {}, e, victims, keys, path: new THREE.CatmullRomCurve3(pts), blues: blues.map(f => ({ f, p0: f.pos.clone(), v: f.vel.lengthSq() > 1 ? f.vel.clone() : new THREE.Vector3(0, 0, -9) })),
    p0: P.pos.clone(), pv: P.vel.lengthSq() > 1 ? P.vel.clone() : new THREE.Vector3(0, 0, -9), kills: victims.map((v, i) => ({ v, at: i ? T2 : T1 })), len: wingmanUp() ? 8.8 : 7.6,
    slow: t => t > 2.1 && t < 3.9 ? 0.32 : 1 };
  P.invulnT = 99; document.body.classList.add('cine');
  if (!cineOn) endEagleArrive();
}
const arrivePos = (c, t, out) => {   // time -> point on his dive
  let k = 0; while (k < c.keys.length - 2 && t > c.keys[k + 1]) k++;
  const a = c.keys[k], b = c.keys[k + 1], u = (k + clamp((t - a) / (b - a), 0, 1)) / (c.keys.length - 1);
  return out.copy(c.path.getPoint(Math.min(1, u)));
};
function updateEagleArrive(dt) {
  const c = cut; c.t += dt; const t = c.t;
  P.pos.copy(c.p0).addScaledVector(c.pv, t); orient(P, c.pv); aim.copy(c.pv).normalize();
  for (const b of c.blues) if (b.f.alive) { b.f.pos.copy(b.p0).addScaledVector(b.v, t); orient(b.f, b.v); }
  const e = c.e, p0 = arrivePos(c, t, _ea), p1 = arrivePos(c, t + 0.05, _eb);
  e.pos.copy(p0); orient(e, _tmp.subVectors(p1, p0)); e.vel.copy(_tmp).divideScalar(0.05); e.speed = e.vel.length();
  e.gunT = (e.gunT || 0) - dt;
  for (const k of c.kills) {
    if (k.v.alive && t > k.at - 0.5 && e.gunT <= 0) { e.gunT = 0.04; const d = _tmp2.subVectors(k.v.pos, e.pos).normalize(); fireBullet(e, _tmp.copy(e.pos).addScaledVector(d, 1), d, 0); }
    if (k.v.alive && t >= k.at) { destroy(k.v, e); CT.lost++; shake = Math.min(0.8, shake + 0.4); burst(k.v.pos, 50, [k.v.colorHex, 0xffffff], 6, 1.6, 1); }
  }
  if (t > (wingmanUp() ? 7.9 : 4.2) && !c.said.title) { c.said.title = 1; flash('⚠ ĐẠI BÀNG ĐỎ', 'Át chủ bài của Phe Đỏ · lần đầu xuất hiện', 3); if (AU.ctx) { tone(110, 82, 1.4, 0.16, 'sawtooth'); noiseHit(AU.ctx.currentTime, 140, 0.5, 1.2); } }
  const line = (n, at, who, text) => { if (t > at && !c.said[n]) { c.said[n] = 1; sayNow(who, text); } };
  line(1, 0.3, 'Blackboard', 'Khoan... radar bắt một tín hiệu lạ. Trên cao, phía tây. Tốc độ rất lớn!');
  if (c.victims[0]) line(2, 1.6, c.victims[0].name, 'Cái gì kia—');
  line(3, 3.8, 'Alpha 2', c.victims[0] ? `${c.victims[0].name} rơi rồi?! Chỉ một lượt?!` : 'Cái gì vừa lướt qua?!');
  line(4, 5.0, 'Alpha 3', 'Blackboard, cái gì vậy?! Ai vừa bay qua?!');
  line(5, 6.2, 'Blackboard', 'Không có dữ liệu... radar chưa từng thấy chiếc này.');
  if (wingmanUp()) line(6, 7.4, 'Wingman', '...Red Eagle.');
  if (t >= c.len || pressed.Enter || pressed.NumpadEnter) endEagleArrive();
}
function endEagleArrive() {
  const c = cut; cut = null; document.body.classList.remove('cine');
  for (const k of c.kills) if (k.v.alive) { destroy(k.v, c.e); CT.lost++; }
  arrivePos(c, c.len, c.e.pos); c.e.speed = 11; c.e.mode = 'attack'; c.e.preyT = 0;
  P.invulnT = 1; P.speed = 9; camPos.copy(P.pos).add(_pv.set(0, 0.5, 2.5)); camAimS.copy(aim);
  radio('Đại Bàng Đỏ', 'Đây là bầu trời của Phe Đỏ. Mời các anh quay về.', true);   // calm, courteous, and that's all he says for a while
  if (wingmanUp()) { radio('Alpha 2', 'Wingman, anh biết hắn?'); radio('Blackboard', 'Đại Bàng Đỏ. Mật danh Red Eagle. Tất cả, cẩn thận.'); }
  CT.phase = 'massacre'; CT.t = 0; CT.killCD = 9; CT.idle = 0; CT.man = null; CT.lostM = 0;
  for (const f of blueOthers()) f.target = c.e;   // everyone goes for him
}
function eagleArriveCamera(dt) {
  const c = cut, t = c.t, e = c.e;
  let fov = 50, shot;
  if (t < 2.1) { shot = 1; _cd.copy(P.pos).add(_pv.set(0.6, 0.5, 1.6)); _cl.copy(e.pos); fov = lerp(26, 40, t / 2.1); }   // from Alpha 1: a red speck growing in the sky
  else if (t < 4.0) { shot = 2; const fw = fwdOf(e, _tmp); _cd.copy(e.pos).addScaledVector(fw, -2.2).add(_pv.set(0, 0.5, 0)); _cl.copy(e.pos).addScaledVector(fw, 14); fov = 55; }   // riding his tail through the formation
  else { shot = 3; _cd.copy(e.pos).add(_pv.set(3, -1, 4)); _cl.copy(e.pos); fov = 44; }   // close on him as he climbs away
  camera.position.lerp(_cd, shot !== c.shot ? 1 : 1 - Math.exp(-dt * 12)); c.shot = shot;
  camera.up.set(0, 1, 0); camera.lookAt(_cl);
  camera.fov += (fov - camera.fov) * (shot !== c.fovS ? 1 : Math.min(1, dt * 3)); c.fovS = shot; camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}

// ---- the end: we run for home; at their own border line he stops. If Wingman is with us, he drops back and the
//      two of them fly the line together, wing to wing, for a few seconds; then Wingman lights out for home and
//      Đại Bàng Đỏ turns south. Without Wingman: he circles once on his side of the line and turns away ----
// the pair's timeline: they meet, he speaks (close on him), Wingman answers (close on Wingman), they split
const HOLD_JOIN = 2.4, HOLD_EAGLE = 3.8, HOLD_WING = 9.8, HOLD_SPLIT = 13.6, PAIR_V = 4.2;
function startEagleHold() {
  const blues = blueOthers(), e = CT.eagle, w = wingmanUp();
  const hold = new THREE.Vector3(clamp(e.pos.x, -40, 40), 30, RED_LINE - 12);
  e.hp = Math.min(e.hp, e.maxHp * 0.42);   // the dogfight cost him too: torn wings, smoking
  const pair = w ? new THREE.Vector3(-28, 26, RED_LINE - 7) : null;   // where the two of them meet: on his side of the line, flying it east
  cut = { kind: 'eagleHold', t: 0, boss: e, crew: blues.concat([e]), said: {}, e, e0: e.pos.clone(), hold, w, pair, len: w ? 19 : 11,
    blues: blues.filter(f => f !== w).map(f => ({ f, p0: f.pos.clone() })), p0: P.pos.clone(), w0: w ? w.pos.clone() : null };
  P.invulnT = 99; document.body.classList.add('cine');
  if (!cineOn) endEagleHold();
}
// the pair's flight: e = 0 for him, 1 for Wingman (a wingspan and a half off his right wing, a touch higher)
function pairPos(c, side, t, out) {
  const u = Math.max(0, t - HOLD_JOIN), x = c.pair.x + PAIR_V * Math.min(u, HOLD_SPLIT - HOLD_JOIN);
  out.set(x, c.pair.y + side * 0.5, c.pair.z + side * 3.2);
  const k = t - HOLD_SPLIT;
  if (k > 0) {
    if (side) out.add(_pv.set(3 * k, 1.2 * k, 2.2 * k * k + 4 * k));   // Wingman: throttle up, a climbing turn for home
    else out.add(_pv.set(4.5 * k, 0.6 * k, -1.6 * k * k));   // him: banking away south, back into his own sky
  }
  if (t < HOLD_JOIN) {   // before they meet: each comes in from where he was
    const s = clamp(t / HOLD_JOIN, 0, 1), e = s * s * (3 - 2 * s);
    out.lerpVectors(side ? _tmp2.copy(c.w0).addScaledVector(_pv.set(0, 0.25, 11), t * (1 - e)) : c.e0, out, e);
  }
  return out;
}
function updateEagleHold(dt) {
  const c = cut; c.t += dt; const t = c.t, e = c.e;
  const run = _ea.set(0, 0.25, 11);
  P.pos.copy(c.p0).addScaledVector(run, t); orient(P, run);
  for (const b of c.blues) if (b.f.alive) { b.f.pos.copy(b.p0).addScaledVector(run, t); orient(b.f, run); }
  if (c.w) {
    for (const [f, side] of [[e, 0], [c.w, 1]]) {
      const p0 = pairPos(c, side, t, new THREE.Vector3()), p1 = pairPos(c, side, t + 0.05, new THREE.Vector3());
      f.pos.copy(p0); orient(f, _tmp.subVectors(p1, p0)); f.vel.copy(_tmp).divideScalar(0.05); f.speed = f.vel.length();
      if (t > HOLD_SPLIT) f.q.multiply(_q.setFromAxisAngle(FWD, (side ? -1 : 1) * 0.6 * Math.min(1, (t - HOLD_SPLIT) * 1.5)));   // peeling apart
    }
    if (t > HOLD_SPLIT && Math.random() < 0.7) puff(fire, _tmp.copy(c.w.pos).addScaledVector(fwdOf(c.w, _tmp2), -0.4), _pv.set(0, 0, 0), 0.18, 0.12, 0.04, 0xffb347);
  } else {   // he comes up to the line... and no further. A slow circle on his own side of it, then back south
    if (t < 2) { e.pos.lerpVectors(c.e0, c.hold, t / 2); orient(e, _tmp.subVectors(c.hold, c.e0).setY(0)); }
    else if (t < 7) { const a = (t - 2) * 0.9; e.pos.set(c.hold.x + Math.sin(a) * 10, c.hold.y, c.hold.z - 10 + Math.cos(a) * 10); orient(e, _tmp.set(Math.cos(a), 0, -Math.sin(a))); e.q.multiply(_q.setFromAxisAngle(FWD, -0.5)); }
    else { const a = 5 * 0.9; e.pos.set(c.hold.x + Math.sin(a) * 10, c.hold.y + (t - 7) * 1.2, c.hold.z - 10 + Math.cos(a) * 10 - (t - 7) * 9); orient(e, _tmp.set(0.001, 0.08, -1)); e.q.multiply(_q.setFromAxisAngle(FWD, Math.sin(t * 3) * 0.12)); }   // limping home, wobbling a little
    e.vel.set(0, 0, 0);
  }
  for (const sx of [-1, 1]) if (Math.random() < dt * 5) {   // a thin wisp off each torn wing now and then: hurt, not burning
    const w = _tmp2.set(sx * 1.25, 0.12, 0.45).multiplyScalar(e.K.scale).applyQuaternion(e.q).add(e.pos);
    puff(smoke, w, _pv.set(rr(-0.2, 0.2), rr(0.2, 0.5), rr(-0.2, 0.2)), rr(0.5, 0.8), 0.05, rr(0.3, 0.5), [0x8a8a8a, 0x9c9c9c, 0x7a7a7a][(Math.random() * 3) | 0]);
  }
  const line = (n, at, who, text) => { if (t > at && !c.said[n]) { c.said[n] = 1; sayNow(who, text); } };
  line(1, 0.8, 'Alpha 2', 'Hắn... không truy kích nữa?');
  if (c.w) {
    line(2, 1.0, 'Alpha 3', 'Khoan, Wingman! Anh quay lại làm gì?!');
    line(3, HOLD_EAGLE + 0.4, 'Đại Bàng Đỏ', 'Cậu đừng quay lại đây nữa. Lần sau tôi sẽ không tha cho bất kỳ máy bay nào vượt qua lằn ranh đâu, kể cả cậu!');
    line(4, HOLD_WING + 0.5, 'Wingman', 'Chúng ta hãy còn gặp lại, bạn già ạ!');
    line(5, HOLD_SPLIT + 2.2, 'Alpha 3', '...Bạn già?');
    line(6, HOLD_SPLIT + 3.8, 'Blackboard', `Ta mất ${CT.lost} máy bay. Tất cả, RTB.`);
  } else {
    line(2, 2.8, 'Alpha 3', 'Red Eagle dừng ngay ở vạch ranh giới. Nhìn kìa, cánh hắn đang bốc khói.');
    line(3, 5.0, 'Blackboard', 'Hắn cũng trúng đạn không nhẹ. Hắn không truy đuổi ta... hắn chỉ giữ bầu trời của Phe Đỏ.');
    line(5, 6.6, 'Đại Bàng Đỏ', 'Xin đừng bước qua vạch phấn này lần nữa.');
    line(4, 8.8, 'Blackboard', `Ta mất ${CT.lost} máy bay. Tất cả, RTB.`);
  }
  if (t >= c.len || pressed.Enter || pressed.NumpadEnter) endEagleHold();
}
function endEagleHold() {
  const c = cut; cut = null; document.body.classList.remove('cine');
  for (const f of [...flyers]) if (f.alive && f.team === 'red') removeFlyer(f);   // he's gone back to his sky
  for (const f of flyers) f.retreat = false;
  if (c.w && c.w.alive) { c.w.pos.copy(P.pos).add(_pv.set(4, 1.5, 8)); orient(c.w, _tmp.set(0.001, 0, 1)); c.w.speed = 9; }   // back with us, saying nothing
  P.invulnT = 1; P.speed = 9; orient(P, _tmp.set(0.001, 0, 1)); aim.set(0, 0, 1); camPos.copy(P.pos).add(_pv.set(0, 0.5, -2.5)); camAimS.copy(aim);
  flash('RÚT LUI THÀNH CÔNG', `Mất ${CT.lost} máy bay · Đại Bàng Đỏ ở lại bên kia vạch ranh giới`, 3);
  endCounter(); waveState = 'active';   // the normal flow ends the chapter
}
function eagleHoldCamera(dt) {
  const c = cut, t = c.t, e = c.e;
  let fov = 52, shot;
  if (t < (c.w ? HOLD_JOIN : 3.6)) { shot = 1; _cd.copy(P.pos).add(_pv.set(0.45, 0.55, -1.1)); _cl.copy(e.pos); fov = 46; }   // over Alpha 1's tail, looking back: he's coming... and stops
  else if (c.w && t < HOLD_SPLIT + 0.6) {
    // they fly east, him on the south side, Wingman on the north. A close-up sits just ahead of the speaker, off his
    // outer wing, looking back at him, so the other one sits in the background over his shoulder
    const mid = _tmp.addVectors(e.pos, c.w.pos).multiplyScalar(0.5);
    if (t < HOLD_EAGLE) { shot = 2; const k = clamp((t - HOLD_JOIN) / (HOLD_EAGLE - HOLD_JOIN), 0, 1); _cd.copy(mid).add(_pv.set(lerp(6, 4.2, k), lerp(1.2, 0.8, k), -1.2)); _cl.copy(mid); fov = 42; }   // the two of them
    else if (t < HOLD_WING) { shot = 4; const k = (t - HOLD_EAGLE) / (HOLD_WING - HOLD_EAGLE); _cd.copy(e.pos).add(_pv.set(lerp(1.7, 1.35, k), 0.32, -0.95)); _cl.copy(e.pos).add(_pv.set(0, 0.04, 0.25)); fov = 44; }   // on him, slowly pushing in
    else if (t < HOLD_SPLIT) { shot = 5; const k = (t - HOLD_WING) / (HOLD_SPLIT - HOLD_WING); _cd.copy(c.w.pos).add(_pv.set(lerp(1.6, 1.3, k), 0.3, 0.9)); _cl.copy(c.w.pos).add(_pv.set(0, 0.04, -0.25)); fov = 44; }   // on Wingman
    else { shot = 6; _cd.copy(mid).add(_pv.set(5, 1.4, 0)); _cl.copy(mid); fov = 50; }   // Wingman lights his burner
  } else if (c.w) { shot = 3; _cl.addVectors(e.pos, c.w.pos).multiplyScalar(0.5); _cd.copy(_cl).add(_pv.set(26, 10, 18)); fov = 52; }   // wide: one north, one south
  else { shot = 2; _cd.set(c.hold.x > 0 ? -42 : 42, 26, RED_LINE + 55); _cl.copy(e.pos); fov = lerp(40, 28, clamp((t - 3.6) / 4, 0, 1)); }   // from our side, clear of the Giếng Trời: him circling over their line
  camera.position.lerp(_cd, shot !== c.shot || shot >= 4 ? 1 : 1 - Math.exp(-dt * 10)); c.shot = shot;
  camera.up.set(0, 1, 0); camera.lookAt(_cl);
  camera.fov += (fov - camera.fov) * (shot !== c.fovS ? 1 : Math.min(1, dt * 3)); c.fovS = shot; camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}

// =====================================================================
//  The duel: one against the whole squadron, and he makes it look easy. Nobody gets cut down out of nowhere:
//  whoever manages to sit on his tail gets a reversal (up and over, and suddenly he's behind them), and if
//  nobody dares, he comes at someone head-on. Never more often than every nine seconds; in between he just
//  flies rings round them.
// =====================================================================
const _du = new THREE.Vector3(), _dv = new THREE.Vector3(), _dw2 = new THREE.Vector3();
function eagleDuel(dt) {
  const e = CT.eagle; if (!e || !e.alive) return;
  CT.killCD -= dt;
  if (CT.man) { duelManoeuvre(dt); return; }
  // who is on his tail, and for how long
  let tailer = null;
  for (const f of flyers) {
    if (!f.alive || f.team !== 'blue' || f === P) continue;
    const v = _du.subVectors(e.pos, f.pos), d = v.length();
    const onTail = d < 24 && v.dot(fwdOf(f, _dv)) > 0.85 * d && v.dot(fwdOf(e, _dw2)) > 0.5 * d;
    f.tailT = onTail ? (f.tailT || 0) + dt : Math.max(0, (f.tailT || 0) - dt * 2);
    if (onTail && f.tailT > 1.0 && (!tailer || f.tailT > tailer.tailT)) tailer = f;
    if (onTail && f.tailT > 0.6) radioOnce('tail' + f.name, f.name, pick(['Đã bám đuôi Red Eagle!', 'Tally! Hắn trong tầm ngắm!', 'Đứng yên đấy... guns, guns!']), 30);
    const facing = d < 35 && v.dot(fwdOf(f, _dv)) > 0.8 * d;   // nose on him and close: some of the rounds land
    if (facing || (onTail && f.tailT > 0.4)) {   // it is a real fight, and it costs him: the paper tears bit by bit
      damage(e, (onTail ? 12 : 4) * dt, f);
      if (e.hp < e.maxHp * 0.8) radioOnce('hitEagle', f.name, pick(['Trúng! Cánh hắn rách một mảng!', 'Trúng đạn rồi, nhưng hắn vẫn bay như không!']), 25);
    }
  }
  CT.idle += dt;
  if (CT.killCD > 0) {
    if (tailer) radioOnce('dodge' + tailer.name, tailer.name, pick(['Trượt hết! Hắn lách như lá rơi!', 'Mất dấu! Hắn đâu rồi?!', 'Hắn lăn một vòng, đạn trượt hết!']), 14);
    else radioOnce('duelLan', pick(['Alpha 2', 'Alpha 3']), pick(['Sáu đấu một mà không ai chạm được hắn!', 'Hắn đang đùa với chúng ta...']), 16);
    return;
  }
  const temps = flyers.filter(f => f.alive && f.temp);
  const prey = tailer && tailer.temp ? tailer : CT.idle > 14 ? temps.sort((a, b) => a.pos.distanceTo(e.pos) - b.pos.distanceTo(e.pos))[0] : null;
  if (!prey) return;
  // the set piece begins
  const kind = prey === tailer ? 'reversal' : 'headon';
  CT.man = { kind, prey, t: 0, s: e.pos.clone(), len: kind === 'reversal' ? 2.0 : 1.8, fire: 0 };
  e.scripted = true; CT.idle = 0;
  if (kind === 'reversal') {
    radio(prey.name, 'Hắn kéo ngóc— mất dấu rồi!', true);
    startCine('pass', { subject: e, dir: fwdOf(e, _du).clone(), dur: 1.6, ts: 0.35, cd: 1, label: 'ĐẠI BÀNG ĐỎ LỘN NGƯỢC RA SAU LƯNG!' });
  } else {
    radio(prey.name, 'Đối đầu! Hắn lao thẳng vào tôi—!', true);
    startCine('pass', { subject: e, dir: fwdOf(e, _du).clone(), dur: 1.4, ts: 0.35, cd: 1, label: 'ĐỐI ĐẦU TRỰC DIỆN!' });
  }
}
function duelManoeuvre(dt) {
  const m = CT.man, e = CT.eagle, v = m.prey; m.t += dt;
  if (!v.alive || !e.alive) { e.scripted = false; CT.man = null; return; }
  const pf = fwdOf(v, new THREE.Vector3());
  let pos;
  if (m.kind === 'reversal') {   // up and over the top, rolling out right on its tail
    const u = Math.min(1, m.t / m.len), end = v.pos.clone().addScaledVector(pf, -7).add(_pv.set(0, 0.6, 0));
    const top = m.s.clone().add(_pv.set(0, 12, 0)).addScaledVector(pf, -4);
    if (m.t > m.len) end.addScaledVector(pf, 0);
    pos = m.s.clone().multiplyScalar((1 - u) ** 2).addScaledVector(top, 2 * u * (1 - u)).addScaledVector(end, u * u);
  } else {   // a head-on pass: in from ahead of it, guns all the way
    const u = Math.min(1, m.t / m.len), start = v.pos.clone().addScaledVector(pf, 30).add(_pv.set(0, 1, 0)), end = v.pos.clone().addScaledVector(pf, -6).add(_pv.set(1.5, 1.2, 0));
    pos = start.lerp(end, u);
  }
  const dir = _du.subVectors(pos, e.pos); if (dir.lengthSq() > 1e-6) orient(e, dir);
  if (m.kind === 'reversal' && m.t < m.len) e.q.multiply(_q.setFromAxisAngle(FWD, Math.sin(m.t / m.len * PI) * 2.6));   // the roll as he comes over the top
  e.vel.copy(dir).divideScalar(Math.max(dt, 1e-3)); e.speed = Math.min(30, e.vel.length()); e.pos.copy(pos);
  // the guns: only at the end, when he's lined up
  const firing = m.kind === 'reversal' ? m.t > m.len - 0.1 : m.t > m.len * 0.35;
  if (firing) { m.fire += dt; e.gunT = (e.gunT || 0) - dt; if (e.gunT <= 0) { e.gunT = 0.05; const d = _dv.subVectors(v.pos, e.pos).normalize(); fireBullet(e, _dw2.copy(e.pos).addScaledVector(d, 1), d, 0); } }
  if ((m.kind === 'reversal' && m.fire > 0.7) || (m.kind === 'headon' && m.t >= m.len)) {
    destroy(v, e); CT.lost++; CT.lostM++; CT.killCD = 9; shake = Math.min(0.7, shake + 0.35);
    startCine('kill', { subject: v, dir: pf, dur: 1.4, ts: 0.25, cd: 2 });
    const left = flyers.filter(f => f.alive && f.temp).length;
    radio(pick(['Alpha 2', 'Alpha 3']), left ? pick([`${v.name} rơi rồi! Hắn là quái vật à?!`, `Mất ${v.name}! Không ai cắt đuôi được hắn sao?!`, `${v.name} trúng đạn! Hắn lật thế chỉ trong một nhịp!`]) : 'Phi đội Bravo... mất hết rồi.', true);
    e.scripted = false; CT.man = null;
  }
}

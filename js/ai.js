'use strict';
// Máy Bay Giấy · enemy & wingman AI (boss skills, elite tactics, defensive maneuvers)
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// Signature move: when one of your missiles closes in, he snaps into a hard break and spins twice round his
// own axis, shedding flares in a corkscrew and spiralling vapour off the wingtips. Most missiles lose him.
const SPIN_T = 1.1;
function eagleSpin(a, dt) {
  a.spinCD = (a.spinCD || 0) - dt;
  if (a.spinT > 0 && a.spinT - dt <= 0 && a.spinFoe && a.spinFoe.alive) {
    // spin finished: reverse onto the tail of whoever fired at him
    const f = a.spinFoe;
    a.mode = 'evade'; a.man = null; a.modeT = 1.4; a.target = f; a.preyT = 4;
    a.evadeDir.copy(f.pos).addScaledVector(fwdOf(f, _tmp2), -12).addScaledVector(UP, 1.5).sub(a.pos).normalize();
    if (f === P) radioOnce('eagleCounter', 'Lan', 'Hắn né xong là vòng ngay ra sau đuôi cậu đấy!', 12);
  }
  if (a.spinT > 0 || a.spinCD > 0) return;
  // wait for the last moment: ~0.7 s to impact, judged from the closing speed
  let m = null;
  for (const mm of missiles) {
    if (!mm.alive || mm.target !== a) continue;
    const d = mm.p.distanceTo(a.pos), closing = Math.max(4, mm.speed - a.speed * Math.max(0, mm.dir.dot(fwdOf(a, _tmp2))));
    if (d / closing < 0.7 || d < 6) { m = mm; break; }
  }
  if (!m) return;
  const fwd = fwdOf(a, new THREE.Vector3());
  a.spinT = SPIN_T; a.spinA = 0; a.spinCD = 4; a.spinSide = Math.random() < 0.5 ? -1 : 1; a.spinFoe = m.owner && m.owner.alive ? m.owner : null;
  a.mode = 'evade'; a.man = null; a.modeT = SPIN_T + 0.2;
  a.evadeDir.subVectors(a.pos, m.p).normalize().cross(UP).normalize().multiplyScalar(a.spinSide).addScaledVector(UP, 0.3).addScaledVector(fwd, 0.3).normalize();
  a.speed = Math.min(a.speed + 2, 14);
  // the missiles chasing him mostly bite on the flares
  for (const mm of missiles) if (mm.alive && mm.target === a && mm.p.distanceTo(a.pos) < 25 && Math.random() < 0.85) {
    mm.target = null; mm.dodgeRoll = true; if (mm.owner === P) stats.bossSpins = (stats.bossSpins || 0) + 1;
  }
  if (a.flares > 0) popFlares(a);
  whoosh();
  radioOnce('eagleSpin', pick(['Lan', 'Minh']), pick(['Hắn lại xoay né được!', 'Tên lửa không ăn thua với hắn!', 'Trời ạ, hắn xoay như con quay!']), 8);
}
function eagleSpinStep(a, dt) {
  a.spinT -= dt;
  const k = clamp(1 - a.spinT / SPIN_T, 0, 1), e = k * k * (3 - 2 * k), target = e * PI * 4;   // two full rolls, eased
  a.q.multiply(_q.setFromAxisAngle(FWD, (target - a.spinA) * a.spinSide)); a.spinA = target;
  // corkscrew of flare sparks + vapour spirals off both wingtips
  const fw = fwdOf(a, _tmp2), rt = rightOf(a, _ar), up = upOf(a, _ui);
  for (const sx of [-1, 1]) { _tmp.copy(a.pos).addScaledVector(rt, sx * 0.55); puff(smoke, _tmp, _pv.set(0, 0, 0), 0.7, 0.04, 0.12, 0xffffff); }
  if (Math.random() < 0.7) { const ang = clock * 14; _tmp.copy(a.pos).addScaledVector(rt, Math.cos(ang) * 1.1).addScaledVector(up, Math.sin(ang) * 1.1).addScaledVector(fw, -0.6); puff(fire, _tmp, _pv.copy(fw).multiplyScalar(-2), 0.5, 0.18, 0.06, 0xffd27a); }
}

// Đại Bàng Đỏ (3 vs 1): faster than all of you and turns harder. He hunts the weakest of your trio,
// and whenever two of you close in on him he zooms up out of the sandwich, then dives back on someone.
function bossTactics(a, t, fwd, dist, dt) {
  const blues = flyers.filter(o => o.alive && o.team === 'blue');
  const near = blues.filter(o => o.pos.distanceTo(a.pos) < 40);
  a.thinkT = Math.max(a.thinkT, 0.5);   // keep his own target choice
  a.preyT = (a.preyT || 0) - dt;
  // YOU are his prey. He only turns on a wingman briefly: to shake one sitting on his tail, or to finish
  // off one that's nearly down -- then he comes straight back for you.
  if (a.preyT <= 0 || !a.target || !a.target.alive) {
    let prey = P.alive ? P : blues[0], dur = rr(7, 10);
    const armourBroken = near.length >= 2;
    for (const o of blues) {
      if (o === P) continue;
      const v = _tmp.subVectors(a.pos, o.pos), d = v.length();
      const onMe = armourBroken && d < 25 && v.dot(fwdOf(o, _tmp2)) / d > 0.85 && a.lastHitBy === o && clock - a.lastHitT < 2;   // only if it is actually hurting him
      if (onMe || (o.hp < o.maxHp * 0.3 && d < 45)) { prey = o; dur = rr(2.5, 3.5); radioOnce('bossPrey' + o.name, o.name, 'Đại Bàng Đỏ quay sang tớ! Ai đó yểm hộ với!', 12); break; }
    }
    if (prey && prey !== a.target) { a.target = prey; a.hunt = 'stalk'; a.huntT = 0; }
    a.preyT = dur;
  }
  a.zoomCD = (a.zoomCD || 0) - dt;
  if (near.length >= 2 && a.mode === 'attack' && a.zoomCD <= 0 && Math.random() < dt * (1.1 + 0.4 * (a.rage || 0))) {
    a.zoomCD = rr(6, 8);
    const c = new THREE.Vector3(); near.forEach(o => c.add(o.pos)); c.divideScalar(near.length);
    a.mode = 'extend'; a.man = null; a.modeT = rr(1.6, 2.2); a.hunt = 'stalk'; a.huntT = 0;
    a.evadeDir.subVectors(a.pos, c).setY(0).normalize().addScaledVector(UP, a.pos.y < AREA.y - 10 ? 0.8 : 0).normalize();
    radioOnce('bossZoom', 'Bảng Đen', 'Hắn thoát khỏi vòng vây rồi! Hắn sẽ vòng lại, coi chừng!', 14);
  }
  // you got on his tail? he pulls up and over you (a reversal) and comes down behind you
  a.reverseCD = (a.reverseCD || 0) - dt;
  if (P.alive && a.mode === 'attack' && a.reverseCD <= 0) {
    const v = _tmp.subVectors(a.pos, P.pos), d = v.length();
    if (d < 28 && v.dot(fwdOf(P, _tmp2)) / d > 0.88 && v.dot(fwd) / d > 0.2) {
      a.reverseCD = rr(5, 7); a.mode = 'evade'; a.man = null; a.modeT = 1.3;
      a.evadeDir.copy(UP).multiplyScalar(a.pos.y < AREA.y - 10 ? 0.9 : 0.2).addScaledVector(fwd, -0.45).addScaledVector(rightOf(a, _tmp2), rr(-0.3, 0.3)).normalize();
      a.target = P; a.preyT = 7; a.hunt = 'strike'; a.huntT = 0;
      radioOnce('bossReverse', pick(['Lan', 'Minh']), 'Hắn lộn ngược qua đầu cậu, coi chừng sau lưng!', 8);
      return;
    }
  }
  // relentless attack runs: STALK into your blind spot (behind and above), STRIKE (dive in, guns, missile),
  // ZOOM away, and round again -- every few seconds there is a red eagle diving on someone
  let boost = 0;
  if (a.mode === 'attack' && t && t.alive) {
    a.hunt = a.hunt || 'stalk'; a.huntT = (a.huntT || 0) + dt;
    const tf = fwdOf(t, _tmp2).clone(), side = Math.sin(a.wander) > 0 ? 1 : -1;
    if (a.hunt === 'stalk') {
      const spot = _tmp.copy(t.pos).addScaledVector(tf, -30).addScaledVector(UP, Math.min(12, AREA.y - 6 - t.pos.y)).addScaledVector(new THREE.Vector3().crossVectors(tf, UP).normalize(), side * 9);
      _des.subVectors(spot, a.pos).normalize(); boost = 1.5;
      const behindIt = _ar.subVectors(a.pos, t.pos).dot(tf) < -8 && dist < 45;
      if (a.pos.distanceTo(spot) < 15 || behindIt || a.huntT > 2.5) { a.hunt = 'strike'; a.huntT = 0; if (t === P) radioOnce('bossDive', pick(['Lan', 'Minh', 'Bảng Đen']), pick(['Hắn bổ nhào xuống cậu kìa!', 'Trên đầu! Hắn đang lao xuống!', 'Ô Li 1, phía sau trên cao!']), 7); }
    } else if (a.hunt === 'strike') {
      boost = 2.5;   // _des is already the lead-pursuit line from the attack branch
      if (dist < 7 || a.huntT > 4.5) { a.hunt = 'zoom'; a.huntT = 0; }
    } else {
      _des.copy(fwd).setY(0).normalize().addScaledVector(UP, 0.7).normalize(); boost = 2;
      if (a.huntT > 1.4) { a.hunt = 'stalk'; a.huntT = 0; }
    }
  }
  a.speedCap = 11 + 1.0 * (a.rage || 0) + (a.mode === 'extend' ? 2 : 0) + boost;   // applied after the physics step
  if (a.mode === 'extend' || boost > 1.5) a.speed = Math.min(a.speedCap, a.speed + 6 * dt);   // bursts of speed
}
// Song Ưng: a two-ship that herds you. The one nearer you is the BAIT (stays in front of your nose, jinking,
// pulling you into a chase); the other is the HAMMER (swings round onto your tail and shoots).
// They also break your missile lock early by turning across your nose.
function eliteTactics(a, t, fwd, dist, dt) {
  const mate = flyers.find(f => f !== a && f.alive && f.kind === 'elite');
  if (t === P && P.target === a && P.lockP > 0.3 && !P.gunMode && a.mode === 'attack' && Math.random() < dt * 3.5) {
    a.mode = 'evade'; a.man = null; a.modeT = rr(0.9, 1.3);   // beam the seeker: cut sideways across your nose
    a.evadeDir.subVectors(a.pos, P.pos).setY(0).normalize().cross(UP).multiplyScalar(Math.random() < 0.5 ? -1 : 1).addScaledVector(UP, 0.1).normalize();
    radioOnce('eliteLock' + a.name, 'Lan', `${a.name} cắt ngang mũi cậu, khoá tuột mất rồi!`, 14);
    return;
  }
  if (!mate) return;   // alone: fight like a normal ace
  // ---- one shared plan for the pair, advanced once per frame: pincer -> bait & hammer -> (regroup) -> pincer ...
  let D = a.duo;
  if (!D || D !== mate.duo) D = a.duo = mate.duo = { phase: 'pincer', t: 0, tick: -1, side: Math.random() < 0.5 ? 1 : -1, lead: a };
  const lead = D.lead.alive ? D.lead : a;
  if (D.tick !== clock) {
    D.tick = clock; D.t += dt;
    const apart = a.pos.distanceTo(mate.pos);
    const next = ph => { D.phase = ph; D.t = 0; D.side = -D.side; a.role = mate.role = null; };
    if (D.phase === 'pincer' && D.t > 8) next('bait');
    else if (D.phase === 'bait' && D.t > 12) next(apart > 60 ? 'regroup' : 'pincer');
    else if (D.phase === 'regroup' && (apart < 14 || D.t > 5)) next('pincer');
  }
  // ---- mutual support ("Thach weave"): if one of them has someone on its tail, it drags the chaser across
  //      its partner's nose, and the partner turns in to shoot the chaser off
  let chaser = null;
  for (const o of flyers) {
    if (!o.alive || o.team === a.team) continue;
    const v = _tmp.subVectors(a.pos, o.pos), d = v.length();
    if (d > 0.1 && d < 28 && v.dot(fwdOf(o, _tmp2)) / d > 0.9 && v.dot(fwd) / d > 0.2) { chaser = o; break; }
  }
  if (chaser) {
    a.mode = 'evade'; a.man = 'weave'; a.modeT = Math.max(a.modeT || 0, 1.2);
    a.evadeDir.subVectors(mate.pos, a.pos).setY(0).normalize().addScaledVector(fwd, 0.35).normalize();
    if (mate.mode !== 'evade') { mate.weaveFor = chaser; mate.weaveT = 2.2; }
    if (chaser === P) radioOnce('weaveP', 'Bảng Đen', `${a.name} đang kéo cậu ngang qua mũi ${mate.name}! Bẻ ra ngay!`, 12);
    else radioOnce('weaveA' + chaser.name, chaser.name, `Tớ đuổi ${a.name} mà ${mate.name} lại lao thẳng vào tớ!`, 12);
    return;
  }
  if (a.weaveT > 0 && a.weaveFor && a.weaveFor.alive) {   // swing in on whoever is chasing my partner
    a.weaveT -= dt; a.target = a.weaveFor; a.thinkT = Math.max(a.thinkT, 0.5);
    const c = a.weaveFor, tt = c.pos.distanceTo(a.pos) / (BULLET_SPEED + a.speed);
    _des.copy(c.vel).multiplyScalar(tt).add(c.pos).sub(a.pos).normalize(); _leadDir.copy(_des);
    return;
  }
  if (!t || !t.alive) return;
  const tf = fwdOf(t, _tmp2).clone(), tr = new THREE.Vector3().crossVectors(tf, UP).normalize();
  if (D.phase === 'regroup') {   // form up on the leader's wing
    if (a !== lead) _des.copy(lead.pos).addScaledVector(fwdOf(lead, _tmp), -5).addScaledVector(rightOf(lead, _ar), 4).sub(a.pos).normalize();
    return;
  }
  if (D.phase === 'pincer') {
    // come in from both flanks at once: each takes one side, then both turn in together
    const side = a === lead ? D.side : -D.side;
    // aim for a spot abeam of where the target WILL be; "in position" = level with its wing on my side
    const pt = _tmp.copy(t.pos).addScaledVector(t.vel, 1.2).addScaledVector(tr, side * 20);
    const rel = _ar.subVectors(a.pos, t.pos), rl = rel.length() || 1;
    if (D.t < 0.1) a.pinIn = false;
    if (!a.pinIn && rl < 40 && Math.abs(rel.dot(tf)) / rl < 0.55 && rel.dot(tr) * side > 0) a.pinIn = true;
    if (!a.pinIn) _des.subVectors(pt, a.pos).normalize();
    if (a.pinIn && mate.pinIn && t === P) radioOnce('pincer', 'Lan', 'Chúng ép hai bên sườn cậu! Gọng kìm!', 12);
    return;
  }
  // bait & hammer: the one nearer the target dangles in front of it, the other swings onto its tail
  const dA = a.pos.distanceTo(t.pos), dM = mate.pos.distanceTo(t.pos);
  if (!a.role || !mate.role || a.role === mate.role) { a.role = dA <= dM ? 'bait' : 'hammer'; mate.role = a.role === 'bait' ? 'hammer' : 'bait'; }
  if (a.role === 'bait') {
    const side = Math.sin(clock * 0.9 + a.wander) * 7;
    _des.copy(t.pos).addScaledVector(tf, 22).addScaledVector(tr, side).sub(a.pos).normalize();
    if (a.tailT > 0.6 && Math.random() < dt * 2) defensiveManeuver(a, t, fwd);
    if (dist < 14) _des.addScaledVector(fwd, 1).normalize();
    if (t === P && a.tailT > 0.3) radioOnce('eliteBait', 'Bảng Đen', `${a.name} cứ lượn trước mũi cậu mãi... coi chừng chiếc còn lại!`, 25);
  } else {
    const behindT = _tmp.copy(t.pos).addScaledVector(tf, -14).addScaledVector(UP, 2);
    const onSix = _ar.subVectors(a.pos, t.pos).dot(tf) < -6 && dA < 26;
    if (!onSix) _des.subVectors(behindT, a.pos).normalize();
    if (onSix && t === P) radioOnce('eliteHammer', 'Lan', `Ô Li 1! ${a.name} đang ở sau đuôi cậu!`, 12);
  }
}
// Defensive maneuvers when someone sits on our tail; each design has its favourites.
const MANEUVERS = {   // weights for [break, scissors, climb, gap]
  dart: [3, 2, 1, 2], swallow: [2, 1, 0, 3], stunt: [1, 2, 3, 1], nakamura: [3, 1, 1, 1], glider: [3, 0, 0, 1],
  boomerang: [2, 2, 1, 1], ace: [2, 3, 3, 1], elite: [2, 3, 2, 2], tape: [3, 0, 0, 2], ring: [1, 0, 0, 0], mother: [1, 0, 0, 0],
};
function defenceCheck(a, fwd, dt) {   // returns the chaser when it's time to shake them
  // the Red Eagle shrugs off a lone chaser (his double armour laughs at one gun) and keeps pressing his attack;
  // only when two of you close in does he bother to defend
  if (a.kind === 'ace' && flyers.filter(o => o.alive && o.team !== a.team && o.pos.distanceTo(a.pos) < 40).length < 2) { a.tailT = 0; return null; }
  let chaser = null;
  for (const o of flyers) {
    if (!o.alive || o.team === a.team) continue;
    _tmp.subVectors(a.pos, o.pos); const d = _tmp.length();
    if (d < 30 && d > 0.1 && _tmp.dot(fwdOf(o, _tmp2)) / d > 0.9 && _tmp.dot(fwd) / d > 0.2) { chaser = o; break; }   // behind me, close, nose on me
  }
  a.tailT = chaser ? (a.tailT || 0) + dt : Math.max(0, (a.tailT || 0) - dt * 2);
  // it takes them a moment to notice: you get ~1 s of clean shooting first
  return chaser && a.tailT > 0.9 && Math.random() < dt * 1.4 * (a.K.evade || 1) ? chaser : null;
}
function defensiveManeuver(a, chaser, fwd) {
  const w = MANEUVERS[a.kind] || [3, 1, 1, 1], names = ['break', 'scissors', 'climb', 'gap'];
  let r = Math.random() * w.reduce((x, y) => x + y, 0), pickI = 0;
  for (; pickI < 4; pickI++) { r -= w[pickI]; if (r <= 0) break; }
  let man = names[Math.min(pickI, 3)];
  if (man === 'climb' && a.pos.y > AREA.y - 12) man = 'break';
  if (man === 'gap') {   // nearest low opening (tree tunnels, benches, hoops...) ahead-ish within reach
    let best = null, bd = 70;
    for (const g of gaps) { const d = g.c.distanceTo(a.pos); if (d < bd && d > 8 && g.c.y < 16 && _tmp.subVectors(g.c, a.pos).dot(fwd) > -0.2 * d) { bd = d; best = g; } }
    if (best) a.manP = best.c.clone(); else man = 'break';
  }
  a.mode = 'evade'; a.man = man; a.tailT = 0;
  if (man === 'break') { a.modeT = rr(1.2, 2.0); a.evadeDir.copy(rightOf(a, _tmp2)).setY(0).normalize().multiplyScalar(Math.random() < 0.5 ? -1 : 1).addScaledVector(fwd, 0.25).addScaledVector(UP, rr(-0.2, 0.3)).normalize(); }
  else if (man === 'scissors') { a.modeT = rr(2.0, 2.8); a.jinkT = 0; a.jinkS = Math.random() < 0.5 ? -1 : 1; }
  else if (man === 'climb') { a.modeT = rr(1.3, 1.9); a.evadeDir.copy(UP).addScaledVector(fwd, -0.3).normalize(); }   // up and over the chaser
  else a.modeT = 3.5;
  if (chaser === P && a.team === 'red' && man === 'gap') radioOnce('aiGap', 'Lan', 'Nó định dụ cậu đâm vào cây đấy, cẩn thận!', 20);
  if (chaser !== P && a.team === 'blue') radioOnce('allyTail' + a.name, a.name, 'Có địch bám đuôi tớ! Giúp với!', 20);
}
function updateAI(a, dt) {
  if (a.flee) { updateFlee(a, dt); return; }
  if (a.K.ai === 'route') { updateHeron(a, dt); return; }
  if (a.K.ai === 'dread') { updateDread(a, dt); return; }
  if (a.kind === 'ace') eagleSpin(a, dt);
  const fwd = fwdOf(a, _fa);
  a.thinkT -= dt;
  if (a.thinkT <= 0 || !a.target || !a.target.alive) {
    a.thinkT = rr(1.5, 3);
    let best = null, bd = 1e9;
    for (const o of flyers) if (o.alive && o.team !== a.team) {
      let d = o.pos.distanceTo(a.pos); if (o === P) d *= a.K.ai === 'ram' ? 0.3 : 0.6; if (o === heron) d *= 0.35;
      if (d < bd) { bd = d; best = o; }
    }
    a.target = best;
  }
  const t = a.target;
  let dist = 1e9;
  _leadDir.copy(fwd);
  if (t) {
    dist = t.pos.distanceTo(a.pos);
    const tt = dist / (BULLET_SPEED + a.speed);
    _leadDir.copy(t.vel).multiplyScalar(tt).add(t.pos).sub(a.pos).normalize();
  }
  if (a.mode === 'evade' || a.mode === 'extend') {
    if (a.man === 'scissors') {   // flick left-right-left so the chaser overshoots
      a.jinkT -= dt; if (a.jinkT <= 0) { a.jinkT = rr(0.5, 0.75); a.jinkS = -(a.jinkS || 1); }
      a.evadeDir.copy(rightOf(a, _tmp2)).setY(0).normalize().multiplyScalar(a.jinkS * 1.2).addScaledVector(fwd, 0.6).addScaledVector(UP, 0.05).normalize();
    } else if (a.man === 'gap' && a.manP) {   // dive through a gap in the trees and hope the chaser hits it
      a.evadeDir.subVectors(a.manP, a.pos).normalize();
      if (a.pos.distanceTo(a.manP) < 2.5) { a.man = null; a.evadeDir.copy(fwd).setY(0.2).normalize(); }
    }
    _des.copy(a.evadeDir); a.modeT -= dt; if (a.modeT <= 0) { a.mode = 'attack'; a.man = null; }
  } else if (a.mode === 'roam') {
    _des.copy(fwd).setY(0).normalize().addScaledVector(rightOf(a, _tmp2).setY(0).normalize(), 0.35 * a.roamS * Math.sin(clock * 1.3 + a.wander)).normalize();
    _des.y = (12 - a.pos.y) * 0.03;
    a.modeT -= dt; if (a.modeT <= 0) a.mode = 'attack';
    if (t) { const c = defenceCheck(a, fwd, dt); if (c) defensiveManeuver(a, c, fwd); }
  } else if (t) {
    _des.copy(_leadDir);
    _des.x += Math.sin(clock * 0.7 + a.wander) * 0.07; _des.y += Math.cos(clock * 0.5 + a.wander) * 0.05; _des.normalize();
    // per-design tactics
    const ai = a.K.ai, behind = _tmp.subVectors(t.pos, a.pos).dot(fwd) < 0;
    if (ai === 'elite') eliteTactics(a, t, fwd, dist, dt);
    else if (ai === 'boss') bossTactics(a, t, fwd, dist, dt);
    else if (ai === 'boomerang') {
      _des.addScaledVector(rightOf(a, _tmp2), 0.35 * a.curl).normalize();               // curved approach
      if (behind && dist < 10) { a.mode = 'extend'; a.modeT = 1.7; a.evadeDir.copy(fwd).applyAxisAngle(UP, a.curl * 1.4).addScaledVector(UP, 0.15).normalize(); }  // swing back round
    } else if (ai === 'hitrun' && dist < 5) {                                             // slash through, then run and come back
      a.mode = 'extend'; a.modeT = 1.8; a.evadeDir.copy(fwd).addScaledVector(UP, 0.15).normalize();
    } else if (ai === 'bomber' && a.bombs > 0 && objectives.some(o => o.alive)) {
      // fly over a landmark and let go of a water balloon
      if (!a.bombTgt || !a.bombTgt.alive) { let bd = 1e9; for (const o of objectives) if (o.alive) { const d = o.pos.distanceTo(a.pos) + rr(0, 15); if (d < bd) { bd = d; a.bombTgt = o; } } }
      const o = a.bombTgt, aimP = _tmp2.copy(o.pos).addScaledVector(a.vel, -0.45); aimP.y = o.pos.y + 8;
      _des.subVectors(aimP, a.pos).normalize();
      a.bombCD -= dt;
      if (Math.hypot(a.pos.x - aimP.x, a.pos.z - aimP.z) < 3 && a.bombCD <= 0 && a.pos.y > o.pos.y + 3) {
        dropBomb(a); a.bombs--; a.bombCD = 2.5;
        if (a.bombs >= 0) { a.mode = 'extend'; a.modeT = 2.2; a.evadeDir.copy(fwd).setY(0.15).normalize(); }
        radioOnce('bombDrop', 'Bảng Đen', 'Vòng Ống đang thả bom nước xuống!', 15);
      }
    } else if (ai === 'support') {
      // tape plane: hang back behind its wingmen and patch them up; flee if the player gets close
      let hurt = null, hd = 1e9;
      for (const o of flyers) if (o.alive && o.team === a.team && o !== a && o.hp < o.maxHp) { const d = o.pos.distanceTo(a.pos); if (d < hd) { hd = d; hurt = o; } }
      if (P.alive && P.pos.distanceTo(a.pos) < 12) { a.mode = 'extend'; a.modeT = 1.6; a.evadeDir.subVectors(a.pos, P.pos).setY(0).normalize().addScaledVector(UP, 0.1).normalize(); }
      else if (hurt) _des.subVectors(_tmp2.copy(hurt.pos).addScaledVector(fwdOf(hurt, _tmp), -4), a.pos).normalize();
    } else if (ai === 'ram') {
      // crumpled paper ball: straight at its target, full speed, bursts on contact
      _des.subVectors(_tmp2.copy(t.vel).multiplyScalar(Math.min(1.2, dist / 14)).add(t.pos), a.pos).normalize();
      if (dist < 0.9 + (t.K ? t.K.hitR : 0.4)) { damage(t, 22, a); a.lastHitBy = null; burst(a.pos, 30, [0xe8e2d0, 0xffffff], 5, 1.5, 1); destroy(a, null); popup(t === P ? 'BỊ GIẤY VO ĐÂM!' : `${t.name} bị Giấy Vo đâm!`, RED, 1); return; }
    } else if (ai === 'carrier') {
      // mothership: slow wide circles high over the yard, launching darts
      const c = arenaCenter(a.pos.z, _tmp2); _tmp.subVectors(a.pos, c); _tmp.y = 0;
      const rad = _tmp.length() || 1; _tmp.divideScalar(rad);
      _des.set(-_tmp.z, 0, _tmp.x).addScaledVector(_tmp, (34 - rad) * 0.05); _des.y = (30 - a.pos.y) * 0.08; _des.normalize();
      if (a.K.turrets) shipWeapons(a, dt);
      a.spawnT -= dt;
      const kids = flyers.filter(f => f.alive && f.mom === a).length;
      if (a.spawnT <= 0 && kids < 5) {
        a.spawnT = 8;
        const d = makeFlyer('dart', 'red', `Phi Tiêu con ${++a.kidN || (a.kidN = 1)}`); d.mom = a;
        d.pos.copy(a.pos).addScaledVector(DOWN, 1.2); orient(d, fwd); d.speed = 9;
        radioOnce('motherKids', 'Bảng Đen', 'Tàu Mẹ lại vừa thả thêm Phi Tiêu!', 12);
      }
    } else if (ai === 'sniper' && dist < 11) {                                            // keep distance, shoot from afar
      a.mode = 'extend'; a.modeT = 1.5; a.evadeDir.subVectors(a.pos, t.pos).setY(0).normalize().addScaledVector(fwd, 0.6).addScaledVector(UP, 0.1).normalize();
    }
    // never pile into the target: inside 6 m, pull off and come round again
    if (a.mode === 'attack' && a.K.ai !== 'ram' && dist < 6) {
      a.mode = 'extend'; a.modeT = rr(1.2, 1.8);
      a.evadeDir.subVectors(a.pos, t.pos).normalize().addScaledVector(rightOf(a, _tmp2), a.curl * 0.6).addScaledVector(UP, 0.15).normalize();
    }
    // someone on my tail? break!
    { const c = defenceCheck(a, fwd, dt); if (c) defensiveManeuver(a, c, fwd); }
    // stalemate breaker: circling with no shot for a while -> extend away and come back in
    if (dist < 40 && fwd.angleTo(_leadDir) > 0.7) a.noShotT = (a.noShotT || 0) + dt; else a.noShotT = Math.max(0, (a.noShotT || 0) - dt);
    if (a.mode === 'attack' && a.noShotT > 3 && a.K.ai !== 'ram' && a.K.ai !== 'boss') {
      // no shot for a while: give up the turning fight and roam in lazy S-curves for a bit (a chance to get on its tail)
      a.noShotT = 0; a.mode = 'roam'; a.modeT = rr(3, 4.5); a.man = null; a.roamS = Math.random() < 0.5 ? -1 : 1;
    }
  } else _des.subVectors(arenaCenter(a.pos.z, _tmp2), a.pos).normalize();
  if (a.K.ai === 'support') for (const o of flyers) if (o.alive && o.team === a.team && o !== a && o.hp < o.maxHp && o.pos.distanceTo(a.pos) < 10) {
    o.hp = Math.min(o.maxHp, o.hp + 7 * dt);
    if (Math.random() < dt * 6) puff(smoke, _tmp.copy(o.pos).add(_pv.set(rr(-0.4, 0.4), rr(0, 0.5), rr(-0.4, 0.4))), _pv.set(0, 0.6, 0), 0.6, 0.05, 0.12, 0x5fd35f);
  }
  // missile defence: break across the missile's path and down (makes it overshoot); flares when close
  for (const m of missiles) {
    if (!m.alive || m.target !== a) continue;
    const md = m.p.distanceTo(a.pos);
    // a late, hard break (missile < 12 m away) can make it overshoot, same rule as the player's V
    if (a.mode === 'evade' && md < 12 && !m.dodgeRoll && a.kind !== 'ace') {
      m.dodgeRoll = true;
      if (Math.random() < 0.3 * (a.K.evade || 1)) { m.target = null; if (m.owner === P) popup(`${a.name} NÉ ĐƯỢC TÊN LỬA!`, '#cfcfcf'); }
      continue;
    }
    if (a.mode === 'evade') continue;
    if (md < 22 && Math.random() < dt * 2.2 * (a.K.evade || 1)) {
      a.mode = 'evade'; a.modeT = rr(1.4, 2.2);
      a.evadeDir.subVectors(a.pos, m.p).normalize().cross(UP).normalize().multiplyScalar(Math.random() < 0.5 ? -1 : 1).addScaledVector(UP, a.pos.y > 8 ? -0.25 : 0.1).normalize();
      if (a.flares > 0 && md < 16 && Math.random() < 0.8) popFlares(a);
      _des.copy(a.evadeDir);
      break;
    }
  }
  // stay inside the school
  const nearEdge = (p, m) => Math.abs(p.x) > AREA.x - m || p.z > AREA.zMax - m || p.z < AREA.zMin + m || p.y > AREA.y - m * 0.3;
  if (nearEdge(a.pos, 4) || nearEdge(_tmp.copy(a.vel).multiplyScalar(1.2).add(a.pos), 0)) _des.subVectors(arenaCenter(a.pos.z, _tmp2), a.pos).normalize();
  // separation from wingmen
  for (const o of flyers) if (o !== a && o.alive && o.team === a.team) { const d = a.pos.distanceTo(o.pos); if (d < 8 && d > 0.01) _des.addScaledVector(_tmp.subVectors(a.pos, o.pos).normalize(), (8 - d) / 8 * 0.9); }   // keep ~8 m apart
  _des.normalize();
  if (a.forceCrash) { a.forceCrashT -= dt; if (a.forceCrashT <= 0) a.forceCrash = null; else _des.subVectors(a.forceCrash, a.pos).normalize(); }
  // terrain avoidance (look ahead)
  let danger = !a.forceCrash && a.pos.y < 1.3;
  const boss = a.kind === 'ace' || a.kind === 'elite' || a.K.tough;   // tough ones read the terrain further ahead and glance off walls
  const look = boss ? [0.25, 0.5, 0.8, 1.2, 1.7] : [0.3, 0.75, 1.3], lm = boss ? 1.6 : 0.9;   // aces read the terrain further ahead
  if (!danger && !a.forceCrash) for (const tl of look) { _tmp.copy(a.vel).multiplyScalar(tl).add(a.pos); if (_tmp.y < 1.3 || pointBlocked(_tmp, lm)) { danger = true; break; } }
  if (danger) { _tmp.set(fwd.x, 0, fwd.z); if (_tmp.lengthSq() < 0.01) _tmp.set(0, 0, -1); _tmp.normalize().multiplyScalar(0.35); _des.set(_tmp.x, 1, _tmp.z).normalize(); }
  instructor(a, _des, ctlA);
  if (a.mode === 'attack') ctlA.pitch *= a.kind === 'ace' ? 1 : a.kind === 'elite' ? 0.97 : 0.75;   // the Red Eagle out-turns everyone   // they can't sustain your turn rate: you can out-turn them onto their six
  const ahead = t && _tmp.subVectors(t.pos, a.pos).dot(fwd) > 0;
  ctlA.throttle = danger || a.mode === 'evade' || a.mode === 'extend' || a.K.ai === 'ram' || a.K.ai === 'elite' || a.K.ai === 'boss' ? 0.95 : (ahead && dist < 14 ? 0.45 : 0.7);   // hang back ~14 m when chasing
  if (a.K.chaser && t) ctlA.throttle = 1;   // a hunter never hangs back
  flyPhysics(a, ctlA, dt);
  if (a.K.chaser && t) {   // ...and keeps up whatever the prey does: falling behind, it pours on speed (even past the sound barrier)
    const want = dist > 22 ? Math.min(t.speed + 3 + (dist - 22) * 0.08, 32) : Math.max(a.K.veq, t.speed + 0.5);
    a.speed += (want - a.speed) * (1 - Math.exp(-dt * 6));
    a.vel.copy(fwdOf(a, _fa)).multiplyScalar(a.speed);
  }
  if (a.spinT > 0) eagleSpinStep(a, dt);
  a.pos.addScaledVector(a.vel, dt);
  a.pos.x = clamp(a.pos.x, -AREA.x - 2, AREA.x + 2); a.pos.z = clamp(a.pos.z, AREA.zMin - 2, AREA.zMax + 2); a.pos.y = Math.min(a.pos.y, AREA.y + 1);
  if (a.forceCrash && a.pos.distanceTo(a.forceCrash) < 0.9) { a.lastHitBy = P; a.lastHitT = clock; crash(a); return; }
  if (a.speedCap) a.speed = Math.min(a.speed, a.speedCap);
  if (pointBlocked(a.pos, 0)) {
    if (!boss) { crash(a); return; }
    // aces never just splat: they glance off, lose some paper and pull up
    a.pos.addScaledVector(a.vel, -dt * 2); collideSphere(a.pos, 0.7);   // step back and get pushed clear of the wall/tree
    orient(a, _tmp.copy(fwdOf(a, _tmp2)).setY(0).normalize().addScaledVector(UP, 1.2));
    if (clock - (a.glanceT || -9) > 1) {   // one scrape = one hit, however many frames it lasts
      a.glanceT = clock; a.speed *= 0.6; a.hp -= 25; a.lastHitT = clock;
      burst(a.pos, 14, [a.colorHex, 0xffffff], 3, 1, 1); popup(`${a.name.toUpperCase()} VA QUỆT! -25`, '#ffb36b', 1);
      if (a.hp <= 0) { crash(a); return; }
    }
  }
  // guns
  a.gunT -= dt;
  if (t && a.K.gunRange > 0 && a.mode !== 'evade' && a.mode !== 'extend' && dist < a.K.gunRange && fwd.angleTo(_leadDir) < a.K.gunCone && a.gunT <= 0) {
    a.burst = (a.burst || 0) + 1;
    fireGun(a, 0.02 + dist / 1500);
    a.gunT = a.burst % 10 === 0 ? rr(0.6, 1.2) : 1 / a.K.fireRate;
  }
  // missiles
  // missiles: limited load-out; must hold the target in the seeker for 1.6 s (the target hears it coming)
  if (a.mslLeft > 0 && t) {
    a.mslT -= dt;
    const inCone = a.mslT <= 0 && a.mode === 'attack' && dist < (a.K.mslRange || 60) && dist > 15 && fwd.angleTo(_tmp.subVectors(t.pos, a.pos).normalize()) < (a.K.mslCone || 0.55);
    a.lockT = inCone ? a.lockT + dt : Math.max(0, a.lockT - dt * 2);
    if (t === P && a.lockT > 0.3) { P.lockedBy = a; P.lockedByT = 0.25; }
    if (a.lockT >= (a.K.mslLock || (a.kind === 'ace' ? 1.1 : 1.6) - (a.kind === 'ace' ? 0.2 : 0.4) * (a.phase || 0))) {   // an enraged boss locks faster   // an enraged boss locks faster
      launchMissile(a, t); a.mslLeft--; a.lockT = 0; a.mslT = a.K.mslGap ? rr(...a.K.mslGap) : a.kind === 'ace' ? rr(4.5, 6.5) : rr(7, 10);
      if (a.kind === 'elite') {   // salvo: the partner fires at the same target from its own angle
        const m2 = flyers.find(f => f !== a && f.alive && f.kind === 'elite');
        if (m2 && m2.mslLeft > 0 && m2.target === t && m2.pos.distanceTo(t.pos) < 70 && m2.lockT < 50) { m2.lockT = 99; if (t === P) radioOnce('salvo', 'Bảng Đen', 'Song Ưng phóng tên lửa đồng loạt từ hai hướng!', 12); }
      }
      if (t === P) radioOnce('enemyFox', pick(['Lan', 'Minh', 'Bảng Đen']), pick([`${a.name} vừa phóng tên lửa vào cậu!`, 'Tên lửa! Có tên lửa bám theo cậu!', 'Tên lửa đang lao tới, né đi!']), 8);
    }
  }
}

function updateFalling(f, dt) {
  f.vel.y -= 9 * dt; f.vel.multiplyScalar(1 - 0.3 * dt);
  f.pos.addScaledVector(f.vel, dt);
  _q.setFromEuler(_e.set(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt)); f.q.multiply(_q);
  f.smokeT -= dt;
  if (f.smokeT <= 0) { f.smokeT = 0.03; puff(smoke, f.pos, _pv.set(0, 0.25, 0), 1.2, 0.06, 0.26, 0x444444); if (Math.random() < 0.6) puff(fire, f.pos, _pv.set(0, 0, 0), 0.2, 0.1, 0.17, 0xff8c1a); }
  if (pointBlocked(f.pos)) {
    explosion(f.pos, 0.9, 0.6);
    f.falling = false;
    if (f === P) { f.obj.visible = false; f.trails.forEach(t => t.line.visible = false); } else removeFlyer(f);
  }
}

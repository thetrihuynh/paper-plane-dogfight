'use strict';
// Máy Bay Giấy · Tàu Mẹ, the flying battleship (Chương 4, and the second one later on)
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)
// Too big to dodge or turn hard: it flies slow and dead straight, high over the yard, for the Thư Viện where
// Phe Xanh folds its planes, and bombs it on arrival. It carries no guns: it ripples missiles off its wings,
// pops flares, and keeps launching escort fighters from its belly.

const _dt = new THREE.Vector3(), _dw = new THREE.Vector3(), _dq = new THREE.Quaternion();
// world position of a point given in the ship's own (unscaled) frame
const shipPoint = (a, p, out) => out.set(p[0], p[1], p[2]).multiplyScalar(a.K.scale).applyQuaternion(a.q).add(a.pos);
const LIB_TARGET = () => OBJECTIVE_DEFS.library.pos;
// missiles off its wings, at whoever is closest (Alpha 1 first)
function shipMissiles(a, dt) {
  a.mslT -= dt;
  if (a.mslT > 0) return;
  let best = null, bd = a.kind === 'dread' ? 80 : 60;
  for (const f of flyers) if (f.alive && f.team !== a.team) { const d = f.pos.distanceTo(a.pos) * (f === P ? 0.7 : 1); if (d < bd && d > 12) { bd = d; best = f; } }
  if (!best) { a.mslT = 1; return; }
  launchMissile(a, best); a.mslLeft--;
  a.mslT = a.kind === 'dread' ? rr(4.5, 6.5) : rr(4.5, 6.5);
  if (best === P) radioOnce('shipFox', 'Blackboard', 'Alpha 1, missile từ Tàu Mẹ! Lộn vòng, pháo sáng!', 10);
}
function shipFlares(a, dt) {
  a.flareCD = (a.flareCD || 0) - dt;
  if (a.flares > 0 && a.flareCD <= 0 && missiles.some(m => m.alive && m.target === a && m.p.distanceTo(a.pos) < 18)) { popFlares(a); a.flareCD = 3.5; }
}
// a steady stream of escort fighters from the hangar under its belly
function shipEscorts(a, dt) {
  a.spawnT -= dt;
  const kids = flyers.filter(f => f.alive && f.mom === a).length, cap = a.kind === 'dread' ? 3 : 4;
  if (a.spawnT > 0 || kids >= cap) return;
  a.spawnT = a.kind === 'dread' ? 11 : 9;
  for (let i = 0; i < 2 && kids + i < cap; i++) {
    const k = a.kind === 'dread' ? pick(['dart', 'swallow', 'dart', 'nakamura']) : 'dart';
    const d = makeFlyer(k, 'red', `${KINDS[k].label} hộ tống ${(a.kidN = (a.kidN || 0) + 1)}`); d.mom = a;
    shipPoint(a, [i ? 0.25 : -0.25, -0.2, 0.2], d.pos); orient(d, fwdOf(a, _dt).setY(-0.15)); d.speed = 10;
  }
  radioOnce('shipKids', 'Blackboard', 'Tàu Mẹ phóng thêm tiêm kích hộ tống!', 14);
}
function updateDread(a, dt) {
  const lib = LIB_TARGET();
  // steer, barely: a slow swing of the nose towards the library, cruising high over everything
  const want = _dt.set(lib.x - a.pos.x, 0, lib.z - a.pos.z), hd = want.length();
  want.normalize(); want.y = (30 - a.pos.y) * 0.02;
  const fw = fwdOf(a, _dw);
  _dq.setFromUnitVectors(fw, fw.clone().lerp(want.normalize(), Math.min(1, dt * 0.25)).normalize()); a.q.premultiply(_dq); a.q.normalize();
  a.speed = a.K.veq; a.vel.copy(fwdOf(a, _dw)).multiplyScalar(a.speed); a.pos.addScaledVector(a.vel, dt);
  // over the library: open the bomb bay
  a.bombCD = (a.bombCD || 0) - dt;
  if (hd < 20 && a.bombCD <= 0) {
    a.bombCD = 0.35; dropBomb(a, 2.6); shipPoint(a, [rr(-0.15, 0.15), -0.15, rr(-0.2, 0.4)], bombs[bombs.length - 1].p);
    radioOnce('shipBombs', 'Blackboard', 'Tàu Mẹ đang ném bom Thư Viện! Hạ nó ngay!', 20);
  } else if (hd < 120) radioOnce('shipNear', 'Blackboard', `Tàu Mẹ cách Thư Viện ${Math.round(hd)} mét! Tập trung hoả lực!`, 20);
  shipMissiles(a, dt); shipFlares(a, dt); shipEscorts(a, dt);
  // engine smoke when it's hurt
  if (a.hp < a.maxHp * 0.5 && Math.random() < dt * 10) puff(smoke, shipPoint(a, pick(MOTHER_ENGINES), _dw), _pv.set(0, 1, 0), 2.5, 0.6, 2.4, 0x3a3a3a);
}
// the circling kind ('mother'): the same missiles and flares
function shipWeapons(a, dt) { shipMissiles(a, dt); shipFlares(a, dt); }
// down at last: a chain of explosions along the hull, and the escorts turn tail
function shipDown(a) {
  for (let i = 0; i < 6; i++) setTimeout(() => { if (state === 'menu') return; explosion(shipPoint(a, [rr(-0.6, 0.6), rr(-0.1, 0.3), rr(-0.8, 0.9)], new THREE.Vector3()), 2.4, 1); shake = Math.min(1, shake + 0.35); }, i * 260);
  burst(a.pos, 120, [0x8f97a6, 0xffffff, 0x9c1c1c, 0xf4f1e6], 14, 3, 3);
  for (const f of flyers) if (f.alive && f.team === a.team && f !== a) f.flee = true;   // the whole escort turns tail
  flash('TÀU MẸ ĐÃ BỊ HẠ!', 'Hộ tống của nó tháo chạy', 3);
  radio('Blackboard', a.kind === 'dread' ? 'Splash Tàu Mẹ! Thư Viện an toàn. Làm tốt lắm, Alpha!' : 'Splash Tàu Mẹ thứ hai!', true);
}
// a fleeing escort: full throttle for their own gate, gone once it's out
function updateFlee(a, dt) {
  const fw = fwdOf(a, _dw), want = _dt.set(0, 30, SCHOOL.zS - 40).sub(a.pos).normalize();
  _dq.setFromUnitVectors(fw, fw.clone().lerp(want, Math.min(1, dt * 2)).normalize()); a.q.premultiply(_dq); a.q.normalize();
  a.speed = Math.min(26, a.speed + 8 * dt); a.vel.copy(fwdOf(a, _dw)).multiplyScalar(a.speed); a.pos.addScaledVector(a.vel, dt);
  a.fleeT = (a.fleeT || 0) + dt;
  if (a.pos.z < SCHOOL.zS - 10 || a.fleeT > 6) { puff(smoke, a.pos, _pv.set(0, 0, 0), 1, 0.3, 1.2, 0xdddddd); removeFlyer(a); }   // gone over the horizon
}

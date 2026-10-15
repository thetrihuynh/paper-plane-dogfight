'use strict';
// Máy Bay Giấy · HUD, gunsight, radar
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  HUD (canvas, Ace Combat green)
// =====================================================================
const hudc = $('hudc'), hg = hudc.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resizeHud() { DPR = Math.min(devicePixelRatio, 2); W = innerWidth; H = innerHeight; hudc.width = W * DPR; hudc.height = H * DPR; hg.setTransform(DPR, 0, 0, DPR, 0, 0); }
resizeHud();
const HUDC = '#7dff9a';
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const G = '#9effa0', RED = '#ff4d4d', BLU = '#7fd6ff', YEL = '#ffe066', LOCKG = '#3dff6a';
const LOCK_RANGE = 60, LOCK_CONE = 0.4;
const GUN_RANGE = 45;   // bullets fly ~40 m/s for 1 s, plus our own speed
const _sp = new THREE.Vector3(), _cam = new THREE.Vector3();
const _rtv = new THREE.Vector3();
function proj(v) {
  _cam.copy(v).applyMatrix4(camera.matrixWorldInverse);
  const behind = _cam.z > 0;
  _sp.copy(v).project(camera);
  return { x: (_sp.x * 0.5 + 0.5) * W, y: (-_sp.y * 0.5 + 0.5) * H, behind, cx: _cam.x, cy: _cam.y };
}
function edgeArrow(p, color) {
  let dx = p.cx, dy = -p.cy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  if (!p.behind) { dx = p.x - W / 2; dy = p.y - H / 2; const l2 = Math.hypot(dx, dy) || 1; dx /= l2; dy /= l2; }
  const r = Math.min(W, H) * 0.42, x = W / 2 + dx * r, y = H / 2 + dy * r, a = Math.atan2(dy, dx);
  hg.save(); hg.translate(x, y); hg.rotate(a); hg.fillStyle = color;
  hg.beginPath(); hg.moveTo(16, 0); hg.lineTo(-6, -10); hg.lineTo(-6, 10); hg.closePath(); hg.fill(); hg.restore();
}
function text(t, x, y, color, size = 13, align = 'left', weight = '700') {
  hg.font = `${weight} ${size}px Consolas, "Courier New", monospace`; hg.textAlign = align; hg.textBaseline = 'middle';
  hg.fillStyle = 'rgba(0,0,0,0.5)'; hg.fillText(t, x + 1, y + 1);
  hg.fillStyle = color; hg.fillText(t, x, y);
}
// speed lines: streaks flying out from where we're heading; edges darken a little at full rush
const SL = Array.from({ length: 70 }, () => ({ a: Math.random() * PI * 2, r: Math.random(), v: 0.6 + Math.random() * 0.8, w: 0.6 + Math.random() * 1.4 }));
let slLast = 0;
function drawSpeedLines() {
  const k = state === 'play' && P.alive ? P.rush || 0 : 0;
  const dt = Math.min(0.05, clock - slLast); slLast = clock;
  if (k < 0.08) return;
  const vp = proj(_v1.copy(P.pos).addScaledVector(P.vel, 50));
  const cx = vp.behind ? W / 2 : clamp(vp.x, W * 0.2, W * 0.8), cy = vp.behind ? H / 2 : clamp(vp.y, H * 0.2, H * 0.8);
  const R = Math.hypot(W, H) * 0.6;
  hg.save(); hg.lineCap = 'round';
  for (const l of SL) {
    l.r += dt * l.v * (1.2 + k * 3.5);
    if (l.r > 1) { l.r = 0.25 + Math.random() * 0.2; l.a = Math.random() * PI * 2; }
    const r0 = l.r * R, r1 = r0 + (0.04 + k * 0.16) * R * l.v;
    const al = k * 0.55 * Math.min(1, (l.r - 0.25) * 4);
    if (al <= 0.01) continue;
    hg.strokeStyle = `rgba(255,255,255,${al.toFixed(3)})`; hg.lineWidth = l.w * (0.6 + k);
    hg.beginPath(); hg.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0); hg.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1); hg.stroke();
  }
  const g = hg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${(k * 0.35).toFixed(3)})`);
  hg.fillStyle = g; hg.fillRect(0, 0, W, H);
  hg.restore();
}
function drawPopups(dt) {
  let y = H * 0.36;
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t -= dt; if (p.t <= 0) { popups.splice(i, 1); continue; }
    const a = Math.min(1, p.t / 0.3), rise = (1 - p.t / p.dur) * 18;
    hg.globalAlpha = a; text(p.text, W / 2, y - rise, p.color, 20, 'center', '800'); hg.globalAlpha = 1; y -= 26;
  }
}
// lead-computing gunsight: the pipper sits where the target will be when the bullets arrive.
// Put the gun cross inside the pipper and fire.
function drawGunSight(pp, fwd, blink) {
  const t = P.target, heatCol = P.overheat ? RED : P.heat > 0.7 ? YEL : HUDC;
  // weapon label + heat arc under the gun cross
  if (!pp.behind) {
    hg.save(); hg.lineWidth = 3; hg.strokeStyle = 'rgba(0,0,0,0.35)'; hg.beginPath(); hg.arc(pp.x, pp.y, 20, PI * 0.25, PI * 0.75); hg.stroke();
    hg.strokeStyle = heatCol; hg.beginPath(); hg.arc(pp.x, pp.y, 20, PI * 0.75 - PI * 0.5 * (1 - P.heat), PI * 0.75); hg.stroke(); hg.restore();
    text(P.overheat ? 'SÚNG NÓNG!' : 'SÚNG', pp.x, pp.y + 32, heatCol, 11, 'center', '800');
  }
  if (!t || !t.alive || state !== 'play') return;
  const d = t.pos.distanceTo(P.pos);
  if (d > GUN_RANGE * 1.6) return;
  const tt = d / (BULLET_SPEED + P.speed);
  const L = _v2.copy(t.vel).multiplyScalar(tt).add(t.pos); L.y += tt * tt;   // lead + a touch of drop
  const lp = proj(L), tp = proj(t.pos);
  if (lp.behind) return;
  const inRange = d < GUN_RANGE;
  const r = clamp(260 / d, 16, 40);
  const off = pp.behind ? 1e9 : Math.hypot(lp.x - pp.x, lp.y - pp.y);
  const onTarget = inRange && off < r * 0.8;
  const col = !inRange ? RED : onTarget ? LOCKG : YEL;
  hg.save();
  // pipper ring + centre dot + range bar (full circle = point blank, empties towards max range)
  hg.strokeStyle = col; hg.lineWidth = onTarget ? 2.6 : 1.8;
  hg.beginPath(); hg.arc(lp.x, lp.y, r, 0, PI * 2); hg.stroke();
  hg.fillStyle = col; hg.beginPath(); hg.arc(lp.x, lp.y, 2.4, 0, PI * 2); hg.fill();
  const rf = clamp(1 - d / GUN_RANGE, 0, 1);
  hg.lineWidth = 4; hg.globalAlpha = 0.8; hg.beginPath(); hg.arc(lp.x, lp.y, r + 5, -PI / 2, -PI / 2 + PI * 2 * rf); hg.stroke(); hg.globalAlpha = 1;
  hg.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) { const a = i * PI / 2; hg.beginPath(); hg.moveTo(lp.x + Math.cos(a) * (r - 5), lp.y + Math.sin(a) * (r - 5)); hg.lineTo(lp.x + Math.cos(a) * (r + 2), lp.y + Math.sin(a) * (r + 2)); hg.stroke(); }
  // where the target is now -> where to aim
  if (!tp.behind) { hg.setLineDash([3, 4]); hg.strokeStyle = 'rgba(255,224,102,0.5)'; hg.beginPath(); hg.moveTo(tp.x, tp.y); hg.lineTo(lp.x, lp.y); hg.stroke(); hg.setLineDash([]); }
  // steer cue: gun cross -> pipper
  if (!pp.behind && !onTarget && off < 400) {
    hg.strokeStyle = 'rgba(255,255,255,0.45)'; hg.setLineDash([6, 6]); hg.lineDashOffset = -clock * 30;
    hg.beginPath(); hg.moveTo(pp.x, pp.y); hg.lineTo(lp.x, lp.y); hg.stroke(); hg.setLineDash([]);
  }
  hg.restore();
  text(`${Math.round(d)}m`, lp.x + r + 8, lp.y - 6, col, 12, 'left', '800');
  if (!inRange) text('XA QUÁ — ÁP SÁT', lp.x, lp.y + r + 14, RED, 12, 'center', '800');
  else if (onTarget) { if (blink || mouse.l || keys.Space) text('BẮN!', lp.x, lp.y + r + 16, LOCKG, 16, 'center', '800'); }
  else text('ĐƯA TÂM SÚNG VÀO VÒNG', lp.x, lp.y + r + 14, YEL, 11, 'center', '700');
}
let popLast = 0;
function drawHUD() {
  hg.clearRect(0, 0, W, H);
  if (state === 'menu' || !P || cine.t > 0) return;
  if (cut) { if (cut.kind === 'rescue') drawRescueHUD(); text('Enter: bỏ qua', W - 20, H - 24, 'rgba(255,255,255,0.7)', 12, 'right', '700'); return; }
  drawSpeedLines();
  hg.lineWidth = 1.6;
  const fwd = fwdOf(P, _fw).clone();
  const alive = P.alive;
  const blink = Math.floor(clock * 4) % 2 === 0;

  if (alive && state === 'play') {
    // gun cross (where bullets will be at the target's range, ~40 m otherwise) and boresight (nose at infinity)
    const gunD = P.gunMode && P.target && P.target.alive ? clamp(P.target.pos.distanceTo(P.pos), 12, GUN_RANGE) : 40;
    const pp = proj(_tmp.copy(P.pos).addScaledVector(fwd, gunD));
    const bs = proj(_tmp.copy(P.pos).addScaledVector(fwd, 2000));
    if (!pp.behind) {
      hg.strokeStyle = P.overheat ? RED : HUDC;
      hg.beginPath(); hg.moveTo(pp.x - 9, pp.y); hg.lineTo(pp.x - 3, pp.y); hg.moveTo(pp.x + 3, pp.y); hg.lineTo(pp.x + 9, pp.y); hg.moveTo(pp.x, pp.y - 9); hg.lineTo(pp.x, pp.y - 3); hg.moveTo(pp.x, pp.y + 3); hg.lineTo(pp.x, pp.y + 9); hg.stroke();
      if (hitMarkT > 0) { hg.strokeStyle = '#fff'; hg.lineWidth = 2.5; hg.beginPath(); for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { hg.moveTo(pp.x + sx * 6, pp.y + sy * 6); hg.lineTo(pp.x + sx * 13, pp.y + sy * 13); } hg.stroke(); hg.lineWidth = 1.6; }
    }
    // missile seeker envelope: RED = no lockable target, GREEN = target inside, can lock
    if (P.gunMode) drawGunSight(pp, fwd, blink);
    else if (!bs.behind && hudMode !== 2 && (hudMode === 1 || P.target)) {
      const rEnv = Math.tan(LOCK_CONE) / Math.tan(camera.fov * PI / 360) * H / 2;
      const can = P.target && P.inEnv;
      hg.save();
      hg.strokeStyle = can ? (P.lockP >= 1 ? LOCKG : 'rgba(61,255,106,0.75)') : 'rgba(255,77,77,0.55)';
      hg.lineWidth = can ? 2 : 1.3;
      hg.setLineDash(can ? [] : [10, 8]);
      hg.lineDashOffset = -clock * 20;
      if (hudMode === 0 && !can) hg.globalAlpha = 0.45;
      hg.beginPath(); hg.arc(bs.x, bs.y, Math.min(rEnv, H * 0.3), 0, PI * 2); hg.stroke();
      hg.setLineDash([]);
      text(can ? (P.lockP >= 1 ? 'MSL ĐÃ KHOÁ — BẤM F' : 'MSL ĐANG KHOÁ…') : P.target ? 'MSL NGOÀI VÙNG KHOÁ' : 'MSL KHÔNG MỤC TIÊU',
        bs.x, bs.y - Math.min(rEnv, H * 0.3) - 10, can ? LOCKG : RED, 12, 'center', '800');
      hg.restore();
    }
    // mouse-aim cursor
    if (document.pointerLockElement) {
      const ap = proj(_tmp.copy(P.pos).addScaledVector(aim, 120));
      if (!ap.behind) { hg.strokeStyle = 'rgba(255,255,255,0.85)'; hg.beginPath(); hg.arc(ap.x, ap.y, 4, 0, PI * 2); hg.stroke(); hg.beginPath(); hg.arc(ap.x, ap.y, 14, 0.3, PI / 2 - 0.3); hg.arc(ap.x, ap.y, 14, PI + 0.3, PI * 1.5 - 0.3); hg.stroke(); }
    }
  }

  // aircraft markers
  for (const f of flyers) {
    if (f === P || !f.alive) continue;
    const d = f.pos.distanceTo(P.pos);
    const p = proj(f.pos);
    const enemy = f.team === 'red';
    const isT = f === P.target;
    const can = isT && P.inEnv, lockedT = isT && P.lockP >= 1;
    const tc = can ? LOCKG : RED;                         // target colour: green = lockable, red = not
    const onScreen = !p.behind && p.x > 0 && p.x < W && p.y > 0 && p.y < H;
    if (!onScreen) { if (isT || (enemy && d < 50) || f.kind === 'ace') edgeArrow(p, isT ? tc : 'rgba(255,77,77,0.6)'); continue; }
    if (enemy) {
      const s = clamp(160 / d, 8, 40);
      if (isT) {
        // corner brackets; blink red while unlockable, steady green when lockable
        hg.strokeStyle = tc; hg.lineWidth = lockedT ? 3 : 2.2;
        if (can || blink) {
          const c = s * 0.45;
          hg.beginPath();
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { hg.moveTo(p.x + sx * s, p.y + sy * (s - c)); hg.lineTo(p.x + sx * s, p.y + sy * s); hg.lineTo(p.x + sx * (s - c), p.y + sy * s); }
          hg.stroke();
        }
        if (lockedT) { hg.fillStyle = 'rgba(61,255,106,0.12)'; hg.fillRect(p.x - s, p.y - s, s * 2, s * 2); }
      } else { hg.strokeStyle = RED; hg.lineWidth = 1.4; hg.strokeRect(p.x - s, p.y - s, s * 2, s * 2); }
      text(`${Math.round(d)}m`, p.x + s + 4, p.y + s - 4, isT ? (d < (P.gunMode ? GUN_RANGE : LOCK_RANGE) ? tc : RED) : RED, 12);
      if (isT || d < 60) text(f.name, p.x, p.y - s - 9, isT ? tc : RED, 12, 'center');
      if (isT) {
        text(P.gunMode ? (d >= GUN_RANGE ? 'NGOÀI TẦM SÚNG' : 'TRONG TẦM SÚNG') : lockedT ? 'LOCK' : can ? 'KHOÁ…' : d >= LOCK_RANGE ? 'XA QUÁ' : 'LỆCH HƯỚNG', p.x - s, p.y + s + 10, tc, 11, 'left', '800');
        // lock-on burst ring
        if (P.lockFx > 0) { const k = 1 - P.lockFx / 0.5; hg.strokeStyle = `rgba(61,255,106,${1 - k})`; hg.lineWidth = 3; hg.beginPath(); hg.arc(p.x, p.y, s + 6 + k * 50, 0, PI * 2); hg.stroke(); }
        // health bar
        hg.fillStyle = 'rgba(0,0,0,0.5)'; hg.fillRect(p.x - s, p.y + s + 18, s * 2, 4);
        hg.fillStyle = RED; hg.fillRect(p.x - s, p.y + s + 18, s * 2 * clamp(f.hp / f.maxHp, 0, 1), 4);
        // lead indicator
        if (d < 60 && state === 'play' && !P.gunMode) {
          const tt = d / (BULLET_SPEED + P.speed);
          const lp = proj(_tmp.copy(f.vel).sub(P.vel).multiplyScalar(tt).add(f.pos).addScaledVector(P.vel, tt));
          if (!lp.behind) { hg.strokeStyle = YEL; hg.lineWidth = 1.5; hg.beginPath(); hg.arc(lp.x, lp.y, 7, 0, PI * 2); hg.stroke(); hg.beginPath(); hg.moveTo(lp.x, lp.y); hg.lineTo(p.x, p.y); hg.setLineDash([3, 4]); hg.stroke(); hg.setLineDash([]); }
        }
        // seeker diamond: flies from the pipper to the target, spinning, then snaps on (green)
        if (P.lockP > 0 && state === 'play') {
          const pp = proj(_tmp.copy(P.pos).addScaledVector(fwd, 45));
          const e = 1 - Math.pow(1 - P.lockP, 2);
          const lx = lerp(pp.x, p.x, e), ly = lerp(pp.y, p.y, e), ds = s + 8 + (1 - P.lockP) * 34;
          const rot = lockedT ? 0 : clock * 6;
          hg.save(); hg.translate(lx, ly); hg.rotate(rot);
          hg.strokeStyle = lockedT ? LOCKG : P.inEnv ? 'rgba(61,255,106,0.85)' : RED; hg.lineWidth = lockedT ? 2.6 : 1.8;
          hg.beginPath(); hg.moveTo(0, -ds); hg.lineTo(ds, 0); hg.lineTo(0, ds); hg.lineTo(-ds, 0); hg.closePath(); hg.stroke();
          hg.restore();
          if (lockedT) text('LOCK', lx, ly + ds + 12, LOCKG, 15, 'center', '800');
          else { hg.fillStyle = 'rgba(0,0,0,0.4)'; hg.fillRect(lx - 20, ly + ds + 6, 40, 4); hg.fillStyle = LOCKG; hg.fillRect(lx - 20, ly + ds + 6, 40 * P.lockP, 4); }
        }
      }
    } else {
      hg.strokeStyle = BLU; hg.lineWidth = 1.5;
      hg.beginPath(); hg.moveTo(p.x - 8, p.y - 8); hg.lineTo(p.x, p.y); hg.lineTo(p.x + 8, p.y - 8); hg.stroke();
      text(`${f.name} ${Math.round(d)}`, p.x, p.y - 16, BLU, 12, 'center');
    }
  }
  // guide line from the pipper to a lockable target while acquiring
  if (state === 'play' && alive && P.target && P.target.alive && P.inEnv && P.lockP < 1 && !P.gunMode) {
    const a = proj(_tmp.copy(P.pos).addScaledVector(fwd, 45)), b = proj(P.target.pos);
    if (!a.behind && !b.behind) { hg.save(); hg.strokeStyle = 'rgba(61,255,106,0.6)'; hg.setLineDash([4, 5]); hg.lineDashOffset = -clock * 30; hg.beginPath(); hg.moveTo(a.x, a.y); hg.lineTo(b.x, b.y); hg.stroke(); hg.restore(); }
  }
  // my missiles in flight: marker + line to what they are chasing + time to impact
  for (const m of missiles) {
    if (!m.alive || m.owner !== P) continue;
    const a = proj(m.p);
    if (a.behind) continue;
    hg.strokeStyle = '#ffffff'; hg.lineWidth = 1.2; hg.beginPath(); hg.arc(a.x, a.y, 5, 0, PI * 2); hg.stroke();
    if (m.target && m.target.alive && m.target.K) {
      const b = proj(m.target.pos);
      if (!b.behind) {
        hg.save(); hg.strokeStyle = 'rgba(255,255,255,0.45)'; hg.setLineDash([2, 4]); hg.beginPath(); hg.moveTo(a.x, a.y); hg.lineTo(b.x, b.y); hg.stroke(); hg.restore();
        text(`${(m.p.distanceTo(m.target.pos) / Math.max(5, m.speed)).toFixed(1)}s`, a.x + 8, a.y - 8, '#fff', 11);
      }
    } else text('MẤT DẤU', a.x + 8, a.y - 8, '#bbb', 10);
  }
  // incoming missiles
  let incoming = 0;
  for (const m of missiles) {
    if (!m.alive) continue;
    if (m.target === P) {
      incoming++;
      const p = proj(m.p);
      if (!p.behind && p.x > 0 && p.x < W && p.y > 0 && p.y < H) { hg.strokeStyle = RED; hg.beginPath(); hg.arc(p.x, p.y, 10, 0, PI * 2); hg.stroke(); }
      else edgeArrow(p, RED);
    }
  }
  hg.lineWidth = 1.6;
  if (state === 'play' && alive) {
    // warnings
    let wy = H * 0.66;
    if (!incoming && P.lockedByT > 0 && P.lockedBy && P.lockedBy.alive) { text(`⚠ BỊ KHOÁ: ${P.lockedBy.name} — BẺ LÁI RA KHỎI MŨI NÓ!`, W / 2, wy, YEL, 18, 'center', '800'); wy += 24; }
    if (incoming && blink) { text('⚠ TÊN LỬA ĐANG BÁM! (V: NÉ · luồn qua chướng ngại)', W / 2, wy, RED, 22, 'center', '800'); wy += 26; }
    const outD = outDistance(P.pos);
    if (outD > 0 && outD <= WARN_BAND && P.bo <= 0.05) { text(`⚠ RA KHỎI TRƯỜNG: còn ${Math.ceil(WARN_BAND - outD)}m tới vùng choáng`, W / 2, wy, YEL, 18, 'center', '800'); wy += 24; }
    if (P.bo > 0.05 && P.boT <= 0) { text('⚠ ĐANG CHOÁNG — QUAY VỀ SÂN TRƯỜNG', W / 2, wy, P.bo > 0.6 && blink ? RED : YEL, 20, 'center', '800'); wy += 24; }
    if (P.pos.y > ZONE.y - 4) { text('⚠ TRẦN BAY — HẠ ĐỘ CAO', W / 2, wy, P.pos.y > ZONE.y ? RED : YEL, 18, 'center', '800'); wy += 24; }
    if (P.speed < STALL + 2 && blink) { text('MẤT TỐC ĐỘ — CHÚC MŨI XUỐNG', W / 2, wy, YEL, 18, 'center', '800'); wy += 24; }
    const sink = P.vel.y < -2 && P.pos.y < 6 && P.pos.y / -P.vel.y < 1.3;
    if (sink && blink) { text('KÉO LÊN! PULL UP!', W / 2, wy, RED, 20, 'center', '800'); wy += 24; }

    { const dt = Math.min(0.05, Math.max(0, clock - popLast)); popLast = clock; drawPopups(dt); }
    { const ship = flyers.find(f => f.alive && f.K.turrets);   // Tàu Mẹ: its armour bar, and how far it still is from the library
      if (ship && !flyers.some(f => f.alive && f.kind === 'ace')) {
        const d = ship.kind === 'dread' ? Math.round(Math.hypot(ship.pos.x - OBJECTIVE_DEFS.library.pos.x, ship.pos.z - OBJECTIVE_DEFS.library.pos.z)) : 0;
        text(ship.kind === 'dread' ? `TÀU MẸ · CÁCH THƯ VIỆN ${d} m` : 'TÀU MẸ II', W / 2, 44, d && d < 150 && blink ? '#ffd23f' : RED, 13, 'center', '800');
        hg.fillStyle = 'rgba(0,0,0,0.5)'; hg.fillRect(W / 2 - 160, 54, 320, 7); hg.fillStyle = RED; hg.fillRect(W / 2 - 160, 54, 320 * ship.hp / ship.maxHp, 7);
      } }
    { const boss = flyers.find(f => f.alive && f.kind === 'ace');
      if (boss) {
        const near = flyers.filter(o => o.alive && o.team === 'blue' && o.pos.distanceTo(boss.pos) < 40).length, ok = near >= 2;
        text('ĐẠI BÀNG ĐỎ', W / 2, 44, ok ? RED : '#c9c9c9', 13, 'center', '800');
        hg.fillStyle = 'rgba(0,0,0,0.5)'; hg.fillRect(W / 2 - 120, 54, 240, 6); hg.fillStyle = ok ? RED : '#8a8a8a'; hg.fillRect(W / 2 - 120, 54, 240 * boss.hp / boss.maxHp, 6);
        // he is on your six: a heartbeat and a red pulse, no words
        const v = _tmp.subVectors(P.pos, boss.pos), dd = v.length();
        if (dd < 32 && v.dot(fwdOf(boss, _tmp2)) / dd > 0.85) {
          P.stalkedT = (P.stalkedT || 0) + 1 / 60;
          if (Math.floor(clock * 1.8) !== Math.floor((clock - 1 / 60) * 1.8)) heartbeat(0.6);
          dmgFlash = Math.max(dmgFlash, 0.18 + 0.12 * Math.sin(clock * 8));
        }
      } }
    if (P.target && P.target.alive && P.tailT > 0.4) {
      const tp = proj(P.target.pos);
      if (!tp.behind) text(P.target.mode === 'evade' ? '● BÁM ĐUÔI · NÓ ĐANG LẮC!' : '● BÁM ĐUÔI · BẮN TỪ SAU ×1.4', tp.x, tp.y + 42, '#9effa0', 12, 'center', '800');
    }
    if ((P.rush || 0) > 0.5) text('BỔ NHÀO · SÁT THƯƠNG ×1.5', W / 2, H * 0.6, '#ff9f1a', 13, 'center', '800');
    if (P.combo > 1 && P.comboT > 0) text(`CHUỖI ×${Math.min(3, 1 + (P.combo - 1) * 0.5)} · ${P.comboT.toFixed(1)}s`, W / 2, H * 0.6 + 18, '#ff9f1a', 12, 'center', '700');
    // landmarks to defend
    for (const o of objectives) {
      const q = proj(o.pos), col = o.alive ? (o.hp > 50 ? '#7fb8ff' : YEL) : 'rgba(160,160,160,0.6)';
      const on = !q.behind && q.x > 0 && q.x < W && q.y > 0 && q.y < H;
      if (!on) { if (o.alive) edgeArrow(q, '#7fb8ff'); continue; }
      hg.strokeStyle = col; hg.lineWidth = 2; hg.beginPath(); hg.moveTo(q.x, q.y - 12); hg.lineTo(q.x + 12, q.y); hg.lineTo(q.x, q.y + 12); hg.lineTo(q.x - 12, q.y); hg.closePath(); hg.stroke();
      text(o.alive ? `BẢO VỆ: ${o.name}` : `${o.name} ✗`, q.x, q.y - 22, col, 12, 'center', '800');
      if (o.alive) { hg.fillStyle = 'rgba(0,0,0,0.5)'; hg.fillRect(q.x - 22, q.y + 16, 44, 4); hg.fillStyle = col; hg.fillRect(q.x - 22, q.y + 16, 44 * o.hp / o.maxHp, 4); }
    }
    { const r = course.rings[course.next];
      if (r && waveState === 'wait') { const q = proj(r.pos); if (q.behind || q.x < 0 || q.x > W || q.y < 0 || q.y > H) edgeArrow(q, '#ffd93b'); else { hg.strokeStyle = '#ffd93b'; hg.lineWidth = 2; hg.beginPath(); hg.arc(q.x, q.y, 14, 0, PI * 2); hg.stroke(); text(`VÒNG ${course.next + 1}/${course.rings.length}`, q.x, q.y - 22, '#ffd93b', 12, 'center', '800'); } } }
    { const t = reconTarget(_rtv);   // chapter 1: the lesson's ring, the next bend of the corridor route, the store, home
      if (t) { const q = proj(t[0]); if (q.behind || q.x < 0 || q.x > W || q.y < 0 || q.y > H) edgeArrow(q, '#ffd93b'); else { hg.strokeStyle = '#ffd93b'; hg.lineWidth = 2; hg.beginPath(); hg.arc(q.x, q.y, 14, 0, PI * 2); hg.stroke(); text(`${t[1]} · ${Math.round(P.pos.distanceTo(t[0]))} m`, q.x, q.y - 22, '#ffd93b', 12, 'center', '800'); } } }
    if (gameMode === 'escort') {
      if (heron && heron.alive) {   // the bomber: always know where it is and how it's doing
        const q = proj(heron.pos), on = !q.behind && q.x > 0 && q.x < W && q.y > 0 && q.y < H, hpk = heron.hp / heron.maxHp;
        const col = hpk > 0.5 ? '#7fd6ff' : hpk > 0.25 ? YEL : RED;
        if (!on) edgeArrow(q, col);
        else {
          hg.strokeStyle = col; hg.lineWidth = 2; hg.beginPath(); hg.arc(q.x, q.y, 16, 0, PI * 2); hg.stroke();
          text(`HẠC LỚN ${Math.round(heron.pos.distanceTo(P.pos))}m`, q.x, q.y - 26, col, 12, 'center', '800');
          hg.fillStyle = 'rgba(0,0,0,0.5)'; hg.fillRect(q.x - 26, q.y + 21, 52, 5); hg.fillStyle = col; hg.fillRect(q.x - 26, q.y + 21, 52 * hpk, 5);
        }
      }
      for (const t of strikeTargets) {
        if (!t.alive) continue;
        const q = proj(t.pos); if (q.behind || q.x < 0 || q.x > W || q.y < 0 || q.y > H) continue;
        hg.strokeStyle = '#ffd93b'; hg.lineWidth = 1.8; hg.beginPath(); hg.arc(q.x, q.y, 12, 0, PI * 2); hg.moveTo(q.x - 17, q.y); hg.lineTo(q.x + 17, q.y); hg.moveTo(q.x, q.y - 17); hg.lineTo(q.x, q.y + 17); hg.stroke();
        text(`MỤC TIÊU NÉM: ${t.name}`, q.x, q.y - 24, '#ffd93b', 11, 'center', '800');
      }
      for (const u of groundUnits) {
        if (!u.alive) continue;
        const d = u.pos.distanceTo(P.pos); if (d > 110) continue;
        const q = proj(u.pos); if (q.behind || q.x < 0 || q.x > W || q.y < 0 || q.y > H) continue;
        const locking = u.kind === 'sam' && u.lockT > 0.3, c = locking && blink ? YEL : '#ff7a5a';
        hg.strokeStyle = c; hg.lineWidth = 1.6; hg.beginPath(); hg.moveTo(q.x, q.y - 10); hg.lineTo(q.x + 9, q.y + 7); hg.lineTo(q.x - 9, q.y + 7); hg.closePath(); hg.stroke();
        text(`${u.kind === 'flak' ? 'PHÁO' : 'SAM'} ${Math.round(d)}m`, q.x, q.y + 19, c, 10, 'center', '800');
        hg.fillStyle = 'rgba(0,0,0,0.5)'; hg.fillRect(q.x - 12, q.y + 26, 24, 3); hg.fillStyle = c; hg.fillRect(q.x - 12, q.y + 26, 24 * u.hp / u.maxHp, 3);
      }
    }
    for (const pk of pickups) {
      const q = proj(pk.pos), dd = Math.round(pk.pos.distanceTo(P.pos));
      const on = !q.behind && q.x > 0 && q.x < W && q.y > 0 && q.y < H;
      if (!on) { edgeArrow(q, PICKUP_TYPES[pk.type].css); continue; }
      const T = PICKUP_TYPES[pk.type];
      hg.strokeStyle = T.css; hg.lineWidth = 2; hg.strokeRect(q.x - 10, q.y - 10, 20, 20);
      hg.beginPath(); hg.moveTo(q.x - 5, q.y); hg.lineTo(q.x + 5, q.y); hg.moveTo(q.x, q.y - 5); hg.lineTo(q.x, q.y + 5); hg.stroke();
      text(`${T.hud} ${dd}m`, q.x, q.y - 18, T.css, 12, 'center', '800');
    }
    for (const b of bombs) { const q = proj(b.p); if (!q.behind) { hg.strokeStyle = '#7fb8ff'; hg.lineWidth = 1.5; hg.beginPath(); hg.arc(q.x, q.y, 7, 0, PI * 2); hg.stroke(); } }
    // supersonic gauge
    if (P.sonic || P.sonicHeat > 0.02) {
      const bw = 140, bx = W / 2 - bw / 2, by = H - 64, hot = P.sonicHeat > 0.75;
      const torn = Math.round(P.sonicDmg || 0);
      text(P.sonic ? (P.speed > SONIC_SPEED ? `SIÊU THANH · ${Math.round(P.speed * 60)} km/h · GIẤY RÁCH -${torn}` : 'ĐANG TĂNG TỐC SIÊU THANH…') : 'GIẤY ĐANG NGUỘI', W / 2, by - 9, P.sonic ? (torn > 15 && blink ? YEL : '#9fd8ff') : '#aaa', 12, 'center', '800');
      hg.fillStyle = 'rgba(0,0,0,0.45)'; hg.fillRect(bx, by, bw, 6);
      hg.fillStyle = hot ? (blink ? RED : YEL) : '#9fd8ff'; hg.fillRect(bx, by, bw * P.sonicHeat, 6);
    }
    { let sy = H - 92; const st = (t, c) => { text(t, W / 2, sy, c, 13, 'center', '800'); sy -= 17; };
      if (P.rapidT > 0) st(`SÚNG NHANH ${P.rapidT.toFixed(1)}s`, '#ff9f1a');
      if (P.shieldT > 0) st(`KHIÊN BÌA ${P.shieldT.toFixed(1)}s`, '#6fd0ff');
      if (P.shieldMesh && P.shieldMesh.material.opacity > 0.22) P.shieldMesh.material.opacity = Math.max(0.22, P.shieldMesh.material.opacity - 0.02); }
    if (windOn) text(`GIÓ ${windV.x < 0 ? '←' : '→'} ${Math.abs(windV.x).toFixed(1)} m/s`, W - 16, 22, '#dfe9ff', 13, 'right', '800');
    if (hudMode !== 2) drawFighterHUD(fwd);
  }

  // bottom-left: hull & weapons
  if (state !== 'menu') {
    const x0 = 24, y0 = H - 118;
    hg.fillStyle = 'rgba(5,25,15,0.55)'; hg.fillRect(x0 - 10, y0 - 22, 250, 120);
    text('ĐỘ BỀN GIẤY', x0, y0 - 8, G, 12);
    const hpf = clamp(P.hp / P.maxHp, 0, 1);
    hg.strokeStyle = G; hg.strokeRect(x0, y0 + 2, 220, 12);
    hg.fillStyle = hpf > 0.5 ? G : hpf > 0.25 ? YEL : RED; hg.fillRect(x0 + 2, y0 + 4, 216 * hpf, 8);
    text(`${Math.ceil(P.hp)}%`, x0 + 220, y0 - 8, G, 12, 'right');
    text('SÚNG', x0, y0 + 30, G, 12);
    hg.strokeStyle = G; hg.strokeRect(x0 + 50, y0 + 24, 120, 10);
    hg.fillStyle = P.overheat ? RED : P.heat > 0.7 ? YEL : G; hg.fillRect(x0 + 52, y0 + 26, 116 * P.heat, 6);
    text(P.overheat ? 'QUÁ NHIỆT' : '∞', x0 + 178, y0 + 30, P.overheat ? RED : G, 12);
    text(`TÊN LỬA  ×${P.msl}`, x0, y0 + 52, G, 13);
    for (let i = 0; i < 2; i++) { const r = clamp(1 - P.pylons[i] / 2.6, 0, 1); hg.strokeStyle = G; hg.strokeRect(x0 + 130 + i * 30, y0 + 46, 22, 12); hg.fillStyle = r >= 1 ? G : 'rgba(158,255,160,0.35)'; hg.fillRect(x0 + 132 + i * 30, y0 + 48, 18 * r, 8); }
    text(`NÉ [V]`, x0, y0 + 74, G, 13);
    { const r = clamp(1 - P.evadeCD / 3, 0, 1); hg.strokeStyle = G; hg.strokeRect(x0 + 52, y0 + 68, 50, 10); hg.fillStyle = r >= 1 ? G : 'rgba(158,255,160,0.35)'; hg.fillRect(x0 + 54, y0 + 70, 46 * r, 6); }
    text(`✦${P.flares}`, x0 + 106, y0 + 74, G, 12);
    text(`HẠ: ${kills} · ${fmt(missionTime)}`, x0 + 140, y0 + 74, G, 13);
    text(`FPS ${Math.round(fps)}${quality < 2 ? ' · đồ hoạ giảm' : ''}`, x0, y0 - 52, fps < 30 ? YEL : 'rgba(158,255,160,0.6)', 11);
    if (state === 'play' && (hudMode === 1 || missionTime < 20 || P.assist)) text(P.assist ? '◎ ĐANG BÁM MỤC TIÊU' : 'Giữ R: bám mục tiêu · Space: bắn · F: tên lửa · B: siêu thanh · Tab: đổi', x0, y0 - 34, P.assist ? YEL : 'rgba(158,255,160,0.75)', 12);
  }
  if (hudMode !== 2) drawMinimap();
  if (hudMode === 1) drawTargetPanel();
}
let mapZoom = 1;
const RADAR_RANGES = [50, 120, 300];   // N cycles the radar range (metres to the rim)
let hudMode = parseInt(localStorage.getItem('pp_hud') || '0', 10);   // 0 = gọn, 1 = đầy đủ, 2 = tắt
const HUD_NAMES = ['HUD: GỌN', 'HUD: ĐẦY ĐỦ', 'HUD: TẮT'];
const RADAR_R = (mode = hudMode) => mode === 1 ? 110 : 88;
// Fighter-style radar, heading-up: you are the aircraft symbol in the middle. Hostiles are red diamonds,
// friendlies blue circles, missiles small chevrons; each contact has a heading stick and +/- height.
function drawMinimap() {
  const rad = RADAR_R(), cx = W - rad - 22, cy = 46 + rad, range = RADAR_RANGES[mapZoom], k = rad / range;
  const x0 = cx - rad, y0 = cy - rad, Wm = rad * 2, Hm = rad * 2;
  const fwd = fwdOf(P, _fw); let fx = fwd.x, fz = fwd.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const rxv = -fz, rzv = fx;   // screen-right in world xz
  const rel = (x, z) => { const dx = x - P.pos.x, dz = z - P.pos.z; return [dx * rxv + dz * rzv, dx * fx + dz * fz]; };   // [right, ahead]
  // square-root scale: the close fight gets most of the scope, far contacts are squeezed towards the rim
  const sq = d => rad * Math.sqrt(Math.min(d, range) / range);
  const toS = (x, z) => { const [r, a] = rel(x, z), d = Math.hypot(r, a), f = d > 1e-3 ? sq(d) / d : 0; return [cx + r * f, cy - a * f]; };
  const angS = v => Math.atan2(v.x * rxv + v.z * rzv, v.x * fx + v.z * fz);   // world dir -> screen angle (0 = up)
  const GR = 'rgba(158,255,160,', blink = Math.floor(clock * 6) % 2 === 0;
  hg.save();
  // scope
  hg.beginPath(); hg.arc(cx, cy, rad, 0, PI * 2); hg.fillStyle = 'rgba(4,22,12,0.72)'; hg.fill();
  hg.save(); hg.clip();
  // school ground, buildings, zone edge
  const poly = (pts, fill, stroke) => { hg.beginPath(); pts.forEach(([x, z], i) => { const [sx, sy] = toS(x, z); i ? hg.lineTo(sx, sy) : hg.moveTo(sx, sy); }); hg.closePath(); if (fill) { hg.fillStyle = fill; hg.fill(); } if (stroke) { hg.strokeStyle = stroke; hg.stroke(); } };
  poly([[-ZONE.x, ZONE.zMax], [ZONE.x, ZONE.zMax], [ZONE.x, ZONE.zMin], [-ZONE.x, ZONE.zMin]], 'rgba(30,80,40,0.35)', null);
  for (let ri = 0; ri < radarRects.length; ri++) { const [a, b, c, d] = radarRects[ri]; if (Math.abs((a + c) / 2 - P.pos.x) < range + 80 && Math.abs((b + d) / 2 - P.pos.z) < range + 200) poly([[a, b], [c, b], [c, d], [a, d]], GR + '0.16)', null); }
  hg.lineWidth = 1.2; hg.setLineDash([4, 4]);
  poly([[-ZONE.x, ZONE.zMax], [ZONE.x, ZONE.zMax], [ZONE.x, ZONE.zMin], [-ZONE.x, ZONE.zMin]], null, 'rgba(255,224,102,0.6)');
  hg.setLineDash([]);
  // range rings + labels
  hg.strokeStyle = GR + '0.28)'; hg.lineWidth = 1;
  for (const f of [1 / 3, 2 / 3]) { hg.beginPath(); hg.arc(cx, cy, rad * f, 0, PI * 2); hg.stroke(); }
  hg.beginPath(); hg.moveTo(cx, cy - rad); hg.lineTo(cx, cy + rad); hg.moveTo(cx - rad, cy); hg.lineTo(cx + rad, cy); hg.stroke();
  text(`${Math.round(range / 9)}m`, cx + 3, cy - rad / 3 + 7, GR + '0.6)', 9); text(`${Math.round(range * 4 / 9)}m`, cx + 3, cy - rad * 2 / 3 + 7, GR + '0.6)', 9);
  // weapon envelope: missile seeker cone, or gun range ring
  if (P.gunMode) { hg.strokeStyle = 'rgba(255,224,102,0.55)'; hg.setLineDash([3, 3]); hg.beginPath(); hg.arc(cx, cy, sq(GUN_RANGE), -PI / 2 - LOCK_CONE, -PI / 2 + LOCK_CONE); hg.stroke(); hg.setLineDash([]); }
  else {
    const can = P.target && P.inEnv, rL = sq(LOCK_RANGE);
    hg.fillStyle = can ? 'rgba(61,255,106,0.16)' : 'rgba(255,77,77,0.09)';
    hg.beginPath(); hg.moveTo(cx, cy); hg.arc(cx, cy, rL, -PI / 2 - LOCK_CONE, -PI / 2 + LOCK_CONE); hg.closePath(); hg.fill();
  }
  // sweep
  const sweepA = (clock * 2.4) % (PI * 2);
  for (let i = 0; i < 12; i++) { const a0 = sweepA - i * 0.06; hg.fillStyle = GR + (0.13 * (1 - i / 12)).toFixed(3) + ')'; hg.beginPath(); hg.moveTo(cx, cy); hg.arc(cx, cy, rad, a0 - 0.06, a0); hg.closePath(); hg.fill(); }
  hg.restore();
  // contacts (drawn unclipped so off-scale ones can sit on the rim as arrows)
  const place = (wx, wz) => {
    const [r, a] = rel(wx, wz), d = Math.hypot(r, a), f = d > 1e-3 ? sq(d) / d : 0;
    if (d < range * 0.93) return { x: cx + r * f, y: cy - a * f, rim: false };
    const s2 = (rad - 4) / (d || 1); return { x: cx + r * s2, y: cy - a * s2, rim: true, ang: Math.atan2(r, a) };
  };
  const rimArrow = (p, col) => { hg.save(); hg.translate(p.x, p.y); hg.rotate(p.ang); hg.fillStyle = col; hg.beginPath(); hg.moveTo(0, -6); hg.lineTo(4, 2); hg.lineTo(-4, 2); hg.closePath(); hg.fill(); hg.restore(); };
  const stick = (p, f, col, len) => { const a = angS(f.vel.lengthSq() > 0.01 ? f.vel : fwdOf(f, _tmp)); hg.strokeStyle = col; hg.lineWidth = 1.4; hg.beginPath(); hg.moveTo(p.x, p.y); hg.lineTo(p.x + Math.sin(a) * len, p.y - Math.cos(a) * len); hg.stroke(); };
  const sweepGlow = p => { let ba = Math.atan2(p.y - cy, p.x - cx) - sweepA; ba = ((ba % (PI * 2)) + PI * 2) % (PI * 2); return 0.55 + 0.45 * (1 - ba / (PI * 2)); };
  // landmarks to defend, crates, ring course
  for (const o of objectives) { const p = place(o.pos.x, o.pos.z); if (p.rim) { if (o.alive) rimArrow(p, '#7fb8ff'); continue; } hg.strokeStyle = o.alive ? '#7fb8ff' : '#777'; hg.lineWidth = 1.5; hg.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; hg[i ? 'lineTo' : 'moveTo'](p.x + Math.cos(a) * 5, p.y + Math.sin(a) * 5); } hg.closePath(); hg.stroke(); }
  for (const pk of pickups) { const p = place(pk.pos.x, pk.pos.z), c = PICKUP_TYPES[pk.type].css; if (p.rim) { rimArrow(p, c); continue; } hg.fillStyle = c; hg.fillRect(p.x - 3, p.y - 3, 6, 6); }
  { const r = course.rings[course.next]; if (r && waveState === 'wait') { const p = place(r.pos.x, r.pos.z); if (p.rim) rimArrow(p, '#ffd93b'); else { hg.strokeStyle = '#ffd93b'; hg.lineWidth = 1.5; hg.beginPath(); hg.arc(p.x, p.y, 4, 0, PI * 2); hg.stroke(); } } }
  if (gameMode === 'escort') {
    for (const t of strikeTargets) { if (!t.alive) continue; const p = place(t.pos.x, t.pos.z); if (p.rim) { rimArrow(p, '#ffd93b'); continue; } hg.strokeStyle = '#ffd93b'; hg.lineWidth = 1.4; hg.beginPath(); hg.arc(p.x, p.y, 4.5, 0, PI * 2); hg.moveTo(p.x - 7, p.y); hg.lineTo(p.x + 7, p.y); hg.moveTo(p.x, p.y - 7); hg.lineTo(p.x, p.y + 7); hg.stroke(); }
    for (const u of groundUnits) { if (!u.alive) continue; const p = place(u.pos.x, u.pos.z); if (p.rim) continue; hg.fillStyle = u.kind === 'sam' ? '#ff7a5a' : 'rgba(255,122,90,0.75)'; hg.beginPath(); hg.moveTo(p.x, p.y - 4.5); hg.lineTo(p.x + 4, p.y + 3); hg.lineTo(p.x - 4, p.y + 3); hg.closePath(); hg.fill(); }
    if (heron && heron.alive) { const p = place(heron.pos.x, heron.pos.z); if (p.rim) rimArrow(p, '#7fd6ff'); else { hg.strokeStyle = '#7fd6ff'; hg.lineWidth = 2; hg.beginPath(); hg.arc(p.x, p.y, 6, 0, PI * 2); hg.stroke(); text('B', p.x, p.y + 0.5, '#7fd6ff', 8, 'center', '800'); } }
  }
  reconMap(place, rimArrow, toS, hg);
  for (const b of bombs) { const p = place(b.p.x, b.p.z); if (!p.rim) { hg.fillStyle = '#7fb8ff'; hg.beginPath(); hg.arc(p.x, p.y, 2.2, 0, PI * 2); hg.fill(); } }
  // aircraft
  for (const f of flyers) {
    if (f === P || !f.alive) continue;
    const p = place(f.pos.x, f.pos.z), red = f.team === 'red', isT = f === P.target;
    const col = red ? (isT && P.inEnv ? LOCKG : RED) : BLU;
    if (p.rim) { if (red || isT) rimArrow(p, col); continue; }
    hg.save(); hg.globalAlpha = red ? sweepGlow(p) : 1;
    stick(p, f, col, 5 + f.speed * 0.9);
    hg.strokeStyle = col; hg.fillStyle = col; hg.lineWidth = 1.6;
    if (red) {   // hostile: diamond (filled when your missile is locked on it)
      const sz = f.K.ai === 'carrier' || f.kind === 'ace' || f.kind === 'elite' ? 6.5 : 4.8;
      hg.beginPath(); hg.moveTo(p.x, p.y - sz); hg.lineTo(p.x + sz, p.y); hg.lineTo(p.x, p.y + sz); hg.lineTo(p.x - sz, p.y); hg.closePath();
      if (isT && P.lockP >= 1) hg.fill(); else hg.stroke();
      if (f.kind === 'ace' || f.kind === 'elite') text(f.kind === 'elite' ? (f.name === 'Hắc Ưng' ? 'H' : 'B') : '★', p.x, p.y - 11, RED, 10, 'center', '800');
    } else { hg.beginPath(); hg.arc(p.x, p.y, 4.2, 0, PI * 2); hg.stroke(); }
    // height relative to you, in metres
    const dy = Math.round(f.pos.y - P.pos.y);
    if (Math.abs(dy) >= 3) text(`${dy > 0 ? '+' : ''}${dy}`, p.x + 7, p.y + 1, col, 9, 'left', '700');
    hg.restore();
    if (isT) { hg.strokeStyle = col; hg.lineWidth = 1.2; hg.strokeRect(p.x - 8, p.y - 8, 16, 16); }
  }
  // missiles: hostile ones aimed at you blink, yours are white
  for (const m of missiles) {
    if (!m.alive) continue;
    const p = place(m.p.x, m.p.z), mine = m.owner === P, threat = m.target === P;
    const col = mine ? '#ffffff' : threat ? (blink ? RED : '#ffffff') : 'rgba(255,120,120,0.8)';
    if (p.rim) { if (threat) rimArrow(p, col); continue; }
    const a = angS(m.dir);
    hg.save(); hg.translate(p.x, p.y); hg.rotate(a); hg.strokeStyle = col; hg.lineWidth = 1.6;
    hg.beginPath(); hg.moveTo(-3, 3); hg.lineTo(0, -3); hg.lineTo(3, 3); hg.moveTo(0, -3); hg.lineTo(0, 6); hg.stroke(); hg.restore();
  }
  // ownship: a small fighter silhouette, always pointing up
  hg.save(); hg.translate(cx, cy); hg.strokeStyle = '#ffffff'; hg.fillStyle = '#ffffff'; hg.lineWidth = 1.6;
  hg.beginPath(); hg.moveTo(0, -7); hg.lineTo(0, 6); hg.moveTo(-6, 1); hg.lineTo(6, 1); hg.moveTo(-3, 6); hg.lineTo(3, 6); hg.stroke();
  hg.restore();
  // bezel: heading ticks + rotating N marker
  const hd = Math.atan2(fwd.x, -fwd.z);
  hg.strokeStyle = G; hg.lineWidth = 1.5; hg.beginPath(); hg.arc(cx, cy, rad, 0, PI * 2); hg.stroke();
  hg.strokeStyle = GR + '0.7)'; hg.lineWidth = 1;
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2 - hd, l = i % 3 === 0 ? 7 : 4; hg.beginPath(); hg.moveTo(cx + Math.sin(a) * rad, cy - Math.cos(a) * rad); hg.lineTo(cx + Math.sin(a) * (rad - l), cy - Math.cos(a) * (rad - l)); hg.stroke(); }
  { const a = -hd; text('N', cx + Math.sin(a) * (rad + 9), cy - Math.cos(a) * (rad + 9), YEL, 11, 'center', '800'); }
  hg.beginPath(); hg.moveTo(cx, cy - rad - 1); hg.lineTo(cx - 5, cy - rad - 8); hg.lineTo(cx + 5, cy - rad - 8); hg.closePath(); hg.fillStyle = G; hg.fill();
  text(`RADAR ${range}m [N]`, x0, y0 - 12, G, 11, 'left', '800');
  const nHost = flyers.filter(f => f.alive && f.team === 'red').length;
  text(`ĐỊCH ${nHost}`, x0 + Wm, y0 - 12, nHost ? RED : G, 11, 'right', '800');
  hg.restore();
  // distances to the zone edge
  const out = outDistance(P.pos);
  let msg, col;
  if (out <= 0) {
    const dEdge = Math.min(ZONE.x - Math.abs(P.pos.x), ZONE.zMax - P.pos.z, P.pos.z - ZONE.zMin);
    msg = `RANH GIỚI TRƯỜNG: ${Math.round(dEdge)}m · TRẦN: ${Math.round(ZONE.y - P.pos.y)}m`; col = dEdge < 12 || ZONE.y - P.pos.y < 8 ? YEL : G;
  } else if (out <= WARN_BAND) { msg = `VÙNG CẢNH BÁO · còn ${Math.ceil(WARN_BAND - out)}m tới vùng choáng`; col = YEL; }
  else { msg = `VÙNG CHOÁNG +${Math.round(out - WARN_BAND)}m · QUAY LẠI!`; col = RED; }
  if (hudMode === 0 && col === G) msg = `RANH GIỚI ${Math.round(Math.min(ZONE.x - Math.abs(P.pos.x), ZONE.zMax - P.pos.z, P.pos.z - ZONE.zMin))}m`;
  hg.fillStyle = 'rgba(5,25,15,0.6)'; hg.fillRect(x0, y0 + Hm + 4, Wm, 20);
  text(msg, x0 + Wm / 2, y0 + Hm + 14, col, hudMode === 1 ? 11 : 10, 'center', '800');
}
function drawTargetPanel() {
  if (state !== 'play' || !P.alive) return;
  const x = W - 238, y = 46 + RADAR_R(1) * 2 + 40, w = 220, h = 112;
  const t = P.target;
  hg.fillStyle = 'rgba(5,25,15,0.6)'; hg.fillRect(x, y, w, h);
  if (!t || !t.alive) { text('MỤC TIÊU: —', x + 10, y + 16, G, 13, 'left', '800'); return; }
  const can = P.inEnv, locked = P.lockP >= 1, tc = can || locked ? LOCKG : RED;
  hg.strokeStyle = tc; hg.lineWidth = P.tgtSwitchFx > 0 ? 3 : 1.5; hg.strokeRect(x, y, w, h);
  text('MỤC TIÊU [Tab]', x + 10, y + 13, G, 11);
  text(t.name, x + 10, y + 31, '#fff', 15, 'left', '800');
  const cl = P.closing || 0;
  text(`KC ${Math.round(P.tgtD || 0)}m`, x + 10, y + 50, (P.tgtD || 99) < LOCK_RANGE ? LOCKG : RED, 13, 'left', '800');
  text(`${cl >= 0 ? '▼ áp sát' : '▲ xa dần'} ${Math.abs(cl).toFixed(1)}m/s`, x + 100, y + 50, cl >= 0 ? G : YEL, 12);
  text(`LỆCH ${Math.round((P.tgtA || 0) * 180 / PI)}° / ${Math.round(LOCK_CONE * 180 / PI)}°`, x + 10, y + 68, (P.tgtA || 9) < LOCK_CONE ? LOCKG : RED, 12);
  // hp
  text('BỀN', x + 110, y + 68, G, 11);
  hg.fillStyle = 'rgba(0,0,0,0.5)'; hg.fillRect(x + 140, y + 63, 70, 8);
  hg.fillStyle = RED; hg.fillRect(x + 140, y + 63, 70 * clamp(t.hp / t.maxHp, 0, 1), 8);
  // lock progress
  hg.fillStyle = 'rgba(0,0,0,0.5)'; hg.fillRect(x + 10, y + 82, w - 20, 10);
  hg.fillStyle = locked ? LOCKG : can ? 'rgba(61,255,106,0.75)' : 'rgba(255,77,77,0.6)'; hg.fillRect(x + 10, y + 82, (w - 20) * P.lockP, 10);
  const inFlight = missiles.filter(m => m.alive && m.owner === P && m.target === t).length;
  const status = locked ? (P.inEnv ? 'ĐÃ KHOÁ · BẤM F' : 'GIỮ KHOÁ…') : can ? `ĐANG KHOÁ ${Math.round(P.lockP * 100)}%` : (P.tgtD || 99) >= LOCK_RANGE ? 'XA QUÁ · ÁP SÁT LẠI' : 'LỆCH HƯỚNG · QUAY MŨI';
  text(status + (inFlight ? ` · ${inFlight} MSL đang bay` : ''), x + 10, y + 103, tc, 12, 'left', '800');
}

function htext(t, x, y, size = 13, align = 'center', col = HUDC, weight = '700') {
  hg.font = `${weight} ${size}px Consolas, "Courier New", monospace`; hg.textAlign = align; hg.textBaseline = 'middle';
  hg.fillStyle = col; hg.fillText(t, x, y);
}
// Top-Gun style HUD: pitch ladder, boresight W, flight-path marker, heading / speed / altitude tapes, G-meter
function drawFighterHUD(fwd) {
  const cx = W / 2, cy = H / 2;
  let hx = fwd.x, hz = fwd.z, hl = Math.hypot(hx, hz);
  if (hl < 0.05) { const cf = _v1.set(0, 0, -1).applyQuaternion(camera.quaternion); hx = cf.x; hz = cf.z; hl = Math.hypot(hx, hz) || 1; }
  hx /= hl; hz /= hl;
  const rhx = -hz, rhz = hx;
  const pitchDeg = Math.asin(clamp(fwd.y, -1, 1)) * 180 / PI;
  const heading = ((Math.atan2(hx, -hz) * 180 / PI) + 360) % 360;
  const full = hudMode === 1;
  const bw = full ? Math.min(W * 0.24, 320) : Math.min(W * 0.18, 230), bh = full ? Math.min(H * 0.3, 290) : Math.min(H * 0.2, 170);
  hg.save();
  hg.shadowColor = 'rgba(90,255,130,0.6)'; hg.shadowBlur = full ? 5 : 3;
  if (!full) hg.globalAlpha = 0.8;
  hg.strokeStyle = HUDC; hg.fillStyle = HUDC; hg.lineWidth = 1.6;
  const cp = camera.position;

  // ---------- pitch ladder ----------
  hg.save();
  hg.beginPath(); hg.rect(cx - bw, cy - bh, bw * 2, bh * 2); hg.clip();
  if (!full) hg.globalAlpha = 0.45;
  const hz0 = proj(_v2.copy(cp).addScaledVector(_v1.set(hx, 0, hz), 800));
  for (let th = -90; th <= 90; th += 5) {
    if (Math.abs(th - pitchDeg) > 35) continue;
    const major = th % 10 === 0;
    if (!major && (!full || Math.abs(th - pitchDeg) > 12)) continue;
    if (!full && th !== 0 && Math.abs(th) > 30) continue;
    const t = th * PI / 180, c = Math.cos(t), s2 = Math.sin(t);
    const p0 = proj(_v2.copy(cp).addScaledVector(_v1.set(hx * c, s2, hz * c), 800));
    if (p0.behind) continue;
    const p1 = proj(_v2.copy(cp).addScaledVector(_v1.set(hx * c + rhx * 0.04, s2, hz * c + rhz * 0.04), 800));
    let vx = p1.x - p0.x, vy = p1.y - p0.y; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    let nx = -vy, ny = vx;                                   // perpendicular; make it point toward the horizon
    if (!hz0.behind && th !== 0 && (hz0.x - p0.x) * nx + (hz0.y - p0.y) * ny < 0) { nx = -nx; ny = -ny; }
    if (th === 0) {
      hg.lineWidth = 2;
      const hl2 = full ? bw * 1.5 : bw * 0.9;
      hg.beginPath(); hg.moveTo(p0.x - vx * hl2, p0.y - vy * hl2); hg.lineTo(p0.x - vx * 50, p0.y - vy * 50);
      hg.moveTo(p0.x + vx * 50, p0.y + vy * 50); hg.lineTo(p0.x + vx * hl2, p0.y + vy * hl2); hg.stroke();
      hg.lineWidth = 1.6;
      continue;
    }
    const half = full ? (major ? 78 : 44) : 52, gap = 28, tick = full ? 9 : 6;
    hg.setLineDash(th < 0 ? [7, 5] : []);
    hg.beginPath();
    for (const sg of [-1, 1]) {
      const ax = p0.x + vx * gap * sg, ay = p0.y + vy * gap * sg, bx = p0.x + vx * half * sg, by = p0.y + vy * half * sg;
      hg.moveTo(ax, ay); hg.lineTo(bx, by); hg.lineTo(bx + nx * tick, by + ny * tick);
    }
    hg.stroke(); hg.setLineDash([]);
    if (major && full) {
      const rot = Math.atan2(vy, vx);
      for (const sg of [-1, 1]) {
        hg.save(); hg.translate(p0.x + vx * (half + 16) * sg, p0.y + vy * (half + 16) * sg); hg.rotate(rot);
        htext(String(Math.abs(th)), 0, 0, 12); hg.restore();
      }
    }
  }
  hg.restore();
  if (!full) hg.globalAlpha = 0.85;

  // ---------- boresight "W" (where the nose points) ----------
  const bs = proj(_v2.copy(P.pos).addScaledVector(fwd, 2000));
  if (!bs.behind) {
    hg.lineWidth = 2;
    hg.beginPath();
    hg.moveTo(bs.x - 24, bs.y); hg.lineTo(bs.x - 12, bs.y); hg.lineTo(bs.x - 6, bs.y + 9); hg.lineTo(bs.x, bs.y);
    hg.lineTo(bs.x + 6, bs.y + 9); hg.lineTo(bs.x + 12, bs.y); hg.lineTo(bs.x + 24, bs.y);
    hg.stroke(); hg.lineWidth = 1.6;
  }
  // ---------- flight-path marker (where the plane is actually going) ----------
  if (P.vel.lengthSq() > 0.01) {
    const fp = proj(_v2.copy(P.pos).addScaledVector(_v1.copy(P.vel).normalize(), 2000));
    if (!fp.behind) {
      const fx = clamp(fp.x, cx - bw, cx + bw), fy = clamp(fp.y, cy - bh, cy + bh);
      hg.beginPath(); hg.arc(fx, fy, 7, 0, PI * 2);
      hg.moveTo(fx - 7, fy); hg.lineTo(fx - 19, fy); hg.moveTo(fx + 7, fy); hg.lineTo(fx + 19, fy);
      hg.moveTo(fx, fy - 7); hg.lineTo(fx, fy - 14); hg.stroke();
    }
  }

  if (!full) {
    const kmh = Math.round(P.speed * 3.6), alt = P.pos.y;
    htext(`${kmh}`, cx - bw * 0.72, cy, 15, 'right', P.speed < STALL + 1.5 ? RED : HUDC, '800');
    htext('km/h', cx - bw * 0.72, cy + 14, 10, 'right');
    const altCol = alt > ZONE.y ? RED : alt > ZONE.y - 8 ? YEL : alt < 1.2 ? YEL : HUDC;
    htext(alt.toFixed(1), cx + bw * 0.72, cy, 15, 'left', altCol, '800');
    htext('m', cx + bw * 0.72, cy + 14, 10, 'left');
    htext(String(Math.round(heading)).padStart(3, '0') + '°', cx, cy - bh - 6, 12);
    if ((P.g ?? 1) > 2.5) htext(`${P.g.toFixed(1)}G`, cx - bw * 0.72, cy + 30, 12, 'right', YEL, '800');
    if (P.afterburner) htext('TĂNG TỐC', cx - bw * 0.72, cy - 16, 10, 'right', YEL, '800');
    const locked = P.lockP >= 1;
    htext(`${P.gunMode ? 'SÚNG' : 'MSL ' + P.msl}  FLR ${P.flares}${P.heat > 0.6 ? (P.overheat ? '  GUN NÓNG' : `  GUN ${Math.round((1 - P.heat) * 100)}%`) : ''}`, cx, cy + bh + 4, 11, 'center', P.overheat ? RED : locked ? LOCKG : HUDC);
    if (locked && Math.floor(clock * 3) % 2 === 0) htext('SHOOT', cx, cy + bh - 14, 16, 'center', LOCKG, '800');
    hg.restore();
    return;
  }
  // ---------- heading tape (top) ----------
  const ty = Math.max(66, cy - bh - 26), tw = Math.min(400, W * 0.42), ppd = tw / 60;
  hg.save(); hg.beginPath(); hg.rect(cx - tw / 2, ty - 26, tw, 44); hg.clip();
  for (let d = Math.ceil((heading - 32) / 5) * 5; d <= heading + 32; d += 5) {
    const x = cx + (d - heading) * ppd, big = d % 10 === 0;
    hg.beginPath(); hg.moveTo(x, ty); hg.lineTo(x, ty + (big ? 10 : 5)); hg.stroke();
    if (big) { const n = ((d % 360) + 360) % 360; htext(n === 0 ? 'N' : n === 90 ? 'E' : n === 180 ? 'S' : n === 270 ? 'W' : String(n / 10).padStart(2, '0'), x, ty - 9, 12); }
  }
  hg.restore();
  hg.beginPath(); hg.moveTo(cx, ty + 12); hg.lineTo(cx - 6, ty + 20); hg.lineTo(cx + 6, ty + 20); hg.closePath(); hg.fill();
  hg.strokeRect(cx - 24, ty - 46, 48, 18); htext(String(Math.round(heading)).padStart(3, '0'), cx, ty - 37, 13, 'center', HUDC, '800');

  // ---------- speed tape (left) ----------
  const kmh = P.speed * 3.6, sx = cx - bw - 18, tapeH = bh * 1.5, sppu = 5;
  hg.save(); hg.beginPath(); hg.rect(sx - 60, cy - tapeH / 2, 64, tapeH); hg.clip();
  for (let v = Math.ceil((kmh - tapeH / 2 / sppu) / 5) * 5; v <= kmh + tapeH / 2 / sppu; v += 5) {
    if (v < 0) continue;
    const y = cy - (v - kmh) * sppu, big = v % 10 === 0;
    hg.beginPath(); hg.moveTo(sx, y); hg.lineTo(sx - (big ? 10 : 5), y); hg.stroke();
    if (big) htext(String(v), sx - 14, y, 11, 'right');
  }
  hg.restore();
  hg.beginPath(); hg.moveTo(sx, cy - tapeH / 2); hg.lineTo(sx, cy + tapeH / 2); hg.stroke();
  hg.fillStyle = 'rgba(0,20,8,0.75)'; hg.fillRect(sx - 58, cy - 12, 52, 24); hg.strokeRect(sx - 58, cy - 12, 52, 24);
  htext(String(Math.round(kmh)), sx - 10, cy, 16, 'right', P.speed < STALL + 1.5 ? RED : HUDC, '800');
  htext('KM/H', sx - 32, cy - tapeH / 2 - 10, 11);
  htext(`THR ${Math.round(P.throttle * 100)}%`, sx - 32, cy + tapeH / 2 + 12, 11, 'center', P.afterburner ? YEL : HUDC);
  if (P.afterburner) htext('TĂNG TỐC', sx - 32, cy + tapeH / 2 + 26, 11, 'center', YEL, '800');
  else if (keys.KeyX) htext('PHANH', sx - 32, cy + tapeH / 2 + 26, 11, 'center', YEL, '800');

  // ---------- altitude tape (right) ----------
  const alt = P.pos.y, ax = cx + bw + 18, appu = 9;
  hg.save(); hg.beginPath(); hg.rect(ax - 4, cy - tapeH / 2, 70, tapeH); hg.clip();
  const yOf = (m) => cy - (m - alt) * appu;
  hg.fillStyle = 'rgba(255,224,102,0.18)'; hg.fillRect(ax, yOf(ZONE.y), 12, (ZONE.y - (ZONE.y - 8)) * appu);
  hg.fillStyle = 'rgba(255,77,77,0.28)'; hg.fillRect(ax, yOf(ZONE.y + 40), 12, 40 * appu);
  hg.fillStyle = 'rgba(160,110,60,0.35)'; hg.fillRect(ax, yOf(0), 12, 30 * appu);
  for (let m = Math.ceil(alt - tapeH / 2 / appu); m <= alt + tapeH / 2 / appu; m++) {
    if (m < 0) continue;
    const y = yOf(m), big = m % 5 === 0;
    hg.beginPath(); hg.moveTo(ax, y); hg.lineTo(ax + (big ? 10 : 5), y); hg.stroke();
    if (big) htext(String(m), ax + 14, y, 11, 'left');
  }
  hg.strokeStyle = RED; hg.beginPath(); hg.moveTo(ax, yOf(ZONE.y)); hg.lineTo(ax + 40, yOf(ZONE.y)); hg.stroke(); hg.strokeStyle = HUDC;
  htext('TRẦN', ax + 42, yOf(ZONE.y) - 7, 10, 'left', RED);
  hg.restore();
  hg.beginPath(); hg.moveTo(ax, cy - tapeH / 2); hg.lineTo(ax, cy + tapeH / 2); hg.stroke();
  const altCol = alt > ZONE.y ? RED : alt > ZONE.y - 8 ? YEL : alt < 1.2 ? YEL : HUDC;
  hg.fillStyle = 'rgba(0,20,8,0.75)'; hg.fillRect(ax + 6, cy - 12, 56, 24); hg.strokeRect(ax + 6, cy - 12, 56, 24);
  htext(alt.toFixed(1), ax + 58, cy, 16, 'right', altCol, '800');
  htext('ALT m', ax + 32, cy - tapeH / 2 - 10, 11);
  const vs = P.vel.y;
  htext(`VS ${vs >= 0 ? '+' : ''}${vs.toFixed(1)}`, ax + 32, cy + tapeH / 2 + 12, 11, 'center', vs < -2.5 ? YEL : HUDC);

  // ---------- G meter, AoA-ish info (inside the glass, lower-left) ----------
  const g = P.g ?? 1;
  htext(`G ${g.toFixed(1)}`, cx - bw + 8, cy + bh - 30, 14, 'left', g > 3 ? YEL : HUDC, '800');
  htext(`MAX ${(P.gMax || 1).toFixed(1)}`, cx - bw + 8, cy + bh - 13, 11, 'left');
  // ---------- weapon line (lower-right in the glass) ----------
  const locked = P.lockP >= 1;
  htext(P.overheat ? 'GUN NÓNG' : `GUN ${Math.round((1 - P.heat) * 100)}%`, cx + bw - 8, cy + bh - 47, 12, 'right', P.overheat ? RED : HUDC);
  htext(`MSL ${P.msl}`, cx + bw - 8, cy + bh - 30, 14, 'right', locked ? LOCKG : HUDC, '800');
  htext(`FLR ${P.flares}`, cx + bw - 8, cy + bh - 13, 11, 'right');
  if (locked && Math.floor(clock * 3) % 2 === 0) htext('SHOOT', cx, cy + bh - 20, 20, 'center', LOCKG, '800');
  hg.restore();
}

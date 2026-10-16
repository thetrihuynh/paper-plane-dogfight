'use strict';
// Máy Bay Giấy · Chương 1: bay huấn luyện, rồi lẻn sang khu Tây trinh sát Phòng Thí Nghiệm của Phe Đỏ
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)
// gameMode 'recon' runs the whole chapter: tutorial lessons over our north courtyard -> sneak across the yard
// under their radar (Hiệu Bộ archway, Giếng Trời arcade, Dãy C's veranda) -> fly through their lab and see the
// half-built Tàu Mẹ (slow orbiting shot; caught by the radar before that = mission failed) -> turning for home,
// a whirlwind throws us up into the radar -> two interceptors we can't beat give chase -> over the half-way
// line Wingman and Alpha 2 come in head-on and shoot them down.

// is P lit up on the radar on the lab roof? 0 = hidden, >0 = seen (the higher above the radar floor, the stronger)
const RADAR_RANGE = 620, _rcP = new THREE.Vector3();
const radarFloor = d => 4 + d * 0.012;   // ground clutter + radar horizon: lower is safer, more so close in
function radarSees(p) {
  const d = p.distanceTo(RADAR_POS);
  if (d > RADAR_RANGE || underRoof(p)) return 0;
  const fl = radarFloor(d);
  if (p.y < fl) return 0;
  for (let i = 1; i < 40; i++) { _rcP.lerpVectors(RADAR_POS, p, i / 40); if (pointBlocked(_rcP)) return 0; }   // masked by trees, walls, buildings
  return 1 + (p.y - fl) * 0.15;
}
// the sneak route: the arch, across the yard, through the Giếng Trời arcade, along Dãy C's veranda, then into the lab
const ROUTE_PTS = [[0, -161], [0, -300], [0, -383], [0, -417], [-45, -612], [-45, -633], [-17, -622], [0, -618]];

// =====================================================================
//  The chapter
// =====================================================================
const RC = { phase: 'off', step: 0, stepT: 0, rings: [], ringNext: 0, drones: [], lowT: 0, meter: 0, pingT: 0, wp: 0,
  labSeen: false, labT: 0, gustT: -1, gustSide: 1, detected: false, fightT: 0, interceptors: [], chaserN: 0, downed: 0, reinfT: -1 };
const stealthEl = document.createElement('div');
stealthEl.style.cssText = 'position:fixed;top:40px;left:50%;transform:translateX(-50%);min-width:300px;padding:5px 12px;border-radius:5px;background:rgba(0,0,0,.45);color:#9effa0;font:700 14px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none;display:none;z-index:3;text-shadow:0 0 4px #000';
document.body.appendChild(stealthEl);
const camFlashEl = document.createElement('div');
camFlashEl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:5;transition:opacity .5s';
document.body.appendChild(camFlashEl);

const TUT_STEPS = [
  { title: 'Lượn qua 3 vòng vàng', hint: 'Chuột hoặc W/S/A/D để lái · Shift tăng tốc · X giảm tốc',
    radio: 'Bài 1: ba cái vòng vàng phía trước. Chuột chỉ đâu, máy bay theo đó. Đơn giản thôi.',
    bb: [['Đẹp lắm! Ba vòng, không quệt vòng nào.'], ['Gọn ghê. Wingman, anh thấy chưa?', 'Wingman', '...Thấy rồi.']],
    start() { tutRings(); }, done: () => RC.ringNext >= RC.rings.length },
  { title: 'Bắn hạ 2 máy bay bia', hint: 'Chuột trái / Space: bắn súng · giữ R: tự bám đuôi mục tiêu',
    radio: 'Bài 2: hai máy bay bia. Chúng không bắn trả, may cho cậu. Bám đuôi rồi bắn.',
    bb: [['Hai bia, rơi cả hai. Ờ thì... tốn đạn hơn hai phát một chút, nhưng vẫn tính.', 'Wingman', 'Bia không biết né. Ngoài kia thì có.'],
         ['Wingman này, anh bay mẫu cho cậu ấy một vòng đi chứ? ...Không à? Thật hết nói.', 'Wingman', 'Học bằng mắt thì quên. Học bằng tay mới nhớ.']],
    start() { tutDrones(2); }, done: () => RC.drones.every(f => !f.alive) },
  { title: 'Khoá và phóng tên lửa vào máy bay bia', hint: 'Giữ mũi vào mục tiêu tới khi KHOÁ · F / chuột phải: phóng',
    radio: 'Bài 3: giữ mũi vào mục tiêu tới khi khoá xanh rồi phóng. Đừng phí, ngoài kia không ai phát thêm tên lửa cho cậu đâu.',
    bb: [['Khoá, phóng, trúng. Nhớ lấy cảm giác này nhé, ngoài kia không dễ thế đâu.'], ['Trúng rồi! Tôi nghe cả tiếng nổ từ đài chỉ huy đấy.']],
    start() { P.msl = Math.max(P.msl, 2); P.wpnGun = false; tutDrones(1); }, done: () => RC.drones.every(f => !f.alive) },
  { title: 'Lộn vòng né tránh', hint: 'Nhấn V: lộn vòng tăng tốc, tự thả pháo sáng',
    radio: 'Bài 4: bị tên lửa bám thì nhấn V. Lộn vòng, pháo sáng lo phần còn lại. Tôi sống tới giờ là nhờ cái nút đó.',
    bb: [['Lộn vòng đẹp đấy. Tôi ngồi dưới này mà còn chóng mặt thay cậu.'], ['Đúng rồi! Cứ thế, đừng bao giờ quên cái nút đó.']],
    start() {}, done: () => P.evadeT > 0 },
  { title: 'Bay lướt thấp dưới 4 m trong 3 giây', hint: 'Hạ thật thấp, sát mặt sân · bay thấp là cách lọt dưới tầm radar',
    radio: 'Bài cuối: lướt sát mặt đất. Dưới mái hiên với tán cây thì chẳng ai trên cao nhìn thấy cậu. ...Ai trên cao à? Cứ bay đi đã.',
    bb: [['Sát đất thế cơ à... cỏ sân Đông chắc giật mình lắm.'], ['Thấp ghê! Thêm tí nữa là cậu lướt qua giày tôi rồi.']],
    start() { RC.lowT = 0; }, done: () => RC.lowT >= 3 },
];

// three chapters share this code: 'tutorial' (Chương 1), 'sneak' (Chương 2), 'chase' (Chương 3). In the campaign
// each hands straight over to the next; on its own (or after a crash) each one starts at its own beginning
function startRecon(kind) {
  const cont = RC.phase === 'handoff';   // carrying straight on from the previous part
  gameMode = 'recon'; waveState = 'recon';
  Object.assign(RC, { kind, step: -1, stepT: 1.5, meter: 0, wp: 0, labSeen: false, labT: 0, gustT: -1, detected: false, fightT: 0, chaserN: 0, downed: 0, reinfT: -1 });
  RC.interceptors = []; RC.drones = []; clearTutRings();
  if (kind === 'tutorial') {
    RC.phase = 'tut';
    radio('Blackboard', 'Trước khi nhận việc thật, mình khởi động vài bài trên sân Đông nhé. Ai tự tin quá thì nhấn K để bỏ qua... nhưng tôi không khuyên đâu.', true);
    radio('Wingman', 'Wingman đây. Họ giao tôi kèm cậu mấy bài đầu. Bay cho đúng, đừng bắt tôi nói lại hai lần.');
    radio('Blackboard', 'Đừng để anh ấy doạ. Anh ấy bay giỏi lắm đấy, chỉ là dạo này lười thôi.');
    radio('Wingman', '...Tôi đang để dành sức cho ngày nghỉ hưu.');
    flash('HUẤN LUYỆN BAY', 'Làm quen với máy bay giấy của bạn', 2.4);
  } else if (kind === 'sneak') {
    RC.phase = 'brief'; RC.stepT = 2.5;
    radio('Blackboard', 'Alpha 1, việc thật đầu tiên của cậu đây: trinh sát. Phe Đỏ đang giấu gì đó trong Phòng Thí Nghiệm khu Tây.', true);
    radio('Blackboard', 'Cái radar trên nóc nó quét cả sân. Bay thấp, lách dưới mái, chui qua cửa phòng rồi chụp vài tấm. Lộ trước khi chụp được là mình về tay trắng.');
    radio('Blackboard', 'Không cần vội. Tôi theo cậu suốt đường đi.');
  } else startChase(cont);
}
// a part is done: in the campaign go straight on into the next one; otherwise let the normal flow end the chapter
function reconChapterDone() {
  if (playMode === 'campaign' && WAVES[wave + 1] && WAVES[wave + 1].recon) { RC.phase = 'handoff'; spawnWave(++wave); return; }
  endReconWorld(); waveState = 'active';
}
function startChase(cont) {
  RC.phase = 'sneak'; RC.labSeen = true; showLabWeapon(true);
  if (!cont) {   // start just outside the lab's yard door, photos in the can
    P.pos.set(0, 4.5, LABH.z1 + 5); orient(P, _tmp.set(0.001, 0, 1)); aim.set(0, 0, 1); P.speed = 8; P.prevVel = null; P.trails.forEach(t => t.init = false);
    P.hp = P.maxHp; P.msl = Math.max(P.msl, MSL_PER_WAVE); P.flares = Math.max(P.flares, FLR_PER_WAVE); P.sonic = false;
  }
  radio('Blackboard', 'Có ảnh rồi! Giỏi lắm. Giờ về nhà thôi, nhớ bay thấp, đừng để tới phút cuối mới bị bắt nhé.', true);
}
function endReconWorld() {
  stealthEl.style.display = 'none'; clearTutRings(); showLabWeapon(false);
  RC.phase = 'off';
  if (gameMode === 'recon') gameMode = 'campaign';
}

// ---- tutorial helpers ----
function clearTutRings() { for (const r of RC.rings) scene.remove(r.mesh); RC.rings.length = 0; RC.ringNext = 0; }
function tutRings() {
  clearTutRings();
  const dir = fwdOf(P, new THREE.Vector3()).setY(0).normalize(), p = P.pos.clone().addScaledVector(dir, 18);
  p.y = clamp(p.y, 5, 20);
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 10 && (pointBlocked(p, 2) || !inSchool(p)); k++) { p.y += 3; if (!inSchool(p)) { dir.negate(); p.addScaledVector(dir, 14); } }
    const mesh = new THREE.Mesh(cRingGeo, new THREE.MeshBasicMaterial({ color: 0xffd93b, transparent: true, opacity: 0.35, fog: false }));
    mesh.scale.setScalar(1.3); mesh.position.copy(p); mesh.lookAt(_tmp.copy(p).add(dir)); scene.add(mesh);
    RC.rings.push({ pos: p.clone(), mesh });
    dir.applyAxisAngle(UP, (i % 2 ? -1 : 1) * rr(0.3, 0.5)); dir.y = 0; dir.normalize();
    p.addScaledVector(dir, 16); p.y = clamp(p.y + rr(-2, 3), 5, 20);
  }
}
function tutDrones(n) {
  RC.drones = [];
  for (let i = 0; i < n; i++) {
    const f = makeFlyer('dart', 'red', `Máy bay bia ${i + 1}`, 0xd8d8d8);
    f.K = { ...f.K, gunDmg: 0, gunRange: 0, veq: 6, evade: 0.35, points: 30, label: 'Máy bay bia' };   // a practice target: never shoots back
    f.mslLeft = 0; f.flares = 0; f.hp = f.maxHp = 30;
    f.pos.copy(findSpawn(28, 55)); orient(f, _ax.subVectors(f.pos, P.pos).setY(0)); f.speed = 6;
    RC.drones.push(f);
  }
}
function finishTutorial(skipped) {
  for (const f of RC.drones) if (f.alive) removeFlyer(f);
  RC.drones = []; clearTutRings();
  RC.phase = 'tutdone'; RC.stepT = 2.5;
  flash(skipped ? 'BỎ QUA HUẤN LUYỆN' : 'HUẤN LUYỆN HOÀN THÀNH', 'Sẵn sàng nhận nhiệm vụ', 2.4);
  radio('Blackboard', skipped ? 'Bỏ qua luôn à? Tự tin ghê. Được, vào việc thôi.' : 'Xong cả năm bài! Alpha 1, giờ thì cậu sẵn sàng thật rồi đấy.', true);
  if (!skipped) [
    ['Wingman', '...Ừ. Được đấy, lính mới. Khá hơn tôi hồi mới gấp ra.'],
    ['Blackboard', 'Thấy chưa, anh dạy hay mà. Nhận thêm một lứa nữa đi.'],
    ['Wingman', 'Vài tuần nữa tôi nghỉ rồi.'],
    ['Blackboard', 'Năm ngoái anh cũng nói y câu đó.'],
    ['Wingman', 'Hồi xưa tôi chỉ mơ được dạy bọn nhỏ bay thế này. Không phải để đưa chúng ra trận.'],
  ].forEach(([w, t]) => radio(w, t));
}
function startSneak() {
  RC.phase = 'sneak'; RC.meter = 0; RC.wp = 0;
  showLabWeapon(true);
  P.pos.set(0, 4.5, -60); orient(P, FWD); aim.set(0, 0, -1); P.speed = 8; P.prevVel = null; P.trails.forEach(t => t.init = false);
  P.hp = P.maxHp; P.msl = Math.max(P.msl, MSL_PER_WAVE); P.flares = Math.max(P.flares, FLR_PER_WAVE); P.sonic = false;
  flash('NHIỆM VỤ: TRINH SÁT', 'Bay dưới tầm radar · bay xuyên Phòng Thí Nghiệm khu Tây', 3);
}

// =====================================================================
//  What they're building: a giant Tàu Mẹ, half folded, hung under the lab ceiling (only in this chapter)
// =====================================================================
const labWeapon = new THREE.Group(), LABW = new THREE.Vector3(0, 9.6, (LABH.z0 + LABH.z1) / 2);
{
  const s = 3.4, paper = lam(0xd8dde6, { map: paperTex, side: THREE.DoubleSide, emissive: 0x3a3f4a });
  const body = new THREE.Mesh(PLANE_GEOS.mother, paper); body.scale.setScalar(s); body.position.set(0, -0.2, 0);
  const ribs = new THREE.LineSegments(PLANE_EDGES.mother, new THREE.LineBasicMaterial({ color: 0x9c1c1c })); ribs.scale.setScalar(s); ribs.position.copy(body.position);
  const frame = new THREE.Mesh(PLANE_GEOS.mother, new THREE.MeshBasicMaterial({ color: 0xff6a3c, wireframe: true })); frame.scale.set(s * 1.01, s * 1.01, s * 1.18); frame.position.set(0, -0.2, 0.3);   // the frame for the panels still to go on
  labWeapon.add(body, ribs, frame);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {   // chains up to the ceiling
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4), MAT.metal); c.position.set(sx * 2.4, 2.1, sz * 2.2); labWeapon.add(c);
  }
  labWeapon.position.copy(LABW); scene.add(labWeapon);
  // scaffolds and work lights along the side benches, the blueprint over the back door
  for (const sx of [-1, 1]) for (const dz of [-6, 6]) {
    const p = put(new THREE.CylinderGeometry(0.08, 0.08, 11.4), MAT.metal, sx * 6.8, 5.7, LABW.z + dz, { parent: labWeapon.parent }); p.userData.labW = 1;
  }
  const bp = signTex([{ t: 'TÀU MẸ · BẢN VẼ MẬT', size: 70, c: '#ffffff' }, { t: 'KHÔNG ĐƯỢC ĐỂ PHE XANH BIẾT', size: 44, c: '#ffd93b' }], { w: 1024, h: 200, bg: '#1d3557', border: '#ffffff' });
  const bpm = put(new THREE.PlaneGeometry(10, 2), signMat(bp), 0, 10.3, LABH.z0 + 0.65, { cast: false }); bpm.userData.labW = 1;
  labWeapon.userData.box = addBox(-3.4, 8.8, LABW.z - 4, 3.4, 12, LABW.z + 4); gridInsert(labWeapon.userData.box, -3.4, LABW.z - 4, 3.4, LABW.z + 4);
}
// ...and the first one, finished, parked on its launch cradle on their football pitch, nose to the north
const parkedMother = new THREE.Group(), PARKED = new THREE.Vector3(PITCH.x, 6.5, PITCH.z);
{
  const s = 9, hull = new THREE.Mesh(PLANE_GEOS.mother, lam(KINDS.dread.color, { map: paperTex, side: THREE.DoubleSide }));
  hull.scale.setScalar(s); hull.castShadow = true;
  const ribs = new THREE.LineSegments(PLANE_EDGES.mother, new THREE.LineBasicMaterial({ color: KINDS.dread.edge })); ribs.scale.setScalar(s);
  parkedMother.add(hull, ribs);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {   // the launch cradle
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.5, 0.5), MAT.metal); st.position.set(sx * 2.2, -3.5, sz * 5); parkedMother.add(st);
  }
  parkedMother.rotation.y = PI;   // forward is -z in the model; it faces north (+z), ready to go
  parkedMother.position.copy(PARKED); scene.add(parkedMother);
  parkedMother.userData.box = addBox(PARKED.x - 9, 0, PARKED.z - 10.5, PARKED.x + 9, PARKED.y + 6, PARKED.z + 10.5);
  gridInsert(parkedMother.userData.box, PARKED.x - 9, PARKED.z - 10.5, PARKED.x + 9, PARKED.z + 10.5);
}
const labWeaponExtras = scene.children.filter(o => o.userData.labW);
function showLabWeapon(on, parked = on) {   // the finished one only stands outside in Chương 2-3; the half-built one stays in the lab until Chương 6
  labWeapon.visible = on; labWeaponExtras.forEach(o => o.visible = on); labWeapon.userData.box.off = !on;
  parkedMother.visible = parked; parkedMother.userData.box.off = !parked;
}
showLabWeapon(false);

// =====================================================================
//  The two scripted moments: the slow orbit round the weapon, and the wingmen's rescue at the half-way line
// =====================================================================
function inLabDoorway(p, fw) {
  if (p.y > 8.4 || Math.abs(p.x) > 9) return false;
  if (p.z < LABH.z1 && p.z > LABH.z0) return true;   // inside
  return (Math.abs(p.x) < 6 && ((p.z > LABH.z1 && p.z < LABH.z1 + 7 && fw.z < -0.5) || (p.z < LABH.z0 && p.z > LABH.z0 - 7 && fw.z > 0.5)));
}
function startLabCut() {
  const dir = Math.sign(fwdOf(P, _fw).z) || -1;   // through the lab towards the back (-1) or the yard (+1)
  cut = { kind: 'lab', t: 0, crew: [], boss: null, said: {}, dir, x0: P.pos.x, y0: clamp(P.pos.y, 2.5, 6), z0: P.pos.z, slow: t => t < LAB_REVEAL ? 0.55 : 0.8 };
  P.invulnT = 99; document.body.classList.add('cine');
  if (!cineOn) endLabCut();
}
const LAB_CUT_LEN = 10.2, LAB_REVEAL = 6.2;   // the orbit inside, then the reveal of the finished one outside
function updateLabCut(dt) {
  const c = cut; c.t += dt; const t = c.t, k = t / LAB_CUT_LEN;
  // Alpha 1 drifts through the hall, slow and level, under the half-built Tàu Mẹ
  P.pos.set(lerp(c.x0, 0, Math.min(1, k * 3)), c.y0, c.z0 + c.dir * 4.5 * t);
  orient(P, _tmp.set(0, 0, c.dir)); P.speed = 4.5; P.vel.set(0, 0, c.dir * 4.5);
  labWeapon.rotation.z = Math.sin(t * 0.8) * 0.02;
  const line = (n, at, who, text) => { if (t > at && !c.said[n]) { c.said[n] = 1; sayNow(who, text); } };
  line(1, 0.3, 'Blackboard', 'Cái gì treo trên trần kia...?');
  line(2, 2.2, 'Blackboard', 'Một chiếc Tàu Mẹ khổng lồ, đang gấp dở! Chụp lại hết, từng nếp gấp một!');
  line(5, 4.3, 'Alpha 1', '(Xấp giấy trên bàn kia... cùng một loại giấy với mình.)');   // the first hint: both sides are folded from the same paper
  if (t > 3.2 && !c.said.snap) {
    c.said.snap = 1; score += 300;
    camFlashEl.style.transition = 'none'; camFlashEl.style.opacity = 0.85;
    requestAnimationFrame(() => { camFlashEl.style.transition = 'opacity .6s'; camFlashEl.style.opacity = 0; });
    if (AU.ctx) { noiseHit(AU.ctx.currentTime, 3000, 0.25, 0.08, 'highpass'); tone(1800, 1800, 0.05, 0.05, 'square', 0.1); }
    flash('VŨ KHÍ BÍ MẬT', 'Phe Đỏ đang chế tạo Tàu Mẹ · đã chụp ảnh +300', 2.6);
  }
  line(3, LAB_REVEAL + 0.4, 'Blackboard', 'Khoan... ngoài sân bóng của chúng... còn một chiếc nữa. Chiếc này đã gấp xong rồi!');
  if (t > LAB_REVEAL + 1.2 && !c.said.snap2) { c.said.snap2 = 1; score += 200; camFlashEl.style.transition = 'none'; camFlashEl.style.opacity = 0.7; requestAnimationFrame(() => { camFlashEl.style.transition = 'opacity .6s'; camFlashEl.style.opacity = 0; }); flash('HAI TÀU MẸ', 'Một chiếc đang gấp dở · một chiếc sẵn sàng xuất kích · +200', 2.6); }
  line(4, LAB_REVEAL + 2.6, 'Blackboard', 'Hai chiến hạm bay... Đủ rồi, RTB ngay! Giữ độ cao thấp!');
  if (t >= LAB_CUT_LEN || pressed.Enter || pressed.NumpadEnter) endLabCut();
}
function endLabCut() {
  const c = cut; cut = null; document.body.classList.remove('cine');
  if (!c.said.snap) score += 300;
  RC.labSeen = true; RC.labT = 0;
  P.pos.set(0, c.y0, c.dir < 0 ? LABH.z0 - 4 : LABH.z1 + 4); orient(P, _tmp.set(0.001, 0, c.dir)); P.speed = 8; P.invulnT = 0.5;
  aim.copy(fwdOf(P, _tmp)); camPos.copy(P.pos).addScaledVector(aim, -2.5).add(_pv.set(0, 0.5, 0)); camAimS.copy(aim);
  reconChapterDone();   // Chương 2 ends here; Chương 3 picks up from this very spot
}
function labCutCamera(dt) {
  const t = cut.t, a = 0.7 + t * 0.42, reveal = t >= LAB_REVEAL;
  if (!reveal) {   // a slow orbit round the half-built one, the plane crossing under it
    _cd.set(Math.sin(a) * 7.6, 5.2 + Math.sin(t * 0.6) * 1.2, LABW.z + Math.cos(a) * 8.4);
    _cl.copy(LABW).lerp(P.pos, 0.35);
  } else {   // out over their courtyard: the finished one on its cradle, rising slowly into view
    const k = clamp((t - LAB_REVEAL) / (LAB_CUT_LEN - LAB_REVEAL), 0, 1), e = k * k * (3 - 2 * k);
    _cd.set(lerp(24, 30, e), lerp(4, 15, e), lerp(LABH.z0 - 8, LABH.z0 - 24, e));
    _cl.copy(PARKED).add(_pv.set(0, lerp(0, 2.5, e), 0));
  }
  camera.position.lerp(_cd, t < 0.05 || reveal !== cut.rev ? 1 : 1 - Math.exp(-dt * 6)); cut.rev = reveal;
  camera.up.set(0, 1, 0); camera.lookAt(_cl);
  camera.fov += (58 - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}
// across the line into our half: the cinematic rescue, all close-ups.
//  1. over a chaser's shoulder: its red gunsight closes round Alpha 1 and locks; Alpha 1 goes to full throttle
//  2. right on the red plane's nose as it gets ready to fire
//  3. from Alpha 1's tail, looking back: the red plane blows apart and Wingman comes through the fireball and
//     shaves past us, in slow motion: "Cần giúp một tay không, lính mới?"
//  4. same view, Alpha 2 takes the second one down the other side
//  5. head-on: the three of them side by side, heading home
const RESCUE_OFF = [[-1.6, 0.9, -9], [3.2, 1.7, -13], [-4.5, 2.4, -17], [5.5, 3, -21]];
const RS = { lock: 2.2, aim: 3.35, k1: 3.55, tail2: 6.2, k2: 6.6, home: 7.9 };
function startRescueCut() {
  for (const m of missiles) if (m.alive && m.target === P) { m.alive = false; scene.remove(m.mesh); }
  const chasers = flyers.filter(f => f.alive && f.team === 'red').slice(0, 4);
  for (const f of flyers) if (f.alive && f.team === 'red' && !chasers.includes(f)) removeFlyer(f);
  const a2 = ALLIES[0], allies = [wingmanUp() || makeWingman(), flyers.find(o => o.alive && o.name === a2.name) || makeFlyer('ally', 'blue', a2.name, a2.color)];
  for (const f of allies) { f.obj.visible = false; f.rg = null; }   // off stage until their entrance
  // Wingman takes the first (passing on our right), Alpha 2 the second (on our left); any others go down off camera
  const kills = chasers.map((f, i) => ({ f, i, by: allies[i % 2], side: i % 2 ? -1 : 1, at: i === 0 ? RS.k1 : i === 1 ? RS.k2 : RS.k2 + 0.3 * (i - 1) }));
  cut = { kind: 'rescue', t: 0, crew: chasers.concat(allies), boss: null, said: {}, chasers, allies, kills,
    pz: P.pos.z, x0: Math.abs(P.pos.x) < 6 ? (P.pos.x < 0 ? -6 : 6) : P.pos.x, y0: clamp(P.pos.y, 4, 12), spd: 9, beepT: 0, len: RS.home + 4.4,
    slow: t => t > RS.lock && t < RS.aim ? 0.6 : t > RS.k1 - 0.1 && t < RS.k1 + 1.5 ? 0.3 : t > RS.k2 - 0.1 && t < RS.k2 + 1.0 ? 0.4 : 1 };
  P.invulnT = 99; document.body.classList.add('cine');
  if (!cineOn) endRescueCut();
}
const rescueLocked = t => t > 1.4;
const _rel = new THREE.Vector3();
// a wingman's run in Alpha 1's frame: in behind its chaser, guns, through the fireball, past our wingtip
function wingmanRel(k, t, out) {
  const o = RESCUE_OFF[k.i], s = k.side;
  const keys = [[k.at - 1.1, o[0] + s * 0.6, o[1] + 0.5, o[2] - 16], [k.at, o[0] + s * 0.4, o[1] + 0.25, o[2] - 2.2], [k.at + 0.95, s * 1.15, 0.55, 0.4], [k.at + 2.5, s * 2, 1.4, 22]];
  let j = 0; while (j < keys.length - 2 && t > keys[j + 1][0]) j++;
  const a = keys[j], b = keys[j + 1], u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1), e = j === 0 ? u * u : u;   // accelerating in, then straight through
  return out.set(lerp(a[1], b[1], e), lerp(a[2], b[2], e), lerp(a[3], b[3], e));
}
function updateRescueCut(dt) {
  const c = cut; c.t += dt; const t = c.t;
  // Alpha 1: locked up, then full throttle; heading home it climbs over our own wing
  c.spd = t > 1.5 ? Math.min(14, c.spd + 6 * dt) : 9; c.pz += c.spd * dt;
  const climb = t > RS.home ? Math.min(1, (t - RS.home) / 3) : 0;
  c.yc = (c.yc ?? c.y0) + (climb ? Math.max(0, 20 - c.yc) * 0.9 * dt : 0);
  const xs = clamp(t / 4, 0, 1), xt = lerp(c.x0, c.x0 < 0 ? -16 : 16, xs * xs * (3 - 2 * xs));   // drift into the open passage beside the Hiệu Bộ, not into it
  P.pos.set(xt + Math.sin(t * 1.3) * 0.5, c.yc + Math.sin(t * 0.9) * 0.25, c.pz);
  orient(P, _tmp.set(Math.cos(t * 1.3) * 0.05, 0.15 * climb, 1)); P.q.multiply(_q.setFromAxisAngle(FWD, Math.sin(t * 1.3) * 0.2)); P.speed = c.spd; P.vel.set(0, 0, c.spd);
  if (t > 1.5 && t < RS.aim) for (let k = 0; k < 2; k++) puff(fire, _tmp.copy(P.pos).add(_pv.set(rr(-0.1, 0.1), rr(-0.1, 0.1), -0.45)), _pv.set(0, 0, -3), 0.18, 0.12, 0.04, 0xffb347);
  c.chasers.forEach((f, i) => {
    if (!f.alive) return;
    const o = RESCUE_OFF[i];
    f.pos.copy(P.pos).add(_pv.set(o[0] + Math.sin(t * 1.7 + i) * 0.4, o[1], o[2]));
    orient(f, _tmp.subVectors(P.pos, f.pos).normalize().lerp(_tmp2.set(0, 0, 1), 0.6).normalize()); f.speed = c.spd; f.vel.set(0, 0, c.spd);
  });
  // the lock tone: faster and faster, then solid until the shot
  c.beepT -= dt;
  if (c.beepT <= 0 && t < RS.k1) { c.beepT = rescueLocked(t) ? 0.075 : lerp(0.32, 0.1, t / 1.4); if (AU.ctx) tone(rescueLocked(t) ? 1650 : 1250, rescueLocked(t) ? 1650 : 1250, 0.05, 0.06, 'square'); }
  // the wingmen's runs
  for (const k of c.kills) {
    const f = k.by;
    if (t < k.at - 1.1 || t > k.at + 2.5 || (k.i > 1 && t > k.at)) { if (k.i <= 1 && t > k.at + 2.5) f.obj.visible = false; }
    else {
      f.obj.visible = true;
      const r0 = wingmanRel(k, t, _rel).clone(), r1 = wingmanRel(k, t + 0.04, _tmp);
      f.pos.copy(P.pos).add(r0); orient(f, _tmp2.subVectors(r1, r0).multiplyScalar(1 / 0.04).add(_pv.set(0, 0, c.spd)).normalize());
      f.q.multiply(_q.setFromAxisAngle(FWD, -k.side * 0.5 * clamp((t - k.at) / 0.9, 0, 1)));   // banking away as it shaves past
      f.speed = 16; f.vel.set(0, 0, 16);
      f.gunT = (f.gunT || 0) - dt;
      if (k.f.alive && t > k.at - 0.6 && f.gunT <= 0) { f.gunT = 0.05; fireGun(f, 0.004); }
    }
    if (k.f.alive && t >= k.at) {
      destroy(k.f, f); shake = Math.min(0.8, shake + 0.45);
      burst(k.f.pos, 60, [0x8a1020, 0xffffff, 0xffd23f, 0xf4f1e6], 8, 1.8, 1); explosion(k.f.pos, 1.6, 1);
    }
  }
  if (t >= RS.home) c.allies.forEach((f, i) => {   // swing in on Alpha 1's wings
    f.obj.visible = true;
    const slot = _tmp2.copy(P.pos).add(_pv.set(i ? -1.25 : 1.25, 0.22, -0.6)), k = Math.min(1, (t - RS.home) / 1.4);
    if (!f.rg) f.rg = P.pos.clone().add(_pv.set(i ? -5 : 5, 2.5, -10)).sub(_pv.set(0, 0, 0));   // sweeping up from behind
    f.rg.z += c.spd * dt; f.pos.lerpVectors(f.rg, slot, k * k * (3 - 2 * k));   // the start point keeps pace, so they really close in orient(f, _tmp.set((slot.x - f.pos.x) * 0.05, 0.15 * climb, 1)); f.speed = c.spd; f.vel.set(0, 0, c.spd);
  });
  const line = (n, at, who, text) => { if (t > at && !c.said[n]) { c.said[n] = 1; sayNow(who, text); } };
  line(1, 0.3, 'Blackboard', 'Alpha 1, spike! Cậu bị khoá rồi!');
  line(2, 1.4, 'Blackboard', 'Khoá cứng rồi! Chạy đi, chạy!');
  line(3, RS.k1 + 0.45, 'Wingman', 'Cần giúp không, lính mới? ...Thôi, khỏi trả lời.');
  if (c.kills.length > 1) line(4, RS.k2 + 0.3, 'Alpha 2', 'Chiếc này của tôi!');
  line(5, RS.home + 1.2, 'Alpha 2', 'Suýt chết đấy nhỉ?');
  line(6, RS.home + 2.6, 'Wingman', 'Bay thấp, không ham đánh, biết chạy đúng lúc. ...Làm tốt lắm. Giờ về, tôi muốn đi ngủ.');
  if (t >= c.len || pressed.Enter || pressed.NumpadEnter) endRescueCut();
}
function endRescueCut() {
  const c = cut; cut = null; document.body.classList.remove('cine');
  for (const k of c.kills) if (k.f.alive) destroy(k.f, k.by);
  c.allies.forEach((f, i) => { f.obj.visible = true; f.rg = null; f.pos.copy(P.pos).add(_pv.set(i ? -1.25 : 1.25, 0.22, -0.6)); orient(f, _tmp.set(0.001, 0, 1)); f.speed = 9; f.mode = 'attack'; });
  P.invulnT = 1; P.speed = 9; orient(P, _tmp.set(0.001, 0, 1)); aim.copy(fwdOf(P, _tmp)); camPos.copy(P.pos).add(_pv.set(0, 0.5, -2.5)); camAimS.copy(aim);
  radio('Blackboard', 'Alpha 1 về rồi! ...Phù. Ảnh Tàu Mẹ đã nằm trên bàn tôi. Cậu làm tốt lắm.', true);
  [['Blackboard', 'Còn anh, Wingman: một loạt đạn hạ một chiếc, xong đòi về đi ngủ. Phí tài quá đấy.'],
   ['Wingman', 'Tài thì phải để dành, Black. Cho lúc thật sự cần.'],   // and he does, in Chương 12
   ['Blackboard', 'Phe Đỏ biết mình bị lộ rồi. Tất cả nghỉ đi... nhưng đừng ai ngủ say quá.']].forEach(([w, t]) => radio(w, t));
  endReconWorld();
  waveState = 'active';   // nothing left in the air: the normal flow ends the chapter
}
function rescueShot(t) { return t < RS.lock ? 'lock' : t < RS.aim ? 'aim' : t < RS.tail2 ? 'tail1' : t < RS.home ? 'tail2' : 'home'; }
function rescueCamera(dt) {
  const c = cut, t = c.t, shot = rescueShot(t), h = c.chasers[0];
  let fov = 52;
  if (shot === 'lock') {   // over the chaser's shoulder, Alpha 1 framed in its gunsight
    _cd.copy(h.pos).add(_pv.set(0.55, 0.45, -2.1)); _cl.copy(P.pos).add(_pv.set(0, 0.1, 0)); fov = lerp(48, 34, clamp(t / RS.lock, 0, 1));
  } else if (shot === 'aim') {   // right on the red plane's nose: it's about to fire
    const u = (t - RS.lock) / (RS.aim - RS.lock);
    _cd.copy(h.pos).add(_pv.set(lerp(1.5, 0.9, u), lerp(0.2, 0.32, u), lerp(1.6, 1.0, u))); _cl.copy(h.pos).add(_pv.set(0, 0.05, 0.25)); fov = 40;
  } else if (shot === 'tail1' || shot === 'tail2') {   // from Alpha 1's tail, looking back down the line of chasers
    const s = shot === 'tail1' ? 1 : -1;
    _cd.copy(P.pos).add(_pv.set(s * 0.32, 0.38, -0.55)); _cl.copy(P.pos).add(_pv.set(-s * 0.4, 0.4, -14)); fov = 60;
  } else {   // head-on: the three of them side by side coming at us, the camera easing back in front of them
    const k = clamp((t - RS.home) / 3.6, 0, 1);
    _cd.copy(P.pos).add(_pv.set(Math.sin(t * 0.5) * 0.25, 0.28 + 0.12 * k, lerp(2.5, 3.4, k))); _cl.copy(P.pos).add(_pv.set(0, 0.1, -1)); fov = 46;
  }
  for (let i = 1; i <= 10; i++) { _tmp.lerpVectors(_cl, _cd, i / 10); if (pointBlocked(_tmp, 0.1)) { _cd.lerpVectors(_cl, _cd, Math.max(0.2, (i - 1) / 10)); break; } }   // never behind a wall
  const snap = shot !== c.shot;
  camera.position.lerp(_cd, snap ? 1 : 1 - Math.exp(-dt * (shot === 'tail1' || shot === 'tail2' ? 30 : 10))); c.shot = shot;
  camera.up.set(0, 1, 0); camera.lookAt(_cl);
  camera.fov += (fov - camera.fov) * (snap ? 1 : Math.min(1, dt * 3)); camera.updateProjectionMatrix();
  camPos.copy(camera.position);
}
// the overlay: their red gunsight while they lock on, and their readiness to fire on the close-up
function drawRescueHUD() {
  const c = cut, t = c.t, shot = rescueShot(t), blink = Math.floor(clock * 8) % 2 === 0;
  if (shot === 'lock') {
    const q = proj(P.pos); if (q.behind) return;
    const locked = rescueLocked(t), r = locked ? 24 : lerp(90, 30, t / 1.4), rot = locked ? 0 : t * 2.2, col = locked ? '#ff2a2a' : 'rgba(255,60,60,0.85)';
    hg.save(); hg.fillStyle = 'rgba(120,0,0,0.12)'; hg.fillRect(0, 0, W, H);   // red tint of their canopy
    hg.strokeStyle = 'rgba(255,60,60,0.5)'; hg.lineWidth = 1.2; hg.beginPath(); hg.arc(W / 2, H / 2, 70, 0, PI * 2); hg.moveTo(W / 2 - 90, H / 2); hg.lineTo(W / 2 - 50, H / 2); hg.moveTo(W / 2 + 50, H / 2); hg.lineTo(W / 2 + 90, H / 2); hg.stroke();
    hg.translate(q.x, q.y); hg.rotate(rot); hg.strokeStyle = col; hg.lineWidth = locked ? 3 : 2;
    hg.beginPath(); hg.moveTo(0, -r); hg.lineTo(r, 0); hg.lineTo(0, r); hg.lineTo(-r, 0); hg.closePath(); hg.stroke();
    if (locked) { hg.beginPath(); hg.arc(0, 0, r + 10, 0, PI * 2); hg.stroke(); }
    hg.restore();
    text('HUD · TIÊM KÍCH PHE ĐỎ', 26, 92, '#ff6b6b', 13, 'left', '800');
    text(locked ? 'LOCK ● TÊN LỬA SẴN SÀNG' : 'ĐANG KHOÁ MỤC TIÊU…', q.x, q.y - r - 18, col, 15, 'center', '800');
    text(`Ô LI 1 · ${Math.round(c.chasers[0].pos.distanceTo(P.pos))} m`, q.x, q.y + r + 22, col, 12, 'center', '700');
    if (locked && blink) text('⚠ BỊ KHOÁ', W / 2, H - 120, '#ff2a2a', 22, 'center', '900');
    if (t > 1.5) text('Ô LI 1: TĂNG TỐC TỐI ĐA', W / 2, H - 92, '#ffd23f', 14, 'center', '800');
  } else if (shot === 'aim') {
    hg.fillStyle = 'rgba(120,0,0,0.10)'; hg.fillRect(0, 0, W, H);
    if (blink) text('● FOX-2 · KHAI HOẢ', W / 2, H - 110, '#ff2a2a', 20, 'center', '900');
  }
}

// ---- the gust that gives us away, and the chase ----
function detected(byGust) {
  if (RC.detected) return;
  RC.detected = true; RC.meter = 1; RC.fightT = 0; RC.gustT = -1; RC.interceptors = [];
  if (!RC.labSeen) {   // caught before we saw anything: the whole mission was for nothing
    if (AU.ctx) for (let i = 0; i < 3; i++) tone(520, 880, 0.45, 0.07, 'sawtooth', i * 0.5);
    radio('Blackboard', 'Chúng thấy cậu rồi... Thể nào cũng giấu hết trước khi mình kịp nhìn. Về thôi, Alpha 1. Không sao đâu, mình làm lại.', true);
    missionFail('Bị radar phát hiện trước khi kịp trinh sát Phòng Thí Nghiệm');
    stealthEl.style.display = 'none';
    return;
  }
  flash('BỊ PHÁT HIỆN!', 'Radar Phe Đỏ đã bắt được Alpha 1', 2.6);
  radio('Blackboard', byGust ? 'Cơn lốc hất cậu lên rồi! Radar thấy cậu, còi khu Tây đang hú!' : 'Cao quá rồi, Alpha 1! Radar thấy cậu, còi khu Tây đang hú!', true);
  radio('Blackboard', 'Hai chiếc cất cánh, đầy tên lửa. Nghe tôi: đừng đánh. Chạy về bên này vạch phấn, tấm ảnh quan trọng hơn mọi chiến công.');
  if (AU.ctx) for (let i = 0; i < 4; i++) tone(520, 880, 0.45, 0.07, 'sawtooth', i * 0.5);
  shake = Math.min(0.7, shake + 0.3);
}
// their interceptors: tough, fast and missile-happy. Shoot one down and two more take off, so running is the only way
function scramble(n = 2, reinforce = false) {
  for (let i = 0; i < n; i++) {
    const f = makeFlyer('dart', 'red', `Tiêm kích Phe Đỏ ${++RC.chaserN}`, 0x8a1020);
    f.K = { ...f.K, veq: 9.4, gunDmg: 1.4, mslN: 99, mslLock: 0.9, mslGap: [2.2, 3.6], mslCone: 0.85, mslRange: 80, mslDmg: 22, mslSpeed: 31, mslTurn: 2.3, evade: 0.6, tough: true, chaser: true };
    f.hp = f.maxHp = 150; f.mslLeft = 99; f.mslT = rr(1.5, 3); f.flares = 2;
    f.pos.set(i ? 6 : -6, LABH.h + 2, RADAR_POS.z); orient(f, _ax.subVectors(P.pos, f.pos).setY(4)); f.speed = f.K.veq + 2;
    f.target = P; f.thinkT = 6;
    puff(smoke, f.pos, _pv.set(0, 1, 0), 1.2, 0.4, 1.4, 0xdddddd);
    RC.interceptors.push(f);
  }
  popup(reinforce ? `PHE ĐỎ CỬ THÊM ${n} TIÊM KÍCH!` : `${n} TIÊM KÍCH CẤT CÁNH TRUY ĐUỔI!`, RED, 2);
  if (reinforce) radio('Blackboard', pick(['Hạ một, chúng cho cất cánh thêm hai! Đừng ham, chạy đi!', 'Thêm bandit từ khu Tây! Không thắng nổi đâu, về qua vạch phấn!', 'Tôi biết cậu muốn đánh. Đừng. Về đây đã.']), true);
}
const _st = new THREE.Vector3();
function updateRecon(dt) {
  RC.stepT -= dt;
  for (let i = 0; i < RC.rings.length; i++) { const r = RC.rings[i]; r.mesh.material.opacity = i < RC.ringNext ? 0 : i === RC.ringNext ? 0.95 : 0.3; r.mesh.rotation.z += 0.02; }
  if (state !== 'play') { stealthEl.style.display = 'none'; return; }
  let obj = '', panel = '';

  if (RC.phase === 'tut') {
    if (pressed.KeyK) { finishTutorial(true); return; }
    const S = TUT_STEPS[RC.step];
    if ((RC.step < 0 || (S && S.doneAt != null)) && RC.stepT <= 0 && !radioQ.length) {   // next lesson, once the chatter has been said
      RC.step++;
      const N = TUT_STEPS[RC.step];
      if (!N) { finishTutorial(false); return; }
      N.doneAt = null; N.start(); radio('Wingman', N.radio, true); flash(`BÀI ${RC.step + 1}/${TUT_STEPS.length}`, N.title, 2);
    } else if (S && S.doneAt == null) {
      if (RC.rings[RC.ringNext] && P.pos.distanceTo(RC.rings[RC.ringNext].pos) < 2.6) {
        RC.ringNext++; score += 20;
        if (AU.ctx) tone(700 + RC.ringNext * 140, 1100 + RC.ringNext * 160, 0.15, 0.07, 'triangle');
      }
      RC.lowT = P.pos.y < 4 ? RC.lowT + dt : Math.max(0, RC.lowT - dt * 0.5);
      if (S.done()) {
        S.doneAt = clock; RC.stepT = 1.6; score += 50;
        if (S.bb) { const [t, who, reply] = pick(S.bb); radio('Blackboard', t); if (who) radio(who, reply); RC.stepT = 1.6 + (who ? readTime(t) : 0); }   // she cheers; now and then Wingman gets poked
        popup(`✓ ${S.title}`, '#7dff9a', 1.6); burst(P.pos, 30, [0x7dff9a, 0xffffff], 5, 1.2, 1);
        if (AU.ctx) { tone(660, 990, 0.12, 0.07, 'triangle'); tone(990, 1320, 0.16, 0.07, 'triangle', 0.12); }
      }
    }
    const C = TUT_STEPS[RC.step];
    if (C) {
      const prog = RC.step === 0 ? ` (${RC.ringNext}/${RC.rings.length})` : RC.step === 4 ? ` (${Math.min(3, RC.lowT).toFixed(1)}/3 giây · cao ${P.pos.y.toFixed(1)} m)` : '';
      obj = `HUẤN LUYỆN ${RC.step + 1}/${TUT_STEPS.length}: ${C.title}${prog}`;
      panel = `${C.hint}<br><span style="color:#ccc;font-weight:400">K: bỏ qua huấn luyện</span>`;
    }
  } else if (RC.phase === 'tutdone') {
    obj = 'Huấn luyện hoàn thành';
    if (RC.stepT <= 0 && !radioQ.length && radioT < 0.8) reconChapterDone();   // (they finish their talk first)
  } else if (RC.phase === 'brief') {
    obj = 'Chuẩn bị nhiệm vụ trinh sát…';
    if (RC.stepT <= 0 && !radioQ.length && radioT < 0.8) startSneak();
  } else if (RC.phase === 'sneak') {
    if (cut) { stealthEl.style.display = 'none'; return; }   // the scripted moments drive everything while they play
    const d = P.pos.distanceTo(RADAR_POS), fl = radarFloor(d), roof = underRoof(P.pos), fw = fwdOf(P, _fw);
    for (let j = RC.wp; j < ROUTE_PTS.length; j++) if (Math.hypot(P.pos.x - ROUTE_PTS[j][0], P.pos.z - ROUTE_PTS[j][1]) < 7) RC.wp = j + 1;
    if (!RC.labSeen && inLabDoorway(P.pos, fw)) { startLabCut(); return; }
    // radar
    let seen = RC.detected ? 0 : radarSees(P.pos);
    if (RC.gustT >= 0) {
      // turbulence: a violent whirlwind tosses the plane up and sideways, out from behind cover
      RC.gustT += dt;
      const k = Math.sin(PI * Math.min(1, RC.gustT / 2.8));
      P.pos.y += 7.5 * k * dt; P.pos.x += 3.5 * RC.gustSide * k * dt;
      if (Math.random() < dt * 4) { P.joltR = clamp(P.joltR + RC.gustSide * rr(0.4, 0.9), -1, 1); P.joltP = clamp(P.joltP + rr(0.2, 0.6), -1, 1); }
      shake = Math.max(shake, 0.25 * k);
      for (let i = 0; i < 3; i++) if (Math.random() < dt * 20) {   // a visible twister of paper scraps and dust round the plane
        const a = RC.gustT * 9 + i * 2.1, r = 2.5 + i;
        puff(smoke, _tmp.copy(P.pos).add(_pv.set(Math.cos(a) * r, rr(-3, 1), Math.sin(a) * r)), _pv.set(-Math.sin(a) * 6, 5, Math.cos(a) * 6), 0.9, 0.05, 0.12, 0xf2efe6);
      }
      seen = Math.max(seen, 1.5);
      if (RC.gustT > 2.8) detected(true);
    } else if (RC.labSeen && !RC.detected && !roof && Math.hypot(P.pos.x, P.pos.z - LABW.z) > 20 && ((RC.labT += dt) > 1.5 && fw.z > 0.2 || RC.labT > 7)) {   // clear of the lab, heading home... and the air turns on us
      RC.gustT = 0; RC.gustSide = P.pos.x > 0 ? -1 : 1; P.sonic = false;
      radio('Blackboard', 'Cẩn thận, gió xoáy! Có cơn lốc đang cuộn qua sân Tây, đừng để nó hất cậu lên!', true);
      flash('', 'GIÓ XOÁY!', 1.4);
      if (AU.ctx) noiseHit(AU.ctx.currentTime, 220, 0.6, 1.6);
    }
    if (!RC.detected) {
      if (seen) {
        RC.meter = Math.min(1, RC.meter + dt * (RC.gustT >= 0 ? 0.35 : 0.45 + 0.1 * seen));
        RC.pingT -= dt; if (RC.pingT <= 0) { RC.pingT = 0.55; if (AU.ctx) tone(1250, 1250, 0.06, 0.05, 'square'); }
        if (RC.gustT < 0) radioOnce('reconSeen', 'Blackboard', pick(['Alpha 1, radar đang quét trúng cậu! Thấp xuống, hoặc chui dưới mái hiên!', 'Cậu đang lộ đấy! Xuống thấp, nhanh!', 'Radar chạm vào cậu rồi, núp đi!']), 10);
      } else RC.meter = Math.max(0, RC.meter - dt * 0.2);
      if (RC.meter >= 1 && RC.gustT < 0) { detected(false); return; }
    }
    if (P.pos.z < ROW_N[1]) radioOnce('reconYard', 'Blackboard', 'Ra sân rồi. Trống trải lắm, cứ như đứng giữa sân cờ vậy. Bám sát đất, núp sau cây với Giếng Trời.', 999);
    if (roof && P.pos.z < ROW_S[1] + 2) radioOnce('reconIn', 'Blackboard', 'Vào hiên Dãy C rồi, dưới mái này radar mù tịt. Phòng Thí Nghiệm ngay bên cạnh, cửa mở ra phía sân đấy.', 999);
    if (!RC.labSeen && P.pos.distanceTo(RADAR_POS) < 60) radioOnce('reconNear', 'Blackboard', 'Sát chân radar rồi. Cái chảo đó không cúi xuống nhìn được đâu, yên tâm. Giờ thì chui qua cửa!', 999);
    // the chase: they can't be beaten here; get back over the half-way line
    if (RC.detected) {
      RC.fightT += dt;
      if (RC.fightT > 2.2 && !RC.interceptors.length) scramble();
      const down = RC.interceptors.filter(f => !f.alive).length;
      if (down > RC.downed) { RC.downed = down; RC.reinfT = 2.5; }   // every one shot down brings two more
      if (RC.reinfT >= 0 && (RC.reinfT -= dt) < 0) { const n = Math.min(2, 4 - RC.interceptors.filter(f => f.alive).length); if (n > 0) scramble(n, true); }   // at most four on your tail
      if (RC.interceptors.length && P.pos.z > BORDER_Z) { startRescueCut(); return; }
    }
    obj = !RC.labSeen ? `TRINH SÁT: bay xuyên Phòng Thí Nghiệm khu Tây · còn ${Math.round(P.pos.distanceTo(_st.set(0, 4, ROW_S[1])))} m`
      : RC.detected ? (RC.interceptors.length ? `BỊ LỘ! CHẠY VỀ ranh giới khu Xanh · còn ${Math.max(0, Math.round(BORDER_Z - P.pos.z))} m` : 'BỊ LỘ! Tiêm kích đang cất cánh…')
      : 'Đã thấy bí mật! Quay đầu về khu Đông, vẫn bay thấp';
    if (RC.detected) panel = `<span style="color:#ff4d4d">⚠ TIÊM KÍCH ĐUỔI THEO · CHẠY VỀ RANH GIỚI KHU XANH</span><br><span style="font-weight:400">Hạ một chiếc, chúng cử thêm hai · V: lộn vòng + pháo sáng · luồn cột Giếng Trời cắt tên lửa</span>`;
    else {
      const bar = Math.round(RC.meter * 10), col = RC.meter > 0.7 ? '#ff4d4d' : RC.meter > 0.35 ? '#ffe066' : '#9effa0';
      panel = (d > RADAR_RANGE ? `<span>Ngoài tầm radar · hạ thấp trước khi vào vùng quét</span>`
        : `<span style="color:${col}">RADAR ${'▮'.repeat(bar)}${'▯'.repeat(10 - bar)} ${seen ? '· ĐANG BỊ QUÉT!' : roof ? '· dưới mái, an toàn' : '· an toàn'}</span><br>`
          + `<span style="font-weight:400">Độ cao ${P.pos.y.toFixed(1)} m · trần an toàn ${fl.toFixed(1)} m (hoặc nấp dưới mái / sau vật cản)</span>`)
        + (RC.labSeen ? '' : `<br><span style="color:#ffd93b;font-weight:400">Bị radar bắt trước khi vào Phòng Thí Nghiệm = nhiệm vụ thất bại</span>`);
    }
  }
  if (gameMode === 'recon') $('objective').textContent = `${obj}  ·  ĐIỂM ${score}`;
  stealthEl.style.display = panel ? 'block' : 'none';
  if (panel) stealthEl.innerHTML = panel;
}

// what the HUD should point at: the lesson's ring, the next bend of the route, the lab, or home
function reconTarget(out) {
  if (gameMode !== 'recon' || cut) return null;
  const r = RC.rings[RC.ringNext];
  if (r) return [out.copy(r.pos), `VÒNG ${RC.ringNext + 1}/${RC.rings.length}`];
  if (RC.phase !== 'sneak') return null;
  if (RC.labSeen) return [out.set(clamp(P.pos.x, -60, 60), 4, BORDER_Z), RC.detected ? 'RANH GIỚI KHU XANH' : 'VỀ KHU ĐÔNG'];
  if (RC.wp < ROUTE_PTS.length) return [out.set(ROUTE_PTS[RC.wp][0], 3.5, ROUTE_PTS[RC.wp][1]), RC.wp === ROUTE_PTS.length - 1 ? 'PHÒNG THÍ NGHIỆM' : 'ĐƯỜNG BAY'];
  return [out.set(0, 4, ROW_S[1]), 'PHÒNG THÍ NGHIỆM'];
}
// minimap: the next waypoint and the radar ring
function reconMap(place, rimArrow, toS, hg) {
  if (gameMode !== 'recon') return;
  if (RC.phase === 'sneak' && !RC.detected) {
    hg.strokeStyle = 'rgba(255,80,80,0.55)'; hg.lineWidth = 1; hg.setLineDash([4, 4]); hg.beginPath();
    for (let i = 0; i <= 48; i++) { const a = i / 48 * PI * 2, [sx, sy] = toS(RADAR_POS.x + Math.cos(a) * RADAR_RANGE, RADAR_POS.z + Math.sin(a) * RADAR_RANGE); i ? hg.lineTo(sx, sy) : hg.moveTo(sx, sy); }
    hg.stroke(); hg.setLineDash([]);
  }
  const t = reconTarget(_st);
  if (!t) return;
  const p = place(t[0].x, t[0].z);
  if (p.rim) rimArrow(p, '#ffd93b');
  else { hg.strokeStyle = '#ffd93b'; hg.lineWidth = 1.4; hg.beginPath(); hg.arc(p.x, p.y, 4.5, 0, PI * 2); hg.stroke(); }
}

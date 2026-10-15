'use strict';
// Máy Bay Giấy · game state, setup, chapter flow, results, skies, levels
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Game state
// =====================================================================
let state = 'menu', paused = false, clock = 0, missionTime = 0, shake = 0, dmgFlash = 0, hitMarkT = 0, endT = 0;
let wave = -1, waveState = 'wait', waveT = 0, score = 0, kills = 0;
const MSL_PER_WAVE = 6, FLR_PER_WAVE = 10;   // realistic-ish load-out, refilled between waves
const stats = { shots: 0, hits: 0, msl: 0, dmg: 0, passes: 0, evades: 0, skim: 0, bestCombo: 0, booms: 0, pickups: 0, courses: 0, objLost: 0, sonicDmg: 0, ground: 0 };
const popups = [];   // small floating score texts on the HUD
function popup(text, color = '#fff', dur = 1.2) { popups.push({ text, color, t: dur, dur }); if (popups.length > 4) popups.shift(); }
let camMode = 0;
let P = null;
const ALLIES = [{ name: 'Alpha 2', color: 0xff8fc0, off: -9 }, { name: 'Alpha 3', color: 0x6fd0ff, off: 9 }];
// Wingman: the old hand who taught Alpha 1 to fly. Not one of the squadron: he turns up when he's needed
// (the chase home in Chương 3, the push south in Chương 7, Song Nhạn in Chương 9) and is gone again after.
// He once flew with Red Eagle; nobody says so, but it shows.
const WINGMAN = { name: 'Wingman', color: 0xb8c2cc };
function makeWingman() {
  const f = makeFlyer('ally', 'blue', WINGMAN.name, WINGMAN.color); f.guest = true;
  f.K = { ...f.K, veq: 8.4, rates: [1.7, 3.0, 0.65], gunDmg: 2.6, gunCone: 0.1, gunRange: 30, fireRate: 7, evade: 1.8 };
  f.hp = f.maxHp = 300; f.mslLeft = 2; f.flares = 4; f.noReturn = true;
  return f;
}
// Chương 11: two old classmates on opposite sides of the line, talking across the fight. A few lines when the fight
// starts and as it wears on, and one when either of them flies something the other recognises. One exchange at a time.
const BANTER = {
  hello: [['Red Eagle', '...Cậu cũng ở đây à, bạn già.'], ['Wingman', 'Tôi cũng chẳng muốn đâu, Red. Quay về đi, vẫn còn kịp.']],
  hp75: [['Red Eagle', 'Hồi đó giữa sân đâu có vạch phấn nào, phải không?'], ['Wingman', 'Hồi đó chưa ai trên cao cần đến nó.']],
  hp50: [['Wingman', 'Về đi, Red. Cậu đâu cần rơi vì một vạch phấn.'], ['Red Eagle', 'Vạch phấn là lệnh. Tôi chưa từng cãi lệnh, cậu biết mà.']],
  hp25: [['Red Eagle', 'Cậu vẫn bay cho Blackboard à?'], ['Wingman', 'Tôi bay vì mấy cậu lính mới này thôi. Vài tuần nữa là tôi nghỉ rồi.'], ['Wingman', 'Ngày xưa ba đứa mình đâu cần ai ra lệnh mới biết bay về đâu.'], ['Red Eagle', 'Ngày xưa cậu cũng chẳng bao giờ nghe lệnh. Một trong hai ta phải nghe chứ.']],
  spin: [['Wingman', 'Vẫn cú lộn hai vòng đó... bao nhiêu năm rồi vẫn không đổi.'], ['Red Eagle', 'Ha, điều này làm ta nhớ tới hồi còn học chung đấy.'], ['Wingman', 'Chúng ta có ký ức khác nhau về hồi đi học đấy, ông bạn à.']],
  zoom: [['Red Eagle', 'Bị kẹp giữa hai chiếc thì leo cao. Ai dạy tôi điều đó nhỉ?'], ['Wingman', 'Tôi dạy cậu để cùng bay, không phải để bay ngược chiều nhau.']],
  reverse: [['Wingman', 'Lộn ngược qua đầu đối thủ... hồi trước cả sân cờ vỗ tay mỗi lần cậu làm thế.'], ['Red Eagle', 'Hồi trước sân cờ chỉ có một lá cờ.']],
  // Blackboard (she was the third of them) tries to talk them out of it; both cut her off, and keep talking to each other
  cutoff: [['Blackboard', 'Wingman, Red... nghe tôi. Hai cậu dừng lại đi. Hôm nay không ai phải giao chiến cả.'],
           ['Red Eagle', '...Xin lỗi. Red Eagle, out.'], ['Wingman', 'Xin lỗi, Blackboard. Wingman out.'],
           // off her channel, just the two of them: the old argument
           ['Wingman', 'Cậu làm thế là Black buồn đấy!'], ['Red Eagle', '...Nhiệm vụ của cậu là làm cô ấy hạnh phúc. Cậu quên rồi à?'],
           ['Wingman', 'Cậu thì lúc nào cũng nghĩa vụ với mệnh lệnh nhỉ?'], ['Red Eagle', 'Bởi vậy tôi luôn ghét cái tính bốc đồng của cậu đấy, Wingman à!']],
  plea: [['Blackboard', 'Wingman? Wingman, trả lời tôi!'], ['Blackboard', '...Hai người các cậu thực sự muốn tiêu diệt nhau sao?']],
  tail: [['Red Eagle', 'Cậu vẫn bám đuôi khéo như ngày nào.'], ['Wingman', 'Ngày đó tôi bám đuôi cậu là để che cho cậu.']],
};
function banterOn() { const e = flyers.find(f => f.alive && f.kind === 'ace'); return e && gameMode !== 'counter' && !cut && state === 'play' && wingmanUp() && !e.fallen ? e : null; }
function banter(e, key) {
  const B = e.bt ||= { cd: 0, said: {}, t: 0, tailT: 0 };
  if (B.said[key] || B.cd > 0) return false;
  B.said[key] = 1; B.cd = 16; radioChain(BANTER[key], true); return true;
}
// Red Eagle gives the white plane its due: when Alpha 1 slips one of his missiles, hurts him, or holds his tail.
// Calm, a little amused, and every so often a hint of who taught it to fly
const EAGLE_PRAISE = {
  dodge: ['Né đẹp lắm, lính mới.', 'Hừm. Không tệ.', 'Lại hụt. Cậu bay chẳng giống lính mới chút nào.', 'Cú lộn đó... tôi biết ai dạy cậu rồi.'],
  hit: ['Khá lắm.', 'Cậu bắn trúng tôi rồi đấy. Người dạy cậu hẳn tự hào lắm.', 'Ha... cậu làm tôi nhớ tới một người. Hồi người đó còn bay cho vui.'],
  tail: ['Bám đuôi tôi được lâu thế này... cậu là người thứ hai đấy.', 'Bình tĩnh, không vội bóp cò. Y hệt người đã dạy cậu.'],
};
function eaglePraise(e, kind) {
  if (!e || !e.alive || e.fallen || cut || state !== 'play' || !P.alive) return;
  const B = e.praise ||= { cd: 0, used: {} };
  const pool = EAGLE_PRAISE[kind].filter(s => !B.used[s]);
  if (clock < B.cd || !pool.length) return;
  const s = pick(pool); B.used[s] = 1; B.cd = clock + 18;
  radio('Red Eagle', s);
}
function eagleSkill(a, key) { if (banterOn() === a) banter(a, key); }   // called by his AI when he flies one of his moves
function eagleBanter(dt) {
  const e = banterOn(); if (!e) return;
  const B = e.bt ||= { cd: 0, said: {}, t: 0, tailT: 0 }; B.t += dt; B.cd -= dt;
  if (B.t > 6) banter(e, 'hello');
  if (B.said.hello && B.t > 22) banter(e, 'cutoff');
  if (B.said.cutoff && B.t > 50) banter(e, 'plea');   // nobody answers
  const hp = e.hp / e.maxHp;
  for (const [k, lim] of [['hp75', 0.75], ['hp50', 0.5], ['hp25', 0.25]]) if (hp < lim && B.said.hello) banter(e, k);
  // Wingman sitting on his tail for a moment
  const w = wingmanUp(), v = _tmp.subVectors(e.pos, w.pos), d = v.length();
  B.tailT = d < 26 && v.dot(fwdOf(w, _tmp2)) > 0.88 * d ? B.tailT + dt : 0;
  if (B.tailT > 1.2) banter(e, 'tail');
}
const wingmanUp = () => flyers.find(f => f.alive && f.name === WINGMAN.name);
const mateName = () => wingmanUp() ? WINGMAN.name : 'Alpha 2';   // who calls the fight beside Alpha 1

// ---- hangar: live 360° preview of the player's plane ----
const hangar = (() => {
  const cvs = $('hangarCvs');
  const r = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, alpha: true });
  r.setPixelRatio(1); r.setSize(500, 380, false);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x9aa7b8, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 4, 3); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(32, 500 / 380, 0.1, 50); cam.position.set(0, 1.5, 4.6); cam.lookAt(0, 0, 0);
  const holder = new THREE.Group(); sc.add(holder);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: 0x1d4fa3, transparent: true, opacity: 0.12 }));
  shadow.rotation.x = -PI / 2; shadow.position.y = -0.7; sc.add(shadow);
  let mesh = null, edges = null, spin = 0, drag = null, dragVel = 0;
  function build() {
    if (mesh) { holder.remove(mesh, edges); mesh.material.dispose(); edges.material.dispose(); }
    mesh = new THREE.Mesh(PLANE_GEOS[custom.design], new THREE.MeshLambertMaterial({ color: custom.color, map: paperTex, side: THREE.DoubleSide }));
    edges = new THREE.LineSegments(PLANE_EDGES[custom.design], new THREE.LineBasicMaterial({ color: custom.edge }));
    holder.add(mesh, edges);
  }
  cvs.addEventListener('pointerdown', e => { drag = e.clientX; cvs.setPointerCapture(e.pointerId); cvs.style.cursor = 'grabbing'; });
  cvs.addEventListener('pointermove', e => { if (drag == null) return; dragVel = (e.clientX - drag) * 0.012; spin += dragVel; drag = e.clientX; });
  cvs.addEventListener('pointerup', () => { drag = null; cvs.style.cursor = 'grab'; });
  build();
  return {
    build,
    render(dt) {
      if (drag == null) { dragVel *= Math.pow(0.05, dt); spin += dt * 0.9 + dragVel; }   // steady 360° turn, with a little fling after a drag
      holder.rotation.set(0.18 * Math.sin(clock * 0.8), spin, 0.25 * Math.sin(clock * 0.6));
      holder.position.y = 0.06 * Math.sin(clock * 1.3);
      r.render(sc, cam);
    },
  };
})();
function saveCustom() { localStorage.setItem('pp_custom', JSON.stringify(custom)); }
function refreshHangar() {
  const d = PLAYER_DESIGNS[custom.design];
  document.querySelectorAll('#hDesigns .chip').forEach(c => c.classList.toggle('on', c.dataset.k === custom.design));
  document.querySelectorAll('#hBody i').forEach(c => c.classList.toggle('on', +c.dataset.c === custom.color));
  document.querySelectorAll('#hEdge i').forEach(c => c.classList.toggle('on', +c.dataset.c === custom.edge));
  const agi = (d.rm[0] + d.rm[1] + d.rm[2]) / 3;
  $('stSpd').style.width = clamp((d.veq - 6) / 3, 0.08, 1) * 100 + '%';
  $('stAgi').style.width = clamp((agi - 0.75) / 0.55, 0.08, 1) * 100 + '%';
  $('stHp').style.width = clamp((d.hp - 70) / 90, 0.08, 1) * 100 + '%';
  $('stGun').style.width = clamp((d.gunMul - 0.85) / 0.45, 0.08, 1) * 100 + '%';
  $('hDesc').textContent = d.desc;
}
{
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  for (const k in PLAYER_DESIGNS) {
    const b = document.createElement('button'); b.className = 'chip'; b.dataset.k = k; b.textContent = PLAYER_DESIGNS[k].label;
    b.onclick = () => { custom.design = k; saveCustom(); hangar.build(); refreshHangar(); };
    $('hDesigns').appendChild(b);
  }
  const swatches = (el, list, key) => {
    for (const c of list) { const i = document.createElement('i'); i.dataset.c = c; i.style.background = hex(c); i.onclick = () => { custom[key] = c; saveCustom(); hangar.build(); refreshHangar(); }; el.appendChild(i); }
    const pick = document.createElement('input'); pick.type = 'color'; pick.value = hex(custom[key]); pick.title = 'Tự chọn màu';
    pick.oninput = () => { custom[key] = parseInt(pick.value.slice(1), 16); saveCustom(); hangar.build(); refreshHangar(); };
    el.appendChild(pick);
  };
  swatches($('hBody'), [0xffffff, 0xfff3c4, 0xff5a5f, 0xff9f1a, 0xffd93b, 0x7bd389, 0x6fd0ff, 0x3d6fd8, 0xb388ff, 0xff8fc0, 0x3a3a3a], 'color');
  swatches($('hEdge'), [0x7d8da0, 0x111111, 0xffffff, 0xd62828, 0xffb703, 0x1d4fa3, 0x2a9d8f, 0xff4fa3], 'edge');
  refreshHangar();
}

$('startBtn').onclick = () => startGame();
$('againBtn').onclick = () => startGame(state === 'dead' ? Math.max(0, wave) : startChapter, playMode === 'chapter');   // shot down: retry this chapter, not the whole campaign
$('nextBtn').onclick = () => startGame(wave + 1, true);
$('chapterBtn').onclick = () => {
  const box = $('chapterList');
  if (!box.childElementCount) WAVES.forEach((W, i) => {   // built on first open (WAVES is defined further down)
    const b = document.createElement('div'); b.className = 'chap';
    b.innerHTML = `<b>${W.title}</b><span>${W.story || ''}</span><button class="chip">CHƠI ▶</button>`;
    b.querySelector('button').onclick = () => startGame(i, true);
    box.appendChild(b);
  });
  showMenuPage('chapters');
};
$('chapterBack').onclick = () => showMenuPage('menuMain');
// the menu has two pages on the same overlay: main (title, hangar, settings) and the chapter list
function showMenuPage(id) {
  $('menuMain').classList.toggle('hidden', id !== 'menuMain');
  $('chapters').classList.toggle('hidden', id !== 'chapters');
}
$('menuBtn').onclick = () => toMenu();
$('quitBtn').onclick = () => { togglePause(); toMenu(); };
$('resumeBtn').onclick = (e) => { e.stopPropagation(); togglePause(); };
$('pause').addEventListener('click', (e) => { if (e.target === $('pause')) togglePause(); });

function togglePause() {
  paused = !paused;
  $('pause').classList.toggle('hidden', !paused);
  if (!paused && state === 'play') lockPointer();
  if (paused && document.pointerLockElement) document.exitPointerLock();
  if (AU.ctx) { AU.lock.g.gain.value = 0; AU.alert.g.gain.value = 0; }
}

let bigT = 0;
function flash(main, sub = '', dur = 1.6) {
  $('big').innerHTML = `${main}${sub ? `<small>${sub}</small>` : ''}`;
  $('big').style.opacity = 1; bigT = dur;
}

function clearWorldEntities() {
  clearBombs(); clearPickups(); clearCourse(); objectives.length = 0;
  for (const f of [...flyers]) removeFlyer(f);
  for (const m of missiles) scene.remove(m.mesh); missiles.length = 0;
  for (const fl of flares) scene.remove(fl.mesh); flares.length = 0;
  bullets.forEach(b => b.alive = false);
  confetti.forEach(q => q.life = 0);
  smoke.list.forEach(q => q.life = 0); fire.list.forEach(q => q.life = 0);
  restoreSouth();   // the finale knocked their half of the school down
}
// point a plane along dir. The shortest rotation from FWD is fine for most headings, but turning the nose back north
// with any climb or dive in it goes over the top and leaves the plane on its back; then build it level instead
// (wings flat, up as close to the sky as the heading allows). Straight up or down keeps the shortest rotation
const _oX = new THREE.Vector3(), _oY = new THREE.Vector3(), _oZ = new THREE.Vector3(), _oM = new THREE.Matrix4();
function orient(f, dir) {
  _pv.copy(dir).normalize(); f.q.setFromUnitVectors(FWD, _pv);
  if (Math.abs(_pv.y) > 0.9 || _oY.set(0, 1, 0).applyQuaternion(f.q).y >= 0) return;
  _oZ.copy(_pv).negate(); _oX.crossVectors(UP, _oZ).normalize(); _oY.crossVectors(_oZ, _oX);
  f.q.setFromRotationMatrix(_oM.makeBasis(_oX, _oY, _oZ));
}

function setupScene() {
  clearWorldEntities();
  P = makeFlyer(playerKind(), 'blue', 'Alpha 1', custom.color, custom.edge);
  P.isPlayer = true; P.msl = MSL_PER_WAVE; P.pylons = [0, 0]; P.heat = 0; P.overheat = false; P.flares = FLR_PER_WAVE; P.flareCD = 0; P.lockedByT = 0; P.sonic = false; P.sonicHeat = 0; P.boomDone = false; P.wpnGun = false; P.gunMode = false; P.rapidT = 0; P.shieldT = 0;
  P.shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.22, wireframe: true, depthWrite: false }));
  P.shieldMesh.visible = false; P.obj.add(P.shieldMesh);
  P.target = null; P.lockP = 0; P.lastDmgT = -99; P.hitCD = 0;
  P.evadeCD = 0; P.evadeT = 0; P.evadeDur = 0; P.evadeRolled = 0; P.evadeFx = 0; P.boostT = 0; P.boostAcc = 0; P.evadeSide = 1; P.evadeVec = new THREE.Vector3(); P.bo = 0; P.boT = 0; P.ctlAuth = 1;
  P.pos.set(0, 4, -42); orient(P, FWD); P.speed = 7.5;
  ALLIES.forEach((a, i) => {
    const f = makeFlyer('ally', 'blue', a.name, a.color);
    f.pos.set(a.off * 0.3, 4.5 + i * 0.3, -37); orient(f, FWD);
  });
  aim.set(0, 0, -1);
}

// ---- Loading screen ----
// covers the page while the files load, and again while a mission is being built,
// so the player never sees a half-set-up world or the hitch of shaders compiling on the first frame
let loading = true;
function showLoading(text) {
  loading = true;
  $('loadTxt').textContent = text; $('loadBar').style.width = '0';
  $('loading').classList.remove('hidden', 'fade');
}
function hideLoading() {
  loading = false;
  $('loading').classList.add('fade');
  setTimeout(() => { if (!loading) $('loading').classList.add('hidden'); }, 350);
}
const afterPaint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // let the overlay show before the heavy work
async function warmUp() {   // compile every shader the scene needs now instead of mid-flight
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) {}
  renderer.render(scene, camera);
  await afterPaint();
}

async function startGame(chapter = 0, single = false) {
  if (loading) return;
  initAudio(); lockPointer();   // both need the click/keypress itself, so they go before any await
  showLoading('Đang chuẩn bị nhiệm vụ...');
  await afterPaint();
  $('loadBar').style.width = '40%';
  setupMission(chapter, single);
  $('loadBar').style.width = '80%';
  await warmUp();
  $('loadBar').style.width = '100%';
  hideLoading();
  if (state === 'play') lockPointer();   // in case Esc was pressed while it loaded
}
function setupMission(chapter, single) {
  playMode = single ? 'chapter' : 'campaign'; startChapter = chapter;
  if (paused) togglePause();
  endEscortWorld(); endReconWorld(); endCounter();
  setLabRuined(chapter > WAVES.findIndex(w => w.escort === 'lab'));   // after Chương 6 their lab is rubble
  setupScene();
  skyTo = PALETTES.morning; windOn = 0; pendingIntro = null; allyReturns.length = 0; cut = null; benched.length = 0;
  wave = chapter - 1; waveState = 'wait'; waveT = 0; score = 0; kills = 0; missionTime = 0; endT = 0;
  Object.assign(stats, { shots: 0, hits: 0, msl: 0, dmg: 0, passes: 0, evades: 0, skim: 0, bestCombo: 0, booms: 0, pickups: 0, courses: 0, objLost: 0, sonicDmg: 0, ground: 0 });
  popups.length = 0;
  gaps.forEach(g => { g.inside = false; g.lastT = -99; });
  cine.t = 0; cineCD = 0; document.body.classList.remove('cine');
  radioQ.length = 0; radioT = 0; radioHushT = 0; for (const k in radioCD) delete radioCD[k]; clearRadioLog(); beatsSaid.clear();
  // later chapters: the back-yard fights start over the back yard
  if (WAVES[chapter].area === 'back') { P.pos.set(0, 12, -60); orient(P, FWD); aim.set(0, 0, -1); flyers.filter(f => f.team === 'blue' && f !== P).forEach((f, i) => f.pos.set(i ? 6 : -6, 12, -50)); }
  $('menu').classList.add('hidden'); $('result').classList.add('hidden'); $('chapters').classList.add('hidden'); $('objective').classList.remove('hidden');
  state = 'play';
  // the chapter's scenario is built right here, behind the loading screen, so the player drops straight into it
  // (its start spot, wind, enemies, sky) instead of flying round the yard until it kicks in
  skyTo = PALETTES[WAVES[chapter].sky] || PALETTES.morning;   // the chapter's sky (its scenario may still change it)
  spawnWave(++wave);
  if (!chapter) [   // the very first take-off gets the welcome before the tutorial's first instruction
    ['Blackboard', 'Nhắc lại: không rời khuôn viên trường. Ra quá xa sẽ choáng và mất kiểm soát.'],
    ['Alpha 2', 'Alpha 2 đây. Hôm nay Alpha 1 bay một mình, chúng tôi theo dõi từ mặt đất!'],
    ['Blackboard', 'Đây là Blackboard, đài chỉ huy. Phi đội Alpha vừa thành lập. Alpha 1, chào mừng lên trời!'],
  ].forEach(([w, t]) => radio(w, t, true));
  updateSky(99);   // already under the chapter's sky, not fading into it
  if (!cut) { camFwd.copy(fwdOf(P, _fw)); camAimS.copy(aim); camPos.copy(P.pos).addScaledVector(camAimS, -2.2); updateCamera(1); }   // camera already behind the plane, no swoop in from the menu view
}
function toMenu() {
  state = 'menu'; skyTo = PALETTES.morning; windOn = false; endEscortWorld(); endReconWorld(); endCounter(); setLabRuined(false);
  if (document.pointerLockElement) document.exitPointerLock();
  $('result').classList.add('hidden'); $('objective').classList.add('hidden'); $('menu').classList.remove('hidden'); showMenuPage('menuMain');
  setupScene();
}

// ---- Waves ----
// each level has its own enemy mix, sky, and a twist
const PALETTES = {
  morning: { top: 0x3d8fdc, fog: 0xd9ecf3, hs: 0xfff4e0, hg: 0x8a7b5a, hi: 1.15, sun: 0xfff0d6, si: 2.4 },
  windy:   { top: 0x4f8fc8, fog: 0xdbe6ee, hs: 0xf2f6ff, hg: 0x7f8270, hi: 1.15, sun: 0xf6f3ea, si: 2.1 },
  noon:    { top: 0x2f86e6, fog: 0xe4f1f7, hs: 0xffffff, hg: 0x8a7b5a, hi: 1.2, sun: 0xffffff, si: 2.6 },
  sunset:  { top: 0x2b3f7a, fog: 0xf2b48a, hs: 0xffd2a8, hg: 0x6a5040, hi: 0.95, sun: 0xff9a5a, si: 2.0 },
  overcast:{ top: 0x7d8a99, fog: 0xc9cfd6, hs: 0xe8eef5, hg: 0x707070, hi: 1.25, sun: 0xdde6f0, si: 1.0 },
  dusk:    { top: 0x1c1f4a, fog: 0x8c6fa8, hs: 0xb8a8e0, hg: 0x40384a, hi: 0.95, sun: 0xffb38a, si: 1.3 },
  mist:    { top: 0xb9c3cc, fog: 0xd5dbe0, hs: 0xf0f3f6, hg: 0x8a8f86, hi: 1.3, sun: 0xf3f5f7, si: 0.9, fn: 18, ff: 95 },
  night:   { top: 0x070b24, fog: 0x141c38, hs: 0x6f80c0, hg: 0x161622, hi: 0.75, sun: 0xa8bcff, si: 0.7, fn: 50, ff: 330 },
  storm:   { top: 0x3a4250, fog: 0x7a828c, hs: 0xc7ccd4, hg: 0x4a4a48, hi: 1.05, sun: 0xcfd8e6, si: 0.8, fn: 70, ff: 360 },
};
for (const k in PALETTES) { PALETTES[k].fn ??= 140; PALETTES[k].ff ??= 620; }
const WAVES = [];   // filled by js/chapters/ch01.js ... ch12.js (one story chapter per file)
const BOSS_INTRO = {
  elite: ['SONG NHẠN', 'Hắc Nhạn & Bạch Nhạn'],
  mother: ['TÀU MẸ II', 'Chiếc chiến hạm bay thứ hai'],
  dread: ['TÀU MẸ', 'Chiến hạm bay của Phe Đỏ · đích đến: Thư Viện'],
  ace: ['RED EAGLE', ''],   // no title: the cinematics have already shown who he is
};
const skyCur = { ...PALETTES.morning }, _c1 = new THREE.Color(), _c2 = new THREE.Color();
let skyTo = PALETTES.morning, windOn = false;
const windV = new THREE.Vector3();
function updateSky(dt) {   // fade the lighting towards the current level's palette
  const k = Math.min(1, dt * 0.6);
  const mix = (a, b) => _c1.set(a).lerp(_c2.set(b), k).getHex();
  for (const key of ['top', 'fog', 'hs', 'hg', 'sun']) skyCur[key] = mix(skyCur[key], skyTo[key]);
  skyCur.hi += (skyTo.hi - skyCur.hi) * k; skyCur.si += (skyTo.si - skyCur.si) * k;
  skyCur.fn += (skyTo.fn - skyCur.fn) * k; skyCur.ff += (skyTo.ff - skyCur.ff) * k;
  scene.fog.near = skyCur.fn; scene.fog.far = skyCur.ff;
  sky.material.uniforms.top.value.set(skyCur.top); sky.material.uniforms.bot.value.set(skyCur.fog);
  FOG.set(skyCur.fog); scene.fog.color.set(skyCur.fog);
  hemi.color.set(skyCur.hs); hemi.groundColor.set(skyCur.hg); hemi.intensity = skyCur.hi;
  sun.color.set(skyCur.sun); sun.intensity = skyCur.si;
}
function applyWind(dt) {
  if (!windOn || state !== 'play') { windV.set(0, 0, 0); return; }
  const gust = 0.6 + 0.4 * Math.sin(clock * 0.7) + 0.35 * Math.sin(clock * 2.3 + 1);
  windV.set(-2.4 * gust * windOn, 0.25 * (windOn - 1) * Math.sin(clock * 1.7), 0.6 * windOn * Math.sin(clock * 0.3));
  for (const f of flyers) if (f.alive) f.pos.addScaledVector(windV, dt);
  for (const b of bullets) if (b.alive) b.v.addScaledVector(windV, dt * 0.8);
  if (Math.random() < dt * 25) puff(smoke, _tmp.copy(P.pos).add(_pv.set(rr(6, 12), rr(-3, 4), rr(-10, 4))), _pv.copy(windV).multiplyScalar(2.5), 1.2, 0.03, 0.05, 0xffffff);
}
let playMode = 'campaign', startChapter = 0;   // 'campaign' = chapter 1 to the end, 'chapter' = one chapter only
function showStory(i) {
  const W = WAVES[i]; if (!W || !W.story) return;
  $('storyT').textContent = W.title; $('storyB').textContent = W.story;
  const c = $('storyCard'); c.classList.remove('hidden'); c.style.opacity = 1;
  clearTimeout(showStory.t1); clearTimeout(showStory.t2);
  showStory.t1 = setTimeout(() => { c.style.opacity = 0; }, 6500);
  showStory.t2 = setTimeout(() => c.classList.add('hidden'), 7200);
}
const benched = [];   // wingmen left at school for a chapter with a smaller flight
// extra wingmen for one chapter only (W.reinforce): they take off with us and head home when it's over
function addReinforcements(W) {
  (W.reinforce || []).forEach(([name, color], i) => {
    if (flyers.some(f => f.alive && f.name === name)) return;
    const f = makeFlyer('ally', 'blue', name, color); f.temp = true;
    f.pos.copy(P.pos).add(_pv.set((i % 2 ? 1 : -1) * (10 + 4 * (i >> 1)), 1 + i * 0.6, 8 + 5 * (i >> 1))); orient(f, fwdOf(P, _tmp)); f.speed = 9;
  });
}
function setFlight(W) {
  if (W.flight) {
    for (const f of [...flyers]) if (f.alive && f.kind === 'ally' && !W.flight.includes(f.name)) { if (!f.guest) benched.push(f.name); removeFlyer(f); }
    for (const n of W.flight) if (!flyers.some(f => f.alive && f.name === n)) {
      if (n === WINGMAN.name) { const f = makeWingman(); f.pos.copy(P.pos).add(_pv.set(6, 1, 6)); orient(f, fwdOf(P, _tmp)); continue; }
      const a = ALLIES.find(x => x.name === n); if (a) { const f = makeFlyer('ally', 'blue', a.name, a.color); f.pos.copy(P.pos).add(_pv.set(-6, 1, 6)); orient(f, fwdOf(P, _tmp)); } }
  } else {
    for (const f of [...flyers]) if (f.alive && f.guest) removeFlyer(f);   // Wingman only flies the chapters that need him
  }
  if (!W.flight) while (benched.length) {   // they're back for the next chapter
    const n = benched.pop(), a = ALLIES.find(x => x.name === n);
    if (a && !flyers.some(f => f.alive && f.name === n)) { const f = makeFlyer('ally', 'blue', a.name, a.color); f.pos.copy(P.pos).add(_pv.set(6, 1, 8)); orient(f, fwdOf(P, _tmp)); radio(a.name, `${a.name} trở lại đội hình!`); }
  }
}
function spawnWave(i) {
  const W = WAVES[i];
  setFlight(W); addReinforcements(W);
  if (W.msl) P.msl = Math.max(P.msl, W.msl);   // a big fight: a bigger load-out
  resupplyT = W.resupply || 0;
  showStory(i);
  if (W.escort) { startEscort(W.escort); return; }
  if (W.recon) { startRecon(W.recon); return; }
  if (W.counter) { startCounter(); return; }
  waveState = 'active';
  flash(W.title, 'Bắn hạ tất cả máy bay địch', 2.4);
  if (!W.cutscene) W.radio.forEach(([w, t]) => radio(w, t));   // with a cutscene, the chatter comes after it
  skyTo = PALETTES[W.sky] || PALETTES.morning; windOn = W.wind || 0;
  setObjectives(W.defend);
  let n = 0;
  for (const [kind, count] of W.spawn) for (let k = 0; k < count; k++, n++) {
    const f = makeFlyer(kind, 'red', kind === 'ace' ? 'Red Eagle' : kind === 'elite' ? ['Hắc Nhạn', 'Bạch Nhạn'][k % 2] : `${KINDS[kind].label} ${k + 1}`, kind === 'elite' ? [0x1e1e24, 0xf4f4f4][k % 2] : undefined);
    f.pos.copy(findSpawn(30, 80, W.area));
    orient(f, _ax.subVectors(P.pos, f.pos));
    if (kind === 'dread') { f.pos.set(0, 30, SCHOOL.zS + 30); orient(f, _ax.set(0.001, 0, 1)); f.mslT = 4; f.spawnT = 8; }   // takes off from their courtyard
    else if (W.spawn.some(s => s[0] === 'dread')) { f.pos.set(rr(-30, 30), rr(18, 26), SCHOOL.zS + rr(40, 90)); orient(f, _ax.set(0.001, 0, 1)); }   // its escorts, in formation round it
    f.speed = f.K.veq;
    if (kind === 'ace') { f.rage = 1; f.phase = 1; f.mslLeft += 2; f.flares += 6; }   // no rage phases: he flies at full strength, the same, from the first pass to the last
    if (W.cutscene === 'eagle' && kind === 'ace') startEagleCutscene(f);
    else if (W.boss === kind && !W.cutscene) pendingIntro = { f, t: 1.4 };   // let the level title read first
  }
  if (W.cutscene === 'twins') { const tw = flyers.filter(f => f.alive && f.kind === 'elite'); startTwinsCut(tw.find(f => f.name === 'Bạch Nhạn'), tw.find(f => f.name === 'Hắc Nhạn')); }
}
let pendingIntro = null;
const allyReturns = [];   // wingmen re-folding a plane after being shot down in the boss fight
function findSpawn(minD, maxD, area) {
  // 'front' = the yard (they come in from the south half), 'back' = our north courtyard, 'rival' = their south side
  area = area || (P.pos.z < -640 ? 'rival' : P.pos.z > -160 ? 'back' : 'front');
  const back = area === 'back';
  for (let i = 0; i < 120; i++) {
    const p = new THREE.Vector3(rr(-55, 55), rr(6, 16), area === 'rival' ? rr(-560, -750) : back ? rr(-45, -140) : rr(-230, -600));
    const d = p.distanceTo(P.pos);
    if ((i > 90 || (d >= minD && d <= maxD)) && !pointBlocked(p, 2.5)) return p;
  }
  return new THREE.Vector3(0, 16, back ? -95 : area === 'rival' ? -705 : -400);
}
let resupplyT = 0;
const beatsSaid = new Set();
function updateWaves(dt) {
  eagleBanter(dt);
  for (let i = allyReturns.length - 1; i >= 0; i--) {
    const r = allyReturns[i]; r.t -= dt;
    if (r.t > 0) continue;
    allyReturns.splice(i, 1);
    if (state !== 'play') continue;
    const f = makeFlyer('ally', 'blue', r.name, r.color); f.pos.copy(P.pos).add(_pv.set(rr(-8, 8), 4, 10)); f.pos.y = Math.max(f.pos.y, 6); orient(f, fwdOf(P, _tmp)); f.speed = 8;
    radio(r.name, `${r.name} đã có máy bay mới, trở lại đội hình!`, true);
  }
  if (gameMode === 'escort') { updateEscort(dt); return; }
  if (gameMode === 'recon') { updateRecon(dt); return; }
  if (gameMode === 'counter') { updateCounter(dt); return; }
  if (pendingIntro && (pendingIntro.t -= dt) <= 0) {
    const { f } = pendingIntro; pendingIntro = null;
    if (f.alive && state === 'play') bossIntro(f, ...BOSS_INTRO[f.kind]);
  }
  const enemies = flyers.filter(f => f.alive && f.team === 'red');
  // mid-fight conversations (W.beats: [enemies left, lines]): played once each, and only if everyone speaking is still flying
  if (waveState === 'active' && WAVES[wave] && WAVES[wave].beats) WAVES[wave].beats.forEach(([left, lines], k) => {
    if (enemies.length > left || beatsSaid.has(wave + ':' + k)) return;
    beatsSaid.add(wave + ':' + k);
    if (lines.every(([w]) => !ALLIES.some(a => a.name === w) || flyers.some(f => f.alive && f.name === w))) lines.forEach(([w, t]) => radio(w, t));   // queued behind what's on air, in order
  });
  if (waveState === 'wait') {
    waveT -= dt;
    if (waveT <= 0) spawnWave(++wave);
  } else if (enemies.length > 0 && WAVES[wave] && WAVES[wave].resupply && (resupplyT -= dt) <= 0) {   // missile crates dropped in ahead of us
    resupplyT = WAVES[wave].resupply;
    const p = _tmp.copy(P.pos).addScaledVector(fwdOf(P, _fw).setY(0).normalize(), 35); p.y = clamp(p.y, 6, 20); p.x = clamp(p.x, -60, 60); p.z = clamp(p.z, SCHOOL.zS + 20, SCHOOL.zN - 20);
    spawnPickup(lowSpot(p, 0, 50) || p.clone(), 'resupply', 'msl'); popup('THÙNG TIẾP TẾ TÊN LỬA!', '#ffd93b', 1.6);
  } else if (enemies.length === 0) {
    for (const f of [...flyers]) if (f.temp) removeFlyer(f);   // the extra wingmen head back to base
    if (playMode === 'chapter') chapterComplete();
    else if (wave >= WAVES.length - 1) missionComplete();
    else {
      waveState = 'wait'; waveT = 13; startCourse();
      const saved = objectives.filter(o => o.alive).length;
      if (objectives.length) { score += saved * 200; popup(`Giữ được ${saved}/${objectives.length} mục tiêu · +${saved * 200}`, '#7fb8ff', 2.5); }
      setObjectives(null); windOn = false;
      P.hp = Math.min(P.maxHp, P.hp + 40); P.flares = Math.max(P.flares, FLR_PER_WAVE); P.msl = Math.max(P.msl, MSL_PER_WAVE);
      flash('KHU VỰC AN TOÀN', `Đã vá giấy (+40 HP) · nạp đủ ${MSL_PER_WAVE} tên lửa, ${FLR_PER_WAVE} pháo sáng`, 2.2);
      { const nx = WAVES[wave + 1];
        radio('Blackboard', nx.escort === 'lab' ? 'Chuẩn bị nhiệm vụ đặc biệt: lần đầu tiên, Hạc Lớn sẽ cất cánh.' : nx.escort ? 'Red Eagle đã bị hạ, không quân Phe Đỏ tan rã. Chuẩn bị phản công: hộ tống Hạc Lớn sang khu Đỏ!'
          : nx.boss ? 'Radar bắt một tín hiệu rất mạnh... tất cả, sẵn sàng chiến đấu!'
          : pick(['Khu vực sạch. Đừng thả lỏng, đợt tiếp theo đang đến.', 'Gọn gàng! Radar thấy contact mới, kiểu gấp lạ.', 'Làm tốt. Khu Tây vừa phóng thêm một lứa mới.'])); }
    }
  }
  const objTxt = objectives.length ? ` · Bảo vệ: ${objectives.map(o => o.alive ? `${o.name} ${Math.max(0, Math.round(o.hp))}%` : `${o.name} ✗`).join(', ')}` : '';
  const tgtText = waveState === 'active' ? `${WAVES[wave].title} · Còn ${enemies.length} địch${objTxt}${windOn ? ' · GIÓ MẠNH ←' : ''}` : wave < 0 ? 'Chuẩn bị chiến đấu…' : `Đợt tiếp theo sau ${Math.ceil(waveT)} giây`;
  $('objective').textContent = `${tgtText}  ·  ĐIỂM ${score}`;
}

function damage(f, amt, src) {
  if (!f.alive) return;
  if (f === P && P.invulnT > 0) return;
  if (cut && f === cut.boss) return;   // untouchable while his entrance plays
  if (cut && cut.kind === 'nuke' && f.team === 'blue') return;   // nothing touches the bomb run
  if (src && src.kind === 'ace' && f.name === WINGMAN.name) {   // he won't fire on his old wingman
    if (gameMode === 'counter') radioOnce('eagleSpares', 'Alpha 3', 'Lạ thật... hắn lướt ngay qua mũi Wingman mà không bắn một viên nào.', 60);
    return;
  }
  if (f.kind === 'ace' && src === P) {   // a missile, or a solid burst of guns, makes him say something
    f.pHurt = (clock - (f.pHurtT || -9) < 2.5 ? f.pHurt || 0 : 0) + amt; f.pHurtT = clock;
    if (f.pHurt >= 40 && f.hp > amt) { f.pHurt = 0; eaglePraise(f, 'hit'); }   // (not on the shot that brings him down)
  }
  if (f === P && P.shieldT > 0) { amt *= 0.3; if (P.shieldMesh) P.shieldMesh.material.opacity = 0.5; }
  if (gameMode === 'counter') {   // Chương 7: nobody brings Red Eagle down today, and he's merciless but not instant
    if (f.kind === 'ace') { if (amt > 0) burst(f.pos, 2, [f.colorHex, 0xdddddd], 3, 0.3, 0.3); f.hp = Math.max(f.maxHp * 0.4, f.hp - amt * 0.6); f.lastHitBy = src; f.lastHitT = clock; return; }   // six on one is a fair fight to him: the hits land and the paper tears, but he doesn't go down
    if (src && src.kind === 'ace' && f === P) amt *= 0.5;
    if (f.plotArmor) amt = Math.min(amt, Math.max(0, f.hp - f.maxHp * 0.15));
  }
  if (f.kind === 'ace' && f.team === 'red') {
    // "giáp giấy kép": one plane alone barely scratches him; two close together tear through, three even better
    const near = flyers.filter(o => o.alive && o.team === 'blue' && o.pos.distanceTo(f.pos) < 40).length;
    amt *= near >= 3 ? 1.2 : near >= 2 ? 1 : 0.3;
    if (src === P && amt > 0 && amt < 3) {   // shown, not told: rounds glance off with grey sparks and a tink
      burst(f.pos, 3, [0x9a9a9a, 0xdddddd], 3, 0.3, 0.3);
      if (AU.ctx && clock - (f.tinkT || -9) > 0.12) { f.tinkT = clock; tone(2400, 1800, 0.05, 0.05, 'triangle'); }
      if (near < 2 && clock - (f.lastSoloHitT || -99) > 0.5) { f.lastSoloHitT = clock; f.soloHits = (f.soloHits || 0) + 1; }
      if (f.soloHits > 12) radioOnce('armourSolo', 'Alpha 3', 'Alpha 1, đạn một chiếc không xuyên nổi! Chờ chúng tôi áp sát cùng bắn!', 40);
    } else if (src && src.team === 'blue' && near >= 2) radioOnce('armourPair', 'Alpha 2', 'Cùng bắn thì xuyên được! Giấy hắn rách rồi, ép sát!', 40);
  }
  const hp0 = f.hp;
  f.hp -= amt; f.lastHitBy = src; f.lastHitT = clock;
  // which wing took it: the side facing the shooter (a bit random), so tears build up lopsided
  if (amt > 0) {
    let s = rr(-1, 1);
    if (src && src.pos && src !== f) s = Math.sign(rightOf(f, _pv).dot(_tmp.subVectors(src.pos, f.pos)) || 1) * rr(0.3, 1);
    f.tearBias = clamp((f.tearBias || 0) + s * Math.min(0.5, amt / f.maxHp * 4), -1, 1);
    burst(f.pos, Math.min(8, 1 + Math.round(amt / 3)), [f.colorHex, 0xf4f1e8], 2.5, 0.9, 0.6);   // paper shreds
  }
  if (f === P && amt > 0) {
    const k = Math.min(0.9, amt / 18);   // the hit knocks the plane around a little
    P.joltR = clamp(P.joltR + rr(0.5, 1) * Math.sign(P.tearBias || rr(-1, 1)) * k, -1, 1); P.joltP = clamp(P.joltP + rr(-0.5, 0.5) * k, -1, 1);
    const f0 = hp0 / P.maxHp, f1 = P.hp / P.maxHp;
    if (P.hp > 0 && f0 >= 0.5 && f1 < 0.5) popup('CÁNH BỊ RÁCH — MÁY BAY KHÓ LÁI!', RED, 1.6);
    else if (P.hp > 0 && f0 >= 0.25 && f1 < 0.25) popup('CÁNH RÁCH NẶNG — TÌM BĂNG KEO!', RED, 1.8);
  }
  if (f === P) {
    stats.dmg += amt; dmgFlash = Math.min(1, dmgFlash + amt / 22); shake = Math.min(0.7, shake + amt / 35); P.lastDmgT = clock;
    hurtSound();
    if (src && src.team === 'red' && P.hp > 0) radioOnce('tail', pick(['Alpha 2', 'Alpha 3', 'Blackboard']), 'Alpha 1, trúng đạn từ phía sau! Break, break!', 14);
  }
  if (src === P && f !== P) hitMarkT = 0.15;
  if (f.kind === 'ace' && f.hp < f.maxHp * 0.35) radioOnce('aceLow', 'Alpha 2', 'Red Eagle hư hại nặng! Ép tiếp, sắp hạ được rồi!', 999);
  if (f.hp <= 0 && f.kind === 'ace' && f.team === 'red' && gameMode !== 'counter' && !f.fallen && wingmanUp() && state === 'play') { f.hp = 1; f.fallen = true; f.lastHitBy = src; startEagleFall(f); return; }
  if (f.hp <= 0) destroy(f, src);
}
function destroy(f, src, crashed = false) {
  f.alive = false; f.falling = true; f.hp = 0;
  f.spin.set(rr(-3, 3), rr(-2, 2), rr(-7, 7));
  explosion(f.pos, f.K.scale * 2.2);
  burst(f.pos, 40, [f.colorHex, 0xffffff, 0xdddddd], 4, 2.5, 1.5);
  if (f === P) { playerDown(); return; }
  if (f.K.turrets) shipDown(f);
  if (f.team === 'red') {
    const credit = src === P || (f.lastHitBy === P && clock - f.lastHitT < 8);
    if (credit && (f.K.mslN || 0) > 0 && (P.msl <= 3 || Math.random() < 0.5)) {
      spawnPickup(f.pos.clone().setY(Math.max(3, f.pos.y)), 'loot'); popup('ĐỊCH RƠI HỘP TÊN LỬA!', '#ffd93b', 1.2);
    } else if (credit && Math.random() < (P.hp < P.maxHp * 0.4 ? 0.35 : 0.2)) {
      const type = P.hp < P.maxHp * 0.4 && Math.random() < 0.6 ? 'repair' : pick(['repair', 'rapid', 'shield']);
      spawnPickup(f.pos.clone().setY(Math.max(3, f.pos.y)), 'loot', type); popup(`ĐỊCH RƠI ${PICKUP_TYPES[type].label}!`, PICKUP_TYPES[type].css, 1.2);
    }
    if (credit && f === P.target && P.tailT > 0.6) { score += 50; popup('BÁM ĐUÔI HẠ GỌN +50', '#9effa0', 1.2); }
    if (credit) {
      // combo: kills within 6 s of each other multiply the points (x1.5, x2, ... up to x3)
      P.combo = P.comboT > 0 ? P.combo + 1 : 1; P.comboT = 6; stats.bestCombo = Math.max(stats.bestCombo, P.combo);
      const mult = Math.min(3, 1 + (P.combo - 1) * 0.5), pts = Math.round((f.K.points + (crashed ? 50 : 0)) * mult);
      score += pts; kills++;
      flash(crashed ? 'ĐỊCH ĐÂM RƠI!' : 'BẮN HẠ!', `${f.name} · +${pts}${P.combo > 1 ? ` · CHUỖI ×${mult}` : ''}`, 1.4);
      if (P.combo > 1) { popup(`CHUỖI ${P.combo} · ×${mult}`, '#ff9f1a', 1.6); if (AU.ctx) tone(600 + P.combo * 120, 1400 + P.combo * 150, 0.25, 0.08, 'triangle'); }
      if (f.kind === 'ace' && f.fallen) { /* the farewell already played (startEagleFall) */ }
      else if (f.kind === 'ace') { radio('Blackboard', 'Splash Red Eagle! Hắn rơi rồi! Tuyệt vời, Alpha 1!', true); radioChain([['Red Eagle', 'Mấy quả bom đó... xin các anh đừng thả. Bên dưới đó cũng là giấy của các anh.'], ['Red Eagle', 'Nói với cậu ấy... tôi đã giữ lời. Tôi chưa từng bắn cậu ấy.']]); }
      else if (f.kind === 'elite') { const mate = flyers.find(x => x.alive && x.kind === 'elite'); radio(mate ? mateName() : 'Blackboard', mate ? `Splash ${f.name}! ${mate.name} đang lao thẳng vào Alpha 1!` : 'Song Nhạn đã rơi cả hai! Alpha 1, xác nhận át chủ bài!', true); if (!mate && wingmanUp()) radio('Wingman', 'Cả hai chiếc... Khá lắm, lính mới. Tôi nói thật đấy.'); }
      else if (Math.random() < 0.6) { const [w, t] = pick(KILL_LINES); radio(w, t); }
    } else if (crashed) radio('Blackboard', `${f.name} tự đâm vào địa hình!`);
    else if (src && src.team === 'blue' && !(cut && cut.kind === 'rescue')) radio(src.name, pick(['Splash one!', 'Trúng! Hạ một chiếc!', 'Thêm một bandit xuống đất!']));   // the rescue has its own lines
  } else if (f.team === 'blue') {
    radio('Blackboard', `${f.name} rơi! ${f.name}, báo cáo tình trạng!`, true);
    if (f.kind === 'ally' && !f.noReturn && flyers.some(o => o.alive && o.kind === 'ace')) { allyReturns.push({ name: f.name, color: f.colorHex, t: 15 }); popup(`${f.name} RƠI · GẤP LẠI MÁY BAY, 15s NỮA QUAY LẠI`, YEL, 2); }
  }
}
function crash(f) { destroy(f, f.lastHitBy, true); }
function playerDown() {
  state = 'dead'; endT = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  radio('Blackboard', 'Alpha 1 rơi! Alpha 1, Blackboard gọi, trả lời!', true);
  flash('MÁY BAY BỊ HẠ', '', 2.5);
}
function chapterComplete() {
  state = 'won'; endT = 0;
  const last = wave >= WAVES.length - 1;
  radio('Blackboard', last ? 'Cuộc chiến kết thúc. Tất cả phi đội, RTB. Về tổ thôi!' : 'Nhiệm vụ hoàn thành. Tất cả, RTB. Phe Đỏ chưa chịu thua đâu.', true);
  flash('CHƯƠNG HOÀN THÀNH', WAVES[wave].title, 3);
}
function missionComplete() {
  state = 'won'; endT = 0;
  if (gameMode !== 'escort') radio('Blackboard', 'Cuộc chiến kết thúc. Tất cả phi đội, RTB. Về tổ thôi!', true);
  if (gameMode === 'escort') { flash('CHIẾN TRANH KẾT THÚC', 'Nhưng ai mới là người chiến thắng?', 3.5); return; }   // a quiet end, no confetti
  flash('NHIỆM VỤ HOÀN THÀNH', 'Mission Accomplished', 3);
  for (let i = 0; i < 4; i++) setTimeout(() => burst(P.pos.clone().add(new THREE.Vector3(rr(-6, 6), rr(2, 6), rr(-6, 6))), 60, [0xff4757, 0xffd93b, 0x2ed573, 0x1e90ff, 0xffffff], 12, 3, 4), i * 350);
}
function showResult(won) {
  if (document.pointerLockElement) document.exitPointerLock();
  const acc = stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0;
  const single = playMode === 'chapter';
  const timeBonus = won ? Math.max(0, Math.round(((single ? 150 : 1000) - missionTime) * 5)) : 0;
  const hpBonus = won ? Math.round(P.hp * 5) : 0;
  const total = score + timeBonus + hpBonus;
  const rank = !won ? 'F' : single ? (total >= 1800 ? 'S' : total >= 1300 ? 'A' : total >= 900 ? 'B' : 'C') : total >= 10000 ? 'S' : total >= 8000 ? 'A' : total >= 6000 ? 'B' : 'C';
  $('resRank').textContent = rank;
  $('resTitle').textContent = single ? (won ? `Chương ${wave + 1} hoàn thành!` : `Chương ${wave + 1} thất bại`) : won ? 'Nhiệm vụ hoàn thành!' : 'Nhiệm vụ thất bại';
  const hasNext = single && won && wave < WAVES.length - 1;
  $('nextBtn').classList.toggle('hidden', !hasNext);
  if (hasNext) $('nextBtn').textContent = `CHƯƠNG ${wave + 2} ▶`;
  $('resSub').textContent = won && single && wave < WAVES.length - 1 ? (WAVES[wave + 1].story || '') : won ? 'Chiến tranh máy bay giấy kết thúc. Khu Tây chỉ còn tro giấy... và một câu hỏi chưa ai trả lời.' : (P.failReason || 'Máy bay giấy của bạn đã bị xé nát…');
  const rows = [['Thời gian', fmt(missionTime)], ['Số địch bắn hạ', kills], ['Độ chính xác súng', acc + '%'], ['Tên lửa đã bắn', stats.msl], ['Pha luồn lách', stats.passes], ['Né tên lửa hoàn hảo', stats.evades], ['Chuỗi hạ dài nhất', stats.bestCombo], ['Lướt sát đất', stats.skim], ['Phá bức tường âm thanh', stats.booms], ['Giấy rách vì siêu thanh', Math.round(stats.sonicDmg)], ...(gameMode === 'escort' ? [['Phòng không bị phá', stats.ground], ['Hạc Lớn còn lại', heron ? Math.max(0, Math.round(heron.hp)) + ' / ' + heron.maxHp : '—']] : []), ['Vật phẩm đã nhặt', stats.pickups], ['Đường bay vòng hoàn hảo', stats.courses], ['Sát thương nhận', Math.round(stats.dmg)],
    ['Điểm hạ địch', score], ['Thưởng thời gian', timeBonus], ['Thưởng độ bền', hpBonus], ['TỔNG ĐIỂM', total]];
  // personal best & medals
  const best = +(localStorage.getItem('pp_best') || 0), isBest = total > best;
  if (isBest) localStorage.setItem('pp_best', String(total));
  const medals = [
    [kills >= 20, '🏅 Át chủ bài (20 hạ)'], [stats.bestCombo >= 4, '🔗 Chuỗi ×4'], [stats.booms >= 3, '💥 Phá tường âm thanh ×3'],
    [acc >= 35, '🎯 Thiện xạ (≥35%)'], [stats.skim >= 10, '🪶 Lướt đất'], [won && stats.objLost === 0, '🛡 Người gác cờ'],
    [stats.courses >= 3, '⭕ Phi công nhào lộn'], [won && stats.dmg < 150, '🧻 Giấy còn phẳng phiu'],
  ].filter(m => m[0]).map(m => m[1]);
  rows.push(['Kỷ lục cá nhân', isBest ? `${total} · KỶ LỤC MỚI!` : Math.max(best, total)]);
  rows.push(['Huy chương', medals.length ? medals.join('<br>') : '—']);
  $('resTable').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td class="v">${v}</td></tr>`).join('');
  $('result').classList.remove('hidden');
}
const fmt = (t) => { const m = Math.floor(t / 60), s = Math.floor(t - m * 60); return `${m}:${s < 10 ? '0' : ''}${s}`; };

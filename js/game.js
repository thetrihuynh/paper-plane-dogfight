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
const ALLIES = [{ name: 'Lan', color: 0xff8fc0, off: -9 }, { name: 'Minh', color: 0x6fd0ff, off: 9 }];

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
  $('chapters').classList.toggle('hidden');
};
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
}
function orient(f, dir) { f.q.setFromUnitVectors(FWD, _pv.copy(dir).normalize()); }

function setupScene() {
  clearWorldEntities();
  P = makeFlyer(playerKind(), 'blue', 'Ô Li 1', custom.color, custom.edge);
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

function startGame(chapter = 0, single = false) {
  playMode = single ? 'chapter' : 'campaign'; startChapter = chapter;
  initAudio();
  if (paused) togglePause();
  endEscortWorld(); endReconWorld();
  setLabRuined(chapter > WAVES.findIndex(w => w.escort === 'lab'));   // after Chương 6 their lab is rubble
  setupScene();
  skyTo = PALETTES.morning; windOn = 0; pendingIntro = null; allyReturns.length = 0; cut = null; benched.length = 0;
  wave = chapter - 1; waveState = 'wait'; waveT = WAVES[chapter] && WAVES[chapter].recon ? 1.5 : chapter ? 6 : 4; score = 0; kills = 0; missionTime = 0; endT = 0;
  Object.assign(stats, { shots: 0, hits: 0, msl: 0, dmg: 0, passes: 0, evades: 0, skim: 0, bestCombo: 0, booms: 0, pickups: 0, courses: 0, objLost: 0, sonicDmg: 0, ground: 0 });
  popups.length = 0;
  gaps.forEach(g => { g.inside = false; g.lastT = -99; });
  cine.t = 0; cineCD = 0; document.body.classList.remove('cine');
  radioQ.length = 0; radioT = 0; for (const k in radioCD) delete radioCD[k];
  if (!chapter) {
    radio('Bảng Đen', 'Đây là đài chỉ huy Bảng Đen. Phi đội Ô Li vừa thành lập, chào mừng Ô Li 1 lên trời!');
    radio('Lan', 'Ô Li 2 đây! Hôm nay cậu bay một mình, tụi tớ ở dưới sân cổ vũ nhé!');
    radio('Bảng Đen', 'Nhắc lại: không bay ra khỏi khuôn viên trường. Ra xa quá các em sẽ choáng và mất kiểm soát!');
  } else {
    radio('Bảng Đen', `Phi đội Ô Li, cất cánh! ${WAVES[chapter].title}.`);
    skyTo = PALETTES[WAVES[chapter].sky] || PALETTES.morning;   // start under that chapter's sky
    // later chapters: the back-yard fights start over the back yard
    if (WAVES[chapter].area === 'back') { P.pos.set(0, 12, -60); orient(P, FWD); aim.set(0, 0, -1); flyers.filter(f => f.team === 'blue' && f !== P).forEach((f, i) => f.pos.set(i ? 6 : -6, 12, -50)); }
  }
  $('menu').classList.add('hidden'); $('result').classList.add('hidden'); $('chapters').classList.add('hidden'); $('objective').classList.remove('hidden');
  if (chapter) showStory(chapter);
  state = 'play';
  lockPointer();
}
function toMenu() {
  state = 'menu'; skyTo = PALETTES.morning; windOn = false; endEscortWorld(); endReconWorld(); setLabRuined(false);
  if (document.pointerLockElement) document.exitPointerLock();
  $('result').classList.add('hidden'); $('objective').classList.add('hidden'); $('menu').classList.remove('hidden');
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
  elite: ['SONG ƯNG', 'Hắc Ưng & Bạch Ưng'],
  mother: ['TÀU MẸ II', 'Chiếc chiến hạm bay thứ hai'],
  dread: ['TÀU MẸ', 'Chiến hạm bay của Phe Đỏ · đích đến: Thư Viện'],
  ace: ['ĐẠI BÀNG ĐỎ', 'Át chủ bài của Phe Đỏ'],
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
function setFlight(W) {
  if (W.flight) {
    for (const f of [...flyers]) if (f.alive && f.kind === 'ally' && !W.flight.includes(f.name)) { benched.push(f.name); removeFlyer(f); }
    for (const n of W.flight) if (!flyers.some(f => f.alive && f.name === n)) { const a = ALLIES.find(x => x.name === n); if (a) { const f = makeFlyer('ally', 'blue', a.name, a.color); f.pos.copy(P.pos).add(_pv.set(-6, 1, 6)); orient(f, fwdOf(P, _tmp)); } }
  } else while (benched.length) {   // they're back for the next chapter
    const n = benched.pop(), a = ALLIES.find(x => x.name === n);
    if (a && !flyers.some(f => f.alive && f.name === n)) { const f = makeFlyer('ally', 'blue', a.name, a.color); f.pos.copy(P.pos).add(_pv.set(6, 1, 8)); orient(f, fwdOf(P, _tmp)); radio(a.name, `${a.name} quay lại đội hình đây!`); }
  }
}
function spawnWave(i) {
  const W = WAVES[i];
  setFlight(W);
  showStory(i);
  if (W.escort) { startEscort(W.escort); return; }
  if (W.recon) { startRecon(W.recon); return; }
  waveState = 'active';
  flash(W.title, 'Bắn hạ tất cả máy bay địch', 2.4);
  if (!W.cutscene) W.radio.forEach(([w, t]) => radio(w, t));   // with a cutscene, the chatter comes after it
  skyTo = PALETTES[W.sky] || PALETTES.morning; windOn = W.wind || 0;
  setObjectives(W.defend);
  let n = 0;
  for (const [kind, count] of W.spawn) for (let k = 0; k < count; k++, n++) {
    const f = makeFlyer(kind, 'red', kind === 'ace' ? 'Đại Bàng Đỏ' : kind === 'elite' ? ['Hắc Ưng', 'Bạch Ưng'][k % 2] : `${KINDS[kind].label} ${k + 1}`, kind === 'elite' ? [0x1e1e24, 0xf4f4f4][k % 2] : undefined);
    f.pos.copy(findSpawn(30, 80, W.area));
    orient(f, _ax.subVectors(P.pos, f.pos));
    if (kind === 'dread') { f.pos.set(0, 30, SCHOOL.zS + 30); orient(f, _ax.set(0.001, 0, 1)); f.mslT = 4; f.spawnT = 8; }   // takes off from their courtyard
    else if (W.spawn.some(s => s[0] === 'dread')) { f.pos.set(rr(-30, 30), rr(18, 26), SCHOOL.zS + rr(40, 90)); orient(f, _ax.set(0.001, 0, 1)); }   // its escorts, in formation round it
    f.speed = f.K.veq;
    if (W.cutscene === 'eagle' && kind === 'ace') startEagleCutscene(f);
    else if (W.boss === kind && !W.cutscene) pendingIntro = { f, t: 1.4 };   // let the level title read first
  }
  if (W.cutscene === 'twins') { const tw = flyers.filter(f => f.alive && f.kind === 'elite'); startTwinsCut(tw.find(f => f.name === 'Bạch Ưng'), tw.find(f => f.name === 'Hắc Ưng')); }
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
function updateWaves(dt) {
  for (let i = allyReturns.length - 1; i >= 0; i--) {
    const r = allyReturns[i]; r.t -= dt;
    if (r.t > 0) continue;
    allyReturns.splice(i, 1);
    if (state !== 'play') continue;
    const f = makeFlyer('ally', 'blue', r.name, r.color); f.pos.copy(P.pos).add(_pv.set(rr(-8, 8), 4, 10)); f.pos.y = Math.max(f.pos.y, 6); orient(f, fwdOf(P, _tmp)); f.speed = 8;
    radio(r.name, 'Tớ gấp xong máy bay mới rồi, quay lại đây!', true);
  }
  if (gameMode === 'escort') { updateEscort(dt); return; }
  if (gameMode === 'recon') { updateRecon(dt); return; }
  if (pendingIntro && (pendingIntro.t -= dt) <= 0) {
    const { f } = pendingIntro; pendingIntro = null;
    if (f.alive && state === 'play') bossIntro(f, ...BOSS_INTRO[f.kind]);
  }
  const enemies = flyers.filter(f => f.alive && f.team === 'red');
  if (waveState === 'wait') {
    waveT -= dt;
    if (waveT <= 0) spawnWave(++wave);
  } else if (enemies.length === 0) {
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
        radio('Bảng Đen', nx.escort === 'lab' ? 'Chuẩn bị nhiệm vụ đặc biệt: lần đầu tiên, Hạc Lớn sẽ cất cánh.' : nx.escort ? 'Đại Bàng Đỏ đã rơi, không quân của chúng tan tác rồi! Chuẩn bị phản công: hộ tống Hạc Lớn sang khu Phe Đỏ!'
          : nx.boss ? 'Tốt! Radar bắt được một tín hiệu rất mạnh... chuẩn bị tinh thần!'
          : pick(['Làm tốt lắm. Đừng thả lỏng, còn đợt nữa đang đến.', 'Gọn gàng! Radar lại thấy máy bay lạ, kiểu gấp khác hẳn.', 'Tốt lắm! Khu Nam vừa gấp thêm một lứa mới.'])); }
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
  if (cut && cut.kind === 'carpet' && f.team === 'blue') return;   // nothing touches the bomb run
  if (f === P && P.shieldT > 0) { amt *= 0.3; if (P.shieldMesh) P.shieldMesh.material.opacity = 0.5; }
  if (f.kind === 'ace' && f.team === 'red') {
    // "giáp giấy kép": one plane alone barely scratches him; two close together tear through, three even better
    const near = flyers.filter(o => o.alive && o.team === 'blue' && o.pos.distanceTo(f.pos) < 40).length;
    amt *= near >= 3 ? 1.2 : near >= 2 ? 1 : 0.3;
    if (src === P && amt > 0 && amt < 3) {   // shown, not told: rounds glance off with grey sparks and a tink
      burst(f.pos, 3, [0x9a9a9a, 0xdddddd], 3, 0.3, 0.3);
      if (AU.ctx && clock - (f.tinkT || -9) > 0.12) { f.tinkT = clock; tone(2400, 1800, 0.05, 0.05, 'triangle'); }
      if (near < 2 && clock - (f.lastSoloHitT || -99) > 0.5) { f.lastSoloHitT = clock; f.soloHits = (f.soloHits || 0) + 1; }
      if (f.soloHits > 12) radioOnce('armourSolo', 'Minh', 'Đạn của một mình cậu cứ bật ra khỏi cánh hắn! Đợi bọn tớ áp sát cùng!', 40);
    } else if (src && src.team === 'blue' && near >= 2) radioOnce('armourPair', 'Lan', 'Cùng bắn thì xuyên được! Giấy hắn rách rồi, áp sát vào!', 40);
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
    if (src && src.team === 'red' && P.hp > 0) radioOnce('tail', pick(['Lan', 'Minh', 'Bảng Đen']), 'Ô Li 1, cậu đang bị bắn! Lắc đuôi ra!', 14);
  }
  if (src === P && f !== P) hitMarkT = 0.15;
  if (f.kind === 'ace' && f.alive && f.hp > 0) {
    const ph = f.hp < f.maxHp * 0.33 ? 2 : f.hp < f.maxHp * 0.66 ? 1 : 0;
    if (ph > (f.phase || 0)) {
      f.phase = ph; f.mslLeft += 1; f.flares += 2; f.mslT = Math.min(f.mslT, 2);
      f.flares += 2; f.rage = ph;
      const sub = ph === 1 ? 'Nạp thêm tên lửa · bay nhanh hơn' : 'Khoá tên lửa cực nhanh · liều mạng';
      if (!underPursuit() && cine.t <= 0) bossIntro(f, ph === 1 ? 'ĐẠI BÀNG ĐỎ NỔI GIẬN!' : 'ĐẠI BÀNG ĐỎ LIỀU MẠNG!', sub, 1.8);
      else flash(ph === 1 ? 'ĐẠI BÀNG ĐỎ NỔI GIẬN!' : 'ĐẠI BÀNG ĐỎ LIỀU MẠNG!', sub, 2.2);
      radio(ph === 1 ? 'Minh' : 'Bảng Đen', ph === 1 ? 'Hắn... còn nhanh hơn lúc nãy!' : 'Hắn đang liều mạng! Giữ vòng vây, đừng để hắn thoát!', true);   // the Red Eagle himself never speaks
      shake = Math.min(0.8, shake + 0.4);
    }
  }
  if (f.kind === 'ace' && f.hp < f.maxHp * 0.35) radioOnce('aceLow', 'Lan', 'Cánh hắn rách rồi! Cố lên, sắp được rồi!', 999);
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
      if (f.kind === 'ace') radio('Bảng Đen', 'Đại Bàng Đỏ đã bị bắn hạ! Tuyệt vời, Ô Li 1!', true);
      else if (f.kind === 'elite') { const mate = flyers.find(x => x.alive && x.kind === 'elite'); radio(mate ? 'Lan' : 'Bảng Đen', mate ? `${f.name} rơi rồi! ${mate.name} đang lao thẳng tới chỗ cậu!` : 'Cả hai con Ưng đã rơi! Cậu là át chủ bài thật sự!', true); }
      else if (Math.random() < 0.6) { const [w, t] = pick(KILL_LINES); radio(w, t); }
    } else if (crashed) radio('Bảng Đen', `${f.name} tự đâm vào chướng ngại vật!`);
    else if (src && src.team === 'blue' && !(cut && cut.kind === 'rescue')) radio(src.name, pick(['Hạ được một chiếc!', 'Trúng rồi!', 'Một chiếc nữa xuống đất!']));   // the rescue has its own lines
  } else if (f.team === 'blue') {
    radio('Bảng Đen', `${f.name} đã rơi! ${f.name}, cậu ổn chứ?`, true);
    if (f.kind === 'ally' && !f.noReturn && flyers.some(o => o.alive && o.kind === 'ace')) { allyReturns.push({ name: f.name, color: f.colorHex, t: 15 }); popup(`${f.name} RƠI · GẤP LẠI MÁY BAY, 15s NỮA QUAY LẠI`, YEL, 2); }
  }
}
function crash(f) { destroy(f, f.lastHitBy, true); }
function playerDown() {
  state = 'dead'; endT = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  radio('Bảng Đen', 'Ô Li 1 đã rơi! Ô Li 1, trả lời đi!', true);
  flash('MÁY BAY BỊ HẠ', '', 2.5);
}
function chapterComplete() {
  state = 'won'; endT = 0;
  const last = wave >= WAVES.length - 1;
  radio('Bảng Đen', last ? 'Cuộc chiến máy bay giấy kết thúc! Về lớp thôi các em!' : 'Chương này xong rồi! Nghỉ một chút, Phe Đỏ chưa chịu thua đâu.', true);
  flash('CHƯƠNG HOÀN THÀNH', WAVES[wave].title, 3);
}
function missionComplete() {
  state = 'won'; endT = 0;
  if (gameMode !== 'escort') radio('Bảng Đen', 'Cuộc chiến máy bay giấy kết thúc! Về lớp thôi các em!', true);
  if (gameMode === 'escort') { flash('CHIẾN TRANH KẾT THÚC', 'Lá cờ Phe Đỏ đã cháy', 3.5); return; }   // a quiet end, no confetti
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
  $('resSub').textContent = won && single && wave < WAVES.length - 1 ? (WAVES[wave + 1].story || '') : won ? 'Chiến tranh máy bay giấy kết thúc: khu Phe Đỏ ngập trong bóng giấy!' : (P.failReason || 'Máy bay giấy của bạn đã bị xé nát…');
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

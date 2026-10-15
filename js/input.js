'use strict';
// Máy Bay Giấy · keyboard / mouse / touch input
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Input
// =====================================================================
const keys = {}, pressed = {};
const mouse = { l: false, r: false };
let touch = null;
const aim = new THREE.Vector3(0, 0, -1);
let invertY = localStorage.getItem('pp_invertY') === '1';
let sens = parseFloat(localStorage.getItem('pp_sens') || '1');
const $ = (id) => document.getElementById(id);
function setInvert(v) {
  invertY = v; localStorage.setItem('pp_invertY', v ? '1' : '0');
  $('invertChk').checked = v;
  $('kPitch').textContent = v ? 'S / W' : 'W / S';
  $('kPitchTxt').textContent = v ? 'Bay lên / bay xuống (đảo chiều; chuột cũng đảo)' : 'Bay lên / bay xuống (thả phím: tự bay ngang)';
}
setInvert(invertY);
let simCtl = localStorage.getItem('pp_sim') === '1';
let cineOn = localStorage.getItem('pp_cine') !== '0';
$('cineChk').checked = cineOn;
$('cineChk').addEventListener('change', (e) => { cineOn = e.target.checked; localStorage.setItem('pp_cine', cineOn ? '1' : '0'); });
$('simChk').checked = simCtl;
$('simChk').addEventListener('change', (e) => { simCtl = e.target.checked; localStorage.setItem('pp_sim', simCtl ? '1' : '0'); });
$('invertChk').addEventListener('change', (e) => setInvert(e.target.checked));
$('sensR').value = sens;
$('sensR').addEventListener('input', (e) => { sens = parseFloat(e.target.value); localStorage.setItem('pp_sens', sens); });

addEventListener('keydown', (e) => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && state === 'menu') startGame();
  if (e.code === 'Escape' && state === 'menu') showMenuPage('menuMain');   // back out of the chapter list
  if (e.code === 'KeyN') mapZoom = (mapZoom + 1) % RADAR_RANGES.length;
  if (e.code === 'KeyH') { hudMode = (hudMode + 1) % 3; localStorage.setItem('pp_hud', hudMode); flash('', HUD_NAMES[hudMode], 0.9); }
  if (e.code === 'KeyM') { setMute(!AU.muted); flash(AU.muted ? '🔇' : '🔊', '', 0.8); }
  if (e.code === 'KeyI') { setInvert(!invertY); flash('', invertY ? 'Đảo chiều: BẬT' : 'Đảo chiều: TẮT', 1); }
  if (e.code === 'KeyP' && (state === 'play' || state === 'dead')) togglePause();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
const cvs = renderer.domElement;
cvs.addEventListener('contextmenu', (e) => e.preventDefault());
cvs.addEventListener('mousedown', (e) => {
  if ((state === 'play') && !document.pointerLockElement && !paused) { lockPointer(); }
  if (e.button === 0) mouse.l = true;
  if (e.button === 2) { mouse.r = true; pressed.Mouse2 = true; }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
let mouseAimActive = false;
const _qa = new THREE.Quaternion(), _ar = new THREE.Vector3();
addEventListener('mousemove', (e) => {
  if (!document.pointerLockElement || paused || state !== 'play') return;
  if (P) P.keyAim = false;   // the mouse owns the aim again
  const s = 0.0016 * sens;
  _qa.setFromAxisAngle(UP, -e.movementX * s); aim.applyQuaternion(_qa);
  _ar.crossVectors(aim, UP);
  if (_ar.lengthSq() < 0.01) _ar.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _ar.normalize();
  _qa.setFromAxisAngle(_ar, -e.movementY * s * (invertY ? -1 : 1));
  const na = aim.clone().applyQuaternion(_qa);
  if (Math.abs(na.y) < 0.97 || Math.abs(na.y) < Math.abs(aim.y)) aim.copy(na);
  aim.normalize();
  mouseAimActive = true;
});
function lockPointer() { try { const p = cvs.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'play' && !paused) togglePause();
});
cvs.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  if (!touch) touch = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, n: e.touches.length, n3: false };
  else { touch.n = e.touches.length; if (touch.n >= 3) pressed.Mouse2 = true; }
}, { passive: true });
cvs.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (touch) { touch.x = t.clientX; touch.y = t.clientY; touch.n = e.touches.length; } }, { passive: true });
cvs.addEventListener('touchend', (e) => { if (!e.touches.length) touch = null; else if (touch) touch.n = e.touches.length; }, { passive: true });

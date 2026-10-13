'use strict';
// Máy Bay Giấy · synthesised audio and radio chatter
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Audio (synthesised)
// =====================================================================
const AU = { ctx: null, muted: false, lastGun: 0 };
function initAudio() {
  if (AU.ctx) { AU.ctx.resume(); return; }
  const ctx = new (window.AudioContext || window.webkitAudioContext)(); AU.ctx = ctx;
  AU.master = ctx.createGain(); AU.master.gain.value = AU.muted ? 0 : 0.7; AU.master.connect(ctx.destination);
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = buf;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  AU.windF = ctx.createBiquadFilter(); AU.windF.type = 'bandpass'; AU.windF.frequency.value = 500; AU.windF.Q.value = 0.7;
  AU.wind = ctx.createGain(); AU.wind.gain.value = 0;
  src.connect(AU.windF).connect(AU.wind).connect(AU.master); src.start();
  const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 4400;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 4;
  const am = ctx.createGain(); am.gain.value = 0;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 42; const lg = ctx.createGain(); lg.gain.value = 0.6;
  lfo.connect(lg).connect(am.gain);
  AU.cicada = ctx.createGain(); AU.cicada.gain.value = 0;
  osc.connect(bp).connect(am).connect(AU.cicada).connect(AU.master); osc.start(); lfo.start();
  // lock-on tone & missile alert tone (gated each frame)
  const mk = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0; o.connect(g).connect(AU.master); o.start(); return { o, g }; };
  AU.lock = mk('square', 1050); AU.alert = mk('square', 1500);
}
function env(node, t, peak, dur) { node.gain.setValueAtTime(peak, t); node.gain.exponentialRampToValueAtTime(0.001, t + dur); }
function noiseHit(t, freq, peak, dur, type = 'lowpass') {
  const n = AU.ctx.createBufferSource(); n.buffer = AU.noise;
  const f = AU.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = AU.ctx.createGain(); env(g, t, peak, dur);
  n.connect(f).connect(g).connect(AU.master); n.start(t, Math.random()); n.stop(t + dur + 0.05);
}
function tone(f0, f1, dur, peak, type = 'sine', delay = 0) {
  const t = AU.ctx.currentTime + delay, o = AU.ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AU.ctx.createGain(); env(g, t, peak, dur); o.connect(g).connect(AU.master); o.start(t); o.stop(t + dur + 0.05);
}
function gunSound(v = 1) { if (!AU.ctx) return; const t = AU.ctx.currentTime; if (v === 1 && t - AU.lastGun < 0.05) return; if (v === 1) AU.lastGun = t; noiseHit(t, 1800, 0.22 * v, 0.06, 'bandpass'); tone(260, 90, 0.06, 0.12 * v, 'square'); }
function launchSound(v = 1) { if (!AU.ctx) return; noiseHit(AU.ctx.currentTime, 900, 0.5 * v, 0.7, 'bandpass'); tone(300, 900, 0.5, 0.1 * v, 'sawtooth'); }
function flareSound(v = 1) { if (!AU.ctx) return; for (let i = 0; i < 3; i++) tone(1400, 500, 0.15, 0.08 * v, 'triangle', i * 0.07); }
function boom(pos, v = 1) {
  if (!AU.ctx) return;
  const d = pos.distanceTo(camera.position), k = clamp(1 - d / 300, 0.05, 1) * v;
  const t = AU.ctx.currentTime;
  tone(110, 35, 0.7, 0.9 * k); noiseHit(t, 600, 0.7 * k, 0.6);
}
function hurtSound() { if (AU.ctx) { noiseHit(AU.ctx.currentTime, 400, 0.6, 0.12); tone(180, 80, 0.12, 0.2, 'square'); } }
function whoosh() { if (AU.ctx) { noiseHit(AU.ctx.currentTime, 1200, 0.5, 0.9, 'bandpass'); tone(700, 120, 0.9, 0.12, 'sine'); } }
function heartbeat(v) { if (AU.ctx) { tone(70, 40, 0.18, 0.8 * v); tone(65, 38, 0.16, 0.6 * v, 'sine', 0.22); } }
function lockedSound() { if (AU.ctx) { tone(1500, 1500, 0.07, 0.08, 'square'); tone(2000, 2000, 0.12, 0.08, 'square', 0.08); } }
function radioBeep() { if (AU.ctx) { tone(1800, 1800, 0.05, 0.07, 'square'); tone(1300, 1300, 0.06, 0.06, 'square', 0.07); } }
function setMute(m) { AU.muted = m; if (AU.master) AU.master.gain.value = m ? 0 : 0.7; }

// =====================================================================
//  Radio chatter
// =====================================================================
const radioQ = []; let radioT = 0; const radioCD = {};
const WHO_COL = { 'Bảng Đen': '#9effa0', 'Lan': '#ff8fc0', 'Minh': '#6fd0ff', 'Tuấn': '#9be37a', 'Hà': '#ffb35c', 'Hạc Lớn': '#7fd6ff', 'Đại Bàng Đỏ': '#ff5050', 'Địch': '#ff8a80', 'Ô Li 1': '#ffffff' };
function radio(who, text, prio = false) { if (prio) radioQ.unshift({ who, text }); else radioQ.push({ who, text }); if (radioQ.length > 5) radioQ.length = 5; }
function radioOnce(key, who, text, cd = 15) { if ((radioCD[key] || -99) > clock) return; radioCD[key] = clock + cd; radio(who, text, true); }
function updateRadio(dt) {
  radioT -= dt;
  const el = document.getElementById('radio');
  if (radioT <= 0) {
    if (radioQ.length) {
      const m = radioQ.shift();
      document.getElementById('radioWho').textContent = m.who.toUpperCase();
      document.getElementById('radioWho').style.color = WHO_COL[m.who] || '#9effa0';
      el.style.borderLeftColor = WHO_COL[m.who] || '#9effa0';
      document.getElementById('radioText').textContent = m.text;
      el.style.opacity = 1; radioT = 2.6 + m.text.length * 0.035; radioBeep();
    } else el.style.opacity = 0;
  }
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const KILL_LINES = [['Lan', 'Đẹp lắm, Ô Li 1!'], ['Minh', 'Rơi như lá bàng mùa thu!'], ['Bảng Đen', 'Mục tiêu bị hạ.'], ['Lan', 'Bắn hay quá!'], ['Minh', 'Gấp lại đi, gấp lại đi!']];

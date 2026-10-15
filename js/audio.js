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
const WHO_COL = { 'Blackboard': '#9effa0', 'Alpha 2': '#ff8fc0', 'Alpha 3': '#6fd0ff', 'Alpha 4': '#9be37a', 'Alpha 5': '#ffb35c', 'Bravo 1': '#c9a0ff', 'Bravo 2': '#fff176', 'Bravo 3': '#80deea', 'Bravo 4': '#f48fb1', 'Bravo 5': '#a5d6a7', 'Bravo 6': '#ffcc80',
  'Red Eagle': '#ff5050', 'Địch': '#ff8a80', 'Phe Đỏ (bắt sóng)': '#ff8a80', 'Khu Tây': '#ff8a80', 'Bạch Nhạn': '#ff8a80', 'Hắc Nhạn': '#ff8a80', 'Alpha 1': '#ffffff', 'Hightower': '#aab4c8', 'Wingman': '#d5dde4' };
// while a conversation holds the channel (radioChain with hush), everyone else's chatter is simply dropped
let radioHushT = 0, radioHushWho = [];
// Chương 11 (W.bbSilent): Blackboard gives no orders at all; all she does is try to reach Wingman (those lines go out
// through radioChain / sayNow, not here). Missile calls are taken up by a wingman; everything else of hers goes unsaid
function bbSilent() { return typeof WAVES !== 'undefined' && WAVES[wave] && WAVES[wave].bbSilent; }
function radio(who, text, prio = false) {
  if (who === 'Blackboard' && bbSilent()) {
    radioOnce('bbGone', 'Alpha 3', 'Blackboard? ...Blackboard, chúng tôi cần chỉ thị!', 999);
    if (!/missile|break/i.test(text)) return;
    who = flyers.some(f => f.alive && f.name === 'Alpha 2') ? 'Alpha 2' : 'Alpha 3';
  }
  if (radioHushT > 0 && !radioHushWho.includes(who)) return;
  if (prio) radioQ.unshift({ who, text }); else radioQ.push({ who, text }); if (radioQ.length > 10) radioQ.length = 10;
}
const readTime = text => 3 + text.length * 0.055;   // how long a line stays up (updateRadio): ~18 chars/s, readable while flying
// a short exchange that must play next, in order, without anything cutting in between. With hush, it also cuts off
// the line on air and keeps everyone else off the channel until it's over
function radioChain(lines, hush = false) {
  radioQ.unshift(...lines.map(([who, text]) => ({ who, text }))); if (radioQ.length > 10) radioQ.length = 10;
  if (hush) { radioT = Math.min(radioT, 0.15); radioHushWho = lines.map(l => l[0]); radioHushT = 0.15 + lines.reduce((s, l) => s + readTime(l[1]), 0); }
}
function radioOnce(key, who, text, cd = 15) { if ((radioCD[key] || -99) > clock) return; radioCD[key] = clock + cd; radio(who, text, true); }   // (Blackboard's silence is applied inside radio)
function updateRadio(dt) {
  radioT -= dt; radioHushT -= dt;
  const el = document.getElementById('radio');
  if (radioT <= 0) {
    if (radioQ.length) {
      const m = radioQ.shift();
      if (el.style.opacity === '1') logRadio(document.getElementById('radioWho').textContent, document.getElementById('radioText').textContent, el.style.borderLeftColor);
      document.getElementById('radioWho').textContent = m.who.toUpperCase();
      document.getElementById('radioWho').style.color = WHO_COL[m.who] || '#9effa0';
      el.style.borderLeftColor = WHO_COL[m.who] || '#9effa0';
      document.getElementById('radioText').textContent = m.text;
      el.style.opacity = 1; radioT = readTime(m.text); radioBeep();
    } else { if (el.style.opacity === '1') logRadio(document.getElementById('radioWho').textContent, document.getElementById('radioText').textContent, el.style.borderLeftColor); el.style.opacity = 0; }
  }
  // the log sits just above the live line; older entries fade out after a while
  const log = document.getElementById('radioLog');
  log.style.bottom = (150 + (el.style.opacity === '1' ? el.offsetHeight + 6 : 0)) + 'px';
  for (const d of [...log.children]) if (clock > d._until) d.remove(); else if (clock > d._until - 1) d.style.opacity = 0;
}
function logRadio(who, text, col) {   // keep the last two lines readable after they leave the live box
  const log = document.getElementById('radioLog'), d = document.createElement('div');
  d.style.borderLeftColor = col; d._until = clock + 9;
  const b = document.createElement('b'); b.textContent = who; b.style.color = col; d.append(b, text);
  log.append(d); while (log.children.length > 2) log.firstChild.remove();
}
function clearRadioLog() { document.getElementById('radioLog').replaceChildren(); }
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const KILL_LINES = [['Alpha 2', 'Splash one! Đẹp lắm, Alpha 1!'], ['Alpha 3', 'Xác nhận hạ một. Rơi như lá bàng!'], ['Blackboard', 'Blackboard xác nhận: splash one.'], ['Alpha 2', 'Bắn đẹp, Alpha 1!'], ['Alpha 3', 'Good kill!']];

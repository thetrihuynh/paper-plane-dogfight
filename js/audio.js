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
  // a hall reverb (a decaying noise impulse) for the big moments, and the music bus that feeds it
  AU.verb = ctx.createConvolver();
  const il = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, il, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < il; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / il) ** 3; }
  AU.verb.buffer = ir; AU.verbIn = ctx.createGain(); AU.verbIn.gain.value = 0.45; AU.verbIn.connect(AU.verb).connect(AU.master);
  AU.music = ctx.createGain(); AU.music.gain.value = 0; AU.music.connect(AU.master); AU.music.connect(AU.verbIn);
  setInterval(musicTick, 50);
}
function env(node, t, peak, dur) { node.gain.setValueAtTime(peak, t); node.gain.exponentialRampToValueAtTime(0.001, t + dur); }
function noiseHit(t, freq, peak, dur, type = 'lowpass', wet = 0) {   // wet: how much goes into the reverb too
  const n = AU.ctx.createBufferSource(); n.buffer = AU.noise;
  const f = AU.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = AU.ctx.createGain(); env(g, t, peak, dur);
  n.connect(f).connect(g).connect(AU.master); if (wet) g.connect(wetGain(wet)); n.start(t, Math.random()); n.stop(t + dur + 0.05);
}
function tone(f0, f1, dur, peak, type = 'sine', delay = 0, wet = 0) {
  const t = AU.ctx.currentTime + delay, o = AU.ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AU.ctx.createGain(); env(g, t, peak, dur); o.connect(g).connect(AU.master); if (wet) g.connect(wetGain(wet)); o.start(t); o.stop(t + dur + 0.05);
}
function wetGain(k) { const g = AU.ctx.createGain(); g.gain.value = k; g.connect(AU.verbIn); return g; }
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

// ---- cinematic effects ----
// a big one: a sub-bass drop under a long, dark roar and a sharp crack on top, all of it rolling on in the hall
function bigBoom(v = 1) {
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  tone(72, 22, 3.2, 1.0 * v, 'sine', 0, 0.6);
  noiseHit(t, 260, 0.9 * v, 3.6, 'lowpass', 0.8);
  noiseHit(t, 3200, 0.45 * v, 0.25, 'highpass', 0.5);
  noiseHit(t + 0.12, 900, 0.35 * v, 1.2, 'bandpass', 0.6);
}
function rumble(dur = 4, v = 0.6) {   // things coming down: a long low grind that swells and settles
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  const n = AU.ctx.createBufferSource(); n.buffer = AU.noise; n.loop = true;
  const f = AU.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
  const g = AU.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f).connect(g).connect(AU.master); g.connect(wetGain(0.5)); n.start(t); n.stop(t + dur + 0.1);
}
function slowmo() {   // time stretching: everything sinks, a falling sweep of air and a low sigh
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  const n = AU.ctx.createBufferSource(); n.buffer = AU.noise;
  const f = AU.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(160, t + 1.3);
  const g = AU.ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  n.connect(f).connect(g).connect(AU.master); g.connect(wetGain(0.5)); n.start(t, Math.random()); n.stop(t + 1.6);
  tone(420, 55, 1.4, 0.16, 'sine', 0, 0.4);
}
function paperTear(v = 0.5) { if (AU.ctx) { const t = AU.ctx.currentTime; noiseHit(t, 3800, 0.3 * v, 0.07, 'highpass'); noiseHit(t + 0.03, 1700, 0.25 * v, 0.14, 'bandpass'); } }
function radioStatic(v = 1) { if (AU.ctx) noiseHit(AU.ctx.currentTime, 2400, 0.06 * v, 0.14, 'bandpass'); }
function towerTone() { if (AU.ctx) { tone(196, 196, 0.22, 0.08, 'square'); tone(147, 147, 0.32, 0.08, 'square', 0.2); } }   // Hightower: low, flat, cold

// =====================================================================
//  Music, composed in code: a few short looping themes for the cutscenes and the last chapter. Each bar is a
//  chord on a soft pad (detuned saws, filtered dark), a bass note, and maybe a music-box melody (it's a paper
//  world), an arpeggio, a bass ostinato, drums. Scheduled a little ahead on the audio clock.
// =====================================================================
const mtof = m => 440 * 2 ** ((m - 69) / 12);
const THEMES = {
  // the falls (Red Eagle, Wingman): A minor, slow
  sorrow: { bpm: 58, vol: 0.55, bars: [
    { chord: [57, 60, 64], bass: 45, mel: [[0, 76], [2, 74], [3, 72]] },
    { chord: [53, 57, 60], bass: 41, mel: [[0, 72], [2, 69]] },
    { chord: [52, 55, 60], bass: 48, mel: [[0, 67], [1.5, 64], [3, 67]] },
    { chord: [55, 59, 62], bass: 47, mel: [[0, 74]] }] },
  // after the bombs: D minor, slower, very sparse
  requiem: { bpm: 50, vol: 0.5, bars: [
    { chord: [62, 65, 69], bass: 38, mel: [[0, 74]] },
    { chord: [58, 62, 65], bass: 34, mel: [[0, 70], [2, 69]] },
    { chord: [57, 60, 65], bass: 41, mel: [[0, 72]] },
    { chord: [57, 61, 64], bass: 45, mel: [[0, 73], [2, 76]] }] },
  // held breath: a low cluster that won't resolve, and a pulse like a heartbeat
  tension: { bpm: 66, vol: 0.45, bars: [
    { chord: [50, 57, 58], bass: 38, drums: [0, 0.35], ticks: [2] },
    { chord: [50, 56, 57], bass: 38, drums: [0, 0.35], ticks: [2, 3.5] }] },
  // the chase: taiko and a driving bass figure
  drive: { bpm: 112, vol: 0.5, bars: [
    { chord: [50, 53, 57], bass: 38, drums: [0, 1, 1.5, 2, 3, 3.5], ost: [38, 38, 45, 38, 41, 38, 45, 36] },
    { chord: [48, 51, 55], bass: 36, drums: [0, 1, 1.5, 2, 2.75, 3, 3.5], ost: [36, 36, 43, 36, 39, 36, 43, 38] }] },
  // over the wall: D major, a music-box arpeggio climbing
  hope: { bpm: 80, vol: 0.55, bars: [
    { chord: [62, 66, 69], bass: 38, arp: [74, 78, 81, 78] },
    { chord: [61, 64, 69], bass: 45, arp: [73, 76, 81, 76] },
    { chord: [62, 66, 71], bass: 47, arp: [74, 78, 83, 78] },
    { chord: [62, 67, 71], bass: 43, arp: [74, 79, 83, 86] }] },
};
const MUS = { name: null, th: null, next: 0, bar: 0, duck: 1 };
function mVoice(type, f, t, a, hold, rel, v, dest, filt) {
  const o = AU.ctx.createOscillator(); o.type = type; o.frequency.value = f;
  const g = AU.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
  if (hold > 0) g.gain.setValueAtTime(v, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  if (filt) { const fl = AU.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl).connect(g); } else o.connect(g);
  g.connect(dest); o.start(t); o.stop(t + a + hold + rel + 0.05); return o;
}
function mPad(notes, t, dur, v, dest = AU.music) {
  for (const n of notes) for (const det of [-7, 7]) mVoice('sawtooth', mtof(n), t, Math.min(1.2, dur * 0.35), dur * 0.6, 1.6, v, dest, 760).detune.value = det;
}
function mPluck(n, t, v) { mVoice('triangle', mtof(n), t, 0.005, 0, 1.6, v, AU.music); mVoice('sine', mtof(n + 12), t, 0.005, 0, 0.7, v * 0.35, AU.music); }
function mDrum(t, v) {
  const o = AU.ctx.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
  const g = AU.ctx.createGain(); env(g, t, v, 0.5); o.connect(g).connect(AU.music); o.start(t); o.stop(t + 0.55);
  const n = AU.ctx.createBufferSource(); n.buffer = AU.noise; const f = AU.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
  const g2 = AU.ctx.createGain(); env(g2, t, v * 0.5, 0.15); n.connect(f).connect(g2).connect(AU.music); n.start(t, Math.random()); n.stop(t + 0.2);
}
function mTick(t, v) { const n = AU.ctx.createBufferSource(); n.buffer = AU.noise; const f = AU.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = AU.ctx.createGain(); env(g, t, v, 0.04); n.connect(f).connect(g).connect(AU.music); n.start(t, Math.random()); n.stop(t + 0.06); }
function scheduleBar(th, b, t) {
  const beat = 60 / th.bpm, len = beat * 4;
  mPad(b.chord, t, len, 0.035);
  mVoice('sine', mtof(b.bass), t, 0.3, len * 0.6, 1.2, 0.22, AU.music);
  for (const [at, n] of b.mel || []) mPluck(n, t + at * beat, 0.13);
  if (b.arp) for (let i = 0; i < 8; i++) mPluck(b.arp[i % b.arp.length], t + i * beat / 2, 0.08);
  if (b.ost) b.ost.forEach((n, i) => mVoice('sawtooth', mtof(n), t + i * beat / 2, 0.01, 0.05, 0.18, 0.09, AU.music, 500));
  for (const at of b.drums || []) mDrum(t + at * beat, at % 1 ? 0.35 : 0.6);
  for (const at of b.ticks || []) mTick(t + at * beat, 0.05);
}
function musicTick() {
  if (!AU.ctx || !MUS.th) return;
  const now = AU.ctx.currentTime;
  if (MUS.next < now) MUS.next = now + 0.05;
  while (MUS.next < now + 0.4) { const th = MUS.th; scheduleBar(th, th.bars[MUS.bar % th.bars.length], MUS.next); MUS.bar++; MUS.next += 4 * 60 / th.bpm; }
}
function musicLevel(fade) { const g = AU.music.gain, t = AU.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(MUS.th ? MUS.th.vol * MUS.duck : 0, t + fade); }
function musicPlay(name, fade = 2) {   // start a theme (or carry on, if it's the one already playing)
  if (!AU.ctx || MUS.name === name) return;
  MUS.name = name; MUS.th = THEMES[name]; MUS.bar = 0; MUS.next = AU.ctx.currentTime + 0.05; musicLevel(fade);
}
function musicStop(fade = 2) { if (!AU.ctx || !MUS.th) return; MUS.name = null; MUS.th = null; const g = AU.music.gain, t = AU.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade); }
function musicDuck(k, fade = 0.6) { MUS.duck = k; if (AU.ctx && MUS.th) musicLevel(fade); }
function musicSting(notes, v = 0.06) {   // one swelling chord, on its own
  if (!AU.ctx) return; const g = AU.ctx.createGain(); g.gain.value = 1; g.connect(AU.master); g.connect(AU.verbIn);
  mPad(notes, AU.ctx.currentTime, 2.5, v, g);
}
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
      el.style.opacity = 1; radioT = readTime(m.text); if (m.who === 'Hightower') towerTone(); else radioBeep(); radioStatic(m.who.startsWith('Phe Đỏ') || m.who === 'Khu Tây' ? 2.5 : 1);   // their frequency comes through rougher
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

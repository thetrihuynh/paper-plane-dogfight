'use strict';
// Máy Bay Giấy · constants, renderer & scene, utilities, canvas textures, shared materials
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Constants
// =====================================================================
// one school: Phe Xanh's wing at the north (gate) end, Phe Đỏ's at the south end, the shared yard between
const AREA = { x: 76, zMax: -34, zMin: -766, y: 38 };     // where the AI likes to fight
const ZONE = { x: 80, zMax: -30, zMin: -770, y: 60 };     // school airspace (60 m ceiling)
const WARN_BAND = 12;                                      // warning band beyond the zone before blackout begins
const CENTER = new THREE.Vector3(0, 9, -400);
// the middle of whichever open space z is in: north courtyard, the yard (either half), south courtyard
const arenaCenter = (z, out) => out.set(0, 9, z > -160 ? -95 : z > -400 ? -290 : z > -640 ? -510 : -705);
const PI = Math.PI;
const BULLET_SPEED = 40;
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0), FWD = new THREE.Vector3(0, 0, -1);

// =====================================================================
//  Renderer / scene
// =====================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const FOG = new THREE.Color(0xd9ecf3);
scene.background = FOG;
scene.fog = new THREE.Fog(FOG, 140, 620);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1300);   // near 0.1: enough depth precision so ground markings don't z-fight

const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a7b5a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(45, 85, 30);
const SUN_Z = SUN_OFF.clone().normalize(), SUN_X = new THREE.Vector3(0, 1, 0).cross(SUN_Z).normalize(), SUN_Y = SUN_Z.clone().cross(SUN_X);
const SUN_TEXEL = 120 / 2048, _sunF = new THREE.Vector3();

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3d8fdc) }, bot: { value: FOG.clone() } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bot; varying vec3 vP;
      void main(){ float t = clamp(vP.y*1.8+0.02,0.0,1.0); gl_FragColor = vec4(mix(bot,top,pow(t,0.8)),1.0);
      #include <colorspace_fragment>
      }`
  })
);
sky.renderOrder = -1;
scene.add(sky);

// =====================================================================
//  Utilities
// =====================================================================
let seed = 20112026;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // deterministic world layout
const R = (a, b) => a + rnd() * (b - a);
const rr = (a, b) => a + Math.random() * (b - a);                      // gameplay randomness
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function lam(color, extra = {}) { return new THREE.MeshLambertMaterial({ color, ...extra }); }
function put(geo, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rx || o.ry || o.rz) m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.recv !== false;
  (o.parent || scene).add(m);
  return m;
}

// ---- collision registries (static items go into a spatial grid after the world is built) ----
const boxes = [], ells = [], discs = [], dynBoxes = [];
const radarRects = [], treeDots = [];
// "Gaps": tight spaces you can thread through for a cinematic pass (bench seats, tree tiers…)
const gaps = [];
function gap(label, name, c, r, test, hit, bonus = 50) { gaps.push({ label, name, c, r, test, hit: typeof hit === 'function' ? hit : () => hit, bonus, inside: false, lastT: -99 }); }
function addBox(x0, y0, z0, x1, y1, z1, dyn = false) {
  const b = { t: 0, min: new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)),
              max: new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)) };
  (dyn ? dynBoxes : boxes).push(b);
  return b;
}
function solid(x0, y0, z0, x1, y1, z1, mat, o = {}) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const m = put(new THREE.BoxGeometry(w, h, d), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o);
  if (o.collide !== false) addBox(x0, y0, z0, x1, y1, z1);
  return m;
}
function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = geo.clone();
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const vcMat = lam(0xffffff, { vertexColors: true });
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function instances(geo, mat, list, shadow = true) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((o, i) => {
    _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0));
    _p.set(o.x, o.y || 0, o.z);
    if (o.sv) _s.copy(o.sv); else _s.setScalar(o.s || 1);
    _m4.compose(_p, _q, _s);
    im.setMatrixAt(i, _m4);
    if (o.color !== undefined) im.setColorAt(i, new THREE.Color(o.color));
  });
  im.castShadow = shadow; im.receiveShadow = true;
  scene.add(im);
  return im;
}

// =====================================================================
//  Canvas textures
// =====================================================================
function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function rep(tex, rx, ry) { const t = tex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; }
function speckle(g, w, h, n, col) { g.fillStyle = col; for (let i = 0; i < n; i++) { const s = 1 + Math.random() * 2; g.fillRect(Math.random() * w, Math.random() * h, s, s); } }
function fitText(g, text, x, y, maxW, size, color, weight = '800', family = 'Arial, Helvetica, sans-serif') {
  let s = size; g.font = `${weight} ${s}px ${family}`;
  while (g.measureText(text).width > maxW && s > 10) { s -= 2; g.font = `${weight} ${s}px ${family}`; }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y);
}
function starPath(g, cx, cy, Rr) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? Rr * 0.382 : Rr; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  g.closePath();
}
function signTex(lines, { w = 1024, h = 200, bg = '#c8102e', fg = '#ffd93b', border = '#ffd93b', size = 110 } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24); }
    lines.forEach((l, i) => {
      const L = typeof l === 'string' ? { t: l } : l;
      fitText(g, L.t, w / 2, h * (i + 0.5) / lines.length, w - 70, L.size || size, L.c || fg);
    });
  });
}
function signMat(tex) { return lam(0xffffff, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 }); }

const concreteTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#cdc6b6'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 2500, 'rgba(70,60,50,0.10)'); speckle(g, w, h, 1500, 'rgba(255,255,255,0.12)');
  g.strokeStyle = 'rgba(95,85,70,0.45)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  g.strokeStyle = 'rgba(95,85,70,0.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
}, true);
const asphaltTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#56565a'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 4000, 'rgba(0,0,0,0.18)'); speckle(g, w, h, 2000, 'rgba(255,255,255,0.08)');
}, true);
const tileTex = canvasTex(256, 256, (g, w, h) => {
  const cols = ['#b4553a', '#a94d34', '#bb5c40', '#b05038'];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = cols[(i * 2 + j + (i ? 1 : 0)) % 4]; g.fillRect(i * 128, j * 128, 128, 128); }
  speckle(g, w, h, 2500, 'rgba(60,20,10,0.12)');
  g.strokeStyle = '#7d3a28'; g.lineWidth = 5;
  g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, h); g.moveTo(0, 128); g.lineTo(w, 128); g.stroke();
}, true);
const ceilTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h); speckle(g, w, h, 400, 'rgba(0,0,0,0.05)');
  g.fillStyle = '#d8d2c3'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
}, true);
const facadeTex = canvasTex(256, 224, (g, w, h) => {
  g.fillStyle = '#f1c24e'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 1500, 'rgba(150,100,20,0.08)');
  const gr = g.createLinearGradient(0, h - 50, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(90,60,10,0.22)');
  g.fillStyle = gr; g.fillRect(0, h - 50, w, 50);
  g.fillStyle = '#fbf1d3'; g.fillRect(0, 0, w, 12);
  const wx = 78, wy = 46, ww = 100, wh = 118;
  g.fillStyle = '#fff3cf'; g.fillRect(wx - 8, wy - 8, ww + 16, wh + 16);
  g.fillStyle = '#25333b'; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = 'rgba(160,200,220,0.25)'; g.beginPath(); g.moveTo(wx, wy + wh * 0.6); g.lineTo(wx + ww * 0.6, wy); g.lineTo(wx + ww * 0.85, wy); g.lineTo(wx, wy + wh * 0.95); g.fill();
  g.fillStyle = '#d9e4e8'; for (let i = 1; i < 6; i++) g.fillRect(wx + i * ww / 6 - 1.5, wy, 3, wh);
  const shut = (x) => {
    g.fillStyle = '#2e8b57'; g.fillRect(x, wy, 40, wh);
    g.fillStyle = '#22704a'; for (let y = wy + 6; y < wy + wh - 4; y += 8) g.fillRect(x + 4, y, 32, 3);
    g.strokeStyle = '#1d5e3d'; g.lineWidth = 2; g.strokeRect(x + 1, wy + 1, 38, wh - 2);
  };
  shut(wx - 8 - 42); shut(wx + ww + 8 + 2);
  g.fillStyle = '#e8dcc0'; g.fillRect(wx - 14, wy + wh + 8, ww + 28, 8);
}, true);
const corrTex = canvasTex(512, 410, (g, w, h) => {
  const U = 51.2, Y = (u) => h - u * U;
  g.fillStyle = '#f4e4a6'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1200, 'rgba(120,90,30,0.07)');
  for (let x = 0; x < w; x += 0.5 * U) {
    g.fillStyle = '#e4d08a'; g.fillRect(x + 2, Y(6.4), 0.5 * U - 4, U - 4);
    g.fillStyle = '#4b4434'; g.beginPath(); g.arc(x + 0.25 * U, Y(5.9) - 2, 8, 0, PI * 2); g.fill();
    g.fillStyle = '#e4d08a'; g.fillRect(x + 0.25 * U - 1.5, Y(6.4), 3, U - 4); g.fillRect(x + 2, Y(5.9) - 3.5, 0.5 * U - 4, 3);
  }
  g.fillStyle = '#2f6e55'; g.fillRect(0, Y(1.4), w, 1.4 * U);
  g.fillStyle = '#20513f'; g.fillRect(0, Y(1.45), w, 5); g.fillRect(0, h - 8, w, 8);
  const d0 = 1.1 * U, d1 = 3.3 * U, dt = Y(3.0);
  g.fillStyle = '#e9dcb0'; g.fillRect(d0 - 8, dt - 8, d1 - d0 + 16, h - dt + 8);
  g.fillStyle = '#1b1612'; g.fillRect(d0, dt, d1 - d0, h - dt);
  g.fillStyle = '#3c3128'; g.fillRect(d0 + 64, Y(1.1), 50, 6); g.fillRect(d0 + 70, Y(1.1), 5, 1.1 * U); g.fillRect(d0 + 105, Y(1.1), 5, 1.1 * U);
  g.fillStyle = '#1f4d3a'; g.fillRect(d0 + 60, Y(2.6), 50, 26);
  g.fillStyle = '#8a5a2b'; g.fillRect(d0, dt, (d1 - d0) * 0.48, h - dt);
  g.strokeStyle = '#5e3b1a'; g.lineWidth = 3; g.strokeRect(d0 + 8, dt + 10, (d1 - d0) * 0.48 - 16, 60); g.strokeRect(d0 + 8, dt + 80, (d1 - d0) * 0.48 - 16, 60);
  const w0 = 4.3 * U, w1 = 9.3 * U, wt = Y(4.5), wb = Y(1.7);
  g.fillStyle = '#e9dcb0'; g.fillRect(w0 - 8, wt - 8, w1 - w0 + 16, wb - wt + 16);
  g.fillStyle = '#3d3a31'; g.fillRect(w0, wt, w1 - w0, wb - wt);
  g.fillStyle = '#1f5240'; g.fillRect(w0 + 40, wt + 18, 150, 60);
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = 'bold 14px Arial'; g.fillText('Toán', w0 + 90, wt + 40); g.fillText('2x + 3 = 7', w0 + 70, wt + 62);
  g.fillStyle = '#5a4430'; for (let i = 0; i < 4; i++) g.fillRect(w0 + 20 + i * 60, wb - 30, 44, 8);
  g.fillStyle = '#3d7fc1'; for (let x = w0 + 10; x < w1; x += 18) g.fillRect(x, wt, 4, wb - wt);
  g.fillRect(w0, (wt + wb) / 2 - 2, w1 - w0, 4);
  g.fillStyle = '#e8d38c'; g.fillRect(0, 0, w, 10);
}, true);
const roofTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#b4472a'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) {
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 13, 0, 3, h);
    for (let y = (x / 16 % 2) * 8; y < h; y += 16) {
      g.fillStyle = 'rgba(255,190,150,0.16)'; g.fillRect(x + 2, y + 2, 9, 10);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + 14, 13, 2);
    }
  }
  speckle(g, w, h, 300, 'rgba(40,20,10,0.15)');
}, true);
const railTex = canvasTex(128, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#eef3f5'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 6, w, 6);
  g.fillStyle = '#3f86c6'; for (let x = 4; x < w; x += 16) g.fillRect(x, 8, 5, h - 14);
}, true);
const netTex = canvasTex(128, 32, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#f5f5f5'; g.lineWidth = 2;
  for (let x = 0; x <= w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y <= h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, 4);
}, true);
const paperTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#fdfdf8'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,160,230,0.35)'; g.lineWidth = 1;
  for (let i = 0; i <= w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  g.strokeStyle = 'rgba(70,110,200,0.65)'; g.lineWidth = 1.5;
  for (let i = 0; i <= h; i += 32) { g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  g.strokeStyle = 'rgba(230,80,80,0.7)'; g.beginPath(); g.moveTo(22, 0); g.lineTo(22, h); g.stroke();
}, true);
const houseTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#ececec'; g.fillRect(0, 0, w, h);
  for (let f = 0; f < 4; f++) {
    const y = f * 64;
    if (f === 3) { g.fillStyle = '#8c8c8c'; g.fillRect(14, y + 10, 100, 54); g.fillStyle = '#7a7a7a'; for (let k = 0; k < 54; k += 5) g.fillRect(14, y + 10 + k, 100, 2); continue; }
    g.fillStyle = '#444b52'; g.fillRect(24, y + 12, 80, 36);
    g.fillStyle = '#ffffff'; g.fillRect(20, y + 46, 88, 4);
    g.fillStyle = '#bbbbbb'; for (let x = 22; x < 108; x += 7) g.fillRect(x, y + 50, 2, 12);
    g.fillRect(20, y + 60, 88, 3);
    if (f === 1) { g.fillStyle = '#fafafa'; g.fillRect(84, y + 20, 18, 12); }
  }
});

// =====================================================================
//  Shared materials
// =====================================================================
const MAT = {
  white: lam(0xf5f3ec), yellow: lam(0xf1c24e), cream: lam(0xf6ecd0), wood: lam(0x7a4a26),
  concrete: lam(0xc9c3b5), stone: lam(0x9d9a93), red: lam(0xc8102e), metal: lam(0x8c939a),
  blue: lam(0x2f6fb5), brick: lam(0xa4482f), trunk: lam(0x6b4a32), lime: lam(0xf2f0e6),
  roof: lam(0xffffff, { map: rep(roofTex, 0.3, 0.3) }),
  emissive: new THREE.MeshBasicMaterial({ color: 0xfafff5 }),
};
const facadeCache = {};
function facadeMat(rx, ry) { const k = rx + '_' + ry; return facadeCache[k] || (facadeCache[k] = lam(0xffffff, { map: rep(facadeTex, rx, ry) })); }
function bldgMats(w, d, h) {
  const fl = h / 7, sx = facadeMat(Math.max(1, Math.round(d / 8)), fl), sz = facadeMat(Math.max(1, Math.round(w / 8)), fl);
  return [sx, sx, MAT.concrete, MAT.concrete, sz, sz];
}

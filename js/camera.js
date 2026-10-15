'use strict';
// Máy Bay Giấy · chase camera
// (plain script: shares the page's global scope with the other files, loaded in order by index.html)

// =====================================================================
//  Camera
// =====================================================================
const camFwd = new THREE.Vector3(0, 0, -1), camAimS = new THREE.Vector3(0, 0, -1);
const camPos = new THREE.Vector3(0, 18, 70), camUp = new THREE.Vector3(0, 1, 0), _cd = new THREE.Vector3(), _cl = new THREE.Vector3(), _pu = new THREE.Vector3();
function updateCamera(dt) {
  if (cut && state === 'play') { cutsceneCamera(dt); sky.position.copy(camera.position); return; }
  if (cine.t > 0 && state !== 'menu' && cine.kind === 'boss') {
    // swoop: from far out to a tight close-up, easing in
    const k = 1 - cine.t / cine.dur, e = 1 - Math.pow(1 - clamp(k / 0.75, 0, 1), 3);
    const sz = cine.subject.K ? cine.subject.K.scale : 0.5;
    _cd.copy(cine.subject.pos).addScaledVector(cine.dir, lerp(22, 2.2 + sz * 2.6, e));
    for (let i = 0; i < 8 && pointBlocked(_cd, 0.1); i++) _cd.lerp(cine.subject.pos, 0.2);
    cine.anchor.lerp(_cd, 1 - Math.exp(-dt * 30));
    camera.position.copy(cine.anchor);
    cine.look.lerp(cine.subject.pos, 1 - Math.exp(-dt * 40));
    camera.up.set(0, 1, 0); camera.lookAt(cine.look);
    camPos.copy(camera.position); camUp.set(0, 1, 0);
  } else if (cine.t > 0 && state !== 'menu') {
    cine.anchor.addScaledVector(_cd.subVectors(cine.subject.pos, cine.anchor), dt * 0.4);
    camera.position.copy(cine.anchor);
    cine.look.lerp(cine.subject.pos, 1 - Math.exp(-dt * 25));
    camera.up.set(0, 1, 0); camera.lookAt(cine.look);
    camPos.copy(camera.position); camUp.set(0, 1, 0);
  } else if (state === 'menu') {
    const a = clock * 0.15;
    camera.position.set(Math.sin(a) * 11, 6 + Math.sin(clock * 0.3) * 1, -60 + Math.cos(a) * 11);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 4, -60);
  } else if ((state === 'dead' || state === 'won') && endT > 0.5) {
    const a = clock * 0.3;
    _cd.set(P.pos.x + Math.sin(a) * 4, Math.max(P.pos.y + 1.5, 0.6), P.pos.z + Math.cos(a) * 4);
    camPos.lerp(_cd, 1 - Math.exp(-dt * 2)); camera.position.copy(camPos);
    camUp.lerp(UP, 0.1); camera.up.copy(camUp); camera.lookAt(P.pos);
  } else {
    const planeUp = upOf(P, _pu);
    const manualish = !document.pointerLockElement && simCtl;
    const mouseMode = !!document.pointerLockElement;
    const targetUp = _cl.copy(UP).multiplyScalar(manualish ? 0.55 : mouseMode ? 0.8 : 0.75).addScaledVector(planeUp, manualish ? 0.45 : mouseMode ? 0.2 : 0.25).normalize();   // horizon stays calm; only a hint of the bank
    const pf = fwdOf(P, _fw);
    if (camFwd.dot(pf) < -0.3) camFwd.copy(pf); else camFwd.lerp(pf, 1 - Math.exp(-dt * 5)).normalize();
    // looping / near vertical: follow the plane's up so the camera never flips at the top
    // decided by the plane's attitude (steep or upside down), not by the key being held, and eased in/out,
    // so tapping W/S doesn't flick the view back and forth
    const wantVert = Math.abs(pf.y) > 0.93 || (P.looping && (Math.abs(pf.y) > 0.7 || planeUp.y < 0.1)) ? 1 : 0;
    P.camVert = (P.camVert || 0) + (wantVert - (P.camVert || 0)) * Math.min(1, dt * 2.2);
    const vert = P.camVert;
    const ev = P.evadeDur > 0 && P.evadeCalm ? Math.sin(PI * clamp(1 - P.evadeT / P.evadeDur, 0, 1)) : 0;
    if (vert > 0) targetUp.lerp(planeUp, vert).normalize();
    camUp.lerp(targetUp, 1 - Math.exp(-dt * (2.2 + vert * 3))).normalize();
    const padlock = keys.KeyT && P.target && P.target.alive;
    if (padlock) {
      _cd.subVectors(P.pos, P.target.pos).normalize().multiplyScalar(2.6).add(P.pos).addScaledVector(camUp, 0.7);
      camPos.lerp(_cd, 1 - Math.exp(-dt * 8)); camera.position.copy(camPos);
      camera.up.copy(camUp); camera.lookAt(P.target.pos);
    } else if (camMode === 2) {           // nose cam
      P.obj.visible = false;
      camera.position.copy(P.pos).addScaledVector(planeUp, 0.08);
      camera.up.copy(planeUp); camera.lookAt(_cl.copy(P.pos).addScaledVector(fwdOf(P, _fw), 30).addScaledVector(planeUp, 0.08));
      camPos.copy(camera.position);
    } else {
      P.obj.visible = P.alive || P.falling;
      const dist = (camMode === 1 ? 4.2 : 2.2) + ev * 1.2, h = camMode === 1 ? 0.9 : 0.42;
      // mouse mode looks along a smoothed copy of the aim, so sudden aim changes never cut the view
      const camTgt = mouseMode ? aim : camFwd;
      if (camAimS.dot(camTgt) < -0.3) camAimS.copy(camTgt); else camAimS.lerp(camTgt, 1 - Math.exp(-dt * (mouseMode ? 9 : 30))).normalize();
      const camDir = camAimS;
      _cd.copy(P.pos).addScaledVector(camDir, -dist).addScaledVector(camUp, h);
      // evade: swing out to the opposite side and a little low, to watch the roll
      if (ev > 0) _cd.addScaledVector(_v3.crossVectors(camDir, camUp).normalize(), -P.evadeSide * 1.4 * ev).addScaledVector(camUp, -0.25 * ev);
      camPos.lerp(_cd, 1 - Math.exp(-dt * 6));
      camPos.y = Math.max(camPos.y, 0.15);
      // don't let the camera sit inside trees / walls, or behind one (narrow corridors with sharp bends):
      // walk from the plane out to the camera spot and stop just short of the first thing in the way
      _cd.copy(camPos);
      for (let i = 1; i <= 12; i++) {
        _cl.lerpVectors(P.pos, camPos, i / 12);
        if (pointBlocked(_cl, 0.08)) { _cd.lerpVectors(P.pos, camPos, Math.max(0.15, (i - 1) / 12)); break; }
      }
      camera.position.copy(_cd);
      camera.up.copy(camUp);
      camera.lookAt(_cl.copy(camera.position).addScaledVector(camDir, 60));
    }
    if (shake > 0) camera.position.add(_cl.set(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(shake * 0.1));
    // wing-flutter buzz: smooth low-amplitude wobble (not random per frame, which reads as stutter)
    const bz = state === 'play' && P.alive ? clamp(P.flutter - 0.6, 0, 0.8) * 0.0012 : 0;   // 10% of the old wobble
    if (bz > 0) camera.position.addScaledVector(camUp, Math.sin(clock * 21) * bz).addScaledVector(_cl.crossVectors(camFwd, camUp), Math.sin(clock * 16 + 1) * bz * 0.6);
  }
  const fov = cine.t > 0 ? (cine.kind === 'boss' ? lerp(60, 30, clamp((1 - cine.t / cine.dur) / 0.75, 0, 1)) : 55) : state === 'play' ? 66 + clamp(P.speed - 7.5, -4, 10) * 0.8 + (P.evadeDur > 0 && P.evadeCalm ? 10 * Math.sin(PI * clamp(1 - P.evadeT / P.evadeDur, 0, 1)) : 0) + (P.boostT > 0 ? 6 : 0) + (P.rush || 0) * 12 : 66;
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
}

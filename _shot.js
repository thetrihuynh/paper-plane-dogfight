
const Q = new URLSearchParams(location.search), cp = Q.get('c').split(',').map(Number), lk = Q.get('l').split(',').map(Number);
setTimeout(() => {
  if (Q.get('s')) towerStrings.visible = true;
  document.querySelectorAll('body > div').forEach(d => { if (!d.querySelector('canvas')) d.style.display = 'none'; });
  window.frameInner = () => {};
  camera.fov = 70; camera.position.set(cp[0], cp[1], cp[2]); camera.lookAt(lk[0], lk[1], lk[2]); camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}, 3000);

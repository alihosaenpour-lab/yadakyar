/* ===== یدک‌یار — صحنهٔ سه‌بعدی واقعی (WebGL / Three.js) ===== */
import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/controls/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';
import { buildCar } from './car3d.js';

export function buildScene(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08101f, 14, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(36, 1, .1, 200);
  camera.position.set(7.2, 2.3, 7.4);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .07;
  controls.minDistance = 5.0; controls.maxDistance = 17;
  controls.minPolarAngle = .30; controls.maxPolarAngle = Math.PI / 2 - .04;
  controls.enablePan = false;
  controls.autoRotate = opts.autoRotate !== false;
  controls.autoRotateSpeed = .8;
  controls.target.set(0, .72, 0);

  /* نورپردازی */
  scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x223049, .7));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(5, 9, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9; key.shadow.camera.right = 9;
  key.shadow.camera.top = 9; key.shadow.camera.bottom = -9;
  key.shadow.camera.near = .5; key.shadow.camera.far = 32;
  key.shadow.bias = -.0009; scene.add(key);
  const rim = new THREE.DirectionalLight(0x5fa2ff, 2.0); rim.position.set(-7, 4, -6); scene.add(rim);
  const under = new THREE.PointLight(0x2f6bff, 18, 20, 2); under.position.set(0, 1.2, -4.5); scene.add(under);
  const sweep = new THREE.SpotLight(0x8fd0ff, 30, 22, .5, .6, 1.6);
  sweep.position.set(0, 7, 0); scene.add(sweep); scene.add(sweep.target);

  /* کف + حلقه */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 96),
    new THREE.MeshStandardMaterial({ color: 0x0a1322, roughness: .22, metalness: .7 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const ring = new THREE.Mesh(new THREE.RingGeometry(3.55, 3.74, 96),
    new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: .5, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .003; scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(4.45, 4.52, 96),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: .25, side: THREE.DoubleSide }));
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = .003; scene.add(ring2);

  /* خودرو */
  const { car, hoodPivot, engine, wheels, materials } = buildCar(THREE, { color: opts.color });
  scene.add(car);

  /* ذرات */
  const pc = 320, pp = new Float32Array(pc * 3);
  for (let i = 0; i < pc; i++) {
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 10;
    pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = Math.random() * 7; pp[i * 3 + 2] = Math.sin(a) * r;
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x93c2ff, size: .045, transparent: true, opacity: .6 }));
  scene.add(dust);

  let hoodOpen = false, hoodT = 0, raf = 0;
  const api = {
    THREE, scene, camera, renderer, controls, car, engine,
    toggleHood() { hoodOpen = !hoodOpen; return hoodOpen; },
    setHood(v) { hoodOpen = !!v; return hoodOpen; },
    get hoodOpen() { return hoodOpen; },
    setAutoRotate(v) { controls.autoRotate = !!v; },
    setColor(c) { materials.paint.color.set(c); },
    reset() { camera.position.set(7.2, 2.3, 7.4); controls.target.set(0, .72, 0); controls.update(); },
    zoom(f) {
      const d = camera.position.length() * f;
      if (d > controls.minDistance && d < controls.maxDistance) camera.position.setLength(d);
      controls.update();
    },
    resize() {
      const w = canvas.clientWidth || canvas.parentElement.clientWidth;
      const h = canvas.clientHeight || canvas.parentElement.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      api.fit();
    },
    /* فاصلهٔ دوربین را طوری تنظیم می‌کند که کل خودرو در هر نسبت ابعادی جا شود */
    fit(margin = 1.28) {
      const box = new THREE.Box3().setFromObject(car);
      const size = box.getSize(new THREE.Vector3());
      const fovV = camera.fov * Math.PI / 180;
      const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
      const d = Math.max(size.y / 2 / Math.tan(fovV / 2), size.z / 2 / Math.tan(fovH / 2),
                         size.x / 2 / Math.tan(fovH / 2)) * margin;
      controls.minDistance = d * .62; controls.maxDistance = d * 2.6;
      camera.position.setLength(Math.min(Math.max(camera.position.length(), controls.minDistance), controls.maxDistance));
      if (!api._fitted) { camera.position.setLength(d); api._fitted = true; }
      controls.update();
    },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', api.resize); renderer.dispose(); pmrem.dispose(); }
  };

  const clock = new THREE.Clock();
  (function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), .05), t = clock.getElapsedTime();
    hoodT += ((hoodOpen ? 1 : 0) - hoodT) * Math.min(1, dt * 5);
    hoodPivot.rotation.x = -hoodT * 1.05;
    engine.visible = hoodT > .05;
    ring.material.opacity = .30 + Math.sin(t * 1.5) * .18;
    ring2.rotation.z = t * .18;
    dust.rotation.y = t * .02;
    car.position.y = Math.sin(t * .8) * .013;
    sweep.position.set(Math.cos(t * .5) * 6, 7, Math.sin(t * .5) * 6);
    wheels.forEach(w => { w.rotation.x -= dt * .22; });
    controls.update();
    renderer.render(scene, camera);
  })();

  api.fit();
  api.resize();
  addEventListener('resize', api.resize);
  return api;
}

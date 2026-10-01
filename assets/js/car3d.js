/* ===== یدک‌یار — مدل سه‌بعدی سدان لوکس فول‌سایز (به سبک S-Class) =====
   ⚠️ این یک مدل اصیل و سبک‌سازی‌شده است که با هندسهٔ پروسیجرال ساخته شده؛
   دادهٔ CAD رسمی مرسدس‌بنز نیست و از هیچ نشان تجاری ثبت‌شده‌ای استفاده نمی‌کند.
   جدا از رندرر نگه داشته شده تا بدون مرورگر هم قابل تست باشد. */

export function buildCar(THREE, opts = {}) {
  const color = opts.color ?? 0x0d1b2e;        // مشکی‌آبی متالیک (اوبسیدین)
  const car = new THREE.Group();

  const M = {
    paint:  new THREE.MeshPhysicalMaterial({ color, metalness: .85, roughness: .16, clearcoat: 1, clearcoatRoughness: .035 }),
    glass:  new THREE.MeshPhysicalMaterial({ color: 0x08121f, metalness: .1, roughness: .04, transmission: .88, thickness: .45, transparent: true, opacity: .92, ior: 1.46 }),
    trim:   new THREE.MeshStandardMaterial({ color: 0x0b0e13, metalness: .5, roughness: .45 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdfe6f0, metalness: 1, roughness: .075 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0c0f, roughness: .96 }),
    head:   new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xd7e8ff, emissiveIntensity: 3.2, roughness: .12 }),
    tail:   new THREE.MeshStandardMaterial({ color: 0xff2b3c, emissive: 0xff1c2c, emissiveIntensity: 2.4, roughness: .26 }),
    block:  new THREE.MeshStandardMaterial({ color: 0x2b3547, metalness: .85, roughness: .38 }),
    blue:   new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: .45, metalness: .3 }),
    dark:   new THREE.MeshStandardMaterial({ color: 0x1b222c, metalness: .8, roughness: .34 })
  };

  const add = (geo, mat, pos, rot, parent) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true; m.receiveShadow = true;
    (parent || car).add(m);
    return m;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const C = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s);

  /* نیم‌رخ (z,y) را به حجمی با پهنای width تبدیل می‌کند */
  function extrudeZY(pts, width, bevel = .05) {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: width - bevel * 2, bevelEnabled: bevel > 0,
      bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 18
    });
    g.rotateY(-Math.PI / 2);
    g.translate(width / 2 - bevel, 0, 0);
    g.computeVertexNormals();
    return g;
  }

  /* ---------- بدنهٔ اصلی: کشیده، کم‌ارتفاع، با کمربند بلند ---------- */
  const W = 2.00;
  add(extrudeZY([
    [ .58, 1.32], [ .58,  .70], [ .30,  .46], [-1.90,  .42], [-2.45,  .48],
    [-2.72,  .78], [-2.74, 1.06], [-2.50, 1.24], [-1.60, 1.30], [ .58, 1.32]
  ], W, .07), M.paint, [0, 0, 0]);

  /* جلوبندی و بال‌های جلو (تا نوک دماغه) */
  add(extrudeZY([
    [ .58, 1.32], [1.70, 1.24], [2.52, 1.08], [2.76,  .92],
    [2.76,  .60], [2.55,  .42], [ .58,  .46], [ .58, 1.32]
  ], W - .04, .07), M.paint, [0, 0, 0]);

  /* رکاب و دامن کناری */
  add(B(W + .06, .15, 3.05), M.trim, [0, .42, -.35]);
  add(B(W + .10, .045, 2.95), M.chrome, [0, .50, -.35]);

  /* ---------- گلخانه / کابین: خط سقف کوپه‌ای ---------- */
  const GW = 1.74;
  add(extrudeZY([
    [ .52, 1.30], [ .10, 1.60], [-1.00, 1.71], [-1.70, 1.64],
    [-2.08, 1.32], [-2.08, 1.30], [ .52, 1.30]
  ], GW, .04), M.glass, [0, 0, 0]);

  /* سقف و ستون‌ها */
  add(extrudeZY([
    [-.22, 1.69], [-1.08, 1.75], [-1.60, 1.68], [-1.60, 1.62], [-1.08, 1.69], [-.22, 1.63]
  ], GW + .04, .03), M.paint, [0, 0, 0]);
  add(B(.07, .58, .10), M.paint, [ GW / 2, 1.46,  .30], [.52, 0, 0]);  // ستون A
  add(B(.07, .58, .10), M.paint, [-GW / 2, 1.46,  .30], [.52, 0, 0]);
  add(B(.07, .52, .09), M.chrome,[ GW / 2, 1.47, -1.84], [-.55, 0, 0]); // ستون C
  add(B(.07, .52, .09), M.chrome,[-GW / 2, 1.47, -1.84], [-.55, 0, 0]);
  add(B(GW + .06, .05, 2.30), M.chrome, [0, 1.315, -.72]);            // نوار کروم دور شیشه

  /* ---------- کاپوت روی لولا ---------- */
  const hoodPivot = new THREE.Group();
  hoodPivot.position.set(0, 1.30, .56);
  car.add(hoodPivot);
  const hoodGeo = extrudeZY([
    [0, .02], [1.12, -.06], [1.94, -.22], [2.16, -.36],
    [2.10, -.44], [1.88, -.32], [1.10, -.16], [0, -.08]
  ], 1.92, .035);
  add(hoodGeo, M.paint, [0, 0, 0], null, hoodPivot);
  add(B(.05, .05, 1.90), M.chrome, [ .60, -.05, 1.02], null, hoodPivot); // خط‌های برجستهٔ کاپوت
  add(B(.05, .05, 1.90), M.chrome, [-.60, -.05, 1.02], null, hoodPivot);

  /* ---------- جلوپنجرهٔ بلند و کروم ---------- */
  add(B(1.30, .56, .12), M.trim, [0, .90, 2.70]);
  for (let i = 0; i < 9; i++)
    add(B(.033, .50, .06), M.chrome, [-.56 + i * .14, .90, 2.76]);
  add(B(1.34, .05, .09), M.chrome, [0, 1.18, 2.73]);
  add(B(1.34, .05, .09), M.chrome, [0, .62, 2.73]);
  add(C(.13, .13, .04, 24), M.chrome, [0, 1.06, 2.80], [Math.PI / 2, 0, 0]); // نشان دایره‌ای خنثی
  add(C(.10, .10, .03, 24), M.dark,   [0, 1.06, 2.82], [Math.PI / 2, 0, 0]);

  /* ---------- چراغ‌های LED باریک ---------- */
  add(B(.52, .085, .09), M.head, [ .80, 1.07, 2.66], [0, -.12, .05]);
  add(B(.52, .085, .09), M.head, [-.80, 1.07, 2.66], [0,  .12, -.05]);
  add(B(.44, .05, .07),  M.head, [ .80,  .94, 2.64]);
  add(B(.44, .05, .07),  M.head, [-.80,  .94, 2.64]);
  add(B(.62, .11, .08),  M.tail, [ .70, 1.10, -2.76]);
  add(B(.62, .11, .08),  M.tail, [-.70, 1.10, -2.76]);
  add(B(1.30, .035, .06),M.tail, [0, 1.06, -2.76]);      // نوار نور عقب

  /* سپرها و دیفیوزر */
  add(B(1.96, .22, .14), M.trim, [0, .50, 2.72]);
  add(B(1.96, .26, .14), M.trim, [0, .52, -2.74]);
  add(C(.07, .07, .22, 16), M.chrome, [ .58, .44, -2.80], [Math.PI / 2, 0, 0]); // اگزوز
  add(C(.07, .07, .22, 16), M.chrome, [-.58, .44, -2.80], [Math.PI / 2, 0, 0]);

  /* دستگیره‌ها و آینه‌ها */
  [[1.02, .30], [-1.02, .30], [1.02, -1.02], [-1.02, -1.02]].forEach(([x, z]) =>
    add(B(.05, .055, .28), M.chrome, [x, 1.22, z]));
  add(B(.10, .12, .26), M.paint, [ 1.06, 1.36, .52]);
  add(B(.10, .12, .26), M.paint, [-1.06, 1.36, .52]);
  add(B(.05, .09, .20), M.dark,  [ 1.14, 1.34, .52]);
  add(B(.05, .09, .20), M.dark,  [-1.14, 1.34, .52]);

  /* ---------- موتور زیر کاپوت ---------- */
  const engine = new THREE.Group();
  engine.position.set(0, 1.00, 1.55);
  car.add(engine);
  add(B(1.22, .40, 1.00), M.block,  [0, .06, 0],       null, engine);
  add(B(1.30, .10, 1.06), M.chrome, [0, .31, 0],       null, engine);
  for (let i = 0; i < 4; i++) {
    add(C(.05, .05, .18, 14), M.chrome, [-.40 + i * .265, .44, .18], null, engine);
    add(C(.05, .05, .18, 14), M.chrome, [-.40 + i * .265, .44, -.18], null, engine);
  }
  add(B(.32, .30, .24), M.blue,  [ .66, .14, -.34], null, engine);
  add(C(.18, .18, .28, 20), M.dark, [-.66, .16, -.30], [0, 0, Math.PI / 2], engine);
  add(B(1.46, .46, .09), M.trim, [0, .14, .70], null, engine);
  add(C(.045, .045, .60, 10), M.dark, [.32, .30, .40], [Math.PI / 2, 0, .28], engine);
  add(B(.90, .06, .70), M.dark, [0, -.16, 0], null, engine);

  /* ---------- چرخ‌ها با رینگ پره‌دار ---------- */
  const wheels = [];
  const tyre = new THREE.TorusGeometry(.345, .115, 16, 34);
  const rimD = C(.272, .272, .19, 28), hub = C(.085, .085, .24, 16), spoke = B(.05, .26, .05);
  [[1.00, 1.66], [-1.00, 1.66], [1.00, -1.70], [-1.00, -1.70]].forEach(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, .46, z); car.add(g);
    add(tyre, M.rubber, [0, 0, 0], [0, Math.PI / 2, 0], g);
    add(rimD, M.chrome, [0, 0, 0], [0, 0, Math.PI / 2], g);
    add(hub,  M.dark,   [0, 0, 0], [0, 0, Math.PI / 2], g);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      add(spoke, M.chrome, [0, Math.cos(a) * .14, Math.sin(a) * .14], [a, 0, Math.PI / 2], g);
    }
    add(C(.255, .255, .11, 22), M.dark, [x > 0 ? -.08 : .08, 0, 0], [0, 0, Math.PI / 2], g); // دیسک ترمز
    wheels.push(g);
    /* قوس گلگیر */
    add(new THREE.TorusGeometry(.445, .042, 10, 24, Math.PI), M.trim, [x > 0 ? x + .01 : x - .01, .46, z], [0, Math.PI / 2, 0]);
  });

  engine.visible = false;
  return { car, hoodPivot, engine, wheels, materials: M };
}

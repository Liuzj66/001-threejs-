/* ============================================================
 * 宅匠 · 家居装修 3D 交互设计室 v2 — 主程序
 * 新增：自由户型（画墙/门/窗）、户型模板、图纸底图、
 *       分部件调色、ACES 色调映射与环境反射
 * 依赖：three.min.js (r128) / OrbitControls.js / furniture.js
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 小工具 ---------- */
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var C = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var fmt = function (n) { return n.toLocaleString('zh-CN'); };
  var snap25 = function (v) { return Math.round(v / .25) * .25; };

  window.addEventListener('error', function (e) {
    var b = $('#errbox');
    if (b) { b.style.display = 'block'; b.textContent = '脚本错误：' + e.message; }
  });

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  /* ---------- 常量与状态 ---------- */
  var WALL_H = 2.8, WT = .12, SILL = .85, WINH = 1.5, DOORH = 2.05;
  var DOOR_W = .95, WIN_W = 1.7;

  var state = {
    night: false, snap: true, view: 'persp',
    tool: 'furniture',          // furniture | wall | door | window | walldelete
    placing: null, ghost: null, selected: null, hover: null, dragging: null, walk: null,
    drawing: null,              // 画墙链式起点 {ax,az}
    walls: [],                  // {ax,az,bx,bz,openings:[{type,t,w}]}
    bbox: { minX: -4, maxX: 4, minZ: -4, maxZ: 4 },
    wallColor: '#efe9df', floorId: 'oak',
    underlay: { mesh: null, opacity: .45, size: 8, visible: true, rot: 0 }
  };
  var items = [];
  var F = window.FURNITURE, CATS = window.FURNITURE_CATS;

  /* ---------- 渲染器 / 相机 / 控制器 ---------- */
  var viewport = $('#viewport');
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewport.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, 1, .1, 300);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.maxPolarAngle = Math.PI / 2 - .02;
  controls.minDistance = 1.2; controls.maxDistance = 40;
  controls.screenSpacePanning = false;
  controls.target.set(0, .7, 0);

  /* ---------- 环境反射（程序化天光） ---------- */
  var envTex = null;
  function buildEnv() {
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    var g = cv.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#b9d4ee'); gr.addColorStop(.48, '#eef3f5'); gr.addColorStop(.52, '#9a8f7c'); gr.addColorStop(1, '#6d6355');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    var sun = g.createRadialGradient(96, 14, 2, 96, 14, 22);
    sun.addColorStop(0, 'rgba(255,250,235,.95)'); sun.addColorStop(1, 'rgba(255,250,235,0)');
    g.fillStyle = sun; g.fillRect(60, 0, 70, 40);
    var tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    var pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    envTex = pm.fromEquirectangular(tex).texture;
    tex.dispose(); pm.dispose();
  }

  /* ---------- 灯光 ---------- */
  var hemi = new THREE.HemisphereLight('#dff0ff', '#9c8d7a', .5); scene.add(hemi);
  var sun = new THREE.DirectionalLight('#fff2dd', 1.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  sun.shadow.camera.near = .5; sun.shadow.camera.far = 80;
  scene.add(sun); scene.add(sun.target);
  var moon = new THREE.DirectionalLight('#8fb0ff', 0); moon.position.set(-8, 9, -5); scene.add(moon);
  var amb = new THREE.AmbientLight('#404860', 0); scene.add(amb);
  var lampA = new THREE.PointLight('#ffd7a3', 0, 10, 2); scene.add(lampA);
  var lampB = new THREE.PointLight('#ffd7a3', 0, 10, 2); scene.add(lampB);

  function fitLights() {
    var b = state.bbox;
    var cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    var bw = b.maxX - b.minX, bd = b.maxZ - b.minZ, m = Math.max(bw, bd);
    sun.position.set(cx + bw * .3, m * .95 + 3, cz + bd * .35);
    sun.target.position.set(cx, 0, cz);
    var s = m * .85 + 1.5, c = sun.shadow.camera;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s;
    c.updateProjectionMatrix();
    lampA.position.set(cx - bw / 4, 2.45, cz);
    lampB.position.set(cx + bw / 4, 2.45, cz - bd / 4);
  }

  /* ---------- 户外地面 ---------- */
  var ground = null;
  function makeGround() {
    if (ground) { ground.geometry.dispose(); ground.material.dispose(); scene.remove(ground); }
    var b = state.bbox;
    var cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    var r = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 1.6 + 8;
    ground = new THREE.Mesh(
      new THREE.CircleGeometry(r, 48),
      new THREE.MeshStandardMaterial({ color: C(state.night ? '#141a24' : '#b7c2a8'), roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, -.12, cz);
    ground.receiveShadow = true;
    scene.add(ground);
  }

  /* ---------- 程序化贴图 ---------- */
  function rnd01(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function texFromCanvas(cv) {
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function woodTexture(base, dark) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 512;
    var g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (var y = 0; y < 512; y += 64) {
      g.fillStyle = 'rgba(0,0,0,' + (.03 + rnd01(y * 7 + 1) * .06).toFixed(3) + ')';
      g.fillRect(0, y, 512, 64);
      g.fillStyle = 'rgba(255,255,255,' + (.02 + rnd01(y * 3) * .05).toFixed(3) + ')';
      g.fillRect(0, y, 512, 64);
      for (var i = 0; i < 16; i++) {
        g.strokeStyle = 'rgba(60,40,25,' + (.05 + rnd01(y * 31 + i) * .07).toFixed(3) + ')';
        g.lineWidth = rnd01(i * 3) > .7 ? 1.6 : 1;
        g.beginPath();
        var yy = y + rnd01(y + i * 13) * 64;
        g.moveTo(0, yy);
        g.bezierCurveTo(170, yy + rnd01(i * 3) * 6 - 3, 340, yy - rnd01(i * 5) * 6 + 3, 512, yy + rnd01(i * 7) * 4 - 2);
        g.stroke();
      }
      g.fillStyle = dark; g.globalAlpha = .85;
      g.fillRect(0, y + 62, 512, 2);
      g.fillRect(rnd01(y * 5) * 512, y, 2, 64);
      g.globalAlpha = 1;
    }
    return texFromCanvas(cv);
  }
  function tileTexture(base) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 512;
    var g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (var ty = 0; ty < 4; ty++) for (var tx = 0; tx < 4; tx++) {
      g.fillStyle = 'rgba(0,0,0,' + (rnd01(tx * 4 + ty * 9) * .05).toFixed(3) + ')';
      g.fillRect(tx * 128, ty * 128, 128, 128);
    }
    g.strokeStyle = 'rgba(80,80,80,.55)'; g.lineWidth = 3;
    for (var i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke();
    }
    return texFromCanvas(cv);
  }
  function marbleTexture(base) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 512;
    var g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    try { g.filter = 'blur(1.5px)'; } catch (e) { }
    for (var i = 0; i < 16; i++) {
      g.strokeStyle = 'rgba(150,158,168,' + (.14 + rnd01(i * 3) * .18).toFixed(3) + ')';
      g.lineWidth = .8 + rnd01(i * 7) * 1.8;
      g.beginPath();
      var x0 = rnd01(i * 11) * 512, y0 = rnd01(i * 13) * 512;
      g.moveTo(x0, y0);
      g.bezierCurveTo(x0 + 120, y0 + (rnd01(i) - .5) * 220, x0 + 300, y0 + (rnd01(i * 5) - .5) * 260, x0 + 460, y0 + (rnd01(i * 9) - .5) * 300);
      g.stroke();
    }
    try { g.filter = 'none'; } catch (e) { }
    return texFromCanvas(cv);
  }
  var FLOORS = [
    { id: 'oak', name: '浅橡木', dot: '#c8a273', scale: 1.44, make: function () { return woodTexture('#c8a273', '#8a6a48'); } },
    { id: 'walnut', name: '深胡桃', dot: '#6e4f38', scale: 1.44, make: function () { return woodTexture('#6e4f38', '#4a3526'); } },
    { id: 'graywood', name: '灰木纹', dot: '#a9a29a', scale: 1.44, make: function () { return woodTexture('#a9a29a', '#7c766e'); } },
    { id: 'tile', name: '灰瓷砖', dot: '#c9ccd0', scale: 3, make: function () { return tileTexture('#c9ccd0'); } },
    { id: 'marble', name: '白大理石', dot: '#e8eaec', scale: 3, make: function () { return marbleTexture('#e8eaec'); } }
  ];
  var texCache = {};
  function getTex(id) {
    if (!texCache[id]) {
      var f = FLOORS.filter(function (x) { return x.id === id; })[0] || FLOORS[0];
      texCache[id] = f.make();
    }
    return texCache[id];
  }

  /* ---------- 户型：地面 / 墙体 / 网格 ---------- */
  var floorGroup = null, floorMat = null, wallRoot = null, grid = null;
  var wallGroups = [];
  var wallMats = [];
  function getWallMat(idx) {
    if (!wallMats[idx]) {
      wallMats[idx] = new THREE.MeshStandardMaterial({ color: C(state.wallColor), roughness: .95 });
    }
    return wallMats[idx];
  }
  function setWallColor(hex) {
    state.wallColor = hex;
    wallMats.forEach(function (m) { if (m) m.color.set(C(hex)); });
  }
  function highlightWall(idx, hex) {
    wallMats.forEach(function (m, i) {
      if (!m) return;
      m.emissive.setHex(i === idx ? hex : 0x000000);
      m.emissiveIntensity = i === idx ? .45 : 1;
    });
  }
  function clearWallHighlight() { highlightWall(-1, 0x000000); }
  function wallLen(idx) {
    var w = state.walls[idx];
    return w ? Math.hypot(w.bx - w.ax, w.bz - w.az) : 0;
  }
  var frameMat = new THREE.MeshStandardMaterial({ color: C('#fafafa'), roughness: .5 });
  var bbMat = new THREE.MeshStandardMaterial({ color: C('#f5f2ec'), roughness: .7 });
  var doorPanelMat = new THREE.MeshStandardMaterial({ color: C('#7a5a3f'), roughness: .65 });
  var knobMat = new THREE.MeshStandardMaterial({ color: C('#c9a24a'), metalness: .8, roughness: .3 });
  var glassMat = new THREE.MeshStandardMaterial({
    color: C('#bfe3f2'), transparent: true, opacity: .35,
    roughness: .15, metalness: .4, side: THREE.DoubleSide,
    emissive: C('#16283e'), emissiveIntensity: 0
  });

  function computeBBox() {
    if (!state.walls.length) { state.bbox = { minX: -4, maxX: 4, minZ: -4, maxZ: 4 }; return; }
    var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    state.walls.forEach(function (w) {
      minX = Math.min(minX, w.ax, w.bx); maxX = Math.max(maxX, w.ax, w.bx);
      minZ = Math.min(minZ, w.az, w.bz); maxZ = Math.max(maxZ, w.az, w.bz);
    });
    state.bbox = { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
  }
  function bboxCenter() {
    var b = state.bbox;
    return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
  }

  function buildFloor() {
    if (floorGroup) {
      floorGroup.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      if (floorMat) floorMat.dispose();
      scene.remove(floorGroup);
    }
    floorGroup = new THREE.Group();
    var b = state.bbox;
    var bw = b.maxX - b.minX + .6, bd = b.maxZ - b.minZ + .6;
    var c = bboxCenter();
    var fl = FLOORS.filter(function (x) { return x.id === state.floorId; })[0] || FLOORS[0];
    var t = getTex(fl.id); t.repeat.set(bw / fl.scale, bd / fl.scale);
    floorMat = new THREE.MeshStandardMaterial({ map: t, roughness: .8, metalness: .05 });
    var slab = new THREE.Mesh(new THREE.BoxGeometry(bw, .1, bd), floorMat);
    slab.position.set(c.x, -.05, c.z);
    slab.receiveShadow = true;
    floorGroup.add(slab);
    scene.add(floorGroup);
  }

  function buildWallMesh(wall, idx) {
    var dx = wall.bx - wall.ax, dz = wall.bz - wall.az;
    var L = Math.hypot(dx, dz);
    if (L < .05) return null;
    var g = new THREE.Group();
    g.position.set(wall.ax, 0, wall.az);
    g.rotation.y = Math.atan2(-dz, dx);
    var H = WALL_H;
    var ops = (wall.openings || []).map(function (o) {
      return { type: o.type, a: o.t * L - o.w / 2, b: o.t * L + o.w / 2 };
    }).sort(function (p, q) { return p.a - q.a; });
    var segs = [], cur = 0;
    ops.forEach(function (o) {
      if (o.a - cur > .02) segs.push({ a: cur, b: o.a });
      cur = Math.max(cur, o.b);
    });
    if (L - cur > .02) segs.push({ a: cur, b: L });

    function wb(w, h, d, x, y, z, mat, noShadow) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = !noShadow; m.receiveShadow = true;
      m.userData.wallIdx = idx;
      g.add(m);
      return m;
    }
    segs.forEach(function (s) { wb(s.b - s.a, H, WT, (s.a + s.b) / 2, H / 2, 0, getWallMat(idx)); });
    segs.forEach(function (s) {
      [WT / 2 + .014, -(WT / 2 + .014)].forEach(function (z) {
        wb(s.b - s.a, .09, .026, (s.a + s.b) / 2, .045, z, bbMat, true);
      });
    });
    ops.forEach(function (o) {
      if (o.type === 'window') {
        wb(o.w, SILL, WT, (o.a + o.b) / 2, SILL / 2, 0, getWallMat(idx));
        wb(o.w, H - SILL - WINH, WT, (o.a + o.b) / 2, SILL + WINH + (H - SILL - WINH) / 2, 0, getWallMat(idx));
        wb(o.w + .2, .07, WT + .05, (o.a + o.b) / 2, SILL - .035, 0, frameMat);
        wb(o.w + .2, .07, WT + .05, (o.a + o.b) / 2, SILL + WINH + .035, 0, frameMat);
        wb(.07, WINH, WT + .05, o.a - .035, SILL + WINH / 2, 0, frameMat);
        wb(.07, WINH, WT + .05, o.b + .035, SILL + WINH / 2, 0, frameMat);
        wb(.05, WINH, .03, (o.a + o.b) / 2, SILL + WINH / 2, .02, frameMat);
        var glass = new THREE.Mesh(new THREE.PlaneGeometry(o.w, WINH), glassMat);
        glass.position.set((o.a + o.b) / 2, SILL + WINH / 2, 0);
        glass.userData.wallIdx = idx;
        g.add(glass);
      } else {
        wb(o.w, H - DOORH, WT, (o.a + o.b) / 2, DOORH + (H - DOORH) / 2, 0, getWallMat(idx));
        wb(o.w + .14, .07, WT + .05, (o.a + o.b) / 2, DOORH + .035, 0, frameMat);
        wb(.07, DOORH, WT + .05, o.a - .035, DOORH / 2, 0, frameMat);
        wb(.07, DOORH, WT + .05, o.b + .035, DOORH / 2, 0, frameMat);
        var panel = new THREE.Mesh(new THREE.BoxGeometry(o.w - .1, DOORH - .06, .05), doorPanelMat);
        panel.position.set((o.a + o.b) / 2, (DOORH - .06) / 2, 0);
        panel.castShadow = panel.receiveShadow = true;
        panel.userData.wallIdx = idx;
        g.add(panel);
        var knob = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 10), knobMat);
        knob.position.set((o.a + o.b) / 2 + o.w / 2 - .14, 1.0, .055);
        knob.userData.wallIdx = idx;
        g.add(knob);
      }
    });
    return g;
  }

  function buildWalls() {
    clearWallHighlight();
    if (wallRoot) {
      wallRoot.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      scene.remove(wallRoot);
    }
    wallMats.forEach(function (m) { if (m) m.dispose(); });
    wallMats = [];
    wallRoot = new THREE.Group();
    wallGroups = [];
    state.walls.forEach(function (w, i) {
      var g = buildWallMesh(w, i);
      if (g) { wallRoot.add(g); wallGroups[i] = g; }
    });
    scene.add(wallRoot);
  }

  function buildGrid() {
    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose(); grid.material.dispose();
    }
    var b = state.bbox, pts = [];
    for (var x = b.minX; x <= b.maxX + .001; x += .5) pts.push(x, 0, b.minZ, x, 0, b.maxZ);
    for (var z = b.minZ; z <= b.maxZ + .001; z += .5) pts.push(b.minX, 0, z, b.maxX, 0, z);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: C('#8fb7d9'), transparent: true, opacity: .28 }));
    grid.position.y = .005;
    grid.visible = false;
    scene.add(grid);
  }

  function buildAll() {
    computeBBox();
    buildFloor();
    buildWalls();
    buildGrid();
    fitLights();
    makeGround();
    if (state.underlay.mesh) {
      var c = bboxCenter();
      state.underlay.mesh.position.set(c.x, .02, c.z);
    }
  }

  /* ---------- 户型模板 ---------- */
  function rectWalls(x0, z0, x1, z1) {
    return [
      { ax: x0, az: z0, bx: x1, bz: z0, openings: [] },
      { ax: x1, az: z0, bx: x1, bz: z1, openings: [] },
      { ax: x1, az: z1, bx: x0, bz: z1, openings: [] },
      { ax: x0, az: z1, bx: x0, bz: z0, openings: [] }
    ];
  }
  function standardPreset(w, d) {
    var ws = rectWalls(-w / 2, -d / 2, w / 2, d / 2);
    ws[0].openings = [{ type: 'window', t: .5, w: WIN_W }];
    ws[3].openings = [{ type: 'door', t: .75, w: DOOR_W }];
    return ws;
  }
  var PRESETS = {
    standard: function () { return standardPreset(6, 5); },
    one: function () {
      var ws = rectWalls(-4, -3, 4, 3);
      ws[0].openings = [{ type: 'window', t: .28, w: WIN_W }, { type: 'window', t: .75, w: WIN_W }];
      ws[1].openings = [{ type: 'window', t: .5, w: WIN_W }];
      ws[2].openings = [{ type: 'door', t: .24, w: DOOR_W }];
      ws.push({ ax: -1, az: -3, bx: -1, bz: 3, openings: [{ type: 'door', t: .8, w: DOOR_W }] });
      return ws;
    },
    two: function () {
      var ws = rectWalls(-5, -3.5, 5, 3.5);
      ws[0].openings = [{ type: 'window', t: .3, w: WIN_W }, { type: 'window', t: .75, w: WIN_W }];
      ws[1].openings = [{ type: 'window', t: .5, w: WIN_W }];
      ws[2].openings = [{ type: 'door', t: .2, w: DOOR_W }];
      ws[3].openings = [{ type: 'window', t: .5, w: WIN_W }];
      ws.push({ ax: -1, az: -3.5, bx: -1, bz: 3.5, openings: [{ type: 'door', t: .25, w: DOOR_W }, { type: 'door', t: .75, w: DOOR_W }] });
      ws.push({ ax: -5, az: 0, bx: -1, bz: 0, openings: [] });
      return ws;
    },
    three: function () {
      var ws = rectWalls(-6, -4.5, 6, 4.5);
      ws[0].openings = [{ type: 'window', t: .25, w: WIN_W }, { type: 'window', t: .83, w: WIN_W }];
      ws[1].openings = [{ type: 'window', t: .55, w: WIN_W }];
      ws[2].openings = [{ type: 'door', t: .18, w: DOOR_W }, { type: 'window', t: .62, w: WIN_W }];
      ws[3].openings = [{ type: 'window', t: .78, w: WIN_W }];
      ws.push({ ax: -1.5, az: -4.5, bx: -1.5, bz: 4.5, openings: [{ type: 'door', t: .28, w: DOOR_W }, { type: 'door', t: .67, w: DOOR_W }] });
      ws.push({ ax: -6, az: .5, bx: -1.5, bz: .5, openings: [] });
      ws.push({ ax: 2.5, az: -4.5, bx: 2.5, bz: -1.5, openings: [{ type: 'door', t: .6, w: DOOR_W }] });
      ws.push({ ax: 2.5, az: -1.5, bx: 6, bz: -1.5, openings: [] });
      return ws;
    }
  };

  /* ---------- 画墙 / 门窗 / 删墙 ---------- */
  var wallPreview = null, wallStartMark = null;
  function ensureWallPreview() {
    if (!wallPreview) {
      wallPreview = new THREE.Mesh(
        new THREE.BoxGeometry(1, WALL_H, WT),
        new THREE.MeshStandardMaterial({ color: C('#cf8a5b'), transparent: true, opacity: .5, depthWrite: false })
      );
      wallPreview.castShadow = false;
      wallStartMark = new THREE.Mesh(
        new THREE.CylinderGeometry(.09, .09, .02, 20),
        new THREE.MeshBasicMaterial({ color: C('#cf8a5b') })
      );
      wallPreview.visible = wallStartMark.visible = false;
      scene.add(wallPreview); scene.add(wallStartMark);
    }
  }
  function hideWallPreview() {
    ensureWallPreview();
    wallPreview.visible = wallStartMark.visible = false;
  }
  function snapPoint(p) {
    var best = null, bd = .35;
    state.walls.forEach(function (w) {
      [[w.ax, w.az], [w.bx, w.bz]].forEach(function (q) {
        var d = Math.hypot(q[0] - p.x, q[1] - p.z);
        if (d < bd) { bd = d; best = { x: q[0], z: q[1] }; }
      });
    });
    if (best) return best;
    /* 吸附到已有墙线（方便拼角 / T 形接墙） */
    var bl = .18, bp = null;
    state.walls.forEach(function (w) {
      var ddx = w.bx - w.ax, ddz = w.bz - w.az, len2 = ddx * ddx + ddz * ddz;
      if (!len2) return;
      var tt = clamp(((p.x - w.ax) * ddx + (p.z - w.az) * ddz) / len2, 0, 1);
      var qx = w.ax + ddx * tt, qz = w.az + ddz * tt;
      var d = Math.hypot(p.x - qx, p.z - qz);
      if (d < bl) { bl = d; bp = { x: qx, z: qz }; }
    });
    if (bp) return bp;
    if (state.drawing) {
      var dx = p.x - state.drawing.ax, dz = p.z - state.drawing.az;
      if (Math.abs(dx) > 2.5 * Math.abs(dz)) return { x: snap25(p.x), z: state.drawing.az };
      if (Math.abs(dz) > 2.5 * Math.abs(dx)) return { x: state.drawing.ax, z: snap25(p.z) };
    }
    return { x: snap25(p.x), z: snap25(p.z) };
  }
  function updateWallPreview(e) {
    var p = floorHit(e);
    if (!p) { hideWallPreview(); return; }
    ensureWallPreview();
    var pt = snapPoint(p);
    var ax = state.drawing.ax, az = state.drawing.az;
    var dx = pt.x - ax, dz = pt.z - az;
    var L = Math.hypot(dx, dz);
    wallStartMark.position.set(ax, .012, az);
    wallStartMark.visible = true;
    if (L < .12) { wallPreview.visible = false; return; }
    wallPreview.visible = true;
    wallPreview.scale.set(L, 1, 1);
    wallPreview.position.set((ax + pt.x) / 2, WALL_H / 2, (az + pt.z) / 2);
    wallPreview.rotation.y = Math.atan2(-dz, dx);
    setHint('画墙：当前段 ' + L.toFixed(2) + 'm · 点击落墙 · 右键 / Esc 结束');
  }
  function handleWallClick(p) {
    if (!p) { state.drawing = null; hideWallPreview(); setHint(TOOL_HINTS.wall); return; }
    var pt = snapPoint(p);
    if (!state.drawing) {
      state.drawing = { ax: pt.x, az: pt.z };
      ensureWallPreview();
      wallStartMark.position.set(pt.x, .012, pt.z);
      wallStartMark.visible = true;
      setHint('画墙：移动到终点点击下一段（自动吸附端点/网格）· 右键或 Esc 结束');
    } else {
      var dx = pt.x - state.drawing.ax, dz = pt.z - state.drawing.az;
      if (Math.hypot(dx, dz) >= .5) {
        if (wallOverlaps(state.drawing.ax, state.drawing.az, pt.x, pt.z)) {
          toast('与已有墙体重叠，这段已跳过');
        } else {
          var nw = { ax: state.drawing.ax, az: state.drawing.az, bx: pt.x, bz: pt.z, openings: [] };
          state.walls.push(nw);
          pushHistory({ type: 'wall', wall: nw });
          buildAll(); persist();
        }
      }
      state.drawing = { ax: pt.x, az: pt.z };
    }
  }
  function removeWall(idx) {
    var removed = state.walls.splice(idx, 1)[0];
    pushHistory({ type: 'remove', idx: idx, wall: removed });
    buildAll(); clampItems(); persist();
    clearWallHighlight();
    toast('已删除该墙（Ctrl+Z 可撤销）');
  }
  /* ---- 撤销（墙体操作） ---- */
  var history = [];
  function pushHistory(a) {
    history.push(a);
    if (history.length > 60) history.shift();
  }
  function undoWall() {
    var a = history.pop();
    if (!a) { toast('没有可撤销的墙体操作'); return; }
    if (a.type === 'wall') {
      var i = state.walls.indexOf(a.wall);
      if (i >= 0) state.walls.splice(i, 1);
      toast('已撤销画墙');
    } else if (a.type === 'opening') {
      var w = state.walls[a.idx];
      if (w && w.openings) {
        var j = w.openings.indexOf(a.op);
        if (j >= 0) w.openings.splice(j, 1);
      }
      toast('已撤销开门/开窗');
    } else if (a.type === 'remove') {
      state.walls.splice(Math.min(a.idx, state.walls.length), 0, a.wall);
      toast('已恢复被删除的墙');
    }
    buildAll(); clampItems(); persist();
  }
  function wallOverlaps(ax, az, bx, bz) {
    var nax = bx - ax, naz = bz - az, L = Math.hypot(nax, naz);
    if (!L) return false;
    for (var i = 0; i < state.walls.length; i++) {
      var w = state.walls[i];
      var wx = w.bx - w.ax, wz = w.bz - w.az, WL = Math.hypot(wx, wz);
      if (!WL) continue;
      var dot = (nax * wx + naz * wz) / (L * WL);
      if (Math.abs(dot) < .999) continue;
      var mx = (w.ax + w.bx) / 2 - (ax + bx) / 2;
      var mz = (w.az + w.bz) / 2 - (az + bz) / 2;
      var perp = Math.abs(mx * (-naz / L) + mz * (nax / L));
      if (perp > .09) continue;
      var pa = ((w.ax - ax) * nax + (w.az - az) * naz) / (L * L);
      var pb = ((w.bx - ax) * nax + (w.bz - az) * naz) / (L * L);
      var lo = Math.max(Math.min(pa, pb), 0), hi = Math.min(Math.max(pa, pb), 1);
      if ((hi - lo) * L > .3) return true;
    }
    return false;
  }
  /* ---- 门/窗预选框 ---- */
  var openGhost = null;
  function ensureOpenGhost() {
    if (openGhost) return;
    var g = new THREE.Group();
    var quad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: C('#cf8a5b'), transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false })
    );
    var edgeMat = new THREE.LineBasicMaterial({ color: C('#ffd9b0') });
    var ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.5, 0, 0), new THREE.Vector3(.5, 0, 0),
      new THREE.Vector3(.5, 1, 0), new THREE.Vector3(-.5, 1, 0),
      new THREE.Vector3(-.5, 0, 0)
    ]), edgeMat);
    var mk = new THREE.Mesh(
      new THREE.CylinderGeometry(.05, .05, .02, 16),
      new THREE.MeshBasicMaterial({ color: C('#cf8a5b') })
    );
    var markA = mk.clone(), markB = mk.clone();
    g.add(quad); g.add(ring); g.add(markA); g.add(markB);
    g.visible = false;
    scene.add(g);
    openGhost = { g: g, quad: quad, ring: ring, markA: markA, markB: markB };
  }
  function computeOpening(e) {
    var hit = pickWall(e);
    if (!hit) return null;
    var idx = hit.object.userData.wallIdx;
    var wall = state.walls[idx], grp = wallGroups[idx];
    if (!wall || !grp) return null;
    var L = Math.hypot(wall.bx - wall.ax, wall.bz - wall.az);
    var w = state.tool === 'door' ? DOOR_W : WIN_W;
    if (L < w + .24) return { err: 'short' };
    var lp = grp.worldToLocal(hit.point.clone());
    var d = clamp(lp.x, w / 2 + .12, L - w / 2 - .12);
    d = Math.round((d - w / 2) / .05) * .05 + w / 2;
    d = clamp(d, w / 2 + .12, L - w / 2 - .12);
    var over = (wall.openings || []).some(function (o) {
      return Math.abs(o.t * L - d) < (o.w + w) / 2 + .15;
    });
    if (over) return { err: 'overlap' };
    return { idx: idx, L: L, w: w, d: d, type: state.tool };
  }
  function showOpeningGhost(o) {
    ensureOpenGhost();
    var wall = state.walls[o.idx];
    var ux = (wall.bx - wall.ax) / o.L, uz = (wall.bz - wall.az) / o.L;
    var y = o.type === 'door' ? DOORH / 2 : SILL + WINH / 2;
    var h = o.type === 'door' ? DOORH : WINH;
    var g = openGhost;
    g.g.position.set(wall.ax + ux * o.d, 0, wall.az + uz * o.d);
    g.g.rotation.y = Math.atan2(-uz, ux);
    g.quad.scale.set(o.w, h, 1);
    g.quad.position.set(0, y, 0);
    g.ring.scale.set(o.w, h, 1);
    g.ring.position.set(0, y, 0);
    g.markA.position.set(-o.w / 2, .01, 0);
    g.markB.position.set(o.w / 2, .01, 0);
    g.g.visible = true;
    setHint((o.type === 'door' ? '门洞' : '窗户') + ' ' + o.w.toFixed(2) + 'm：左端距墙起点 ' + (o.d - o.w / 2).toFixed(2)
      + 'm · 右端 ' + (o.d + o.w / 2).toFixed(2) + 'm（墙长 ' + o.L.toFixed(2) + 'm）· 点击确认');
  }
  function hideOpenGhost() { if (openGhost) openGhost.g.visible = false; }
  function clampItems() {
    items.forEach(function (it) {
      var c = clampPos(it.userData.def, it.rotation.y, it.userData.scale, it.position.x, it.position.z);
      it.position.set(c.x, 0, c.z);
    });
  }

  /* ---------- 提示 / 轻提示 ---------- */
  var HINT_DEFAULT = '左键选择 / 拖动家具 · 右键平移视角 · 滚轮缩放 · R 旋转 · Del 删除 · 双击聚焦';
  var TOOL_HINTS = {
    furniture: HINT_DEFAULT,
    wall: '画墙：点击起点 → 移动 → 点击终点，可连续画 · 右键 / Esc 结束',
    door: '开门洞：点击任意墙段（宽 0.95m）· Esc 退出工具',
    window: '开窗户：点击任意墙段（宽 1.7m）· Esc 退出工具',
    walldelete: '删墙：点击要删除的墙段 · Esc 退出工具'
  };
  function setHint(t) { $('#hint').textContent = t || TOOL_HINTS[state.tool] || HINT_DEFAULT; }
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------- 拾取 ---------- */
  var raycaster = new THREE.Raycaster();
  var floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function ptrNDC(e) {
    var r = renderer.domElement.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
  }
  function pickItem(e) {
    var n = ptrNDC(e);
    raycaster.setFromCamera(n, camera);
    var hits = raycaster.intersectObjects(items, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      while (o && !o.userData.def) o = o.parent;
      if (o) return o;
    }
    return null;
  }
  function pickWall(e) {
    if (!wallRoot) return null;
    var n = ptrNDC(e);
    raycaster.setFromCamera(n, camera);
    var hits = raycaster.intersectObjects(wallRoot.children, true);
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].object.userData.wallIdx != null) return hits[i];
    }
    return null;
  }
  function floorHit(e) {
    var n = ptrNDC(e);
    raycaster.setFromCamera(n, camera);
    var p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(floorPlane, p) ? p : null;
  }

  /* ---------- 摆放范围 ---------- */
  function halfExt(def, rot, scale) {
    var f = def.foot, c = Math.abs(Math.cos(rot || 0)), s = Math.abs(Math.sin(rot || 0)), sc = scale || 1;
    return [(c * f[0] + s * f[1]) * sc / 2, (s * f[0] + c * f[1]) * sc / 2];
  }
  function clampPos(def, rot, scale, x, z) {
    var he = halfExt(def, rot, scale), b = state.bbox, off = WT / 2;
    return {
      x: clamp(x, b.minX + off + he[0], b.maxX - off - he[0]),
      z: clamp(z, b.minZ + off + he[1], b.maxZ - off - he[1])
    };
  }
  function inRoom(def, rot, scale) {
    var he = halfExt(def, rot, scale), b = state.bbox, off = WT / 2;
    return he[0] <= (b.maxX - b.minX) / 2 - off + .001 && he[1] <= (b.maxZ - b.minZ) / 2 - off + .001;
  }
  function autoOrient(x, z) {
    var best = null, bd = .6;
    state.walls.forEach(function (w) {
      var dx = w.bx - w.ax, dz = w.bz - w.az, len2 = dx * dx + dz * dz;
      var t = len2 ? clamp(((x - w.ax) * dx + (z - w.az) * dz) / len2, 0, 1) : 0;
      var px = w.ax + dx * t, pz = w.az + dz * t;
      var d = Math.hypot(x - px, z - pz);
      if (d < bd) {
        bd = d;
        if (Math.abs(dx) > Math.abs(dz)) best = (z > pz) ? 0 : Math.PI;
        else best = (x > px) ? Math.PI / 2 : -Math.PI / 2;
      }
    });
    return best === null ? 0 : best;
  }

  /* ---------- 放置家具 ---------- */
  function placeItem(def, x, z, rot, parts, scale) {
    var g = def.build(parts);
    g.position.set(x, 0, z);
    g.rotation.y = rot || 0;
    g.scale.setScalar(scale || 1);
    g.userData = { def: def, parts: parts, scale: scale || 1 };
    scene.add(g);
    items.push(g);
    return g;
  }
  function normParts(def, r) {
    var p = {};
    def.parts.forEach(function (pt, i) {
      var v = null;
      if (r && r.p && typeof r.p[pt.key] === 'string') v = r.p[pt.key];
      else if (r && typeof r.c === 'string' && i === 0) v = r.c;
      p[pt.key] = /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : pt.dfl;
    });
    return p;
  }
  function startPlacing(def) {
    cancelPlacing();
    setTool('furniture', true);
    setSelected(null);
    state.placing = def;
    var g = def.build(null);
    g.traverse(function (o) {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true; o.material.opacity = .5; o.material.depthWrite = false;
        o.castShadow = o.receiveShadow = false;
      }
      if (o.isLight) o.visible = false;
    });
    g.visible = false;
    scene.add(g);
    state.ghost = g;
    document.body.classList.add('placing');
    renderer.domElement.style.cursor = 'crosshair';
    grid.visible = true;
    setHint('移动鼠标选择位置 · 左键放置 · Shift+左键连续放置 · 右键 / Esc 取消');
  }
  function cancelPlacing() {
    if (state.ghost) { scene.remove(state.ghost); disposeGroup(state.ghost); }
    state.ghost = null; state.placing = null;
    document.body.classList.remove('placing');
    renderer.domElement.style.cursor = '';
    if (grid) grid.visible = false;
    setHint(null);
  }
  function updateGhost(e) {
    var p = floorHit(e);
    if (!p) { state.ghost.visible = false; return; }
    var def = state.placing, rot = autoOrient(p.x, p.z);
    var c = clampPos(def, rot, 1, p.x, p.z);
    if (state.snap) { c.x = snap25(c.x); c.z = snap25(c.z); }
    state.ghost.position.set(c.x, 0, c.z);
    state.ghost.rotation.y = rot;
    state.ghost.visible = true;
    var ok = inRoom(def, rot, 1);
    state.ghost.traverse(function (o) {
      if (o.isMesh) o.material.emissive.setHex(ok ? 0x0c3a1e : 0x7a1010);
    });
  }
  function disposeGroup(g) {
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  /* ---------- 选中高亮 ---------- */
  function isGlow(m) { return m.userData && m.userData.isGlow; }
  function clearMarks(it) {
    if (!it) return;
    it.traverse(function (o) {
      if (o.isMesh && o.material && o.material.userData && o.material.userData._em !== undefined) {
        o.material.emissive.setHex(o.material.userData._em);
        o.material.emissiveIntensity = o.material.userData._emi;
        delete o.material.userData._em;
      }
    });
  }
  function mark(it, hex, inten) {
    it.traverse(function (o) {
      if (o.isMesh && o.material && o.material.emissive && !isGlow(o.material) && o.material.userData._em === undefined) {
        o.material.userData._em = o.material.emissive.getHex();
        o.material.userData._emi = o.material.emissiveIntensity;
        o.material.emissive.setHex(hex);
        o.material.emissiveIntensity = inten;
      }
    });
  }
  function setSelected(it) {
    if (state.selected === it) { refreshProps(); return; }
    if (state.selected) clearMarks(state.selected);
    if (state.hover && state.hover !== it) clearMarks(state.hover);
    state.hover = null;
    state.selected = it;
    if (it) mark(it, 0x1c4f9e, .32);
    refreshProps();
  }
  function setHover(it) {
    if (state.hover === it) return;
    if (state.hover && state.hover !== state.selected) clearMarks(state.hover);
    state.hover = it;
    if (it && it !== state.selected) mark(it, 0x17335f, .15);
    renderer.domElement.style.cursor = it ? 'grab' : (state.placing ? 'crosshair' : '');
  }

  /* ---------- 指针事件 ---------- */
  var downInfo = null;
  renderer.domElement.addEventListener('pointerdown', function (e) {
    if (state.walk) return;
    if (e.button === 2) {
      if (state.placing) cancelPlacing();
      if (state.drawing) { state.drawing = null; hideWallPreview(); setHint(null); }
      return;
    }
    if (e.button !== 0) return;
    var it = (state.tool === 'furniture' && !state.placing) ? pickItem(e) : null;
    if (it) controls.enabled = false;
    downInfo = { x: e.clientX, y: e.clientY, moved: false, item: it };
  });
  window.addEventListener('pointermove', function (e) {
    if (state.walk) return;
    if (state.tool === 'wall') {
      if (state.drawing) updateWallPreview(e);
      return;
    }
    if (state.tool === 'door' || state.tool === 'window') {
      var o = computeOpening(e);
      if (o && !o.err) { showOpeningGhost(o); return; }
      hideOpenGhost();
      setHint(o ? (o.err === 'short' ? '这面墙太短，装不下' : '这里已有门/窗，往外挪一点再点') : null);
      return;
    }
    if (state.tool === 'walldelete') {
      var hw = pickWall(e);
      highlightWall(hw ? hw.object.userData.wallIdx : -1, 0x8b1a1a);
      setHint(hw ? '点击删除这面墙（长 ' + wallLen(hw.object.userData.wallIdx).toFixed(2) + 'm）· Esc 退出工具' : null);
      return;
    }
    if (state.placing && state.ghost) { updateGhost(e); return; }
    if (downInfo && downInfo.item && (e.buttons & 1)) {
      if (!downInfo.moved && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) > 5) {
        downInfo.moved = true;
        state.dragging = downInfo.item;
        setSelected(downInfo.item);
        grid.visible = true;
        renderer.domElement.style.cursor = 'grabbing';
      }
      if (state.dragging) {
        var p = floorHit(e);
        if (p) {
          var it = state.dragging, def = it.userData.def;
          var rot = it.rotation.y, sc = it.userData.scale;
          var c = clampPos(def, rot, sc, p.x, p.z);
          if (state.snap) { c.x = snap25(c.x); c.z = snap25(c.z); }
          c = clampPos(def, rot, sc, c.x, c.z);
          it.position.set(c.x, 0, c.z);
        }
      }
      return;
    }
    if (!downInfo) setHover(e.target === renderer.domElement && state.tool === 'furniture' ? pickItem(e) : null);
  });
  window.addEventListener('pointerup', function (e) {
    if (e.button !== 0) return;
    var info = downInfo; downInfo = null;
    if (state.dragging) {
      state.dragging = null;
      grid.visible = false;
      renderer.domElement.style.cursor = '';
      persist();
    }
    /* 关键：无论是否拖拽，左键释放后都恢复轨道控制，避免视角“失灵” */
    if (!state.walk) controls.enabled = true;
    if (!info) return;
    if (e.target !== renderer.domElement) return;
    if (state.walk) return;
    if (info.moved) return;

    if (state.tool === 'wall') { handleWallClick(floorHit(e)); return; }
    if (state.tool === 'door' || state.tool === 'window') {
      var o = computeOpening(e);
      hideOpenGhost();
      if (!o || o.err) {
        toast(!o ? '请点击一面墙' : o.err === 'short' ? '这面墙太短，装不下' : '和已有的门/窗距离太近');
        return;
      }
      var wall = state.walls[o.idx];
      wall.openings = wall.openings || [];
      wall.openings.push({ type: o.type, t: +(o.d / o.L).toFixed(4), w: o.w });
      pushHistory({ type: 'opening', idx: o.idx, op: wall.openings[wall.openings.length - 1] });
      buildAll(); clampItems(); persist();
      toast(o.type === 'door' ? '已开设门洞（Ctrl+Z 可撤销）' : '已安装窗户（Ctrl+Z 可撤销）');
      return;
    }
    if (state.tool === 'walldelete') {
      var hit2 = pickWall(e);
      if (!hit2) { toast('请点击要删除的墙'); return; }
      removeWall(hit2.object.userData.wallIdx);
      return;
    }

    if (state.placing) {
      var p = floorHit(e);
      if (p) {
        var def = state.placing;
        if (!inRoom(def, 0, 1)) { toast('空间不够，放不下这件家具'); return; }
        var rot = autoOrient(p.x, p.z);
        var c = clampPos(def, rot, 1, p.x, p.z);
        if (state.snap) { c.x = snap25(c.x); c.z = snap25(c.z); }
        placeItem(def, c.x, c.z, rot, normParts(def, null), 1);
        toast('已添加「' + def.name + '」');
        updateStats(); persist();
        if (!e.shiftKey) cancelPlacing();
      }
      return;
    }
    setSelected(info.item || null);
  });
  /* 指针异常中断（取消/窗口失焦）时克降恢复，避免交互卡死 */
  function releasePointer() {
    downInfo = null;
    if (state.dragging) {
      state.dragging = null;
      grid.visible = false;
      renderer.domElement.style.cursor = '';
      persist();
    }
    if (!state.walk) controls.enabled = true;
  }
  window.addEventListener('pointercancel', releasePointer);
  window.addEventListener('blur', releasePointer);
  renderer.domElement.addEventListener('pointerleave', function () {
    setHover(null);
    hideOpenGhost();
    if (state.tool === 'walldelete') { clearWallHighlight(); setHint(null); }
  });
  renderer.domElement.addEventListener('dblclick', function (e) {
    var it = pickItem(e);
    if (it) tweenCamera(camera.position.clone(), new THREE.Vector3(it.position.x, .6, it.position.z), 600);
  });

  /* ---------- 键盘 ---------- */
  window.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (state.walk) {
      if (e.code === 'Escape') { exitWalk(); }
      else { state.walk.keys.add(e.code); }
      return;
    }
    if (e.code === 'Escape') {
      if (state.drawing) { state.drawing = null; hideWallPreview(); setHint(null); }
      else if (state.tool !== 'furniture') setTool('furniture');
      else if (state.placing) cancelPlacing();
      else setSelected(null);
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      if (state.selected) { e.preventDefault(); deleteSel(); }
    } else if (e.code === 'KeyR') {
      if (state.selected) rotateSel(45);
    } else if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) {
      if (state.selected) { e.preventDefault(); duplicateSel(); }
    } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); undoWall();
    } else if (e.code.indexOf('Arrow') === 0 && state.selected) {
      e.preventDefault();
      var st = .25;
      var dx = e.code === 'ArrowLeft' ? -st : e.code === 'ArrowRight' ? st : 0;
      var dz = e.code === 'ArrowUp' ? -st : e.code === 'ArrowDown' ? st : 0;
      var it = state.selected;
      var c = clampPos(it.userData.def, it.rotation.y, it.userData.scale, it.position.x + dx, it.position.z + dz);
      it.position.set(c.x, 0, c.z);
      persist();
    }
  });
  window.addEventListener('keyup', function (e) {
    if (state.walk) state.walk.keys.delete(e.code);
  });

  /* ---------- 工具切换 ---------- */
  function setTool(t, silent) {
    if (state.drawing) { state.drawing = null; hideWallPreview(); }
    hideOpenGhost();
    clearWallHighlight();
    cancelPlacing();
    state.tool = t;
    $$('.toolbtn').forEach(function (b) { b.classList.toggle('active', b.dataset.tool === t); });
    if (t === 'wall' && !silent) setView('top');
    setHint(null);
  }

  /* ---------- 选中项操作 ---------- */
  function rotateSel(deg) {
    var it = state.selected; if (!it) return;
    it.rotation.y += deg * Math.PI / 180;
    var c = clampPos(it.userData.def, it.rotation.y, it.userData.scale, it.position.x, it.position.z);
    it.position.set(c.x, 0, c.z);
    persist();
  }
  function scaleSel(s) {
    var it = state.selected; if (!it) return;
    it.userData.scale = s;
    it.scale.setScalar(s);
    var c = clampPos(it.userData.def, it.rotation.y, s, it.position.x, it.position.z);
    it.position.set(c.x, 0, c.z);
    refreshProps(); persist();
  }
  function applyPart(key, hex) {
    var it = state.selected; if (!it) return;
    var def = it.userData.def;
    var parts = Object.assign({}, it.userData.parts);
    parts[key] = hex;
    var x = it.position.x, z = it.position.z, r = it.rotation.y, s = it.userData.scale;
    clearMarks(it);
    scene.remove(it); disposeGroup(it);
    items.splice(items.indexOf(it), 1);
    var g = placeItem(def, x, z, r, parts, s);
    state.selected = g;
    mark(g, 0x1c4f9e, .32);
    refreshProps(); persist();
  }
  function duplicateSel() {
    var it = state.selected; if (!it) return;
    var def = it.userData.def;
    var c = clampPos(def, it.rotation.y, it.userData.scale, it.position.x + .45, it.position.z + .45);
    var g = placeItem(def, c.x, c.z, it.rotation.y, Object.assign({}, it.userData.parts), it.userData.scale);
    setSelected(g);
    updateStats(); persist();
    toast('已复制「' + def.name + '」');
  }
  function deleteSel() {
    var it = state.selected; if (!it) return;
    clearMarks(it);
    var name = it.userData.def.name;
    scene.remove(it); disposeGroup(it);
    items.splice(items.indexOf(it), 1);
    state.selected = null;
    refreshProps(); updateStats(); persist();
    toast('已删除「' + name + '」');
  }

  /* ---------- 属性面板 ---------- */
  function refreshProps() {
    var it = state.selected;
    var propSec = $('#propSec'), sceneSec = $('#sceneSec');
    if (!it) { propSec.hidden = true; sceneSec.hidden = false; return; }
    propSec.hidden = false; sceneSec.hidden = true;
    var def = it.userData.def;
    $('#propName').textContent = def.name;
    $('#propPrice').textContent = '¥' + fmt(def.price);
    var wrap = $('#propParts');
    wrap.innerHTML = '';
    def.parts.forEach(function (pt) {
      var sec = document.createElement('div');
      sec.className = 'part';
      var lb = document.createElement('div');
      lb.className = 'lbl';
      lb.textContent = pt.name;
      sec.appendChild(lb);
      var row = document.createElement('div');
      row.className = 'swrow';
      pt.choices.forEach(function (h) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sw' + (h === it.userData.parts[pt.key] ? ' active' : '');
        b.style.background = h;
        b.title = h;
        b.addEventListener('click', function () { applyPart(pt.key, h); });
        row.appendChild(b);
      });
      var inp = document.createElement('input');
      inp.type = 'color';
      inp.value = /^#[0-9a-fA-F]{6}$/.test(it.userData.parts[pt.key] || '') ? it.userData.parts[pt.key] : pt.dfl;
      inp.title = '自定义';
      inp.addEventListener('input', function () { applyPart(pt.key, inp.value); });
      row.appendChild(inp);
      sec.appendChild(row);
      wrap.appendChild(sec);
    });
    $$('#scaleRow .btn').forEach(function (b) {
      b.classList.toggle('active', parseFloat(b.dataset.s) === it.userData.scale);
    });
  }

  /* ---------- 统计 ---------- */
  function updateStats() {
    var total = items.reduce(function (s, it) { return s + it.userData.def.price; }, 0);
    $('#statCount').textContent = items.length;
    $('#statTotal').textContent = '¥' + fmt(total);
  }

  /* ---------- 序列化 / 恢复 / 示范 ---------- */
  function serialize() {
    return {
      v: 3,
      walls: state.walls.map(function (w) {
        return {
          ax: +w.ax.toFixed(3), az: +w.az.toFixed(3),
          bx: +w.bx.toFixed(3), bz: +w.bz.toFixed(3),
          openings: (w.openings || []).map(function (o) { return { type: o.type, t: o.t, w: o.w }; })
        };
      }),
      wall: state.wallColor, floor: state.floorId, night: state.night,
      items: items.map(function (it) {
        return {
          id: it.userData.def.id, p: it.userData.parts,
          x: +it.position.x.toFixed(3), z: +it.position.z.toFixed(3),
          r: +it.rotation.y.toFixed(3), s: it.userData.scale
        };
      })
    };
  }
  var persistTimer = null;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () { store.set('home3d.auto', JSON.stringify(serialize())); }, 150);
  }
  function clearItems() {
    cancelPlacing();
    if (state.selected) { clearMarks(state.selected); state.selected = null; refreshProps(); }
    items.slice().forEach(function (it) { scene.remove(it); disposeGroup(it); });
    items.length = 0;
    updateStats();
  }
  function restore(data) {
    if (!data) return false;
    clearItems();
    if (Array.isArray(data.walls) && data.walls.length) {
      state.walls = data.walls.map(function (w) {
        return {
          ax: +w.ax || 0, az: +w.az || 0, bx: +w.bx || 0, bz: +w.bz || 0,
          openings: Array.isArray(w.openings) ? w.openings.map(function (o) {
            return { type: o.type === 'door' ? 'door' : 'window', t: +o.t || .5, w: +o.w || (o.type === 'door' ? DOOR_W : WIN_W) };
          }) : []
        };
      });
    } else if (data.room && +data.room.w) {
      state.walls = standardPreset(clamp(+data.room.w || 6, 3, 30), clamp(+data.room.d || 5, 3, 30));
    } else {
      state.walls = PRESETS.standard();
    }
    if (/^#[0-9a-fA-F]{6}$/.test(data.wall || '')) state.wallColor = data.wall;
    if (FLOORS.some(function (f) { return f.id === data.floor; })) state.floorId = data.floor;
    state.night = !!data.night;
    setWallColor(state.wallColor);
    buildAll();
    syncRoomUI();
    applyNight();
    (Array.isArray(data.items) ? data.items : []).forEach(function (r) {
      var def = F[r.id]; if (!def) return;
      var parts = normParts(def, r);
      var c = clampPos(def, +r.r || 0, +r.s || 1, +r.x || 0, +r.z || 0);
      placeItem(def, c.x, c.z, +r.r || 0, parts, +r.s || 1);
    });
    updateStats();
    return true;
  }
  var DEMO = [
    { id: 'rug', x: 0, z: .55, r: 0 },
    { id: 'tvunit', x: 0, z: -2.26, r: 0 },
    { id: 'sofa3', x: 0, z: 1.85, r: Math.PI },
    { id: 'coffee', x: 0, z: .8, r: Math.PI },
    { id: 'floorlamp', x: -2.55, z: -1.95, r: 0 },
    { id: 'plant', x: 2.55, z: -2.1, r: 0 },
    { id: 'plant_small', x: 2.0, z: 2.1, r: 0 },
    { id: 'bookshelf', x: -2.8, z: .9, r: Math.PI / 2 },
    { id: 'sofa1', x: 2.2, z: .5, r: -1.1 },
    { id: 'vase', x: -1.4, z: -2.25, r: 0 }
  ];
  function loadDemo() {
    restore({
      walls: PRESETS.standard(),
      wall: '#efe9df', floor: 'oak', night: false,
      items: DEMO
    });
  }

  /* ---------- 昼夜 ---------- */
  function applyNight() {
    var n = state.night;
    document.body.classList.toggle('night', n);
    $('#btnNight').textContent = n ? '🌙 夜晚' : '☀ 白天';
    sun.intensity = n ? 0 : 1.35;
    moon.intensity = n ? .3 : 0;
    hemi.intensity = n ? .32 : .5;
    hemi.color.set(C(n ? '#31415e' : '#dff0ff'));
    hemi.groundColor.set(C(n ? '#0c0f14' : '#9c8d7a'));
    amb.intensity = n ? .35 : 0;
    lampA.intensity = lampB.intensity = n ? .95 : 0;
    scene.environment = n ? null : envTex;
    if (ground) ground.material.color.set(C(n ? '#141a24' : '#b7c2a8'));
    glassMat.emissiveIntensity = n ? .45 : 0;
    items.forEach(function (it) {
      if (it.userData.glowMats) it.userData.glowMats.forEach(function (m) {
        m.emissiveIntensity = n ? (m.userData.glowLevel || 1) : 0;
      });
      it.traverse(function (o) {
        if (o.isPointLight && o.userData.lamp) o.intensity = n ? .8 : 0;
      });
    });
  }

  /* ---------- 相机视角 ---------- */
  var camTween = null;
  function tweenCamera(p, t, ms) {
    camTween = {
      t0: performance.now(), ms: ms || 750,
      p0: camera.position.clone(), q0: controls.target.clone(),
      p1: p.clone(), q1: t.clone()
    };
  }
  function setActiveViewBtn() {
    $$('.viewbtn').forEach(function (b) { b.classList.toggle('active', b.dataset.view === state.view); });
  }
  function setView(v) {
    if (state.walk && v !== 'walk') exitWalk();
    state.view = v;
    var b = state.bbox, c = bboxCenter();
    var size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    if (v === 'persp') {
      tweenCamera(new THREE.Vector3(c.x + size * 1.02, size * .8, c.z + size * 1.25), new THREE.Vector3(c.x, .7, c.z));
    } else if (v === 'top') {
      tweenCamera(new THREE.Vector3(c.x, size * 1.7, c.z + .001), new THREE.Vector3(c.x, 0, c.z));
    } else if (v === 'walk') {
      if (state.walk) exitWalk(); else enterWalk();
    }
    setActiveViewBtn();
  }

  /* ---------- 漫游模式 ---------- */
  function enterWalk() {
    var c = bboxCenter();
    state.walk = { yaw: 0, pitch: 0, saved: { pos: camera.position.clone(), tgt: controls.target.clone() }, keys: new Set() };
    camera.rotation.order = 'YXZ';
    camera.position.set(c.x, 1.6, state.bbox.maxZ - WT / 2 - .4);
    camera.rotation.set(0, 0, 0);
    controls.enabled = false;
    cancelPlacing();
    setSelected(null);
    if (renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
    document.body.classList.add('walking');
    setHint('漫游模式：W / A / S / D 移动 · Shift 加速 · 鼠标环视 · Esc 退出');
  }
  function exitWalk() {
    if (!state.walk) return;
    var s = state.walk.saved;
    camera.rotation.set(0, 0, 0);
    camera.position.copy(s.pos);
    controls.target.copy(s.tgt);
    controls.enabled = true;
    controls.update();
    if (document.pointerLockElement) document.exitPointerLock();
    state.walk = null;
    state.view = 'persp';
    document.body.classList.remove('walking');
    setHint(null);
    setActiveViewBtn();
  }
  document.addEventListener('pointerlockchange', function () {
    if (!document.pointerLockElement && state.walk) exitWalk();
  });
  document.addEventListener('mousemove', function (e) {
    if (state.walk && document.pointerLockElement === renderer.domElement) {
      state.walk.yaw -= e.movementX * .0024;
      state.walk.pitch = clamp(state.walk.pitch - e.movementY * .0022, -1.35, 1.35);
    }
  });
  function walkUpdate(dt) {
    var wk = state.walk; if (!wk) return;
    var f = (wk.keys.has('KeyW') || wk.keys.has('ArrowUp') ? 1 : 0) - (wk.keys.has('KeyS') || wk.keys.has('ArrowDown') ? 1 : 0);
    var r = (wk.keys.has('KeyD') || wk.keys.has('ArrowRight') ? 1 : 0) - (wk.keys.has('KeyA') || wk.keys.has('ArrowLeft') ? 1 : 0);
    if (f || r) {
      var sp = (wk.keys.has('ShiftLeft') || wk.keys.has('ShiftRight') ? 3.4 : 1.9) * dt;
      var yaw = wk.yaw;
      var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      var rx = Math.cos(yaw), rz = -Math.sin(yaw);
      var vx = fx * f + rx * r, vz = fz * f + rz * r;
      var len = Math.hypot(vx, vz) || 1;
      var b = state.bbox, off = WT / 2 + .25;
      camera.position.x = clamp(camera.position.x + vx / len * sp, b.minX + off, b.maxX - off);
      camera.position.z = clamp(camera.position.z + vz / len * sp, b.minZ + off, b.maxZ - off);
    }
    camera.position.y = 1.6;
    camera.rotation.set(wk.pitch, wk.yaw, 0);
  }

  /* ---------- 目录与缩略图 ---------- */
  var thumbQueue = [], thumbR = null, thumbScene = null, thumbCam = null;
  function renderThumb(job) {
    if (!thumbR) {
      thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      thumbR.setSize(160, 160);
      thumbR.outputEncoding = THREE.sRGBEncoding;
      thumbScene = new THREE.Scene();
      thumbScene.add(new THREE.HemisphereLight('#ffffff', '#8a7968', .95));
      var dl = new THREE.DirectionalLight('#ffffff', .85);
      dl.position.set(2, 3, 2.5);
      thumbScene.add(dl);
      thumbCam = new THREE.PerspectiveCamera(32, 1, .01, 50);
    }
    var g = job.def.build(null);
    var box = new THREE.Box3().setFromObject(g);
    var size = box.getSize(new THREE.Vector3());
    var ctr = box.getCenter(new THREE.Vector3());
    g.position.set(-ctr.x, -box.min.y, -ctr.z);
    thumbScene.add(g);
    var r = Math.max(size.x, size.y, size.z);
    var dist = r * 1.5 + .3;
    thumbCam.position.set(dist * .8, dist * .68, dist * .95);
    thumbCam.lookAt(0, size.y * .42, 0);
    thumbR.render(thumbScene, thumbCam);
    job.img.src = thumbR.domElement.toDataURL('image/png');
    thumbScene.remove(g);
    disposeGroup(g);
  }
  function pumpThumbs() {
    requestAnimationFrame(function step() {
      var job = thumbQueue.shift();
      if (job) { renderThumb(job); requestAnimationFrame(step); }
    });
  }
  function renderGrid(cat) {
    var gridEl = $('#catGrid');
    gridEl.innerHTML = '';
    Object.keys(F).forEach(function (k) {
      var def = F[k];
      if (def.cat !== cat) return;
      var card = document.createElement('button');
      card.className = 'item';
      card.type = 'button';
      var img = document.createElement('img');
      img.alt = def.name;
      card.appendChild(img);
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = def.name;
      card.appendChild(nm);
      var pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = '¥' + fmt(def.price);
      card.appendChild(pr);
      card.addEventListener('click', function () { startPlacing(def); });
      gridEl.appendChild(card);
      thumbQueue.push({ def: def, img: img });
    });
    pumpThumbs();
  }
  function buildCatalog() {
    var tabs = $('#catTabs');
    Object.keys(CATS).forEach(function (k, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cattab' + (i === 0 ? ' active' : '');
      b.textContent = CATS[k];
      b.dataset.cat = k;
      b.addEventListener('click', function () {
        $$('.cattab').forEach(function (x) { x.classList.toggle('active', x === b); });
        renderGrid(k);
      });
      tabs.appendChild(b);
    });
    renderGrid('living');
  }

  /* ---------- 左侧页签 ---------- */
  function bindPanelTabs() {
    $$('.ptab').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.ptab').forEach(function (x) { x.classList.toggle('active', x === b); });
        $('#paneFurniture').hidden = b.dataset.pane !== 'furniture';
        $('#panePlan').hidden = b.dataset.pane !== 'plan';
      });
    });
  }

  /* ---------- 房间外观 UI ---------- */
  var WALLS = ['#f1ece2', '#dcd6cc', '#a9beca', '#b7c7b1', '#e9d9b8', '#ddc4ba'];
  function buildRoomUI() {
    var wr = $('#wallRow'); wr.innerHTML = '';
    WALLS.forEach(function (h) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw';
      b.style.background = h;
      b.title = h;
      b.addEventListener('click', function () {
        setWallColor(h);
        $$('#wallRow .sw').forEach(function (x) { x.classList.toggle('active', x === b); });
        persist();
      });
      wr.appendChild(b);
    });
    var fr = $('#floorRow'); fr.innerHTML = '';
    FLOORS.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw';
      b.style.background = f.dot;
      b.title = f.name;
      b.addEventListener('click', function () { setFloor(f.id); });
      fr.appendChild(b);
    });
  }
  function setFloor(id) {
    state.floorId = id;
    var f = FLOORS.filter(function (x) { return x.id === id; })[0];
    var t = getTex(id);
    var b = state.bbox;
    t.repeat.set((b.maxX - b.minX + .6) / f.scale, (b.maxZ - b.minZ + .6) / f.scale);
    if (floorMat) { floorMat.map = t; floorMat.needsUpdate = true; }
    $$('#floorRow .sw').forEach(function (x) { x.classList.toggle('active', x.title === f.name); });
    persist();
  }
  function syncRoomUI() {
    $$('#wallRow .sw').forEach(function (x) { x.classList.toggle('active', x.title === state.wallColor); });
    var f = FLOORS.filter(function (x) { return x.id === state.floorId; })[0];
    $$('#floorRow .sw').forEach(function (x) { x.classList.toggle('active', x.title === f.name); });
  }

  /* ---------- 图纸底图 ---------- */
  function setUnderlayImage(file) {
    var url = URL.createObjectURL(file);
    new THREE.TextureLoader().load(url, function (tex) {
      tex.encoding = THREE.sRGBEncoding;
      if (state.underlay.mesh) {
        scene.remove(state.underlay.mesh);
        state.underlay.mesh.geometry.dispose();
        state.underlay.mesh.material.map.dispose();
        state.underlay.mesh.material.dispose();
      }
      var mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: state.underlay.opacity, depthWrite: false
      });
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = state.underlay.rot;
      m.renderOrder = 2;
      m.scale.set(state.underlay.size, state.underlay.size * tex.image.height / tex.image.width, 1);
      var c = bboxCenter();
      m.position.set(c.x, .02, c.z);
      m.visible = state.underlay.visible;
      scene.add(m);
      state.underlay.mesh = m;
      toast('底图已铺入，建议切换「俯视」沿图描墙');
    });
  }
  function updateUnderlay() {
    var u = state.underlay;
    if (u.mesh) {
      u.mesh.material.opacity = u.opacity;
      u.mesh.visible = u.visible;
    }
  }

  /* ---------- 保存 / 读取 / 导出 / 导入 / 截图 ---------- */
  function download(name, href) {
    var a = document.createElement('a');
    a.href = href; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function bindUI() {
    $$('.viewbtn').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.dataset.view); });
    });
    $('#btnNight').addEventListener('click', function () {
      state.night = !state.night;
      applyNight(); persist();
    });
    $('#btnSnap').addEventListener('click', function () {
      state.snap = !state.snap;
      this.classList.toggle('active', state.snap);
      this.textContent = state.snap ? '吸附 开' : '吸附 关';
    });
    $('#btnSave').addEventListener('click', function () {
      store.set('home3d.saved', JSON.stringify(serialize()));
      toast('方案已保存到本浏览器');
    });
    $('#btnLoad').addEventListener('click', function () {
      var s = store.get('home3d.saved');
      if (!s) { toast('还没有保存过方案'); return; }
      try {
        restore(JSON.parse(s));
        toast('已载入保存的方案');
      } catch (e) { toast('方案数据损坏，无法读取'); }
    });
    $('#btnExport').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      download('家装方案.json', url);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('已导出家装方案.json');
    });
    $('#btnImport').addEventListener('click', function () { $('#fileImport').click(); });
    $('#fileImport').addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          restore(JSON.parse(fr.result));
          persist();
          toast('已导入方案');
        } catch (e) { toast('文件不是有效的方案 JSON'); }
      };
      fr.readAsText(file);
    });
    $('#btnShot').addEventListener('click', function () {
      scene.background = new THREE.Color(state.night ? '#141c2a' : '#dbe7f0');
      renderer.render(scene, camera);
      var url = renderer.domElement.toDataURL('image/png');
      scene.background = null;
      download('家居效果图.png', url);
      toast('效果图已导出');
    });
    $('#btnClear').addEventListener('click', function () {
      if (!items.length) { toast('场景已经是空的'); return; }
      if (window.confirm('确定要清空场景中的所有家具吗？')) {
        clearItems(); persist(); toast('场景已清空');
      }
    });
    $('#btnDemo').addEventListener('click', function () {
      loadDemo(); toast('已布置示范客厅');
    });
    /* 户型模板与工具 */
    $$('.preset-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.drawing = null; hideWallPreview();
        state.walls = PRESETS[b.dataset.preset]();
        buildAll(); clampItems(); persist();
        setTool('furniture', true);
        setView('persp');
        toast('已套用「' + b.textContent.trim() + '」户型');
      });
    });
    $$('.toolbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (state.tool === b.dataset.tool) setTool('furniture');
        else setTool(b.dataset.tool);
      });
    });
    $('#btnUndo').addEventListener('click', undoWall);
    /* 图纸底图 */
    $('#btnUnderlay').addEventListener('click', function () { $('#fileUnderlay').click(); });
    $('#fileUnderlay').addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (file) setUnderlayImage(file);
    });
    $('#btnUnderlayShow').addEventListener('click', function () {
      state.underlay.visible = !state.underlay.visible;
      this.textContent = state.underlay.visible ? '隐藏' : '显示';
      updateUnderlay();
    });
    $('#btnUnderlayRemove').addEventListener('click', function () {
      if (!state.underlay.mesh) { toast('还没有导入底图'); return; }
      scene.remove(state.underlay.mesh);
      state.underlay.mesh.geometry.dispose();
      state.underlay.mesh.material.map.dispose();
      state.underlay.mesh.material.dispose();
      state.underlay.mesh = null;
      toast('底图已移除');
    });
    $('#ulOpacity').addEventListener('input', function () {
      state.underlay.opacity = +this.value / 100;
      $('#ulOpV').textContent = this.value + '%';
      updateUnderlay();
    });
    $('#ulSize').addEventListener('input', function () {
      state.underlay.size = +this.value;
      $('#ulSizeV').textContent = this.value + ' m';
      var u = state.underlay;
      if (u.mesh) {
        var img = u.mesh.material.map.image;
        u.mesh.scale.set(u.size, u.size * img.height / img.width, 1);
      }
    });
    $('#btnUnderlayRot').addEventListener('click', function () {
      state.underlay.rot += Math.PI / 2;
      if (state.underlay.mesh) state.underlay.mesh.rotation.z = state.underlay.rot;
    });
    /* 属性面板 */
    $('#rotL').addEventListener('click', function () { rotateSel(-45); });
    $('#rotR').addEventListener('click', function () { rotateSel(45); });
    $$('#scaleRow .btn').forEach(function (b) {
      b.addEventListener('click', function () { scaleSel(parseFloat(b.dataset.s)); });
    });
    $('#btnDup').addEventListener('click', duplicateSel);
    $('#btnDel').addEventListener('click', deleteSel);
    /* 窄屏抽屉 */
    $('#catToggle').addEventListener('click', function () {
      document.body.classList.toggle('show-cat');
      document.body.classList.remove('show-side');
      resize();
    });
    $('#sideToggle').addEventListener('click', function () {
      document.body.classList.toggle('show-side');
      document.body.classList.remove('show-cat');
      resize();
    });
  }

  /* ---------- 尺寸自适应 ---------- */
  function resize() {
    var w = viewport.clientWidth, h = viewport.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  /* ---------- 主循环 ---------- */
  var last = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    var now = performance.now();
    var dt = Math.min(.05, (now - last) / 1000);
    last = now;
    if (camTween) {
      var k = Math.min(1, (now - camTween.t0) / camTween.ms);
      var e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(camTween.p0, camTween.p1, e);
      controls.target.lerpVectors(camTween.q0, camTween.q1, e);
      if (k >= 1) camTween = null;
    }
    if (state.walk) walkUpdate(dt);
    else if (controls.enabled) controls.update();
    renderer.render(scene, camera);
  }

  /* ---------- 启动 ---------- */
  buildEnv();
  buildAll();
  buildRoomUI();
  buildCatalog();
  bindPanelTabs();
  bindUI();
  syncRoomUI();
  applyNight();
  fitLights();
  setHint(null);

  var restored = false;
  var auto = store.get('home3d.auto');
  if (auto) {
    try { restored = restore(JSON.parse(auto)); } catch (e) { restored = false; }
  }
  if (!restored) {
    loadDemo();
    setTimeout(function () { toast('已布置示范客厅 · 左侧「户型」页签可换户型'); }, 900);
  }

  /* 开发自检钩子：?drawtest 验证画墙与开窗管线 */
  if (location.search.indexOf('drawtest') >= 0) {
    state.walls.push({ ax: -1.25, az: -1, bx: .75, bz: -1, openings: [] });
    addOpening(state.walls.length - 1, 'window', .5);
    setView('top');
  }

  var b0 = state.bbox, c0 = bboxCenter();
  var s0 = Math.max(b0.maxX - b0.minX, b0.maxZ - b0.minZ);
  camera.position.set(c0.x + s0 * 1.02, s0 * .8, c0.z + s0 * 1.25);
  controls.target.set(c0.x, .7, c0.z);
  resize();
  animate();
  requestAnimationFrame(function () {
    var l = $('#loader');
    l.classList.add('hide');
    setTimeout(function () { if (l.parentNode) l.parentNode.removeChild(l); }, 650);
  });
})();

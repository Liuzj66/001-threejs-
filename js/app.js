/* ============================================================
 * 宅匠 · 家居装修 3D 交互设计室 — 主程序
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

  window.addEventListener('error', function (e) {
    var b = $('#errbox');
    if (b) { b.style.display = 'block'; b.textContent = '脚本错误：' + e.message; }
  });

  /* ---------- 安全存储 ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  /* ---------- 全局状态 ---------- */
  var state = {
    night: false, snap: true, view: 'persp',
    placing: null, ghost: null, selected: null, hover: null,
    dragging: null, walk: null,
    room: { w: 6, d: 5, wall: '#efe9df', floor: 'oak' }
  };
  var items = [];
  var F = window.FURNITURE, CATS = window.FURNITURE_CATS;
  var WALL_H = 2.8, WT = .12;

  /* ---------- 渲染器 / 场景 / 相机 ---------- */
  var viewport = $('#viewport');
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewport.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, 1, .1, 200);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.maxPolarAngle = Math.PI / 2 - .02;
  controls.minDistance = 1.6; controls.maxDistance = 26;
  controls.screenSpacePanning = false;
  controls.target.set(0, .8, 0);

  /* ---------- 灯光 ---------- */
  var hemi = new THREE.HemisphereLight('#dff0ff', '#9c8d7a', .55); scene.add(hemi);
  var sun = new THREE.DirectionalLight('#fff2dd', 1.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  sun.shadow.camera.near = .5; sun.shadow.camera.far = 60;
  scene.add(sun); scene.add(sun.target);
  var moon = new THREE.DirectionalLight('#8fb0ff', 0); moon.position.set(-8, 9, -5); scene.add(moon);
  var amb = new THREE.AmbientLight('#404860', 0); scene.add(amb);
  var lampA = new THREE.PointLight('#ffd7a3', 0, 9, 2); scene.add(lampA);
  var lampB = new THREE.PointLight('#ffd7a3', 0, 9, 2); scene.add(lampB);

  function fitLights() {
    var w = state.room.w, d = state.room.d, m = Math.max(w, d);
    sun.position.set(w * .55, m * .95 + 3, d * .8);
    var s = m * .8 + 1.5, c = sun.shadow.camera;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s;
    c.updateProjectionMatrix();
    lampA.position.set(-w / 4, 2.45, 0);
    lampB.position.set(w / 4, 2.45, -d / 4);
  }

  /* ---------- 地面（户外场地） ---------- */
  var ground = null;
  function makeGround() {
    if (ground) { ground.geometry.dispose(); ground.material.dispose(); scene.remove(ground); }
    ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshStandardMaterial({ color: C(state.night ? '#141a24' : '#b7c2a8'), roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.12;
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
      g.fillStyle = 'rgba(0,0,0,' + (.02 + rnd01(y * 7 + 1) * .05).toFixed(3) + ')';
      g.fillRect(0, y, 512, 64);
      g.fillStyle = 'rgba(255,255,255,' + (.02 + rnd01(y * 3) * .05).toFixed(3) + ')';
      g.fillRect(0, y, 512, 64);
      for (var i = 0; i < 14; i++) {
        g.strokeStyle = 'rgba(60,40,25,' + (.04 + rnd01(y * 31 + i) * .06).toFixed(3) + ')';
        g.lineWidth = 1;
        g.beginPath();
        var yy = y + rnd01(y + i * 13) * 64;
        g.moveTo(0, yy);
        g.bezierCurveTo(170, yy + rnd01(i * 3) * 6 - 3, 340, yy - rnd01(i * 5) * 6 + 3, 512, yy + rnd01(i * 7) * 4 - 2);
        g.stroke();
      }
      g.fillStyle = dark; g.globalAlpha = .8;
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
    for (var i = 0; i < 14; i++) {
      g.strokeStyle = 'rgba(150,158,168,' + (.14 + rnd01(i * 3) * .16).toFixed(3) + ')';
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

  /* ---------- 房间 ---------- */
  var roomGroup = null, floorMat = null, wallMat = null, glassMat = null, grid = null;
  function wallBox(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function buildRoom() {
    if (roomGroup) {
      roomGroup.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      scene.remove(roomGroup);
    }
    roomGroup = new THREE.Group();
    var w = state.room.w, d = state.room.d;

    var fl = FLOORS.filter(function (x) { return x.id === state.room.floor; })[0] || FLOORS[0];
    var t = getTex(fl.id); t.repeat.set(w / fl.scale, d / fl.scale);
    floorMat = new THREE.MeshStandardMaterial({ map: t, roughness: .8, metalness: .05 });
    var floor = new THREE.Mesh(new THREE.BoxGeometry(w, .1, d), floorMat);
    floor.position.y = -.05;
    floor.receiveShadow = true;
    roomGroup.add(floor);

    wallMat = new THREE.MeshStandardMaterial({ color: C(state.room.wall), roughness: .95 });
    var fm = new THREE.MeshStandardMaterial({ color: C('#fafafa'), roughness: .5 });
    var bb = new THREE.MeshStandardMaterial({ color: C('#f5f2ec'), roughness: .7 });

    /* 背墙（-z）带窗 */
    var winW = 1.7, sill = .85, winH = 1.5;
    var segW = (w - winW) / 2;
    if (segW > .05) {
      roomGroup.add(wallBox(segW, WALL_H, WT, wallMat, -(winW / 2 + segW / 2), WALL_H / 2, -d / 2 - WT / 2));
      roomGroup.add(wallBox(segW, WALL_H, WT, wallMat, (winW / 2 + segW / 2), WALL_H / 2, -d / 2 - WT / 2));
    }
    roomGroup.add(wallBox(winW, sill, WT, wallMat, 0, sill / 2, -d / 2 - WT / 2));
    roomGroup.add(wallBox(winW, WALL_H - sill - winH, WT, wallMat, 0, sill + winH + (WALL_H - sill - winH) / 2, -d / 2 - WT / 2));
    /* 窗框 + 玻璃 */
    roomGroup.add(wallBox(winW + .21, .07, WT + .04, fm, 0, sill - .035, -d / 2 - WT / 2));
    roomGroup.add(wallBox(winW + .21, .07, WT + .04, fm, 0, sill + winH + .035, -d / 2 - WT / 2));
    roomGroup.add(wallBox(.07, winH, WT + .04, fm, -(winW / 2 + .035), sill + winH / 2, -d / 2 - WT / 2));
    roomGroup.add(wallBox(.07, winH, WT + .04, fm, (winW / 2 + .035), sill + winH / 2, -d / 2 - WT / 2));
    roomGroup.add(wallBox(.05, winH, .02, fm, 0, sill + winH / 2, -d / 2 + .02));
    glassMat = new THREE.MeshStandardMaterial({
      color: C('#bfe3f2'), transparent: true, opacity: .35,
      roughness: .15, metalness: .4, side: THREE.DoubleSide,
      emissive: C('#16283e'), emissiveIntensity: state.night ? .35 : 0
    });
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
    glass.position.set(0, sill + winH / 2, -d / 2 + .01);
    roomGroup.add(glass);

    /* 左墙（-x）带门 */
    var doorW = .95, doorH = 2.05, zc = -d / 2 + 1.25;
    var l1 = zc - doorW / 2 - (-d / 2), l2 = d / 2 - (zc + doorW / 2);
    if (l1 > .02) roomGroup.add(wallBox(WT, WALL_H, l1, wallMat, -w / 2 - WT / 2, WALL_H / 2, -d / 2 + l1 / 2));
    if (l2 > .02) roomGroup.add(wallBox(WT, WALL_H, l2, wallMat, -w / 2 - WT / 2, WALL_H / 2, zc + doorW / 2 + l2 / 2));
    roomGroup.add(wallBox(WT, WALL_H - doorH, doorW, wallMat, -w / 2 - WT / 2, doorH + (WALL_H - doorH) / 2, zc));
    roomGroup.add(wallBox(WT + .04, .07, doorW + .14, fm, -w / 2 - WT / 2, doorH + .035, zc));
    roomGroup.add(wallBox(WT + .04, doorH, .07, fm, -w / 2 - WT / 2, doorH / 2, zc - doorW / 2 - .035));
    roomGroup.add(wallBox(WT + .04, doorH, .07, fm, -w / 2 - WT / 2, doorH / 2, zc + doorW / 2 + .035));
    /* 门板（绕合页微开） */
    var door = new THREE.Group();
    var panel = new THREE.Mesh(
      new THREE.BoxGeometry(.05, doorH - .04, doorW - .06),
      new THREE.MeshStandardMaterial({ color: C('#7a5a3f'), roughness: .65 })
    );
    panel.position.set(0, (doorH - .04) / 2, 0);
    panel.castShadow = panel.receiveShadow = true;
    door.add(panel);
    var knob = new THREE.Mesh(
      new THREE.SphereGeometry(.032, 14, 12),
      new THREE.MeshStandardMaterial({ color: C('#c9a24a'), metalness: .8, roughness: .3 })
    );
    knob.position.set(.05, (doorH - .04) / 2, doorW / 2 - .12);
    door.add(knob);
    door.position.set(-w / 2 + .035, 0, zc - doorW / 2 + .03);
    door.rotation.y = .9;
    roomGroup.add(door);

    /* 踢脚线 */
    roomGroup.add(wallBox(w, .09, .028, bb, 0, .045, -d / 2 + .014));
    roomGroup.add(wallBox(.028, .09, d, bb, -w / 2 + .014, .045, 0));

    scene.add(roomGroup);
    makeGround();
    fitLights();
    buildGrid();
  }
  function buildGrid() {
    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose(); grid.material.dispose();
    }
    var w = state.room.w, d = state.room.d, pts = [];
    for (var x = -w / 2; x <= w / 2 + .001; x += .5) pts.push(x, 0, -d / 2, x, 0, d / 2);
    for (var z = -d / 2; z <= d / 2 + .001; z += .5) pts.push(-w / 2, 0, z, w / 2, 0, z);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: C('#8fb7d9'), transparent: true, opacity: .28 }));
    grid.position.y = .005;
    grid.visible = false;
    scene.add(grid);
  }

  /* ---------- 提示 / 轻提示 ---------- */
  var HINT_DEFAULT = '左键选择 / 拖动家具 · 右键平移视角 · 滚轮缩放 · R 旋转 · Del 删除 · 双击聚焦';
  function setHint(t) { $('#hint').textContent = t || HINT_DEFAULT; }
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
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

  /* ---------- 物体拾取与地面交点 ---------- */
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
    var he = halfExt(def, rot, scale);
    return {
      x: clamp(x, -state.room.w / 2 + he[0], state.room.w / 2 - he[0]),
      z: clamp(z, -state.room.d / 2 + he[1], state.room.d / 2 - he[1])
    };
  }
  function inRoom(def, rot, scale) {
    var he = halfExt(def, rot, scale);
    return he[0] <= state.room.w / 2 + .001 && he[1] <= state.room.d / 2 + .001;
  }
  function autoOrient(x, z) {
    var w = state.room.w, d = state.room.d, m = .55;
    if (z < -d / 2 + m) return 0;
    if (x < -w / 2 + m) return Math.PI / 2;
    if (x > w / 2 - m) return -Math.PI / 2;
    if (z > d / 2 - m) return Math.PI;
    return 0;
  }

  /* ---------- 放置 ---------- */
  function placeItem(def, x, z, rot, color, scale) {
    var g = def.build(color || def.colors[0]);
    g.position.set(x, 0, z);
    g.rotation.y = rot || 0;
    g.scale.setScalar(scale || 1);
    g.userData = { def: def, color: color || def.colors[0], scale: scale || 1 };
    scene.add(g);
    items.push(g);
    return g;
  }
  function startPlacing(def) {
    cancelPlacing();
    setSelected(null);
    state.placing = def;
    if (window.matchMedia && window.matchMedia('(max-width: 1024px)').matches) {
      document.body.classList.remove('show-cat');
    }
    var g = def.build(def.colors[0]);
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
    var def = state.placing, rot = 0;
    var c = clampPos(def, rot, 1, p.x, p.z);
    if (state.snap) { c.x = Math.round(c.x / .25) * .25; c.z = Math.round(c.z / .25) * .25; }
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

  /* ---------- 指针事件 ---------- */
  var downInfo = null;
  renderer.domElement.addEventListener('pointerdown', function (e) {
    if (state.walk) return;
    if (e.button === 2) { if (state.placing) cancelPlacing(); return; }
    if (e.button !== 0) return;
    var it = state.placing ? null : pickItem(e);
    if (it && !state.placing) controls.enabled = false;
    downInfo = { x: e.clientX, y: e.clientY, moved: false, item: it };
  });
  window.addEventListener('pointermove', function (e) {
    if (state.walk) return;
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
          if (state.snap) { c.x = Math.round(c.x / .25) * .25; c.z = Math.round(c.z / .25) * .25; }
          c = clampPos(def, rot, sc, c.x, c.z);
          it.position.set(c.x, 0, c.z);
        }
      }
      return;
    }
    if (!downInfo) setHover(e.target === renderer.domElement ? pickItem(e) : null);
  });
  window.addEventListener('pointerup', function (e) {
    if (e.button !== 0) return;
    var info = downInfo; downInfo = null;
    if (state.dragging) {
      state.dragging = null;
      controls.enabled = true;
      grid.visible = false;
      renderer.domElement.style.cursor = '';
      persist();
    }
    if (!info) return;
    if (e.target !== renderer.domElement) return;
    if (state.walk) return;
    if (state.placing) {
      if (!info.moved) {
        var p = floorHit(e);
        if (p) {
          var def = state.placing;
          if (!inRoom(def, 0, 1)) { toast('空间不够，放不下这件家具'); return; }
          var rot = autoOrient(p.x, p.z);
          var c = clampPos(def, rot, 1, p.x, p.z);
          if (state.snap) { c.x = Math.round(c.x / .25) * .25; c.z = Math.round(c.z / .25) * .25; }
          placeItem(def, c.x, c.z, rot, def.colors[0], 1);
          toast('已添加「' + def.name + '」');
          updateStats(); persist();
          if (!e.shiftKey) cancelPlacing();
        }
      }
      return;
    }
    if (!info.moved) setSelected(info.item || null);
  });
  renderer.domElement.addEventListener('pointerleave', function () { setHover(null); });
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
      if (state.placing) cancelPlacing(); else setSelected(null);
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      if (state.selected) { e.preventDefault(); deleteSel(); }
    } else if (e.code === 'KeyR') {
      if (state.selected) rotateSel(45);
    } else if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) {
      if (state.selected) { e.preventDefault(); duplicateSel(); }
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
  function applyColor(hex) {
    var it = state.selected; if (!it) return;
    var def = it.userData.def;
    var x = it.position.x, z = it.position.z, r = it.rotation.y, s = it.userData.scale;
    clearMarks(it);
    scene.remove(it); disposeGroup(it);
    items.splice(items.indexOf(it), 1);
    var g = placeItem(def, x, z, r, hex, s);
    state.selected = g;
    mark(g, 0x1c4f9e, .32);
    refreshProps(); persist();
  }
  function duplicateSel() {
    var it = state.selected; if (!it) return;
    var def = it.userData.def;
    var c = clampPos(def, it.rotation.y, it.userData.scale, it.position.x + .45, it.position.z + .45);
    var g = placeItem(def, c.x, c.z, it.rotation.y, it.userData.color, it.userData.scale);
    setSelected(g);
    updateStats(); persist();
    toast('已复制「' + def.name + '」');
  }
  function deleteSel() {
    var it = state.selected; if (!it) return;
    clearMarks(it);
    scene.remove(it); disposeGroup(it);
    items.splice(items.indexOf(it), 1);
    state.selected = null;
    refreshProps(); updateStats(); persist();
    toast('已删除「' + it.userData.def.name + '」');
  }

  /* ---------- 属性面板 / 场景面板 ---------- */
  function refreshProps() {
    var it = state.selected;
    var propSec = $('#propSec'), sceneSec = $('#sceneSec');
    if (!it) { propSec.hidden = true; sceneSec.hidden = false; return; }
    propSec.hidden = false; sceneSec.hidden = true;
    var def = it.userData.def;
    $('#propName').textContent = def.name;
    $('#propPrice').textContent = '¥' + fmt(def.price);
    var sw = $('#propSwatches'); sw.innerHTML = '';
    def.colors.forEach(function (h) {
      var b = document.createElement('button');
      b.className = 'sw' + (h === it.userData.color ? ' active' : '');
      b.style.background = h;
      b.title = h;
      b.addEventListener('click', function () { applyColor(h); });
      sw.appendChild(b);
    });
    $('#propColor').value = /^#[0-9a-fA-F]{6}$/.test(it.userData.color) ? it.userData.color : '#b98d6f';
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
      v: 1,
      room: { w: state.room.w, d: state.room.d, wall: state.room.wall, floor: state.room.floor },
      night: state.night,
      items: items.map(function (it) {
        return {
          id: it.userData.def.id, c: it.userData.color,
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
    if (!data || !Array.isArray(data.items)) return false;
    clearItems();
    if (data.room) {
      state.room.w = clamp(+data.room.w || 6, 4, 10);
      state.room.d = clamp(+data.room.d || 5, 4, 10);
      if (/^#[0-9a-fA-F]{6}$/.test(data.room.wall || '')) state.room.wall = data.room.wall;
      if (FLOORS.some(function (f) { return f.id === data.room.floor; })) state.room.floor = data.room.floor;
    }
    state.night = !!data.night;
    buildRoom();
    syncRoomUI();
    applyNight();
    var ok = 0;
    data.items.forEach(function (r) {
      var def = F[r.id]; if (!def) return;
      var col = def.colors.indexOf(r.c) >= 0 ? r.c : def.colors[0];
      placeItem(def, +r.x || 0, +r.z || 0, +r.r || 0, col, +r.s || 1);
      ok++;
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
    { id: 'plant', x: 2.55, z: 1.9, r: 0 },
    { id: 'bookshelf', x: -2.8, z: .9, r: Math.PI / 2 },
    { id: 'sofa1', x: 2.2, z: .5, r: -1.1 },
    { id: 'vase', x: -1.4, z: -2.25, r: 0 }
  ];
  function loadDemo() {
    restore({
      room: { w: 6, d: 5, wall: '#efe9df', floor: 'oak' },
      night: false,
      items: DEMO
    });
  }

  /* ---------- 昼夜 ---------- */
  function applyNight() {
    var n = state.night;
    document.body.classList.toggle('night', n);
    $('#btnNight').textContent = n ? '🌙 夜晚' : '☀ 白天';
    sun.intensity = n ? 0 : 1.1;
    moon.intensity = n ? .22 : 0;
    hemi.intensity = n ? .3 : .55;
    hemi.color.set(C(n ? '#31415e' : '#dff0ff'));
    hemi.groundColor.set(C(n ? '#0c0f14' : '#9c8d7a'));
    amb.intensity = n ? .3 : 0;
    lampA.intensity = lampB.intensity = n ? .85 : 0;
    if (ground) ground.material.color.set(C(n ? '#141a24' : '#b7c2a8'));
    if (glassMat) glassMat.emissiveIntensity = n ? .35 : 0;
    items.forEach(function (it) {
      if (it.userData.glowMats) it.userData.glowMats.forEach(function (m) {
        m.emissiveIntensity = n ? (m.userData.glowLevel || 1) : 0;
      });
      it.traverse(function (o) {
        if (o.isPointLight && o.userData.lamp) o.intensity = n ? .7 : 0;
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
    var w = state.room.w, d = state.room.d, m = Math.max(w, d);
    if (v === 'persp') {
      tweenCamera(new THREE.Vector3(m * 1.05, m * .85, m * 1.3), new THREE.Vector3(0, .7, 0));
    } else if (v === 'top') {
      tweenCamera(new THREE.Vector3(0, m * 1.7, .001), new THREE.Vector3(0, 0, 0));
    } else if (v === 'walk') {
      if (state.walk) exitWalk(); else enterWalk();
    }
    setActiveViewBtn();
  }

  /* ---------- 漫游模式 ---------- */
  function enterWalk() {
    state.walk = { yaw: 0, pitch: 0, saved: { pos: camera.position.clone(), tgt: controls.target.clone() }, keys: new Set() };
    camera.rotation.order = 'YXZ';
    camera.position.set(0, 1.6, state.room.d / 2 - .5);
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
      camera.position.x = clamp(camera.position.x + vx / len * sp, -state.room.w / 2 + .25, state.room.w / 2 - .25);
      camera.position.z = clamp(camera.position.z + vz / len * sp, -state.room.d / 2 + .25, state.room.d / 2 - .25);
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
    var g = job.def.build(job.def.colors[0]);
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

  /* ---------- 房间 UI ---------- */
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
        state.room.wall = h;
        if (wallMat) wallMat.color.set(C(h));
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
    state.room.floor = id;
    var f = FLOORS.filter(function (x) { return x.id === id; })[0];
    var t = getTex(id);
    t.repeat.set(state.room.w / f.scale, state.room.d / f.scale);
    if (floorMat) { floorMat.map = t; floorMat.needsUpdate = true; }
    $$('#floorRow .sw').forEach(function (x) { x.classList.toggle('active', x.title === f.name); });
    persist();
  }
  var roomDebounce = null;
  function onRoomSlider() {
    state.room.w = parseFloat($('#roomW').value);
    state.room.d = parseFloat($('#roomD').value);
    $('#roomWv').textContent = state.room.w + ' m';
    $('#roomDv').textContent = state.room.d + ' m';
    clearTimeout(roomDebounce);
    roomDebounce = setTimeout(function () {
      buildRoom();
      items.forEach(function (it) {
        var c = clampPos(it.userData.def, it.rotation.y, it.userData.scale, it.position.x, it.position.z);
        it.position.set(c.x, 0, c.z);
      });
      persist();
    }, 120);
  }
  function syncRoomUI() {
    $('#roomW').value = state.room.w;
    $('#roomD').value = state.room.d;
    $('#roomWv').textContent = state.room.w + ' m';
    $('#roomDv').textContent = state.room.d + ' m';
    $$('#wallRow .sw').forEach(function (x) { x.classList.toggle('active', x.title === state.room.wall); });
    var f = FLOORS.filter(function (x) { return x.id === state.room.floor; })[0];
    $$('#floorRow .sw').forEach(function (x) { x.classList.toggle('active', x.title === f.name); });
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
      loadDemo(); persist(); toast('已布置示范客厅');
    });
    $('#roomW').addEventListener('input', onRoomSlider);
    $('#roomD').addEventListener('input', onRoomSlider);
    /* 属性面板 */
    $('#rotL').addEventListener('click', function () { rotateSel(-45); });
    $('#rotR').addEventListener('click', function () { rotateSel(45); });
    $$('#scaleRow .btn').forEach(function (b) {
      b.addEventListener('click', function () { scaleSel(parseFloat(b.dataset.s)); });
    });
    $('#propColor').addEventListener('input', function () {
      if (/^#[0-9a-fA-F]{6}$/.test(this.value)) applyColor(this.value);
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
  buildRoom();
  buildRoomUI();
  buildCatalog();
  bindUI();
  syncRoomUI();
  applyNight();
  fitLights();

  var restored = false;
  var auto = store.get('home3d.auto');
  if (auto) {
    try { restored = restore(JSON.parse(auto)); } catch (e) { restored = false; }
  }
  if (!restored) {
    loadDemo();
    setTimeout(function () { toast('已为您布置示范客厅 · 点击左侧目录添加家具'); }, 900);
  }

  camera.position.set(6.3, 5.1, 7.8);
  controls.target.set(0, .7, 0);
  resize();
  animate();
  requestAnimationFrame(function () {
    var l = $('#loader');
    l.classList.add('hide');
    setTimeout(function () { if (l.parentNode) l.parentNode.removeChild(l); }, 650);
  });
})();

/* ============================================================
 * 家具模型工厂 v2 — 39 件家具 · 分部件配色
 * 约定：模型原点在地面中心，正面朝 +z；尺寸单位为米（真实比例）
 * build(parts) 中 parts = {部件key: '#hex'}；缺省时用 pt.dfl
 * userData.glowMats 为夜间发光材质
 * ============================================================ */
(function () {
  'use strict';

  var FURNITURE = {};
  var CATS = { living: '客厅', bedroom: '卧室', study: '书房 · 餐厅', kitchen: '厨卫', decor: '装饰' };

  /* ---------- 基础工具 ---------- */
  function C(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function M(hex, o) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: C(hex), roughness: .85, metalness: 0 }, o || {}));
  }
  function pv(p, k, d) { var v = p ? p[k] : null; return (typeof v === 'string' && v) ? v : d; }
  function tint(hex, f) {
    var c = new THREE.Color(hex);
    if (f >= 0) c.lerp(new THREE.Color('#ffffff'), f); else c.lerp(new THREE.Color('#000000'), -f);
    return '#' + c.getHexString();
  }
  function mesh(geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function B(w, h, d, mat, x, y, z) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
  function Cy(rt, rb, h, mat, x, y, z, seg) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), mat, x, y, z); }
  function S(r, mat, x, y, z) { return mesh(new THREE.SphereGeometry(r, 18, 14), mat, x, y, z); }
  function Ico(r, mat, x, y, z) { return mesh(new THREE.IcosahedronGeometry(r, 0), mat, x, y, z); }
  function Tor(r, t, mat, x, y, z) { return mesh(new THREE.TorusGeometry(r, t, 10, 28), mat, x, y, z); }
  function legs(g, w, d, h, mat, r) {
    var x = w / 2 - .07, z = d / 2 - .07;
    [[x, z], [-x, z], [x, -z], [-x, -z]].forEach(function (p) { g.add(Cy(r || .025, r || .025, h, mat, p[0], h / 2, p[1])); });
  }
  function P(k, n, d, c) { return { key: k, name: n, dfl: d, choices: c }; }
  function rnd(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ---------- 通用色板 ---------- */
  var FABRIC = ['#b98d6f', '#7f8ea3', '#8a9a5b', '#c97b63', '#6d7b8c', '#ded5c4', '#a67f8e', '#5d7263'];
  var CUSHION = ['#d9c6ae', '#c8d3dc', '#c9d2b8', '#dcae97', '#c6ccd4', '#efe9dd', '#d9c0cc', '#b8c4b0'];
  var WOOD = ['#8a6a4f', '#5a4632', '#3d3a36', '#c2a878', '#9c7b5e', '#4a5568'];
  var LIGHTWOOD = ['#c2a878', '#8a6a4f', '#a9a29a', '#ded5c4', '#5a4632', '#9c7b5e'];
  var DARKLEG = ['#3d3128', '#2c2f34', '#5a4632', '#c9a24a', '#b8bec6', '#1c1e22'];
  var STONE = ['#e9e5dd', '#d7d3ca', '#c9ccd0', '#e8eaec', '#b8bec6', '#9aa3ad'];
  var APPLIANCE = ['#ccd1d7', '#e8eaec', '#aab4be', '#5a6470', '#3d3a36', '#b98d6f'];
  var PORCELAIN = ['#f2f4f6', '#e8e2d5', '#cdd8de', '#ded5c4', '#d7e0e4', '#e6d9d4'];
  var POTTED = ['#b0674f', '#8a8f96', '#ded5c4', '#5a4632', '#7f8ea3', '#3d3a36'];

  function reg(def) { FURNITURE[def.id] = def; }

  /* ================= 客厅 ================= */

  reg({
    id: 'sofa3', name: '三人沙发', cat: 'living', price: 3999, foot: [2.15, .95],
    parts: [P('main', '沙发主体', '#b98d6f', FABRIC), P('cushion', '坐垫靠垫', '#d9c6ae', CUSHION), P('leg', '沙发腿', '#3d3128', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      var f = M(pv(p, 'main', '#b98d6f'), { roughness: .92 });
      var cu = M(pv(p, 'cushion', '#d9c6ae'), { roughness: .95 });
      g.add(B(2.15, .3, .95, f, 0, .23, 0));
      for (var i = -1; i <= 1; i++) {
        g.add(B(.62, .17, .78, cu, i * .7, .465, .06));
        g.add(B(.62, .4, .15, cu, i * .7, .6, -.33));
      }
      g.add(B(2.15, .52, .2, f, 0, .62, -.375));
      g.add(B(.24, .34, .95, f, -2.15 / 2 + .12, .46, 0));
      g.add(B(.24, .34, .95, f, 2.15 / 2 - .12, .46, 0));
      legs(g, 2.15, .95, .08, M(pv(p, 'leg', '#3d3128'), { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'sofa1', name: '单人沙发', cat: 'living', price: 1599, foot: [1.0, .95],
    parts: [P('main', '沙发主体', '#7f8ea3', FABRIC), P('cushion', '坐垫靠垫', '#c8d3dc', CUSHION), P('leg', '沙发腿', '#3d3128', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      var f = M(pv(p, 'main', '#7f8ea3'), { roughness: .92 });
      var cu = M(pv(p, 'cushion', '#c8d3dc'), { roughness: .95 });
      g.add(B(1.0, .3, .95, f, 0, .23, 0));
      g.add(B(.66, .17, .78, cu, 0, .465, .06));
      g.add(B(.66, .42, .15, cu, 0, .61, -.33));
      g.add(B(.24, .34, .95, f, -.38, .46, 0));
      g.add(B(.24, .34, .95, f, .38, .46, 0));
      legs(g, 1.0, .95, .08, M(pv(p, 'leg', '#3d3128'), { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'chaise', name: '贵妃躺椅', cat: 'living', price: 2599, foot: [1.7, .8],
    parts: [P('main', '主体', '#a67f8e', FABRIC), P('cushion', '软垫', '#d9c0cc', CUSHION), P('leg', '椅腿', '#5a4632', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      var f = M(pv(p, 'main', '#a67f8e'), { roughness: .92 });
      var cu = M(pv(p, 'cushion', '#d9c0cc'), { roughness: .95 });
      g.add(B(1.7, .28, .8, f, 0, .22, 0));
      g.add(B(.2, .55, .8, f, -.72, .6, 0));
      g.add(B(.2, .32, .8, f, .72, .5, 0));
      g.add(B(1.16, .14, .68, cu, .14, .43, .02));
      g.add(B(.42, .36, .16, cu, -.42, .66, -.28));
      var bol = Cy(.11, .11, .6, cu, .38, .6, -.22);
      bol.rotation.z = Math.PI / 2; g.add(bol);
      legs(g, 1.7, .8, .08, M(pv(p, 'leg', '#5a4632'), { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'pouf', name: '圆墩', cat: 'living', price: 299, foot: [.64, .64],
    parts: [P('main', '墩身', '#c97b63', FABRIC), P('top', '顶面', '#dcae97', CUSHION)],
    build: function (p) {
      var g = new THREE.Group();
      g.add(Cy(.3, .33, .3, M(pv(p, 'main', '#c97b63'), { roughness: .95 }), 0, .15, 0));
      g.add(Cy(.31, .31, .09, M(pv(p, 'top', '#dcae97'), { roughness: 1 }), 0, .335, 0));
      var band = Tor(.315, .012, M(tint(pv(p, 'main', '#c97b63'), -.25), { roughness: .9 }), 0, .28, 0);
      band.rotation.x = Math.PI / 2; band.castShadow = false; g.add(band);
      return g;
    }
  });

  reg({
    id: 'coffee', name: '茶几', cat: 'living', price: 899, foot: [1.1, .6],
    parts: [P('top', '台面', '#8a6a4f', WOOD), P('leg', '几腿', '#4a4038', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      var tp = pv(p, 'top', '#8a6a4f'), lg = pv(p, 'leg', '#4a4038');
      g.add(B(1.1, .05, .6, M(tp, { roughness: .5 }), 0, .44, 0));
      g.add(B(.98, .03, .5, M(tint(tp, -.12), { roughness: .6 }), 0, .16, 0));
      [[-.49, -.24], [.49, -.24], [-.49, .24], [.49, .24]].forEach(function (q) {
        g.add(B(.05, .42, .05, M(lg, { roughness: .55 }), q[0], .21, q[1]));
      });
      var b1 = B(.26, .035, .19, M('#b5544a', { roughness: .7 }), -.25, .4825, .1); b1.rotation.y = .25; g.add(b1);
      var b2 = B(.23, .035, .17, M('#4a6fb5', { roughness: .7 }), -.27, .5175, .1); b2.rotation.y = .05; g.add(b2);
      g.add(Cy(.07, .045, .05, M('#d8cfc0', { roughness: .8 }), .3, .4875, -.1));
      return g;
    }
  });

  reg({
    id: 'coffeetbl_round', name: '圆茶几', cat: 'living', price: 899, foot: [.95, .95],
    parts: [P('top', '台面', '#c2a878', LIGHTWOOD), P('base', '底座', '#3d3a36', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      var tp = pv(p, 'top', '#c2a878'), bs = pv(p, 'base', '#3d3a36');
      g.add(Cy(.45, .45, .035, M(tp, { roughness: .5 }), 0, .42, 0));
      g.add(Cy(.05, .07, .36, M(bs, { metalness: .3, roughness: .5 }), 0, .21, 0));
      g.add(Cy(.22, .25, .03, M(bs, { metalness: .3, roughness: .5 }), 0, .015, 0));
      g.add(Cy(.3, .3, .02, M(tint(bs, .1), { roughness: .6 }), 0, .18, 0));
      return g;
    }
  });

  reg({
    id: 'sidetable', name: '边几', cat: 'living', price: 399, foot: [.48, .48],
    parts: [P('top', '台面', '#5a4632', LIGHTWOOD), P('frame', '几架', '#2c2f34', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      var tp = pv(p, 'top', '#5a4632'), fr = pv(p, 'frame', '#2c2f34');
      g.add(B(.45, .03, .45, M(tp, { roughness: .5 }), 0, .5, 0));
      [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]].forEach(function (q) {
        g.add(B(.025, .5, .025, M(fr, { metalness: .4, roughness: .5 }), q[0], .25, q[1]));
      });
      g.add(B(.36, .02, .36, M(tint(fr, .12), { metalness: .4, roughness: .5 }), 0, .16, 0));
      return g;
    }
  });

  reg({
    id: 'tvunit', name: '电视柜组合', cat: 'living', price: 1999, foot: [1.9, .45],
    parts: [P('body', '柜体', '#5a4632', WOOD), P('door', '门板', '#6d5a44', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#5a4632'), dr = pv(p, 'door', '#6d5a44');
      g.add(B(1.9, .42, .42, M(bd, { roughness: .6 }), 0, .26, 0));
      g.add(B(1.7, .1, .36, M('#2e2a26', { roughness: .7 }), 0, .05, 0));
      g.add(B(.88, .34, .02, M(dr, { roughness: .55 }), -.45, .28, .22));
      g.add(B(.88, .34, .02, M(dr, { roughness: .55 }), .45, .28, .22));
      var hb = M('#c9cdd2', { metalness: .7, roughness: .35 });
      g.add(B(.14, .018, .02, hb, -.1, .28, .235));
      g.add(B(.14, .018, .02, hb, .1, .28, .235));
      g.add(B(1.94, .03, .46, M(tint(bd, -.1), { roughness: .5 }), 0, .485, 0));
      var tf = M('#15181d', { metalness: .5, roughness: .5 });
      g.add(B(.08, .1, .08, tf, -.5, .55, .05));
      g.add(B(.08, .1, .08, tf, .5, .55, .05));
      g.add(B(1.35, .78, .06, tf, 0, .99, .05));
      g.add(B(1.26, .68, .012, M('#0d141c', { metalness: .6, roughness: .25, emissive: '#0a2033', emissiveIntensity: 0 }), 0, .99, .085));
      return g;
    }
  });

  reg({
    id: 'rug', name: '地毯', cat: 'living', price: 399, foot: [2.2, 1.5],
    parts: [P('main', '毯面', '#9c7b5e', FABRIC), P('border', '毯边', '#7d6248', FABRIC)],
    build: function (p) {
      var g = new THREE.Group();
      var o = B(2.2, .012, 1.5, M(pv(p, 'border', '#7d6248'), { roughness: 1 }), 0, .006, 0);
      var i = B(1.94, .014, 1.24, M(pv(p, 'main', '#9c7b5e'), { roughness: 1 }), 0, .007, 0);
      o.castShadow = i.castShadow = false;
      g.add(o); g.add(i);
      return g;
    }
  });

  reg({
    id: 'floorlamp', name: '落地灯', cat: 'living', price: 599, foot: [.42, .42],
    parts: [P('shade', '灯罩', '#f3e7cd', ['#f3e7cd', '#e0d5bc', '#cbbfa4', '#d9c8a9', '#efe6d8', '#c9b896'])],
    build: function (p) {
      var g = new THREE.Group();
      var mt = M('#2c2f34', { metalness: .6, roughness: .4 });
      g.add(Cy(.17, .19, .03, mt, 0, .015, 0));
      g.add(Cy(.015, .015, 1.3, mt, 0, .68, 0));
      var shadeM = M(pv(p, 'shade', '#f3e7cd'), { roughness: .9, emissive: '#ffca8a', emissiveIntensity: 0, side: THREE.DoubleSide });
      shadeM.userData.isGlow = true; shadeM.userData.glowLevel = 1;
      var shade = Cy(.17, .23, .34, shadeM, 0, 1.5, 0); shade.castShadow = false; g.add(shade);
      var bulbM = M('#fff3d6', { emissive: '#ffd9a0', emissiveIntensity: 0 });
      bulbM.userData.isGlow = true; bulbM.userData.glowLevel = 1.2;
      g.add(S(.045, bulbM, 0, 1.36, 0));
      var light = new THREE.PointLight('#ffd9a0', 0, 4.5, 2);
      light.position.set(0, 1.42, 0); light.userData.lamp = true; g.add(light);
      g.userData.glowMats = [shadeM, bulbM];
      return g;
    }
  });

  /* ================= 卧室 ================= */

  reg({
    id: 'bed2', name: '双人床', cat: 'bedroom', price: 3999, foot: [2.12, 2.32],
    parts: [P('frame', '床架床头', '#8a6a4f', WOOD), P('blanket', '被褥', '#a8b8d0', ['#a8b8d0', '#c9a44a', '#8a9a5b', '#c97b63', '#7f8ea3', '#ded5c4'])],
    build: function (p) {
      var g = new THREE.Group();
      var f = M(pv(p, 'frame', '#8a6a4f'), { roughness: .75 });
      var bl = pv(p, 'blanket', '#a8b8d0');
      g.add(B(2.0, .24, 2.2, f, 0, .18, 0));
      g.add(B(2.0, .95, .1, f, 0, .55, -1.05));
      g.add(B(1.84, .22, 2.02, M('#f4f1ea', { roughness: .95 }), 0, .41, .04));
      g.add(B(.74, .13, .44, M('#ffffff', { roughness: 1 }), -.46, .585, -.7));
      g.add(B(.74, .13, .44, M('#ffffff', { roughness: 1 }), .46, .585, -.7));
      g.add(B(1.86, .09, 1.3, M(bl, { roughness: 1 }), 0, .565, .45));
      g.add(B(1.86, .025, .2, M(tint(bl, .18), { roughness: 1 }), 0, .61, -.12));
      legs(g, 2.0, 2.2, .06, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'bed1', name: '单人床', cat: 'bedroom', price: 1999, foot: [1.32, 2.22],
    parts: [P('frame', '床架床头', '#9c7b5e', WOOD), P('blanket', '被褥', '#c9a44a', ['#c9a44a', '#a8b8d0', '#8a9a5b', '#c97b63', '#7f8ea3', '#ded5c4'])],
    build: function (p) {
      var g = new THREE.Group();
      var f = M(pv(p, 'frame', '#9c7b5e'), { roughness: .75 });
      var bl = pv(p, 'blanket', '#c9a44a');
      g.add(B(1.2, .24, 2.1, f, 0, .18, 0));
      g.add(B(1.2, .95, .1, f, 0, .55, -1.0));
      g.add(B(1.04, .22, 1.92, M('#f4f1ea', { roughness: .95 }), 0, .41, .04));
      g.add(B(.6, .13, .4, M('#ffffff', { roughness: 1 }), 0, .585, -.66));
      g.add(B(1.06, .09, 1.2, M(bl, { roughness: 1 }), 0, .565, .42));
      g.add(B(1.06, .025, .18, M(tint(bl, .18), { roughness: 1 }), 0, .61, -.12));
      legs(g, 1.2, 2.1, .06, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'nightstand', name: '床头柜', cat: 'bedroom', price: 599, foot: [.56, .49],
    parts: [P('body', '柜体', '#8a6a4f', WOOD), P('front', '抽屉面板', '#9c7b5e', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#8a6a4f'), fr = pv(p, 'front', '#9c7b5e');
      g.add(B(.52, .46, .45, M(bd, { roughness: .65 }), 0, .32, 0));
      g.add(B(.56, .03, .49, M(tint(bd, -.1), { roughness: .55 }), 0, .565, 0));
      var kn = M('#c9c9c9', { metalness: .8, roughness: .3 });
      g.add(B(.44, .16, .02, M(fr, { roughness: .55 }), 0, .44, .235));
      g.add(B(.44, .16, .02, M(fr, { roughness: .55 }), 0, .24, .235));
      g.add(S(.018, kn, 0, .44, .25));
      g.add(S(.018, kn, 0, .24, .25));
      legs(g, .52, .45, .09, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'wardrobe', name: '衣柜', cat: 'bedroom', price: 2999, foot: [1.66, .66],
    parts: [P('body', '柜体', '#8a6a4f', WOOD), P('door', '门板', '#9c7b5e', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#8a6a4f'), dr = pv(p, 'door', '#9c7b5e');
      g.add(B(1.6, 2.14, .6, M(bd, { roughness: .6 }), 0, 1.15, 0));
      g.add(B(.74, 2.04, .02, M(dr, { roughness: .55 }), -.385, 1.15, .31));
      g.add(B(.74, 2.04, .02, M(dr, { roughness: .55 }), .385, 1.15, .31));
      var h = Cy(.009, .009, .34, M('#c9c9c9', { metalness: .8, roughness: .3 }), -.07, 1.2, .33);
      g.add(h);
      var h2 = h.clone(); h2.position.x = .07; g.add(h2);
      g.add(B(1.66, .05, .66, M(tint(bd, -.12), { roughness: .55 }), 0, 2.245, 0));
      g.add(B(1.5, .08, .5, M(tint(bd, -.18), { roughness: .6 }), 0, .04, 0));
      return g;
    }
  });

  reg({
    id: 'dresser', name: '梳妆台', cat: 'bedroom', price: 1299, foot: [1.05, .5],
    parts: [P('body', '柜体', '#ded5c4', LIGHTWOOD), P('frame', '镜框', '#c2a878', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#ded5c4'), fr = pv(p, 'frame', '#c2a878');
      g.add(B(1.0, .72, .45, M(bd, { roughness: .65 }), 0, .44, 0));
      g.add(B(1.05, .04, .5, M(tint(bd, -.1), { roughness: .55 }), 0, .82, 0));
      g.add(B(.9, .28, .02, M(tint(bd, .1), { roughness: .55 }), 0, .62, .235));
      g.add(B(.9, .28, .02, M(tint(bd, .1), { roughness: .55 }), 0, .3, .235));
      var kn = M('#c9c9c9', { metalness: .8, roughness: .3 });
      g.add(S(.02, kn, 0, .62, .25)); g.add(S(.02, kn, 0, .3, .25));
      g.add(B(.66, .85, .04, M(fr, { roughness: .6 }), 0, 1.32, -.2));
      g.add(B(.58, .77, .012, M('#d5dde3', { metalness: 1, roughness: .08 }), 0, 1.32, -.174));
      legs(g, 1.0, .45, .08, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'dresser5', name: '五斗柜', cat: 'bedroom', price: 1499, foot: [.95, .48],
    parts: [P('body', '柜体', '#5a4632', WOOD), P('front', '抽屉面板', '#6d5a44', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#5a4632'), fr = pv(p, 'front', '#6d5a44');
      g.add(B(.9, 1.28, .42, M(bd, { roughness: .6 }), 0, .67, 0));
      var kn = M('#c9c9c9', { metalness: .8, roughness: .3 });
      for (var i = 0; i < 5; i++) {
        var y = .25 + i * .24;
        g.add(B(.8, .19, .02, M(fr, { roughness: .55 }), 0, y, .22));
        g.add(B(.16, .018, .02, kn, 0, y + .05, .235));
      }
      g.add(B(.94, .03, .46, M(tint(bd, -.1), { roughness: .55 }), 0, 1.325, 0));
      legs(g, .9, .42, .06, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'bench', name: '床尾凳', cat: 'bedroom', price: 699, foot: [1.3, .45],
    parts: [P('top', '凳面', '#c97b63', FABRIC), P('leg', '凳腿', '#5a4632', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(1.3, .15, .45, M(pv(p, 'top', '#c97b63'), { roughness: .95 }), 0, .42, 0));
      var lm = M(pv(p, 'leg', '#5a4632'), { roughness: .55 });
      g.add(B(.05, .35, .4, lm, -.58, .175, 0));
      g.add(B(.05, .35, .4, lm, .58, .175, 0));
      g.add(B(1.1, .04, .04, lm, 0, .1, 0));
      return g;
    }
  });

  /* ================= 书房 · 餐厅 ================= */

  reg({
    id: 'desk', name: '书桌', cat: 'study', price: 1299, foot: [1.4, .7],
    parts: [P('top', '台面', '#8a6a4f', WOOD), P('frame', '桌腿挡板', '#6d5a44', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var tp = pv(p, 'top', '#8a6a4f'), fr = pv(p, 'frame', '#6d5a44');
      g.add(B(1.4, .05, .7, M(tp, { roughness: .5 }), 0, .75, 0));
      g.add(B(.05, .72, .62, M(fr, { roughness: .6 }), -.66, .36, 0));
      g.add(B(.05, .72, .62, M(fr, { roughness: .6 }), .66, .36, 0));
      g.add(B(1.28, .45, .03, M(fr, { roughness: .6 }), 0, .5, -.3));
      g.add(B(.42, .52, .58, M(tp, { roughness: .6 }), .42, .51, .02));
      var kn = M('#c9c9c9', { metalness: .8, roughness: .3 });
      g.add(B(.16, .018, .02, kn, .42, .62, .315));
      g.add(B(.16, .018, .02, kn, .42, .44, .315));
      return g;
    }
  });

  reg({
    id: 'officechair', name: '办公转椅', cat: 'study', price: 799, foot: [.62, .62],
    parts: [P('main', '坐背', '#4a5568', FABRIC), P('base', '五星脚', '#2f3338', ['#2f3338', '#1c1e22', '#b8bec6', '#5a6470', '#c9a24a', '#8a6a4f'])],
    build: function (p) {
      var g = new THREE.Group();
      var bs = M(pv(p, 'base', '#2f3338'), { metalness: .4, roughness: .5 });
      var wm = M('#1c1e22', { roughness: .4 });
      for (var i = 0; i < 5; i++) {
        var a = i * Math.PI * 2 / 5;
        var arm = B(.05, .035, .3, bs, Math.sin(a) * .16, .045, Math.cos(a) * .16);
        arm.rotation.y = a; g.add(arm);
        g.add(S(.032, wm, Math.sin(a) * .3, .032, Math.cos(a) * .3));
      }
      g.add(Cy(.03, .03, .3, M(tint(pv(p, 'base', '#2f3338'), .15), { metalness: .8, roughness: .3 }), 0, .28, 0));
      var up = M(pv(p, 'main', '#4a5568'), { roughness: .9 });
      g.add(B(.5, .09, .5, up, 0, .47, 0));
      var back = B(.47, .56, .08, up, 0, .8, .235);
      back.rotation.x = -.1; g.add(back);
      return g;
    }
  });

  reg({
    id: 'bookshelf', name: '书架', cat: 'study', price: 999, foot: [1.0, .34],
    parts: [P('body', '柜体', '#8a6a4f', WOOD), P('back', '背板', '#6d5a44', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#8a6a4f'), bk = pv(p, 'back', '#6d5a44');
      var pal = ['#b5544a', '#4a6fb5', '#5b8c5a', '#c9a44a', '#7a5ba8', '#8f8f96'];
      g.add(B(.03, 1.82, .34, M(bd, { roughness: .6 }), -.485, .91, 0));
      g.add(B(.03, 1.82, .34, M(bd, { roughness: .6 }), .485, .91, 0));
      g.add(B(.94, 1.82, .02, M(bk, { roughness: .7 }), 0, .91, -.155));
      var ys = [.12, .54, .96, 1.38, 1.8];
      ys.forEach(function (y) { g.add(B(.94, .03, .3, M(bd, { roughness: .6 }), 0, y, 0)); });
      [1, 2, 3].forEach(function (si) {
        var y = ys[si], x = -.4, bi = 0;
        while (x < .34) {
          if (rnd(si * 17 + bi * 3) > .18) {
            var bw = .028 + rnd(si * 7 + bi) * .026;
            var bh = .2 + rnd(si * 11 + bi * 5) * .1;
            g.add(B(bw, bh, .2, M(pal[Math.floor(rnd(si * 13 + bi * 7) * pal.length)], { roughness: .85 }),
              x + bw / 2, y + .015 + bh / 2, 0));
            x += bw + .008;
          } else { x += .07; }
          bi++;
        }
      });
      return g;
    }
  });

  reg({
    id: 'diningtable', name: '餐桌', cat: 'study', price: 1799, foot: [1.5, .9],
    parts: [P('top', '台面', '#8a6a4f', WOOD), P('leg', '桌腿', '#6d5a44', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var tp = pv(p, 'top', '#8a6a4f'), lg = pv(p, 'leg', '#6d5a44');
      g.add(B(1.5, .05, .9, M(tp, { roughness: .45 }), 0, .75, 0));
      g.add(B(1.36, .07, .76, M(tint(tp, -.1), { roughness: .55 }), 0, .7, 0));
      [[-.66, -.36], [.66, -.36], [-.66, .36], [.66, .36]].forEach(function (q) {
        g.add(B(.06, .68, .06, M(lg, { roughness: .55 }), q[0], .34, q[1]));
      });
      return g;
    }
  });

  reg({
    id: 'diningtable_round', name: '圆餐桌', cat: 'study', price: 1999, foot: [1.25, 1.25],
    parts: [P('top', '台面', '#c2a878', LIGHTWOOD), P('base', '底座', '#3d3a36', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      var tp = pv(p, 'top', '#c2a878'), bs = pv(p, 'base', '#3d3a36');
      g.add(Cy(.6, .6, .045, M(tp, { roughness: .45 }), 0, .74, 0));
      g.add(Cy(.07, .1, .66, M(bs, { metalness: .3, roughness: .5 }), 0, .38, 0));
      g.add(Cy(.3, .34, .04, M(bs, { metalness: .3, roughness: .5 }), 0, .02, 0));
      return g;
    }
  });

  reg({
    id: 'diningchair', name: '餐椅', cat: 'study', price: 499, foot: [.48, .52],
    parts: [P('seat', '坐背', '#8a6a4f', LIGHTWOOD), P('leg', '椅腿', '#5a4632', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      var st = pv(p, 'seat', '#8a6a4f'), lg = pv(p, 'leg', '#5a4632');
      g.add(B(.44, .045, .44, M(st, { roughness: .6 }), 0, .45, 0));
      var lm = M(lg, { roughness: .6 });
      [[-.185, -.185], [.185, -.185], [-.185, .185], [.185, .185]].forEach(function (q) {
        g.add(B(.035, .43, .035, lm, q[0], .215, q[1]));
      });
      g.add(B(.035, .45, .035, lm, -.185, .69, -.19));
      g.add(B(.035, .45, .035, lm, .185, .69, -.19));
      g.add(B(.4, .07, .025, M(st, { roughness: .6 }), 0, .885, -.19));
      g.add(B(.4, .06, .025, M(st, { roughness: .6 }), 0, .75, -.19));
      return g;
    }
  });

  reg({
    id: 'bar', name: '吧台', cat: 'study', price: 1899, foot: [1.4, .55],
    parts: [P('body', '台体', '#3d3a36', WOOD), P('top', '台面', '#c2a878', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#3d3a36'), tp = pv(p, 'top', '#c2a878');
      g.add(B(1.4, .95, .45, M(bd, { roughness: .6 }), 0, .475, 0));
      g.add(B(1.5, .045, .55, M(tp, { roughness: .4 }), 0, .975, .02));
      g.add(B(1.3, .08, .4, M(tint(bd, -.15), { roughness: .6 }), 0, .04, 0));
      var rail = M('#b8bec6', { metalness: .8, roughness: .3 });
      g.add(B(1.2, .025, .025, rail, 0, .24, .26));
      g.add(B(.025, .025, .06, rail, -.6, .24, .24));
      g.add(B(.025, .025, .06, rail, .6, .24, .24));
      return g;
    }
  });

  reg({
    id: 'barstool', name: '吧凳', cat: 'study', price: 399, foot: [.42, .42],
    parts: [P('seat', '凳面', '#7f8ea3', FABRIC), P('leg', '凳腿', '#2c2f34', DARKLEG)],
    build: function (p) {
      var g = new THREE.Group();
      var st = pv(p, 'seat', '#7f8ea3'), lg = pv(p, 'leg', '#2c2f34');
      g.add(Cy(.17, .17, .06, M(st, { roughness: .9 }), 0, .72, 0));
      var lm = M(lg, { metalness: .5, roughness: .4 });
      [[-.13, -.13], [.13, -.13], [-.13, .13], [.13, .13]].forEach(function (q) {
        g.add(Cy(.015, .015, .7, lm, q[0], .35, q[1]));
      });
      var ring = Tor(.15, .012, lm, 0, .24, 0);
      ring.rotation.x = Math.PI / 2; g.add(ring);
      [[-.13, -.13], [.13, -.13], [-.13, .13], [.13, .13]].forEach(function (q) {
        g.add(S(.02, M('#1c1e22', { roughness: .4 }), q[0], .02, q[1]));
      });
      return g;
    }
  });

  /* ================= 厨卫 ================= */

  reg({
    id: 'counter', name: '橱柜', cat: 'kitchen', price: 3299, foot: [2.06, .64],
    parts: [P('body', '柜体', '#ded5c4', LIGHTWOOD), P('door', '门板', '#eae2d2', ['#eae2d2', '#c9ccd0', '#a9beca', '#8a6a4f', '#4a5568', '#3d3a36'])],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#ded5c4'), dr = pv(p, 'door', '#eae2d2');
      g.add(B(1.86, .1, .52, M('#2e2a26', { roughness: .7 }), 0, .05, 0));
      g.add(B(2.0, .76, .58, M(bd, { roughness: .6 }), 0, .48, 0));
      g.add(B(2.06, .045, .64, M('#e9e5dd', { roughness: .35 }), 0, .885, 0));
      [-.66, 0, .66].forEach(function (x) {
        g.add(B(.6, .62, .02, M(dr, { roughness: .55 }), x, .5, .3));
        g.add(B(.14, .018, .02, M('#b8bec6', { metalness: .85, roughness: .25 }), x, .74, .315));
      });
      g.add(B(.56, .015, .42, M('#c8ccd2', { metalness: .85, roughness: .25 }), -.66, .912, 0));
      g.add(B(.48, .012, .34, M('#aab0b8', { metalness: .8, roughness: .3 }), -.66, .918, 0));
      var fc = M('#b8bec6', { metalness: .85, roughness: .25 });
      g.add(Cy(.014, .014, .22, fc, -.66, 1.0, -.18));
      g.add(B(.028, .025, .17, fc, -.66, 1.1, -.1));
      return g;
    }
  });

  reg({
    id: 'island', name: '中岛台', cat: 'kitchen', price: 2999, foot: [1.8, .95],
    parts: [P('body', '岛体', '#4a5568', ['#4a5568', '#3d3a36', '#8a6a4f', '#ded5c4', '#7f8ea3', '#5d7263']), P('top', '台面', '#e8eaec', STONE)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#4a5568'), tp = pv(p, 'top', '#e8eaec');
      g.add(B(1.6, .85, .8, M(bd, { roughness: .6 }), 0, .425, 0));
      g.add(B(1.8, .05, 1.0, M(tp, { roughness: .3 }), 0, .875, 0));
      g.add(B(1.5, .08, .7, M(tint(bd, -.15), { roughness: .6 }), 0, .04, 0));
      var rail = M('#b8bec6', { metalness: .8, roughness: .3 });
      g.add(B(.9, .02, .02, rail, 0, .6, .415));
      g.add(B(.5, .35, .02, M(tint(bd, .1), { roughness: .55 }), -.45, .45, .401));
      g.add(B(.5, .35, .02, M(tint(bd, .1), { roughness: .55 }), .45, .45, .401));
      return g;
    }
  });

  reg({
    id: 'fridge', name: '冰箱', cat: 'kitchen', price: 3199, foot: [.72, .72],
    parts: [P('body', '外壳', '#ccd1d7', APPLIANCE)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#ccd1d7');
      g.add(B(.7, 1.78, .66, M(bd, { metalness: .7, roughness: .3 }), 0, .9, 0));
      g.add(B(.72, .014, .02, M(tint(bd, -.18), { metalness: .6, roughness: .4 }), 0, 1.2, .335));
      g.add(B(.026, .5, .026, M('#b8bec6', { metalness: .85, roughness: .25 }), .29, 1.5, .35));
      g.add(B(.026, .34, .026, M('#b8bec6', { metalness: .85, roughness: .25 }), .29, .72, .35));
      return g;
    }
  });

  reg({
    id: 'washer', name: '洗衣机', cat: 'kitchen', price: 2599, foot: [.64, .66],
    parts: [P('body', '机身', '#e8eaec', APPLIANCE), P('door', '机门圈', '#aab4be', ['#aab4be', '#5a6470', '#3d3a36', '#c9a24a', '#7f8ea3', '#b98d6f'])],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#e8eaec'), dr = pv(p, 'door', '#aab4be');
      g.add(B(.6, .85, .6, M(bd, { metalness: .5, roughness: .35 }), 0, .425, 0));
      g.add(B(.56, .09, .01, M('#3d3a36', { roughness: .5 }), 0, .76, .302));
      g.add(B(.1, .03, .012, M('#c9cdd2', { metalness: .6, roughness: .4 }), -.16, .76, .306));
      var ring = Tor(.16, .022, M(dr, { metalness: .6, roughness: .35 }), 0, .4, .302);
      g.add(ring);
      var glass = Cy(.14, .14, .015, M('#1d2733', { metalness: .5, roughness: .15 }), 0, .4, .305);
      glass.rotation.x = Math.PI / 2; g.add(glass);
      var knob = Cy(.025, .025, .02, M('#c9cdd2', { metalness: .7, roughness: .35 }), .18, .76, .308);
      knob.rotation.x = Math.PI / 2; g.add(knob);
      [[-.24, -.24], [.24, -.24], [-.24, .24], [.24, .24]].forEach(function (q) {
        g.add(B(.05, .04, .05, M('#2c2f34', { roughness: .5 }), q[0], .02, q[1]));
      });
      return g;
    }
  });

  reg({
    id: 'bathtub', name: '浴缸', cat: 'kitchen', price: 2599, foot: [1.78, .88],
    parts: [P('body', '缸体', '#f2f4f6', PORCELAIN)],
    build: function (p) {
      var g = new THREE.Group();
      var wm = M(pv(p, 'body', '#f2f4f6'), { roughness: .3 });
      g.add(B(1.72, .52, .82, wm, 0, .28, 0));
      g.add(B(1.78, .035, .06, wm, 0, .555, .41));
      g.add(B(1.78, .035, .06, wm, 0, .555, -.41));
      g.add(B(.06, .035, .76, wm, .86, .555, 0));
      g.add(B(.06, .035, .76, wm, -.86, .555, 0));
      var water = B(1.58, .015, .66, M('#6fb7d9', { roughness: .15 }), 0, .545, 0);
      water.castShadow = false; g.add(water);
      var fc = M('#b8bec6', { metalness: .85, roughness: .25 });
      g.add(Cy(.016, .016, .2, fc, 0, .66, -.32));
      g.add(B(.028, .025, .14, fc, 0, .74, -.26));
      return g;
    }
  });

  reg({
    id: 'toilet', name: '马桶', cat: 'kitchen', price: 999, foot: [.44, .72],
    parts: [P('body', '陶瓷体', '#f2f4f6', PORCELAIN)],
    build: function (p) {
      var g = new THREE.Group();
      var wm = M(pv(p, 'body', '#f2f4f6'), { roughness: .3 });
      var seat = M(tint(pv(p, 'body', '#f2f4f6'), -.05), { roughness: .35 });
      g.add(B(.38, .28, .42, wm, 0, .16, .1));
      var bowl = Cy(.2, .15, .16, wm, 0, .38, .12); bowl.scale.z = 1.25; g.add(bowl);
      var s = Cy(.215, .215, .045, seat, 0, .47, .12); s.scale.z = 1.25; g.add(s);
      g.add(B(.4, .42, .2, wm, 0, .52, -.24));
      g.add(B(.42, .03, .22, seat, 0, .745, -.24));
      g.add(B(.1, .018, .06, M('#b8bec6', { metalness: .6, roughness: .35 }), 0, .765, -.24));
      return g;
    }
  });

  reg({
    id: 'vanity', name: '浴室柜', cat: 'kitchen', price: 1499, foot: [.86, .5],
    parts: [P('body', '柜体', '#8a6a4f', WOOD), P('frame', '镜框', '#9c7b5e', LIGHTWOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#8a6a4f'), fr = pv(p, 'frame', '#9c7b5e');
      g.add(B(.8, .58, .44, M(bd, { roughness: .6 }), 0, .41, 0));
      g.add(B(.86, .04, .48, M('#e9e5dd', { roughness: .35 }), 0, .72, 0));
      g.add(Cy(.16, .12, .11, M('#f2f4f6', { roughness: .3 }), 0, .795, 0));
      var fc = M('#b8bec6', { metalness: .85, roughness: .25 });
      g.add(Cy(.012, .012, .18, fc, 0, .86, -.14));
      g.add(B(.024, .022, .12, fc, 0, .94, -.09));
      g.add(B(.5, .6, .035, M(fr, { roughness: .6 }), 0, 1.25, -.2));
      g.add(B(.43, .53, .012, M('#d5dde3', { metalness: 1, roughness: .08 }), 0, 1.25, -.178));
      legs(g, .8, .44, .12, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  /* ================= 装饰 ================= */

  reg({
    id: 'plant', name: '大型绿植', cat: 'decor', price: 299, foot: [.6, .6],
    parts: [P('pot', '花盆', '#b0674f', POTTED)],
    build: function (p) {
      var g = new THREE.Group();
      var pc = pv(p, 'pot', '#b0674f');
      g.add(Cy(.19, .14, .32, M(pc, { roughness: .95 }), 0, .16, 0));
      g.add(Cy(.21, .21, .045, M(tint(pc, -.1), { roughness: .9 }), 0, .34, 0));
      g.add(Cy(.17, .17, .02, M('#4a3626', { roughness: 1 }), 0, .355, 0));
      g.add(Cy(.028, .04, .5, M('#7a5a3a', { roughness: 1 }), 0, .6, 0));
      g.add(Ico(.3, M('#4d7a4d', { roughness: 1, flatShading: true }), 0, 1.02, 0));
      g.add(Ico(.22, M('#5d8a52', { roughness: 1, flatShading: true }), .17, .82, .1));
      g.add(Ico(.19, M('#3f6b44', { roughness: 1, flatShading: true }), -.15, .88, -.08));
      return g;
    }
  });

  reg({
    id: 'plant_small', name: '小盆栽', cat: 'decor', price: 99, foot: [.3, .3],
    parts: [P('pot', '花盆', '#ded5c4', POTTED)],
    build: function (p) {
      var g = new THREE.Group();
      var pc = pv(p, 'pot', '#ded5c4');
      g.add(Cy(.09, .07, .14, M(pc, { roughness: .95 }), 0, .07, 0));
      g.add(Cy(.012, .014, .12, M('#5d7a4a', { roughness: 1 }), 0, .19, 0));
      g.add(Ico(.11, M('#4d7a4d', { roughness: 1, flatShading: true }), 0, .33, 0));
      g.add(Ico(.08, M('#5d8a52', { roughness: 1, flatShading: true }), .06, .26, .03));
      g.add(Ico(.07, M('#3f6b44', { roughness: 1, flatShading: true }), -.06, .28, -.02));
      return g;
    }
  });

  reg({
    id: 'vase', name: '陶瓷花瓶', cat: 'decor', price: 199, foot: [.36, .36],
    parts: [P('body', '瓶身', '#ded5c4', ['#ded5c4', '#b98d6f', '#7f8ea3', '#8a9a5b', '#c97b63', '#3d3a36'])],
    build: function (p) {
      var g = new THREE.Group();
      var pts = [[.001, 0], [.13, .02], [.165, .13], [.13, .32], [.055, .44], [.07, .52]]
        .map(function (q) { return new THREE.Vector2(q[0], q[1]); });
      g.add(mesh(new THREE.LatheGeometry(pts, 26), M(pv(p, 'body', '#ded5c4'), { roughness: .35, side: THREE.DoubleSide }), 0, 0, 0));
      var stm = M('#4d7a4d', { roughness: 1 });
      [['#d4708f', .03, .02], ['#e8c14a', -.04, -.02], ['#c96b6b', 0, .04]].forEach(function (h, i) {
        g.add(Cy(.006, .006, .34, stm, h[1], .62 + i * .03, h[2]));
        g.add(S(.045, M(h[0], { roughness: .8 }), h[1], .8 + i * .03, h[2]));
      });
      return g;
    }
  });

  reg({
    id: 'mirror', name: '落地穿衣镜', cat: 'decor', price: 699, foot: [.6, .5],
    parts: [P('frame', '边框', '#5a4632', WOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var lean = new THREE.Group(); lean.rotation.x = -.06;
      lean.add(B(.56, 1.85, .05, M(pv(p, 'frame', '#5a4632'), { roughness: .6 }), 0, .93, 0));
      lean.add(B(.48, 1.77, .015, M('#d5dde3', { metalness: 1, roughness: .06 }), 0, .93, .026));
      g.add(lean);
      g.add(B(.56, .04, .18, M(tint(pv(p, 'frame', '#5a4632'), -.2), { roughness: .6 }), 0, .02, .06));
      return g;
    }
  });

  reg({
    id: 'ac', name: '立式空调', cat: 'decor', price: 3599, foot: [.4, .4],
    parts: [P('body', '机身', '#eef1f4', ['#eef1f4', '#d7e0e4', '#cdd8de', '#aab4be', '#ded5c4', '#9fb8c4'])],
    build: function (p) {
      var g = new THREE.Group();
      var bd = pv(p, 'body', '#eef1f4');
      g.add(B(.38, 1.78, .36, M(bd, { roughness: .35, metalness: .15 }), 0, .92, 0));
      g.add(B(.3, .42, .015, M(tint(bd, -.06), { roughness: .4 }), 0, 1.32, .185));
      g.add(B(.3, .02, .02, M('#9aa0a8', { metalness: .5, roughness: .4 }), 0, 1.74, .185));
      var dm = M('#14181d', { emissive: '#3fd0ff', emissiveIntensity: 0 });
      dm.userData.isGlow = true; dm.userData.glowLevel = .9;
      g.add(B(.13, .045, .012, dm, 0, 1.62, .186));
      g.add(B(.34, .03, .3, M(tint(bd, -.12), { metalness: .5, roughness: .4 }), 0, .015, 0));
      g.userData.glowMats = [dm];
      return g;
    }
  });

  reg({
    id: 'screen', name: '屏风', cat: 'decor', price: 899, foot: [1.72, .5],
    parts: [P('panel', '屏面', '#b98d6f', FABRIC), P('frame', '边框', '#5a4632', WOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var pn = pv(p, 'panel', '#b98d6f'), fr = pv(p, 'frame', '#5a4632');
      var xs = [-.56, 0, .56], rots = [.42, -.42, .42];
      for (var i = 0; i < 3; i++) {
        var pan = new THREE.Group();
        pan.add(B(.56, 1.75, .035, M(fr, { roughness: .6 }), 0, .875, 0));
        pan.add(B(.48, 1.6, .02, M(pn, { roughness: .9, side: THREE.DoubleSide }), 0, .875, .012));
        pan.position.x = xs[i];
        pan.rotation.y = rots[i];
        g.add(pan);
      }
      return g;
    }
  });

  reg({
    id: 'floorclock', name: '落地钟', cat: 'decor', price: 1599, foot: [.48, .34],
    parts: [P('case', '钟体', '#5a4632', WOOD)],
    build: function (p) {
      var g = new THREE.Group();
      var cs = pv(p, 'case', '#5a4632');
      var cm = M(cs, { roughness: .6 });
      g.add(B(.42, 1.9, .26, cm, 0, .97, 0));
      g.add(B(.48, .06, .32, cm, 0, 1.93, 0));
      g.add(B(.46, .06, .3, cm, 0, .03, 0));
      var face = Cy(.14, .14, .02, M('#f4efe2', { roughness: .5 }), 0, 1.6, .13);
      face.rotation.x = Math.PI / 2; g.add(face);
      g.add(B(.012, .09, .008, M('#3d3a36'), 0, 1.63, .142));
      g.add(B(.06, .012, .008, M('#3d3a36'), .02, 1.6, .142));
      var brass = M('#c9a24a', { metalness: .85, roughness: .3 });
      g.add(B(.018, .52, .012, brass, 0, 1.0, .1));
      var disc = Cy(.05, .05, .012, brass, 0, .78, .1);
      disc.rotation.x = Math.PI / 2; g.add(disc);
      g.add(B(.3, 1.3, .01, M(tint(cs, -.15), { roughness: .6 }), 0, .95, -.125));
      return g;
    }
  });

  window.FURNITURE = FURNITURE;
  window.FURNITURE_CATS = CATS;
})();

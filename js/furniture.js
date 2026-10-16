/* ============================================================
 * 家具模型工厂 — 全部用 three.js 基础几何体程序化拼装
 * 约定：模型原点在地面中心，正面朝 +z；尺寸单位为米（真实比例）
 * build(primaryHex) 返回 THREE.Group；userData.glowMats 为夜间发光材质
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
  /* 变亮(+) / 变暗(-)，返回 hex 字符串 */
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
  function legs(g, w, d, h, mat, r) {
    var x = w / 2 - .07, z = d / 2 - .07;
    [[x, z], [-x, z], [x, -z], [-x, -z]].forEach(function (p) { g.add(Cy(r || .025, r || .025, h, mat, p[0], h / 2, p[1])); });
  }
  /* 确定性伪随机（用于书脊等，保证每次重建一致） */
  function rnd(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  var DARKMETAL = function () { return M('#2c2f34', { metalness: .6, roughness: .4 }); };
  var CHROME = function () { return M('#b8bec6', { metalness: .85, roughness: .25 }); };
  var WHITE = function () { return M('#f2f4f6', { roughness: .3 }); };

  /* ---------- 注册 ---------- */
  function reg(def) { FURNITURE[def.id] = def; }

  /* ================= 客厅 ================= */

  reg({
    id: 'sofa3', name: '三人沙发', cat: 'living', price: 3999, foot: [2.15, .95],
    colors: ['#b98d6f', '#7f8ea3', '#8a9a5b', '#c97b63', '#6d7b8c', '#ded5c4'],
    build: function (p) {
      var g = new THREE.Group();
      var f = M(p, { roughness: .92 }), cu = M(tint(p, .16), { roughness: .95 });
      g.add(B(2.15, .3, .95, f, 0, .23, 0));
      for (var i = -1; i <= 1; i++) {
        g.add(B(.62, .17, .78, cu, i * .7, .465, .06));
        g.add(B(.62, .4, .15, cu, i * .7, .6, -.33));
      }
      g.add(B(2.15, .52, .2, f, 0, .62, -.375));
      g.add(B(.24, .34, .95, f, -2.15 / 2 + .12, .46, 0));
      g.add(B(.24, .34, .95, f, 2.15 / 2 - .12, .46, 0));
      legs(g, 2.15, .95, .08, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'sofa1', name: '单人沙发', cat: 'living', price: 1599, foot: [1.0, .95],
    colors: ['#b98d6f', '#7f8ea3', '#8a9a5b', '#c97b63', '#6d7b8c', '#ded5c4'],
    build: function (p) {
      var g = new THREE.Group();
      var f = M(p, { roughness: .92 }), cu = M(tint(p, .16), { roughness: .95 });
      g.add(B(1.0, .3, .95, f, 0, .23, 0));
      g.add(B(.66, .17, .78, cu, 0, .465, .06));
      g.add(B(.66, .42, .15, cu, 0, .61, -.33));
      g.add(B(.24, .34, .95, f, -.38, .46, 0));
      g.add(B(.24, .34, .95, f, .38, .46, 0));
      legs(g, 1.0, .95, .08, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'coffee', name: '茶几', cat: 'living', price: 899, foot: [1.1, .6],
    colors: ['#8a6a4f', '#5a4632', '#3d3a36', '#9c7b5e', '#4a5568', '#c2a878'],
    build: function (p) {
      var g = new THREE.Group();
      var w = M(p, { roughness: .5 });
      g.add(B(1.1, .05, .6, w, 0, .44, 0));
      g.add(B(.98, .03, .5, M(tint(p, -.12), { roughness: .6 }), 0, .16, 0));
      [[-.49, -.24], [.49, -.24], [-.49, .24], [.49, .24]].forEach(function (q) {
        g.add(B(.05, .42, .05, M('#4a4038', { roughness: .55 }), q[0], .21, q[1]));
      });
      /* 桌面小摆设：两本书 + 木碗 */
      var b1 = B(.26, .035, .19, M('#b5544a', { roughness: .7 }), -.25, .4825, .1); b1.rotation.y = .25; g.add(b1);
      var b2 = B(.23, .035, .17, M('#4a6fb5', { roughness: .7 }), -.27, .5175, .1); b2.rotation.y = .05; g.add(b2);
      g.add(Cy(.07, .045, .05, M('#d8cfc0', { roughness: .8 }), .3, .4875, -.1));
      return g;
    }
  });

  reg({
    id: 'tvunit', name: '电视柜组合', cat: 'living', price: 1999, foot: [1.9, .45],
    colors: ['#5a4632', '#8a6a4f', '#3d3a36', '#4a5568', '#9c7b5e', '#2e2a26'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(1.9, .42, .42, M(p, { roughness: .6 }), 0, .26, 0));
      g.add(B(1.7, .1, .36, M('#2e2a26', { roughness: .7 }), 0, .05, 0));
      g.add(B(.88, .34, .02, M(tint(p, .08), { roughness: .55 }), -.45, .28, .22));
      g.add(B(.88, .34, .02, M(tint(p, .08), { roughness: .55 }), .45, .28, .22));
      var hb = M('#c9cdd2', { metalness: .7, roughness: .35 });
      g.add(B(.14, .018, .02, hb, -.1, .28, .235));
      g.add(B(.14, .018, .02, hb, .1, .28, .235));
      g.add(B(1.94, .03, .46, M(tint(p, -.1), { roughness: .5 }), 0, .485, 0));
      /* 电视 */
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
    colors: ['#9c7b5e', '#7f8ea3', '#8a9a5b', '#b98d6f', '#6d7b8c', '#ded5c4'],
    build: function (p) {
      var g = new THREE.Group();
      var o = B(2.2, .012, 1.5, M(tint(p, -.18), { roughness: 1 }), 0, .006, 0);
      var i = B(1.94, .014, 1.24, M(p, { roughness: 1 }), 0, .007, 0);
      o.castShadow = i.castShadow = false;
      g.add(o); g.add(i);
      return g;
    }
  });

  reg({
    id: 'floorlamp', name: '落地灯', cat: 'living', price: 599, foot: [.42, .42],
    colors: ['#f3e7cd', '#e0d5bc', '#cbbfa4', '#d9c8a9', '#efe6d8', '#c9b896'],
    build: function () {
      var g = new THREE.Group();
      var mt = DARKMETAL();
      g.add(Cy(.17, .19, .03, mt, 0, .015, 0));
      g.add(Cy(.015, .015, 1.3, mt, 0, .68, 0));
      var shadeM = M('#f3e7cd', { roughness: .9, emissive: '#ffca8a', emissiveIntensity: 0, side: THREE.DoubleSide });
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

  function buildBed(p, bw, bd, single) {
    var g = new THREE.Group();
    var f = M(p, { roughness: .75 });
    g.add(B(bw + .12, .24, bd + .12, f, 0, .18, 0));
    g.add(B(bw + .12, .95, .1, f, 0, .55, -(bd + .12) / 2 + .05));
    g.add(B(bw, .22, bd, M('#f4f1ea', { roughness: .95 }), 0, .41, .04));
    if (single) {
      g.add(B(.6, .13, .4, M('#ffffff', { roughness: 1 }), 0, .585, -bd / 2 + .3));
    } else {
      g.add(B(.74, .13, .44, M('#ffffff', { roughness: 1 }), -.46, .585, -bd / 2 + .34));
      g.add(B(.74, .13, .44, M('#ffffff', { roughness: 1 }), .46, .585, -bd / 2 + .34));
    }
    g.add(B(bw + .04, .09, bd * .62, M(tint(p, .22), { roughness: 1 }), 0, .565, bd * .2));
    g.add(B(bw + .04, .02, .16, M('#f4f1ea', { roughness: 1 }), 0, .62, -bd * .11));
    legs(g, bw + .12, bd + .12, .06, M('#3d3128', { roughness: .6 }));
    return g;
  }
  reg({
    id: 'bed2', name: '双人床', cat: 'bedroom', price: 3999, foot: [2.12, 2.32],
    colors: ['#8a6a4f', '#5a4632', '#7f8ea3', '#9c7b5e', '#4a5568', '#b98d6f'],
    build: function (p) { return buildBed(p, 1.84, 2.02, false); }
  });
  reg({
    id: 'bed1', name: '单人床', cat: 'bedroom', price: 1999, foot: [1.32, 2.22],
    colors: ['#8a6a4f', '#5a4632', '#7f8ea3', '#9c7b5e', '#4a5568', '#b98d6f'],
    build: function (p) { return buildBed(p, 1.04, 1.94, true); }
  });

  reg({
    id: 'nightstand', name: '床头柜', cat: 'bedroom', price: 599, foot: [.56, .49],
    colors: ['#8a6a4f', '#5a4632', '#3d3a36', '#9c7b5e', '#4a5568', '#c2a878'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(.52, .46, .45, M(p, { roughness: .65 }), 0, .32, 0));
      g.add(B(.56, .03, .49, M(tint(p, -.1), { roughness: .55 }), 0, .565, 0));
      var kn = M('#c9c9c9', { metalness: .8, roughness: .3 });
      g.add(B(.44, .16, .02, M(tint(p, .1), { roughness: .55 }), 0, .44, .235));
      g.add(B(.44, .16, .02, M(tint(p, .1), { roughness: .55 }), 0, .24, .235));
      g.add(S(.018, kn, 0, .44, .25));
      g.add(S(.018, kn, 0, .24, .25));
      legs(g, .52, .45, .09, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  reg({
    id: 'wardrobe', name: '衣柜', cat: 'bedroom', price: 2999, foot: [1.66, .66],
    colors: ['#8a6a4f', '#5a4632', '#3d3a36', '#c2a878', '#4a5568', '#9c7b5e'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(1.6, 2.14, .6, M(p, { roughness: .6 }), 0, 1.15, 0));
      g.add(B(.74, 2.04, .02, M(tint(p, .1), { roughness: .55 }), -.385, 1.15, .31));
      g.add(B(.74, 2.04, .02, M(tint(p, .1), { roughness: .55 }), .385, 1.15, .31));
      var h = Cy(.009, .009, .34, M('#c9c9c9', { metalness: .8, roughness: .3 }), 0, 1.2, .33);
      g.add(h);
      var h2 = h.clone(); h2.position.x = .07; h.position.x = -.07; g.add(h2);
      g.add(B(1.66, .05, .66, M(tint(p, -.12), { roughness: .55 }), 0, 2.245, 0));
      [[-.72, -.24], [.72, -.24], [-.72, .24], [.72, .24]].forEach(function (q) {
        g.add(B(.06, .08, .06, M('#3d3128', { roughness: .6 }), q[0], .04, q[1]));
      });
      return g;
    }
  });

  reg({
    id: 'dresser', name: '梳妆台', cat: 'bedroom', price: 1299, foot: [1.05, .5],
    colors: ['#8a6a4f', '#ded5c4', '#3d3a36', '#c2a878', '#7f8ea3', '#9c7b5e'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(1.0, .72, .45, M(p, { roughness: .65 }), 0, .44, 0));
      g.add(B(1.05, .04, .5, M(tint(p, -.1), { roughness: .55 }), 0, .82, 0));
      g.add(B(.9, .28, .02, M(tint(p, .1), { roughness: .55 }), 0, .62, .235));
      g.add(B(.9, .28, .02, M(tint(p, .1), { roughness: .55 }), 0, .3, .235));
      var kn = M('#c9c9c9', { metalness: .8, roughness: .3 });
      g.add(S(.02, kn, 0, .62, .25)); g.add(S(.02, kn, 0, .3, .25));
      g.add(B(.66, .85, .04, M(p, { roughness: .6 }), 0, 1.32, -.2));
      g.add(B(.58, .77, .012, M('#d5dde3', { metalness: 1, roughness: .08 }), 0, 1.32, -.174));
      legs(g, 1.0, .45, .08, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  /* ================= 书房 · 餐厅 ================= */

  reg({
    id: 'desk', name: '书桌', cat: 'study', price: 1299, foot: [1.4, .7],
    colors: ['#8a6a4f', '#5a4632', '#3d3a36', '#c2a878', '#4a5568', '#9c7b5e'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(1.4, .05, .7, M(p, { roughness: .5 }), 0, .75, 0));
      g.add(B(.05, .72, .62, M(tint(p, -.08), { roughness: .6 }), -.66, .36, 0));
      g.add(B(.05, .72, .62, M(tint(p, -.08), { roughness: .6 }), .66, .36, 0));
      g.add(B(1.28, .45, .03, M(tint(p, -.08), { roughness: .6 }), 0, .5, -.3));
      g.add(B(.42, .52, .58, M(p, { roughness: .6 }), .42, .51, .02));
      var kn = M('#c9c9c9', { metalness: .8, roughness: .3 });
      g.add(B(.16, .018, .02, kn, .42, .62, .315));
      g.add(B(.16, .018, .02, kn, .42, .44, .315));
      return g;
    }
  });

  reg({
    id: 'officechair', name: '办公转椅', cat: 'study', price: 799, foot: [.62, .62],
    colors: ['#3d3a36', '#4a5568', '#7f8ea3', '#6d4a3f', '#2e2a26', '#8a9a5b'],
    build: function (p) {
      var g = new THREE.Group();
      var bs = M('#2f3338', { metalness: .4, roughness: .5 });
      var wm = M('#1c1e22', { roughness: .4 });
      for (var i = 0; i < 5; i++) {
        var a = i * Math.PI * 2 / 5;
        var arm = B(.05, .035, .3, bs, Math.sin(a) * .16, .045, Math.cos(a) * .16);
        arm.rotation.y = a; g.add(arm);
        g.add(S(.032, wm, Math.sin(a) * .3, .032, Math.cos(a) * .3));
      }
      g.add(Cy(.03, .03, .3, M('#9aa3ad', { metalness: .8, roughness: .3 }), 0, .28, 0));
      g.add(B(.5, .09, .5, M(p, { roughness: .9 }), 0, .47, 0));
      var back = B(.47, .56, .08, M(p, { roughness: .9 }), 0, .8, .235);
      back.rotation.x = -.1; g.add(back);
      return g;
    }
  });

  reg({
    id: 'bookshelf', name: '书架', cat: 'study', price: 999, foot: [1.0, .34],
    colors: ['#8a6a4f', '#5a4632', '#3d3a36', '#c2a878', '#4a5568', '#9c7b5e'],
    build: function (p) {
      var g = new THREE.Group();
      var pal = ['#b5544a', '#4a6fb5', '#5b8c5a', '#c9a44a', '#7a5ba8', '#8f8f96'];
      g.add(B(.03, 1.82, .34, M(p, { roughness: .6 }), -.485, .91, 0));
      g.add(B(.03, 1.82, .34, M(p, { roughness: .6 }), .485, .91, 0));
      g.add(B(.94, 1.82, .02, M(tint(p, -.15), { roughness: .7 }), 0, .91, -.155));
      var ys = [.12, .54, .96, 1.38, 1.8];
      ys.forEach(function (y) { g.add(B(.94, .03, .3, M(p, { roughness: .6 }), 0, y, 0)); });
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
    colors: ['#8a6a4f', '#5a4632', '#3d3a36', '#c2a878', '#ded5c4', '#9c7b5e'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(1.5, .05, .9, M(p, { roughness: .45 }), 0, .75, 0));
      g.add(B(1.36, .07, .76, M(tint(p, -.1), { roughness: .55 }), 0, .7, 0));
      [[-.66, -.36], [.66, -.36], [-.66, .36], [.66, .36]].forEach(function (q) {
        g.add(B(.06, .68, .06, M(tint(p, -.1), { roughness: .55 }), q[0], .34, q[1]));
      });
      return g;
    }
  });

  reg({
    id: 'diningchair', name: '餐椅', cat: 'study', price: 499, foot: [.48, .52],
    colors: ['#8a6a4f', '#5a4632', '#3d3a36', '#ded5c4', '#4a5568', '#9c7b5e'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(.44, .045, .44, M(p, { roughness: .6 }), 0, .45, 0));
      var lm = M(tint(p, -.15), { roughness: .6 });
      [[-.185, -.185], [.185, -.185], [-.185, .185], [.185, .185]].forEach(function (q) {
        g.add(B(.035, .43, .035, lm, q[0], .215, q[1]));
      });
      g.add(B(.035, .45, .035, lm, -.185, .69, -.19));
      g.add(B(.035, .45, .035, lm, .185, .69, -.19));
      g.add(B(.4, .07, .025, M(p, { roughness: .6 }), 0, .885, -.19));
      g.add(B(.4, .06, .025, M(p, { roughness: .6 }), 0, .75, -.19));
      return g;
    }
  });

  /* ================= 厨卫 ================= */

  reg({
    id: 'counter', name: '橱柜', cat: 'kitchen', price: 3299, foot: [2.06, .64],
    colors: ['#ded5c4', '#8a6a4f', '#4a5568', '#3d3a36', '#7f8ea3', '#c2a878'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(1.86, .1, .52, M('#2e2a26', { roughness: .7 }), 0, .05, 0));
      g.add(B(2.0, .76, .58, M(p, { roughness: .6 }), 0, .48, 0));
      g.add(B(2.06, .045, .64, M('#e9e5dd', { roughness: .35 }), 0, .885, 0));
      [-.66, 0, .66].forEach(function (x) {
        g.add(B(.6, .62, .02, M(tint(p, .1), { roughness: .55 }), x, .5, .3));
        g.add(B(.14, .018, .02, CHROME(), x, .74, .315));
      });
      g.add(B(.56, .015, .42, M('#c8ccd2', { metalness: .85, roughness: .25 }), -.66, .912, 0));
      g.add(B(.48, .012, .34, M('#aab0b8', { metalness: .8, roughness: .3 }), -.66, .918, 0));
      var fc = CHROME();
      g.add(Cy(.014, .014, .22, fc, -.66, 1.0, -.18));
      g.add(B(.028, .025, .17, fc, -.66, 1.1, -.1));
      return g;
    }
  });

  reg({
    id: 'fridge', name: '冰箱', cat: 'kitchen', price: 3199, foot: [.72, .72],
    colors: ['#ccd1d7', '#e8eaec', '#aab4be', '#5a6470', '#3d3a36', '#b98d6f'],
    build: function () {
      var g = new THREE.Group();
      g.add(B(.7, 1.78, .66, M('#ccd1d7', { metalness: .7, roughness: .3 }), 0, .9, 0));
      g.add(B(.72, .014, .02, M('#9aa0a8', { metalness: .6, roughness: .4 }), 0, 1.2, .335));
      g.add(B(.026, .5, .026, CHROME(), .29, 1.5, .35));
      g.add(B(.026, .34, .026, CHROME(), .29, .72, .35));
      return g;
    }
  });

  reg({
    id: 'bathtub', name: '浴缸', cat: 'kitchen', price: 2599, foot: [1.78, .88],
    colors: ['#f2f4f6', '#ded5c4', '#cdd8de', '#9fb8c4', '#e8e2d5', '#b8c4cc'],
    build: function () {
      var g = new THREE.Group();
      var wm = WHITE();
      g.add(B(1.72, .52, .82, wm, 0, .28, 0));
      g.add(B(1.78, .035, .06, wm, 0, .555, .41));
      g.add(B(1.78, .035, .06, wm, 0, .555, -.41));
      g.add(B(.06, .035, .76, wm, .86, .555, 0));
      g.add(B(.06, .035, .76, wm, -.86, .555, 0));
      var water = B(1.58, .015, .66, M('#6fb7d9', { roughness: .15 }), 0, .545, 0);
      water.castShadow = false; g.add(water);
      var fc = CHROME();
      g.add(Cy(.016, .016, .2, fc, 0, .66, -.32));
      g.add(B(.028, .025, .14, fc, 0, .74, -.26));
      return g;
    }
  });

  reg({
    id: 'toilet', name: '马桶', cat: 'kitchen', price: 999, foot: [.44, .72],
    colors: ['#f2f4f6', '#e8e2d5', '#cdd8de', '#ded5c4', '#d7e0e4', '#e6d9d4'],
    build: function () {
      var g = new THREE.Group();
      var wm = WHITE();
      g.add(B(.38, .28, .42, wm, 0, .16, .1));
      var bowl = Cy(.2, .15, .16, wm, 0, .38, .12); bowl.scale.z = 1.25; g.add(bowl);
      var seat = Cy(.215, .215, .045, M('#e8ebee', { roughness: .35 }), 0, .47, .12); seat.scale.z = 1.25; g.add(seat);
      g.add(B(.4, .42, .2, wm, 0, .52, -.24));
      g.add(B(.42, .03, .22, M('#e8ebee', { roughness: .35 }), 0, .745, -.24));
      g.add(B(.1, .018, .06, M('#b8bec6', { metalness: .6, roughness: .35 }), 0, .765, -.24));
      return g;
    }
  });

  reg({
    id: 'vanity', name: '浴室柜', cat: 'kitchen', price: 1499, foot: [.86, .5],
    colors: ['#8a6a4f', '#ded5c4', '#4a5568', '#3d3a36', '#7f8ea3', '#c2a878'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(B(.8, .58, .44, M(p, { roughness: .6 }), 0, .41, 0));
      g.add(B(.86, .04, .48, M('#e9e5dd', { roughness: .35 }), 0, .72, 0));
      g.add(Cy(.16, .12, .11, WHITE(), 0, .795, 0));
      var fc = CHROME();
      g.add(Cy(.012, .012, .18, fc, 0, .86, -.14));
      g.add(B(.024, .022, .12, fc, 0, .94, -.09));
      g.add(B(.5, .6, .035, M(p, { roughness: .6 }), 0, 1.25, -.2));
      g.add(B(.43, .53, .012, M('#d5dde3', { metalness: 1, roughness: .08 }), 0, 1.25, -.178));
      legs(g, .8, .44, .12, M('#3d3128', { roughness: .6 }));
      return g;
    }
  });

  /* ================= 装饰 ================= */

  reg({
    id: 'plant', name: '大型绿植', cat: 'decor', price: 299, foot: [.6, .6],
    colors: ['#b0674f', '#8a8f96', '#ded5c4', '#5a4632', '#7f8ea3', '#3d3a36'],
    build: function (p) {
      var g = new THREE.Group();
      g.add(Cy(.19, .14, .32, M(p, { roughness: .95 }), 0, .16, 0));
      g.add(Cy(.21, .21, .045, M(tint(p, -.1), { roughness: .9 }), 0, .34, 0));
      g.add(Cy(.17, .17, .02, M('#4a3626', { roughness: 1 }), 0, .355, 0));
      g.add(Cy(.028, .04, .5, M('#7a5a3a', { roughness: 1 }), 0, .6, 0));
      var l1 = M('#4d7a4d', { roughness: 1, flatShading: true });
      var l2 = M('#5d8a52', { roughness: 1, flatShading: true });
      var l3 = M('#3f6b44', { roughness: 1, flatShading: true });
      g.add(Ico(.3, l1, 0, 1.02, 0));
      g.add(Ico(.22, l2, .17, .82, .1));
      g.add(Ico(.19, l3, -.15, .88, -.08));
      return g;
    }
  });

  reg({
    id: 'mirror', name: '落地穿衣镜', cat: 'decor', price: 699, foot: [.6, .5],
    colors: ['#5a4632', '#3d3a36', '#c2a878', '#4a5568', '#8a6a4f', '#2e2a26'],
    build: function (p) {
      var g = new THREE.Group();
      var lean = new THREE.Group(); lean.rotation.x = -.06;
      lean.add(B(.56, 1.85, .05, M(p, { roughness: .6 }), 0, .93, 0));
      lean.add(B(.48, 1.77, .015, M('#d5dde3', { metalness: 1, roughness: .06 }), 0, .93, .026));
      g.add(lean);
      g.add(B(.56, .04, .18, M('#3d3128', { roughness: .6 }), 0, .02, .06));
      return g;
    }
  });

  reg({
    id: 'vase', name: '陶瓷花瓶', cat: 'decor', price: 199, foot: [.36, .36],
    colors: ['#ded5c4', '#b98d6f', '#7f8ea3', '#8a9a5b', '#c97b63', '#3d3a36'],
    build: function (p) {
      var g = new THREE.Group();
      var pts = [[.001, 0], [.13, .02], [.165, .13], [.13, .32], [.055, .44], [.07, .52]]
        .map(function (q) { return new THREE.Vector2(q[0], q[1]); });
      var vase = mesh(new THREE.LatheGeometry(pts, 26), M(p, { roughness: .35, side: THREE.DoubleSide }), 0, 0, 0);
      g.add(vase);
      var stm = M('#4d7a4d', { roughness: 1 });
      var heads = [['#d4708f', .03, .02], ['#e8c14a', -.04, -.02], ['#c96b6b', 0, .04]];
      heads.forEach(function (h, i) {
        g.add(Cy(.006, .006, .34, stm, h[1], .62 + i * .03, h[2]));
        g.add(S(.045, M(h[0], { roughness: .8 }), h[1], .8 + i * .03, h[2]));
      });
      return g;
    }
  });

  reg({
    id: 'ac', name: '立式空调', cat: 'decor', price: 3599, foot: [.4, .4],
    colors: ['#eef1f4', '#d7e0e4', '#cdd8de', '#aab4be', '#ded5c4', '#9fb8c4'],
    build: function () {
      var g = new THREE.Group();
      g.add(B(.38, 1.78, .36, M('#eef1f4', { roughness: .35, metalness: .15 }), 0, .92, 0));
      g.add(B(.3, .42, .015, M('#dde1e6', { roughness: .4 }), 0, 1.32, .185));
      g.add(B(.3, .02, .02, M('#9aa0a8', { metalness: .5, roughness: .4 }), 0, 1.74, .185));
      var dm = M('#14181d', { emissive: '#3fd0ff', emissiveIntensity: 0 });
      dm.userData.isGlow = true; dm.userData.glowLevel = .9;
      g.add(B(.13, .045, .012, dm, 0, 1.62, .186));
      g.add(B(.34, .03, .3, M('#c8ccd2', { metalness: .5, roughness: .4 }), 0, .015, 0));
      g.userData.glowMats = [dm];
      return g;
    }
  });

  window.FURNITURE = FURNITURE;
  window.FURNITURE_CATS = CATS;
})();

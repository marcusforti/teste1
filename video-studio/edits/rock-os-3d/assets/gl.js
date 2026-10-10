/* Rock OS 3D — camada WebGL (Three.js r147 + bloom).
 * Tudo é função do tempo: GL.render(t) desenha o quadro exato do segundo t,
 * então o render quadro a quadro do HyperFrames é determinístico.
 * Depende de: THREE (+ FontLoader, TextGeometry, EffectComposer, RenderPass, UnrealBloomPass),
 * window.FONT_BSD e das globais TIMING/CUES/W/S definidas no index.html.
 */
(function () {
  const W_ = 1920, H_ = 1080;
  const RED = 0xff3b30, RED_DEEP = 0xe0140c, OK = 0x3fcf7e;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, a, d) => clamp((t - a) / d);
  const easeOut3 = (x) => 1 - Math.pow(1 - x, 3);
  const easeIn3 = (x) => x * x * x;
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const backOut = (x, s = 1.9) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
  const expoOut = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  const lerp = (a, b, x) => a + (b - a) * x;
  let seed = 1847;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  let R, comp, renderPass, bloom, ready = false;
  const envs = [];
  const lazyTex = [];

  // ---------- utilidades ----------
  function imgTex(id) {
    const tex = new THREE.Texture(document.getElementById(id));
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    lazyTex.push(tex);
    return tex;
  }
  function pumpTextures() {
    for (const tex of lazyTex) if (!tex.userData.ok && tex.image && tex.image.complete && tex.image.naturalWidth) { tex.needsUpdate = true; tex.userData.ok = true; }
  }
  const canvases = [];
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const entry = { c, tex, draw, fontsOk: false };
    canvases.push(entry);
    redraw(entry);
    return tex;
  }
  function redraw(e) {
    const ctx = e.c.getContext("2d"); ctx.clearRect(0, 0, e.c.width, e.c.height); e.draw(ctx, e.c.width, e.c.height); e.tex.needsUpdate = true;
    e.fontsOk = document.fonts ? document.fonts.check('900 40px "Big Shoulders Display"') && document.fonts.check('600 20px "JetBrains Mono"') : true;
  }
  function pumpCanvases() { for (const e of canvases) if (!e.fontsOk) redraw(e); }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function label(text, opts = {}) {
    const { size = 34, color = "#f4eee9", bg = "rgba(12,10,10,.78)", border = "#3a2c2a", font = "JetBrains Mono", weight = 700, pad = 18, scale = 0.012 } = opts;
    const m = document.createElement("canvas").getContext("2d");
    m.font = `${weight} ${size}px "${font}"`;
    const w = Math.ceil(m.measureText(text).width + pad * 2 + 10), h = Math.ceil(size + pad * 1.6);
    const tex = canvasTex(w, h, (ctx) => {
      ctx.font = `${weight} ${size}px "${font}"`;
      if (bg) { ctx.fillStyle = bg; roundRect(ctx, 3, 3, w - 6, h - 6, 12); ctx.fill(); }
      if (border) { ctx.strokeStyle = border; ctx.lineWidth = 3; roundRect(ctx, 3, 3, w - 6, h - 6, 12); ctx.stroke(); }
      ctx.fillStyle = color; ctx.textBaseline = "middle"; ctx.fillText(text, pad + 5, h / 2 + 2);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(w * scale, h * scale, 1);
    sp.renderOrder = 10;
    return sp;
  }

  let dotTex;
  function embers(n, box, color = 0xff5a20, size = 0.12) {
    if (!dotTex) dotTex = canvasTex(64, 64, (ctx) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,200,150,.8)"); g.addColorStop(1, "rgba(255,80,20,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
    const base = [];
    for (let i = 0; i < n; i++) base.push([lerp(box[0], box[1], rnd()), lerp(box[2], box[3], rnd()), lerp(box[4], box[5], rnd()), 0.2 + rnd() * 0.7, rnd() * 6.28]);
    const pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: dotTex, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    const span = box[3] - box[2];
    pts.userData.update = (t) => {
      for (let i = 0; i < n; i++) {
        const b = base[i];
        pos[i * 3] = b[0] + Math.sin(t * b[3] * 1.3 + b[4]) * 0.4;
        pos[i * 3 + 1] = box[2] + (((b[1] - box[2]) + t * b[3] * 1.2) % span);
        pos[i * 3 + 2] = b[2] + Math.cos(t * b[3] + b[4]) * 0.3;
      }
      g.attributes.position.needsUpdate = true;
    };
    return pts;
  }

  function tubeAlong(points, radius, color, opts = {}) {
    const path = new THREE.CurvePath();
    for (let i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    const geo = new THREE.TubeGeometry(path, opts.segments || 400, radius, 10, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false }));
    mesh.userData.total = geo.index.count;
    mesh.userData.draw = (p) => geo.setDrawRange(0, Math.floor(mesh.userData.total * clamp(p) / 60) * 60);
    mesh.userData.draw(0);
    return mesh;
  }
  function tubeCurve(curve, radius, color, segs = 160) {
    const geo = new THREE.TubeGeometry(curve, segs, radius, 8, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false }));
    mesh.userData.total = geo.index.count;
    mesh.userData.draw = (p) => geo.setDrawRange(0, Math.floor(mesh.userData.total * clamp(p) / 48) * 48);
    mesh.userData.draw(0);
    return mesh;
  }

  let font;
  function logo3D() {
    if (!font) font = new THREE.FontLoader().parse(window.FONT_BSD);
    const mk = (s, col, em, emi) => {
      const g = new THREE.TextGeometry(s, { font, size: 1.7, height: 0.55, curveSegments: 5, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.045, bevelSegments: 3 });
      g.computeBoundingBox();
      return new THREE.Mesh(g, [
        new THREE.MeshStandardMaterial({ color: col, metalness: 0.55, roughness: 0.28, emissive: em, emissiveIntensity: emi }),
        new THREE.MeshStandardMaterial({ color: 0x2a0a08, metalness: 0.85, roughness: 0.35 }),
      ]);
    };
    const a = mk("ROCK", 0xd9d2cb, 0x000000, 0), b = mk("OS", RED, 0x8a0800, 0.9);
    const wa = a.geometry.boundingBox.max.x;
    b.position.x = wa + 0.55;
    const W = b.position.x + b.geometry.boundingBox.max.x;
    const H = a.geometry.boundingBox.max.y;
    a.position.set(-W / 2, -H / 2, -0.27); b.position.set(b.position.x - W / 2, -H / 2, -0.27);
    const grp = new THREE.Group(); grp.add(a, b);
    grp.userData.os = b;
    return grp;
  }
  function addLights(scene, rimColor = RED) {
    scene.add(new THREE.AmbientLight(0x2a1414, 1.2));
    const key = new THREE.DirectionalLight(0xfff4ea, 1.7); key.position.set(-4, 6, 9); scene.add(key);
    const rim = new THREE.PointLight(rimColor, 70, 30); rim.position.set(5, 2, -3); scene.add(rim);
    const fill = new THREE.PointLight(0xff6a40, 25, 25); fill.position.set(-6, -2, 4); scene.add(fill);
    return { key, rim, fill };
  }
  function ring(radius, width, color, opacity = 1) {
    const m = new THREE.Mesh(new THREE.RingGeometry(radius - width, radius, 128), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    return m;
  }
  function photoPlane(id, w, h, opts = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: imgTex(id), transparent: !!opts.transparent, depthWrite: !opts.transparent, toneMapped: false, color: opts.color || 0xffffff });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    return m;
  }
  const pop01 = (t, at, d = 0.45) => (t < at ? 0 : backOut(prog(t, at, d)));

  // =====================================================================
  // ENV 1 · GANCHO — neon real ao fundo, pulso da marca como tubo de luz, brasas
  // =====================================================================
  function envHook() {
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, W_ / H_, 0.1, 200);
    const bg = photoPlane("img-neon", 34, 19.1); bg.position.set(0, 0, -14); scene.add(bg);
    const pts = [[77, 556], [499, 556], [634, 428], [806, 700], [979, 324], [1133, 652], [1267, 524], [1843, 524]].map(([x, y]) => new THREE.Vector3((x - 960) / 96, -(y - 540) / 90, 0));
    const bolt = tubeAlong(pts, 0.07, RED, { segments: 500 }); scene.add(bolt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffd0c0, toneMapped: false })); scene.add(head);
    const em = embers(380, [-14, 14, -7, 7, -10, 6]); scene.add(em);
    const curve = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    const first = SEG.hook.words[0].start;
    return {
      scene, cam, t0: 0, t1: S("problema") - 0.15,
      update(t) {
        const p = easeInOut(prog(t, 0.5, 0.9));
        bolt.userData.draw(p);
        head.visible = p > 0 && p < 1;
        if (head.visible) head.position.copy(curve.getPointAt(p));
        let op = 1;
        if (t > 1.45 && t < 1.8) op = [0.2, 1, 0.3, 1][Math.floor((t - 1.45) / 0.09) % 4];
        if (t > first - 0.1) op = lerp(1, 0.22, prog(t, first - 0.1, 0.4));
        bolt.material.opacity = op;
        bg.material.color.setScalar(lerp(0.25, 0.75, prog(t, 0, 2.5)) * (t > first ? lerp(1, 0.55, prog(t, first, 1)) : 1));
        em.userData.update(t);
        cam.position.set(Math.sin(t * 0.25) * 0.6, Math.sin(t * 0.2) * 0.3, lerp(17, 13.5, prog(t, 0, this.t1)));
        cam.lookAt(0, 0, -4);
      },
    };
  }

  // =====================================================================
  // ENV 2 · PROBLEMA — painéis de vidro flutuando, fios embolados, vórtice
  // =====================================================================
  function envProblem() {
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, W_ / H_, 0.1, 200);
    addLights(scene);
    const em = embers(160, [-14, 14, -7, 7, -14, 2], 0xff4020, 0.09); scene.add(em);
    const tRev = W("reveal", "Rock");
    const CH = [
      ["iFood", "gestor de pedidos", [3.0, 2.4, -1.5], -0.25, W("problema", "iFood")],
      ["BeeFood", "loja Boa Vista", [7.6, 1.2, -3.0], 0.3, W("problema", "BeeFood")],
      ["Suitable", "loja Wanel Ville", [2.6, -1.2, 0.2], -0.12, W("problema", "Suitable")],
      ["WhatsApp", "reservas", [7.0, -2.4, -0.8], 0.22, W("problema", "WhatsApp")],
      ["WhatsApp", "vagas", [4.5, -3.6, 1.2], -0.3, W("problema", "WhatsApp") + 0.3],
      ["Itu", "em breve", [9.4, 3.4, -5.0], 0.35, W("problema", "WhatsApp") + 0.6],
    ];
    const panels = CH.map(([name, sub, p, ry, at], i) => {
      const tex = canvasTex(720, 300, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, "rgba(40,30,30,.92)"); g.addColorStop(1, "rgba(18,14,14,.92)");
        ctx.fillStyle = g; roundRect(ctx, 6, 6, w - 12, h - 12, 28); ctx.fill();
        ctx.strokeStyle = i === 5 ? "rgba(179,165,159,.6)" : "rgba(255,59,48,.75)"; ctx.lineWidth = 5; if (i === 5) ctx.setLineDash([18, 12]); roundRect(ctx, 6, 6, w - 12, h - 12, 28); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.arc(64, 70, 12, 0, 6.3); ctx.fill();
        ctx.fillStyle = "#b3a59f"; ctx.font = '600 30px "JetBrains Mono"'; ctx.fillText("SISTEMA " + String(i + 1).padStart(2, "0"), 92, 81);
        ctx.fillStyle = "#f4eee9"; ctx.font = '900 104px "Big Shoulders Display"'; ctx.fillText(name.toUpperCase(), 48, 200);
        ctx.fillStyle = "#b3a59f"; ctx.font = '500 34px "JetBrains Mono"'; ctx.fillText(sub, 52, 256);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.5), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.3, metalness: 0.2, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, side: THREE.DoubleSide }));
      m.position.set(...p); m.rotation.y = ry;
      scene.add(m);
      return { m, p: new THREE.Vector3(...p), ry, at, ph: i * 1.7 };
    });
    // fios embolados
    const pairs = [[0, 2], [2, 1], [1, 3], [3, 4], [4, 0], [5, 1], [2, 4], [0, 3], [5, 0]];
    const wires = pairs.map(([a, b], k) => {
      const A = panels[a].p, B = panels[b].p;
      const mid = A.clone().add(B).multiplyScalar(0.5).add(new THREE.Vector3((rnd() - 0.5) * 3, (rnd() - 0.5) * 3, (rnd() - 0.5) * 3));
      const w = tubeCurve(new THREE.CatmullRomCurve3([A, mid, B]), 0.022, RED, 90);
      scene.add(w);
      return { w, at: W("problema", "juntando") + k * 0.11 };
    });
    const core = new THREE.PointLight(RED, 0, 20); core.position.set(5, 0, -1); scene.add(core);
    const coreBall = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffe0d8, toneMapped: false })); coreBall.position.copy(core.position); scene.add(coreBall);
    const center = new THREE.Vector3(5, 0, -1);
    return {
      scene, cam, t0: S("problema") - 0.25, t1: tRev + 0.03,
      update(t) {
        const vort = easeIn3(prog(t, tRev - 1.3, 1.25));
        panels.forEach((P, i) => {
          const s = pop01(t, P.at - 0.05);
          const bob = Math.sin(t * 1.1 + P.ph) * 0.18;
          const pos = P.p.clone(); pos.y += bob;
          if (vort > 0) { const ang = vort * 5 + i; const r = (1 - vort); pos.lerp(center.clone().add(new THREE.Vector3(Math.cos(ang) * r * 2, Math.sin(ang) * r * 1.2, 0)), vort); }
          P.m.position.copy(pos);
          P.m.scale.setScalar(Math.max(0.0001, s * (1 - vort * 0.92)));
          P.m.rotation.set(Math.sin(t * 0.7 + P.ph) * 0.08, P.ry + Math.sin(t * 0.5 + P.ph) * 0.12 + vort * 6, vort * 3);
        });
        wires.forEach((W2) => { W2.w.userData.draw(easeOut3(prog(t, W2.at, 0.5))); W2.w.material.opacity = 0.75 * (1 - vort); });
        core.intensity = vort * 200; coreBall.scale.setScalar(0.01 + vort * 2.2);
        coreBall.visible = vort > 0;
        em.userData.update(t);
        const lt = t - this.t0;
        cam.position.set(4.5 + Math.sin(lt * 0.18) * 2.2, 0.6 + Math.sin(lt * 0.13) * 0.6, 13.5 - lt * 0.12 - vort * 4);
        cam.lookAt(4.2, 0, -1);
      },
    };
  }

  // =====================================================================
  // ENV 3 · REVEAL — logo extrudado, anéis de choque, hambúrgueres orbitando
  // =====================================================================
  function envReveal() {
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, W_ / H_, 0.1, 200);
    const L = addLights(scene);
    const logo = logo3D(); scene.add(logo);
    const rings = [3.8, 5.2, 6.6].map((r) => { const m = ring(r, 0.03, 0x6a2a24, 0.9); m.position.z = -2; scene.add(m); return m; });
    const shock = ring(2, 0.25, RED, 1); shock.position.z = -0.5; scene.add(shock);
    const burgers = ["img-b19", "img-b3", "img-b17", "img-b13"].map((id, i) => {
      const img = document.getElementById(id);
      const ar = (img.naturalHeight || 700) / (img.naturalWidth || 1000);
      const m = photoPlane(id, 3.2, 3.2 * ar, { transparent: true }); scene.add(m); return m;
    });
    const em = embers(320, [-12, 12, -7, 7, -12, 5]); scene.add(em);
    const tRev = W("reveal", "Rock"), t4 = S("rede");
    return {
      scene, cam, t0: tRev - 0.02, t1: t4 - 0.12,
      update(t) {
        const lt = t - tRev;
        const slam = easeOut3(prog(lt, 0, 0.35));
        const exitP = easeIn3(prog(t, t4 - 0.6, 0.48));
        logo.position.set(0, 0.35, lerp(9, 0, slam) + exitP * 9);
        logo.rotation.set(Math.sin(lt * 0.7) * 0.05, Math.sin(lt * 0.55) * 0.22, 0);
        logo.scale.setScalar(1 + lt * 0.012);
        logo.userData.os.material[0].emissiveIntensity = 0.9 + Math.sin(lt * 3) * 0.15;
        rings.forEach((r, i) => { const p = expoOut(prog(lt, 0.05 + i * 0.08, 1.2)); r.scale.setScalar(0.2 + p * 0.8 + exitP); r.material.opacity = 0.9 * p * (1 - exitP); });
        const sp = prog(lt, 0, 0.9); shock.scale.setScalar(0.5 + easeOut3(sp) * 7); shock.material.opacity = (1 - sp) * 0.9;
        burgers.forEach((b, i) => {
          const a = lt * 0.32 + i * (Math.PI / 2);
          const appear = easeOut3(prog(lt, 0.3 + i * 0.12, 0.8));
          b.position.set(Math.cos(a) * 7.2, Math.sin(a * 1.3) * 0.8 - 0.4, -3.5 + Math.sin(a) * 3);
          b.scale.setScalar(appear * (0.85 + 0.15 * Math.sin(a)));
          b.material.opacity = appear * (1 - exitP);
          b.lookAt(cam.position);
        });
        L.rim.intensity = 70 + Math.sin(lt * 2) * 20;
        em.userData.update(t);
        cam.position.set(Math.sin(lt * 0.2) * 1.2, 0.6 + Math.sin(lt * 0.15) * 0.2, 13 - lt * 0.15);
        cam.lookAt(0, 0.1, 0);
      },
    };
  }

  // =====================================================================
  // ENV 4 · CIDADE — mapa noturno, feixes nas lojas, arcos e pacotes, internet caindo
  // (reaproveitado na cena de Itu)
  // =====================================================================
  function cityWorld() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c0a0a, 0.022);
    scene.add(new THREE.AmbientLight(0x442222, 1));
    const ground = photoPlane("img-city", 60, 40); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const grid = new THREE.GridHelper(60, 30, 0x5a1a14, 0x2a0e0a); grid.position.y = 0.02; grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
    const STORES = [["WANEL VILLE", new THREE.Vector3(-9, 0, 4)], ["BOA VISTA", new THREE.Vector3(1, 0, 7)], ["ITU", new THREE.Vector3(11, 0, -3)]];
    const central = new THREE.Vector3(0, 5.2, -4);
    const beacons = STORES.map(([name, p], i) => {
      const g = new THREE.Group(); g.position.copy(p); scene.add(g);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.22, 12, 16, 1, true), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      beam.position.y = 6; g.add(beam);
      const base = ring(0.9, 0.12, RED, 1); base.rotation.x = -Math.PI / 2; base.position.y = 0.05; g.add(base);
      const pulse = ring(1.2, 0.06, RED, 1); pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.06; g.add(pulse);
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), new THREE.MeshStandardMaterial({ color: 0x201919, emissive: RED_DEEP, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.5 })); block.position.y = 0.35; g.add(block);
      const lab = label(name, { size: 40, scale: 0.016 }); lab.position.set(0, 2.2, 0); g.add(lab);
      const ok = label("✓ OPERANDO", { size: 30, color: "#3fcf7e", border: "#3f6b3a", scale: 0.014 }); ok.position.set(0, 1.25, 0); ok.visible = false; g.add(ok);
      return { g, beam, base, pulse, block, lab, ok, p };
    });
    const hub = new THREE.Group(); hub.position.copy(central); scene.add(hub);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 1.4, metalness: 0.4, roughness: 0.3, flatShading: true }));
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), new THREE.MeshBasicMaterial({ color: 0xff7a60, wireframe: true, transparent: true, opacity: 0.35, toneMapped: false }));
    hub.add(core, shell);
    const hubLight = new THREE.PointLight(RED, 60, 18); hub.add(hubLight);
    const hubLab = label("CENTRAL ROCK OS · CASA DO DONO", { size: 36, bg: "rgba(224,20,12,.9)", border: null, color: "#fff", scale: 0.016 }); hubLab.position.set(0, 2.1, 0); hub.add(hubLab);
    const arcs = beacons.map((b) => {
      const end = b.p.clone().add(new THREE.Vector3(0, 0.8, 0));
      const mid = central.clone().add(end).multiplyScalar(0.5).add(new THREE.Vector3(0, 3.5, 0));
      const curve = new THREE.QuadraticBezierCurve3(central.clone(), mid, end);
      const tube = tubeCurve(curve, 0.05, RED, 120); scene.add(tube);
      const packets = [0, 1, 2].map(() => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffd4c8, toneMapped: false })); scene.add(s); return s; });
      return { curve, tube, packets };
    });
    const netPos = new THREE.Vector3(0, 13, -16);
    const netCurve = new THREE.QuadraticBezierCurve3(central.clone(), central.clone().add(netPos).multiplyScalar(0.5).add(new THREE.Vector3(3, 1, 0)), netPos.clone());
    const netTube = tubeCurve(netCurve, 0.035, 0xb3a59f, 100); scene.add(netTube);
    const netLab = label("INTERNET · API iFood · Claude (IA)", { size: 34, scale: 0.02, border: "#b3a59f" }); netLab.position.copy(netPos).add(new THREE.Vector3(0, 1, 0)); scene.add(netLab);
    const offLab = label("OFFLINE", { size: 48, bg: "rgba(224,20,12,.95)", border: null, color: "#fff", scale: 0.024 }); offLab.position.copy(netPos).add(new THREE.Vector3(0, -0.6, 0)); offLab.visible = false; scene.add(offLab);
    const syncLab = label("↻ SINCRONIZADO", { size: 40, color: "#3fcf7e", border: "#3fcf7e", scale: 0.02 }); syncLab.position.copy(offLab.position); syncLab.visible = false; scene.add(syncLab);
    const lockLab = label("◆ REDE PRIVADA · CRIPTOGRAFADA", { size: 30, color: "#ff3b30", border: "#ff3b30", scale: 0.015 }); lockLab.position.set(-4.8, 4.6, 1); lockLab.visible = false; scene.add(lockLab);
    const em = embers(200, [-25, 25, 0.5, 14, -20, 15], 0xff6a40, 0.1); scene.add(em);
    // fluxo de "configuração" para Itu
    const flows = [0, 1].map((k) => {
      const a = beacons[k].p.clone().add(new THREE.Vector3(0, 1.2, 0)), b = beacons[2].p.clone().add(new THREE.Vector3(0, 1.2, 0));
      const curve = new THREE.QuadraticBezierCurve3(a, a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 4.5, 0)), b);
      const tube = tubeCurve(curve, 0.04, OK, 100); scene.add(tube);
      const dots = [0, 1, 2, 3].map(() => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), new THREE.MeshBasicMaterial({ color: 0xc8ffdc, toneMapped: false })); scene.add(s); return s; });
      return { curve, tube, dots };
    });
    const ituShock = ring(1.5, 0.3, RED, 1); ituShock.rotation.x = -Math.PI / 2; ituShock.position.copy(beacons[2].p).add(new THREE.Vector3(0, 0.1, 0)); scene.add(ituShock);
    return { scene, beacons, hub, core, shell, hubLab, arcs, netTube, netLab, offLab, syncLab, lockLab, em, flows, ituShock };
  }
  function setBeacon(b, on, t, i) {
    b.beam.material.opacity = on * (0.75 + Math.sin(t * 3 + i) * 0.1);
    b.beam.scale.set(1, Math.max(0.001, on), 1); b.beam.position.y = 6 * on;
    b.base.material.opacity = 0.25 + on * 0.75;
    const pp = (t * 0.6 + i * 0.3) % 1; b.pulse.scale.setScalar(1 + pp * 2.5); b.pulse.material.opacity = on * (1 - pp) * 0.8;
    b.block.material.emissiveIntensity = 0.1 + on * 0.5;
  }
  function envRede(world) {
    const cam = new THREE.PerspectiveCamera(40, W_ / H_, 0.1, 300);
    const t4 = S("rede"), t5 = S("fila");
    const tCen = W("rede", "central"), tCon = W("rede", "conectadas"), tCri = W("rede", "criptografada");
    const tCair = W("rede", "cair"), tCont = W("rede", "continua"), tSync = W("rede", "sincroniza");
    const storeAt = [W("rede", "Wanel"), W("rede", "Boa"), W("rede", "Itu")];
    return {
      scene: world.scene, cam, t0: t4 - 0.4, t1: t5 - 0.12,
      update(t) {
        const w = world; const lt = t - this.t0;
        w.hub.visible = t > tCen - 0.1;
        const hs = backOut(prog(t, tCen - 0.1, 0.5)); w.hub.scale.setScalar(Math.max(0.001, hs));
        w.core.rotation.set(t * 0.4, t * 0.6, 0); w.shell.rotation.set(-t * 0.25, t * 0.3, 0);
        w.beacons.forEach((b, i) => {
          const on = easeOut3(prog(t, storeAt[i] - 0.1, 0.5));
          b.g.visible = on > 0; setBeacon(b, on, t, i); b.lab.material.opacity = on;
          b.ok.visible = t > tCont + i * 0.12;
          b.block.scale.setScalar(Math.max(0.001, backOut(prog(t, storeAt[i] - 0.1, 0.45))));
        });
        w.arcs.forEach((a, i) => {
          const p = easeOut3(prog(t, tCon + i * 0.12, 0.7)); a.tube.userData.draw(p);
          a.packets.forEach((s, k) => { s.visible = t > tCri + 0.2; const u = ((t - tCri) * 0.55 + k / 3 + i * 0.11) % 1; s.position.copy(a.curve.getPoint(k % 2 ? 1 - u : u)); });
        });
        w.lockLab.visible = t > tCri; w.lockLab.material.opacity = prog(t, tCri, 0.3);
        // internet
        const netOn = prog(t, t4 + 0.2, 0.6);
        const down = t > tCair && t < tSync;
        w.netTube.userData.draw(netOn);
        w.netTube.material.color.setHex(down ? 0x3a2c2a : 0xb3a59f);
        w.netTube.material.opacity = down ? (Math.floor((t - tCair) * 8) % 2 ? 0.2 : 0.5) : 0.9;
        w.netLab.material.opacity = down ? 0.3 : netOn;
        w.offLab.visible = down; w.offLab.scale.setScalar(1);
        w.syncLab.visible = t > tSync + 0.15;
        w.flows.forEach((f) => { f.tube.visible = false; f.dots.forEach((d) => (d.visible = false)); });
        w.ituShock.visible = false;
        w.em.userData.update(t);
        // câmera: plano aéreo descendo e orbitando
        const a = lt / (this.t1 - this.t0);
        const ang = lerp(-0.35, 0.25, easeInOut(a));
        const dist = lerp(30, 21, easeOut3(a));
        const hgt = lerp(20, 11, easeOut3(a));
        cam.position.set(Math.sin(ang) * dist, hgt, Math.cos(ang) * dist);
        cam.lookAt(0.5, 2.2, -0.5);
      },
    };
  }
  function envItu(world) {
    const cam = new THREE.PerspectiveCamera(40, W_ / H_, 0.1, 300);
    const t12 = S("itu"), t13 = S("cuidado");
    const flowAt = [W("itu", "processos"), W("itu", "alertas"), W("itu", "padrao")];
    const tLiga = W("itu", "Liga");
    return {
      scene: world.scene, cam, t0: t12 - 0.3, t1: t13 - 0.12,
      update(t) {
        const w = world; const lt = t - this.t0;
        w.hub.visible = true; w.hub.scale.setScalar(1);
        w.core.rotation.set(t * 0.4, t * 0.6, 0); w.shell.rotation.set(-t * 0.25, t * 0.3, 0);
        const ituOn = easeOut3(prog(t, tLiga + 0.1, 0.6));
        w.beacons.forEach((b, i) => {
          b.g.visible = true; b.block.scale.setScalar(1);
          const on = i < 2 ? 1 : ituOn;
          setBeacon(b, on, t, i); b.lab.material.opacity = i < 2 ? 1 : 0.55 + ituOn * 0.45;
          b.ok.visible = i < 2 || t > tLiga + 0.4;
          if (i === 2) b.block.material.emissiveIntensity = 0.05 + ituOn * 0.8;
        });
        w.arcs.forEach((a, i) => {
          a.tube.userData.draw(i < 2 ? 1 : ituOn); a.tube.material.opacity = 0.55;
          a.packets.forEach((s, k) => { s.visible = i < 2 || ituOn > 0.5; const u = (t * 0.55 + k / 3 + i * 0.11) % 1; s.position.copy(a.curve.getPoint(k % 2 ? 1 - u : u)); });
        });
        w.netTube.userData.draw(1); w.netTube.material.color.setHex(0xb3a59f); w.netTube.material.opacity = 0.5; w.netLab.material.opacity = 0.5;
        w.offLab.visible = false; w.syncLab.visible = false; w.lockLab.visible = false;
        w.flows.forEach((f, k) => {
          const first = flowAt[0] - 0.4;
          f.tube.visible = t > first; f.tube.userData.draw(easeOut3(prog(t, first, 0.6)));
          f.tube.material.opacity = t > tLiga + 0.6 ? lerp(0.8, 0.15, prog(t, tLiga + 0.6, 0.6)) : 0.8;
          f.dots.forEach((d, j) => {
            const burst = flowAt[Math.min(2, j)];
            const u = (t - burst + 0.5) / 0.9;
            d.visible = u > 0 && u < 1 && t < tLiga + 0.3;
            if (d.visible) d.position.copy(f.curve.getPoint(clamp(u)));
          });
        });
        const sp = prog(t, tLiga + 0.1, 1.1);
        w.ituShock.visible = sp > 0 && sp < 1; w.ituShock.scale.setScalar(0.5 + easeOut3(sp) * 6); w.ituShock.material.opacity = (1 - sp);
        w.em.userData.update(t);
        const a = lt / (this.t1 - this.t0);
        const target = new THREE.Vector3(lerp(4, 9.5, easeInOut(a)), 2.4, lerp(0, -2.5, easeInOut(a)));
        cam.position.set(lerp(-6, 4, easeInOut(a)), lerp(12, 7.5, easeOut3(a)), lerp(20, 13, easeOut3(a)));
        cam.lookAt(target);
      },
    };
  }

  // =====================================================================
  // ENV 5 · ROCK VISION — parede curva de 15 telas com fotos reais e detecção
  // =====================================================================
  function envWall() {
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(42, W_ / H_, 0.1, 200);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const em = embers(120, [-12, 12, -6, 6, -14, 2], 0xff6a40, 0.08); scene.add(em);
    const CAMS = [
      ["03", "Conferência de montagem", "img-feed-chop"], ["07", "Foto do pedido fechado", "img-feed-table"], ["02", "Tempo por estação", "img-feed-kitchen"],
      ["05", "Padrão do prato", "img-feed-table"], ["04", "Higiene e EPI", "img-feed-chop"], ["06", "Desperdício em reais", "img-feed-kitchen"],
      ["09", "Estoque e validade", "img-feed-bar"], ["08", "Motoboy esperando", "img-feed-moto"], ["01", "Contagem de entradas", "img-feed-terrace"],
      ["10", "Pessoas por mesa", "img-feed-booths"], ["11", "Mesa sem atendimento", "img-feed-booths"], ["12", "Mesa para limpar", "img-feed-table"],
      ["13", "Mapa de calor", "img-feed-terrace"], ["14", "Fila no pedido", "img-feed-neon"], ["15", "POP escrito pela câmera", "img-feed-chop"],
    ];
    const R0 = 11;
    const screens = CAMS.map(([n, title, imgId], i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const img = document.getElementById(imgId);
      const boxes = [0, 1].map(() => [40 + rnd() * 380, 60 + rnd() * 150, 110 + rnd() * 140, 90 + rnd() * 90, rnd() < 0.3]);
      const tex = canvasTex(640, 360, (ctx, w, h) => {
        ctx.fillStyle = "#0b0909"; ctx.fillRect(0, 0, w, h);
        if (img && img.complete && img.naturalWidth) { ctx.globalAlpha = 0.95; ctx.drawImage(img, 0, 0, w, h); ctx.globalAlpha = 1; }
        ctx.fillStyle = "rgba(0,0,0,.25)"; for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
        boxes.forEach(([x, y, bw, bh, bad]) => { ctx.strokeStyle = bad ? "#ff3b30" : "#3fcf7e"; ctx.lineWidth = 4; ctx.strokeRect(x, y, bw, bh); ctx.fillStyle = bad ? "#ff3b30" : "#3fcf7e"; ctx.fillRect(x - 2, y - 24, 92, 24); ctx.fillStyle = "#0b0909"; ctx.font = '700 16px "JetBrains Mono"'; ctx.fillText(bad ? "ALERTA" : "OK 97%", x + 6, y - 6); });
        const g = ctx.createLinearGradient(0, h - 120, 0, h); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.85)"); ctx.fillStyle = g; ctx.fillRect(0, h - 120, w, 120);
        ctx.fillStyle = "#ff3b30"; ctx.font = '700 22px "JetBrains Mono"'; ctx.fillText("● CAM " + n, 20, h - 64);
        ctx.fillStyle = "#f4eee9"; ctx.font = '900 46px "Big Shoulders Display"'; ctx.fillText(title.toUpperCase(), 20, h - 20);
        ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
      });
      const ang = (col - 2) * 0.33;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, toneMapped: false }));
      m.position.set(Math.sin(ang) * R0, (1 - row) * 2.15, -Math.cos(ang) * R0);
      m.lookAt(0, (1 - row) * 2.15, 0);
      scene.add(m);
      return { m, i };
    });
    const dome = photoPlane("img-cctv", 2.6, 2.6, { transparent: true }); dome.position.set(-4.3, 2.9, -4); scene.add(dome);
    const t7 = S("vision"), t8 = S("montagem");
    const target = screens[0].m.position.clone();
    return {
      scene, cam, t0: t7 - 0.4, t1: t8 + 0.02,
      update(t) {
        screens.forEach((s) => {
          const at = t7 + 0.15 + s.i * 0.13;
          const on = prog(t, at, 0.06);
          s.m.material.opacity = on;
          const fl = prog(t, at, 0.4);
          s.m.material.color.setScalar(on > 0 ? lerp(2.6, 1, fl) : 1);
        });
        dome.position.y = 2.9 + Math.sin(t * 1.2) * 0.08; dome.rotation.z = Math.sin(t * 0.9) * 0.06;
        dome.material.opacity = prog(t, t7, 0.5);
        em.userData.update(t);
        const lt = t - this.t0;
        const dive = easeIn3(prog(t, t8 - 0.9, 0.9));
        const yaw = Math.sin(lt * 0.35) * 0.12 + lerp(0.08, 0, prog(lt, 0, 2));
        const base = new THREE.Vector3(Math.sin(yaw) * 2, 0.2, 3 - lt * 0.25);
        cam.position.copy(base.lerp(target.clone().multiplyScalar(0.82), dive));
        const look = new THREE.Vector3(Math.sin(yaw) * 6, 0.1, -10).lerp(target, dive);
        cam.lookAt(look);
      },
    };
  }

  // =====================================================================
  // ENV 6 · FINAL — hambúrgueres voando na câmera, logo 3D com onda de choque
  // =====================================================================
  function envFinal() {
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, W_ / H_, 0.1, 200);
    const L = addLights(scene);
    const logo = logo3D(); scene.add(logo);
    const rings = [3.8, 5.2, 6.6].map((r) => { const m = ring(r, 0.03, 0x6a2a24, 0.9); m.position.z = -2; scene.add(m); return m; });
    const shock = ring(2, 0.3, RED, 1); shock.position.z = -0.5; scene.add(shock);
    const pts = [[0, 13], [46, 13], [56, 4], [70, 24], [84, 1], [98, 22], [110, 13], [200, 13]].map(([x, y]) => new THREE.Vector3((x - 100) / 15, -(y - 13) / 16 - 1.85, 0.3));
    const bolt = tubeAlong(pts, 0.05, RED, { segments: 400 }); scene.add(bolt);
    const em = embers(380, [-12, 12, -7, 7, -12, 5]); scene.add(em);
    const tHit = CUES.impact.at(-1);
    const flyAt = [SEG.final.words[0].start, W("final", "merecem"), W("final", "mais", 1)];
    const flyers = ["img-b19", "img-b17", "img-b3"].map((id, i) => {
      const img = document.getElementById(id); const ar = (img.naturalHeight || 700) / (img.naturalWidth || 1000);
      const m = photoPlane(id, 3.4, 3.4 * ar, { transparent: true }); scene.add(m); return m;
    });
    return {
      scene, cam, t0: S("final") - 0.3, t1: TIMING.total,
      update(t) {
        flyers.forEach((f, i) => {
          const u = prog(t, flyAt[i] - 0.1, 1.3);
          f.visible = u > 0 && u < 1;
          const side = [-1, 1, 0][i];
          f.position.set(lerp(side * 6, side * 1.5, u), lerp(-1.8 + i, -0.6, u), lerp(-40, 14, easeIn3(u)));
          f.rotation.z = lerp(side * 0.6, -side * 0.3, u);
          f.material.opacity = clamp(u * 4);
        });
        const lt = t - tHit;
        logo.visible = lt > 0;
        const slam = easeOut3(prog(lt, 0, 0.3));
        logo.position.set(0, 0.5, lerp(-30, 0, slam));
        logo.rotation.set(Math.sin(lt * 0.6) * 0.04, Math.sin(lt * 0.5) * 0.18 * clamp(lt), 0);
        logo.scale.setScalar(1 + Math.max(0, lt) * 0.01);
        rings.forEach((r, i) => { const p = expoOut(prog(lt, 0.05 + i * 0.08, 1.4)); r.visible = lt > 0; r.scale.setScalar(0.2 + p * 0.8); r.material.opacity = 0.9 * p; });
        const sp = prog(lt, 0, 1.0); shock.visible = lt > 0 && sp < 1; shock.scale.setScalar(0.5 + easeOut3(sp) * 9); shock.material.opacity = 1 - sp;
        bolt.userData.draw(easeOut3(prog(lt, 0.3, 0.8)));
        let pulse = 0; (CUES.beep || []).concat(CUES.online || []).forEach((b) => { const d = t - b; if (d > 0 && d < 0.5) pulse = Math.max(pulse, 1 - d / 0.5); });
        bolt.material.color.setScalar(1).setHex(RED).multiplyScalar(1 + pulse * 2.5);
        L.rim.intensity = 70 + pulse * 220;
        logo.userData.os.material[0].emissiveIntensity = 0.9 + pulse * 2;
        em.userData.update(t);
        const k = t - this.t0;
        cam.position.set(Math.sin(k * 0.2) * 0.8, 0.5, 13 + Math.max(0, -lt) * 0.0);
        cam.lookAt(0, 0.2, 0);
      },
    };
  }

  // ---------- init e render ----------
  function init() {
    const canvas = document.getElementById("gl");
    R = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    R.setPixelRatio(1); R.setSize(W_, H_, false);
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
    R.setClearColor(0x000000, 0);
    const dummyScene = new THREE.Scene(), dummyCam = new THREE.PerspectiveCamera();
    comp = new THREE.EffectComposer(R);
    renderPass = new THREE.RenderPass(dummyScene, dummyCam); renderPass.clearAlpha = 0;
    comp.addPass(renderPass);
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W_ / 2, H_ / 2), 0.85, 0.5, 0.72);
    comp.addPass(bloom);
    const city = cityWorld();
    envs.push(envHook(), envProblem(), envReveal(), envRede(city), envWall(), envItu(city), envFinal());
    ready = true;
  }
  let last = null;
  window.GL = {
    windows: () => envs.map((e) => [e.t0, e.t1]),
    render(t) {
      if (!ready) { if (document.readyState !== "complete") return; init(); }
      pumpTextures(); pumpCanvases();
      const env = envs.find((e) => t >= e.t0 && t < e.t1);
      const canvas = R.domElement;
      if (!env) { if (last !== null) { R.clear(); last = null; } canvas.style.visibility = "hidden"; return; }
      canvas.style.visibility = "visible";
      env.update(t);
      renderPass.scene = env.scene; renderPass.camera = env.cam;
      comp.render();
      last = env;
    },
  };
})();

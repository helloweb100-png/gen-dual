const WHATSAPP_NUMBER = ""; // 10 dígitos, sin +52 ni espacios. Vacío = el cliente aún no entregó número.

/* ==========================================================================
   GenoDual · La doble hélice
   Un solo bucle requestAnimationFrame con scroll suavizado (lerp) mueve todo
   lo que depende del scroll. Todo es mejora: si algo falla, el HTML se ve completo.
   ========================================================================== */
(() => {
  'use strict';
  window.__gdOk = true;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const TAU = Math.PI * 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const mqDesk = matchMedia('(min-width:960px)');
  const mqStack = matchMedia('(min-width:960px) and (min-height:640px)');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const safe = (fn) => { try { fn(); } catch (e) { /* una mejora que falla no rompe el sitio */ } };

  let NUM = String(WHATSAPP_NUMBER || '').replace(/\D/g, '');
  if (NUM.length === 12 && NUM.startsWith('52')) NUM = NUM.slice(2);
  if (NUM.length !== 10) NUM = '';

  /* ---------- Estado global de scroll / puntero ---------- */
  const S = { raw: scrollY, prev: scrollY, sy: scrollY, v: 0, vh: innerHeight, vw: innerWidth, mx: 0, my: 0, cx: -999, cy: -999, hx: -999, hy: -999, hasPtr: false };
  const hooks = new Map();

  /* ======================================================================
     WhatsApp: una sola constante, enlaces y formulario
     ====================================================================== */
  const waLink = (t) => `https://wa.me/52${NUM}?text=${encodeURIComponent(t)}`;
  safe(() => {
    if (!NUM) {
      root.classList.add('no-wa');
      $$('[data-wa]').forEach((a) => a.setAttribute('href', '#contacto'));
    } else {
      $$('[data-wa]').forEach((a) => {
        a.href = waLink(a.dataset.waText || 'Hola GenoDual, quiero información');
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      });
    }
    const form = $('#cform');
    const msg = $('#fmsg');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!NUM) return;
        const nombre = $('#f-nombre').value.trim();
        const interes = $('#f-interes').value;
        const extra = $('#f-msg').value.trim();
        const fld = $('#f-nombre').closest('.fld');
        if (!nombre) {
          fld.classList.add('err');
          msg.textContent = 'Cuéntanos tu nombre para que sepamos cómo llamarte.';
          $('#f-nombre').focus();
          return;
        }
        fld.classList.remove('err');
        msg.textContent = '';
        const texto = `Hola GenoDual, soy ${nombre}. Me interesa: ${interes}. ${extra}`.trim();
        window.open(waLink(texto), '_blank', 'noopener');
      });
      $('#f-nombre').addEventListener('input', () => {
        $('#f-nombre').closest('.fld').classList.remove('err');
        msg.textContent = '';
      });
    }
    // Etiqueta "¿Dudas? Escríbenos": una sola vez, a los 6 s
    const wf = $('#waFloat');
    if (wf && NUM) {
      setTimeout(() => wf.classList.add('tip'), 6000);
      setTimeout(() => wf.classList.remove('tip'), 12500);
    }
  });

  /* ======================================================================
     Cargador
     ====================================================================== */
  let started = false;
  function start() {
    if (started) return;
    started = true;
    root.classList.remove('loading');
    root.classList.add('ready');
    safe(heroAnime);
  }
  function runLoader() {
    const L = $('#loader');
    if (!L) { start(); return; }
    const lc = $('#lc');
    const t0 = performance.now();
    const DUR = 1150;
    if (!reduce) {
      requestAnimationFrame(function c(now) {
        const p = clamp((now - t0) / DUR);
        if (lc) lc.textContent = Math.round(p * 100);
        if (p < 1) requestAnimationFrame(c);
      });
    }
    setTimeout(() => { L.classList.add('open'); root.classList.remove('loading'); }, reduce ? 50 : 1200);
    setTimeout(() => { L.style.display = 'none'; start(); }, reduce ? 200 : 1750);
    setTimeout(() => { root.classList.remove('loading'); start(); }, 2400);
  }

  /* anime.js: solo mejora (si la CDN falla, el CSS ya lo resolvió) */
  function heroAnime() {
    if (!window.anime || reduce) return;
    const chips = $$('.chip-w');
    chips.forEach((c) => { c.style.animation = 'none'; c.style.opacity = '0'; });
    window.anime({
      targets: chips,
      opacity: [0, 1],
      scale: [0.4, 1],
      delay: window.anime.stagger(220, { start: 700 }),
      duration: 1300,
      easing: 'easeOutElastic(1, .6)'
    });
  }

  /* ======================================================================
     Titulares partidos en palabras
     ====================================================================== */
  function splitInto(node, counter) {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const i = document.createElement('span'); i.textContent = p; i.style.setProperty('--i', counter.n++);
          w.appendChild(i); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('w')) {
        splitInto(n, counter);
      }
    });
  }
  $$('[data-split]').forEach((h) => safe(() => splitInto(h, { n: 0 })));

  /* ======================================================================
     Revelado: IntersectionObserver + respaldo por geometría
     ====================================================================== */
  const revealEls = $$('.rv,[data-split],.mask,[data-count]');
  function reveal(el) {
    if (el.classList.contains('in')) return;
    el.classList.add('in');
    const h = hooks.get(el);
    if (h) safe(h);
  }
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  }
  function geo() {
    const lim = innerHeight * 0.95;
    revealEls.forEach((el) => {
      if (el.classList.contains('in')) return;
      const r = el.getBoundingClientRect();
      if (r.top < lim) reveal(el);
    });
  }
  let geoQueued = false;
  const geoSoon = () => {
    if (geoQueued) return;
    geoQueued = true;
    requestAnimationFrame(() => { geoQueued = false; geo(); });
  };
  addEventListener('scroll', geoSoon, { passive: true });
  addEventListener('resize', geoSoon);
  addEventListener('load', () => { geoSoon(); setTimeout(geo, 600); });
  setTimeout(geo, 2000);
  setTimeout(geo, 4000);

  /* Contadores */
  const countUp = (el) => {
    const target = parseFloat(el.dataset.count) || 0;
    const pre = el.dataset.prefix || '';
    if (reduce) { el.textContent = pre + target; return; }
    const t0 = performance.now();
    const D = 1800;
    requestAnimationFrame(function f(now) {
      const p = clamp((now - t0) / D);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + Math.round(target * e);
      if (p < 1) requestAnimationFrame(f); else el.textContent = pre + target;
    });
  };
  $$('[data-count]').forEach((el) => {
    hooks.set(el, () => countUp(el));
    if (el.getBoundingClientRect().top > innerHeight) el.textContent = (el.dataset.prefix || '') + '0';
  });

  /* ADN: pop de los iconos de los chips (anime.js) */
  const adnChips = $('#adnChips');
  if (adnChips) hooks.set(adnChips, () => {
    if (!window.anime || reduce) return;
    window.anime({ targets: '#adnChips .ico', scale: [0.4, 1], rotate: [-25, 0], delay: window.anime.stagger(90), duration: 900, easing: 'easeOutElastic(1, .6)' });
  });
  if (adnChips && !revealEls.includes(adnChips)) revealEls.push(adnChips);

  /* ======================================================================
     Lienzos (canvas): ayudante con tamaño, DPR y visibilidad
     ====================================================================== */
  function mkCanvas(el) {
    if (!el || !el.getContext) return null;
    const o ={ el, ctx: el.getContext('2d'), w: 0, h: 0, vis: false, dpr: 1, dirty: true };
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      o.dpr = dpr; o.w = w; o.h = h;
      el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
      o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.dirty = true;
    };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(el); else addEventListener('resize', fit);
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { o.vis = es[0].isIntersecting; if (o.vis) o.dirty = true; }, { rootMargin: '120px' }).observe(el);
    else o.vis = true;
    return o;
  }
  const needs = (o) => o && o.vis && o.w > 0 && (!reduce || o.dirty);

  /* ---------- Hélice 3D (compartida por hero y dualidad) ---------- */
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
  function drawHelix(cb, cf, w, h, o) {
    cb.clearRect(0, 0, w, h);
    if (cf) cf.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const R = w * 0.22 * (o.rs || 1);
    const top = h * 0.05, H = h * 0.9;
    const N = 140, P = o.pairs || 28, T = o.turns || 2.3;
    const items = [];
    const pt = (t) => {
      const y = top + t * H;
      const ph = o.angle + t * T * TAU;
      const c = Math.cos(ph), s = Math.sin(ph);
      const tl = (y - cy) * (o.tilt || 0);
      return { y, xa: cx + R * c + tl, za: R * s, xb: cx - R * c + tl, zb: -R * s };
    };
    const proj = (x, z) => { const s = 1 / (1 - z / (4 * R)); return { x: cx + (x - cx) * s, s }; };
    let prev = pt(0);
    for (let i = 1; i <= N; i++) {
      const cur = pt(i / N);
      const a1 = proj(prev.xa, prev.za), a2 = proj(cur.xa, cur.za);
      const b1 = proj(prev.xb, prev.zb), b2 = proj(cur.xb, cur.zb);
      items.push({ k: 0, z: (prev.za + cur.za) / 2, x1: a1.x, y1: prev.y, x2: a2.x, y2: cur.y, c: o.ca });
      items.push({ k: 0, z: (prev.zb + cur.zb) / 2, x1: b1.x, y1: prev.y, x2: b2.x, y2: cur.y, c: o.cb });
      prev = cur;
    }
    for (let k = 0; k < P; k++) {
      const p = pt((k + 0.5) / P);
      const a = proj(p.xa, p.za), b = proj(p.xb, p.zb);
      const mx = (a.x + b.x) / 2;
      items.push({ k: 1, z: p.za, x1: mx, y1: p.y, x2: a.x, y2: p.y });
      items.push({ k: 1, z: p.zb, x1: mx, y1: p.y, x2: b.x, y2: p.y });
      items.push({ k: 2, z: p.za, x: a.x, y: p.y, s: a.s, c: o.ca });
      items.push({ k: 2, z: p.zb, x: b.x, y: p.y, s: b.s, c: o.cb });
    }
    items.sort((a, b) => a.z - b.z);
    const lw = w / 170, nr = w / 90, dpr = o.dpr || 1;
    for (const it of items) {
      const ctx = (cf && it.z >= 0) ? cf : cb;
      const d = clamp((it.z + R) / (2 * R));
      if (it.k === 0) {
        ctx.strokeStyle = rgba(it.c, 0.3 + 0.7 * d);
        ctx.lineWidth = lw * (0.55 + 1.25 * d);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
      } else if (it.k === 1) {
        ctx.strokeStyle = rgba(o.rung, (0.25 + 0.75 * d) * 0.6);
        ctx.lineWidth = Math.max(1, lw * 0.5 * (0.6 + d));
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
      } else {
        ctx.shadowColor = rgba(it.c, 0.9);
        ctx.shadowBlur = 12 * dpr * (0.4 + d);
        ctx.fillStyle = rgba(it.c, 0.4 + 0.6 * d);
        ctx.beginPath(); ctx.arc(it.x, it.y, nr * it.s * (0.7 + 0.7 * d), 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
  const PAL_DARK = { ca: [155, 209, 58], cb: [192, 107, 224], rung: [235, 230, 245] };
  const PAL_LIGHT = { ca: [118, 162, 43], cb: [152, 77, 155], rung: [112, 112, 112] };

  /* ======================================================================
     HERO
     ====================================================================== */
  const hero = $('#inicio');
  const heroBack = mkCanvas($('#helice'));
  const heroFront = mkCanvas($('#helice-f'));
  const spores = mkCanvas($('#esporas'));
  let heroAng = 0.6;
  const bottleTilt = $('#bottleTilt');
  const heroInner = $('.hero-inner');
  const heroBg = $('.hero-bg');
  const hv = $('#hv');
  let tiltX = 0, tiltY = 0;

  let ps = [];
  const makeSpores = () => {
    if (!spores || !spores.w) return;
    const n = innerWidth < 768 ? 34 : 70;
    ps = Array.from({ length: n }, () => ({
      x: Math.random() * spores.w, y: Math.random() * spores.h,
      vx: (Math.random() - 0.5) * 0.25, vy: -0.1 - Math.random() * 0.3,
      r: 1 + Math.random() * 2.2, c: Math.random() < 0.5 ? 0 : 1, ph: Math.random() * TAU
    }));
  };
  function modHero(now, dt) {
    const k = dt / 16.667;
    const rect = hero.getBoundingClientRect();
    const onScreen = rect.bottom > 0 && rect.top < S.vh;
    // parallax de salida
    if (onScreen && !reduce) {
      const sy = Math.max(0, S.raw);
      const fade = clamp(1 - sy / (S.vh * 0.95));
      heroInner.style.transform = `translate3d(0,${(sy * 0.25).toFixed(1)}px,0)`;
      heroInner.style.opacity = fade.toFixed(3);
      heroBg.style.transform = `scale(${(1 + sy * 0.0002).toFixed(4)})`;
    }
    // hélice
    if (needs(heroBack) && heroFront) {
      if (!reduce) heroAng += 0.006 * k;
      const ang = heroAng + S.sy * 0.0016;
      drawHelix(heroBack.ctx, heroFront.ctx, heroBack.w, heroBack.h, { angle: ang, rs: 1.45, tilt: S.mx * 0.14, ca: PAL_DARK.ca, cb: PAL_DARK.cb, rung: PAL_DARK.rung, dpr: heroBack.dpr });
      heroBack.dirty = false;
    }
    // botella 3D
    if (bottleTilt && fine && onScreen) {
      const tx = S.hasPtr ? S.mx * 8 : 0, ty = S.hasPtr ? -S.my * 8 : 0;
      tiltX += (tx - tiltX) * 0.08; tiltY += (ty - tiltY) * 0.08;
      bottleTilt.style.setProperty('--ry', tiltX.toFixed(2) + 'deg');
      bottleTilt.style.setProperty('--rx', tiltY.toFixed(2) + 'deg');
    }
    // esporas
    if (needs(spores)) {
      if (!ps.length) makeSpores();
      const ctx = spores.ctx, W = spores.w, Hh = spores.h;
      ctx.clearRect(0, 0, W, Hh);
      const r0 = spores.el.getBoundingClientRect();
      const mx = S.cx - r0.left, my = S.cy - r0.top;
      for (const p of ps) {
        if (!reduce) {
          p.ph += 0.01 * k;
          p.x += (p.vx + Math.sin(p.ph) * 0.12) * k; p.y += p.vy * k;
          const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
          if (d2 < 14400 && d2 > 1) { const d = Math.sqrt(d2), f = (120 - d) / 120 * 1.2; p.x += dx / d * f * k; p.y += dy / d * f * k; }
          if (p.y < -10) { p.y = Hh + 10; p.x = Math.random() * W; }
          if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 12100) {
            ctx.strokeStyle = `rgba(190,205,160,${((1 - Math.sqrt(d2) / 110) * 0.2).toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of ps) {
        const col = p.c ? '192,107,224' : '155,209,58';
        const tw = 0.7 + 0.3 * Math.sin(now * 0.002 + p.ph * 3);
        ctx.fillStyle = `rgba(${col},${(0.14 * tw).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(${col},${(0.9 * tw).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
      spores.dirty = false;
    }
  }

  /* ======================================================================
     Marquesina
     ====================================================================== */
  const strips = $$('.strip').map((el, i) => {
    const tr = $('.track', el), ul = $('.items', el);
    if (!reduce && tr && ul) {
      const clone = ul.cloneNode(true); clone.setAttribute('aria-hidden', 'true');
      tr.appendChild(clone);
    }
    return { el, tr, ul, dir: i === 0 ? -1 : 1, x: 0, w: 0 };
  });
  function measureStrips() { strips.forEach((s) => { if (s.ul) s.w = s.ul.offsetWidth; if (s.dir > 0 && s.x === 0) s.x = -s.w; }); }
  measureStrips();
  addEventListener('resize', measureStrips);
  addEventListener('load', measureStrips);
  const marq = $('.marq');
  function modMarq(now, dt) {
    if (reduce || !marq) return;
    const r = marq.getBoundingClientRect();
    if (r.bottom < -50 || r.top > S.vh + 50) return;
    const k = dt / 16.667;
    const sp = (0.6 + Math.abs(S.v) * 0.4) * k;
    strips.forEach((s) => {
      if (!s.w) return;
      s.x += s.dir * sp;
      if (s.dir < 0 && s.x <= -s.w) s.x += s.w;
      if (s.dir > 0 && s.x >= 0) s.x -= s.w;
      const skew = clamp(S.v * 0.3, -6, 6) * -s.dir;
      s.tr.style.transform = `translate3d(${s.x.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
    });
  }

  /* ======================================================================
     S2 · DUALIDAD
     ====================================================================== */
  const dual = {
    pin: $('#dualPin'), bar: $('#dualBar'), cta: $('#dualCta'), a: $('#dcA'), b: $('#dcB'),
    cv: mkCanvas($('#helice2')), p: 0, words: [], last: []
  };
  safe(() => {
    const fill = $('#dualFill');
    if (!fill) return;
    const parts = fill.textContent.trim().split(/\s+/);
    fill.textContent = '';
    fill.setAttribute('aria-label', parts.join(' '));
    parts.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'fw'; s.textContent = w; s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--o', 0);
      fill.appendChild(s);
      if (i < parts.length - 1) fill.appendChild(document.createTextNode(' '));
      dual.words.push(s); dual.last.push(0);
    });
  });
  const smooth = (t) => t * t * (3 - 2 * t);
  function modDual(now, k) {
    if (!dual.pin) return;
    const r = dual.pin.getBoundingClientRect();
    if (r.bottom < -150 || r.top > S.vh + 150) return;
    const tgt = clamp(-r.top / Math.max(1, r.height - S.vh));
    dual.p += (tgt - dual.p) * k;
    const p = dual.p;
    const N = dual.words.length;
    const pp = clamp((p - 0.06) / 0.58) * N;
    for (let i = 0; i < N; i++) {
      const o = clamp(pp - i);
      if (Math.abs(o - dual.last[i]) > 0.004) { dual.last[i] = o; dual.words[i].style.setProperty('--o', o.toFixed(3)); }
    }
    if (dual.bar) dual.bar.style.setProperty('--p', p.toFixed(3));
    if (dual.a) dual.a.classList.toggle('on', p > 0.35);
    if (dual.b) dual.b.classList.toggle('on', p > 0.6);
    if (dual.cta) dual.cta.classList.toggle('on', p > 0.9 || tgt >= 0.98);
    if (needs(dual.cv)) {
      const q = clamp((p - 0.3) / 0.4);
      const bump = Math.sin(q * Math.PI);
      drawHelix(dual.cv.ctx, null, dual.cv.w, dual.cv.h, { angle: p * 4 * Math.PI + (reduce ? 0 : now * 0.0004), rs: 1 + 0.6 * bump, pairs: 28, turns: 2.3, ca: PAL_LIGHT.ca, cb: PAL_LIGHT.cb, rung: PAL_LIGHT.rung, dpr: dual.cv.dpr });
      dual.cv.dirty = false;
    }
  }

  /* ======================================================================
     S3 · Tarjetas apiladas (escala por geometría) y paralaje de imágenes
     ====================================================================== */
  const cards = $$('#stack .card');
  const stackEl = $('#stack');
  function modStack() {
    if (!stackEl) return;
    const r = stackEl.getBoundingClientRect();
    if (r.bottom < -200 || r.top > S.vh + 200) return;
    const on = mqStack.matches;
    cards.forEach((c, i) => {
      const next = cards[i + 1];
      if (!on || !next) {
        if (c._q !== 0) { c._q = 0; c.style.removeProperty('--s'); c.style.removeProperty('--b'); }
        return;
      }
      const a = c.getBoundingClientRect(), b = next.getBoundingClientRect();
      const dmax = a.height + 24, d = b.top - a.top;
      const q = clamp((dmax - d) / (dmax - 16));
      if (Math.abs(q - (c._q || 0)) > 0.002) {
        c._q = q;
        c.style.setProperty('--s', (1 - 0.06 * q).toFixed(4));
        c.style.setProperty('--b', (1 - 0.1 * q).toFixed(3));
      }
    });
  }
  const parEls = $$('[data-par]');
  function modPar() {
    if (reduce) return;
    parEls.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > S.vh + 100) return;
      const amt = parseFloat(el.dataset.par) || 20;
      const c = r.top + r.height / 2;
      const t = clamp((c - S.vh / 2) / (S.vh / 2 + r.height / 2), -1, 1);
      el.style.transform = `translate3d(0,${(t * amt).toFixed(1)}px,0)`;
    });
  }

  /* ======================================================================
     S4 · PROTEOMA (2,228 puntos en espiral de filotaxis)
     ====================================================================== */
  const pro = { pin: $('#proPin'), cv: mkCanvas($('#proteoma-cv')), num: $('#pnum'), rows: $$('#proList li'), p: 0, hl: -1, xs: null, ys: null, bw: 0, rot: 0 };
  const NP = 2228, ZN = Math.ceil(NP / 6), GA = 137.508 * Math.PI / 180;
  const ZCOL = ['#9BD13A', '#C06BE0', '#E9D3F2', '#FFFFFF', '#76A22B', '#984D9B'];
  function buildPro() {
    const cv = pro.cv; if (!cv || !cv.w) return;
    const R = Math.min(cv.w, cv.h) / 2 - 6, r0 = R * 0.36;
    pro.xs = new Float32Array(NP); pro.ys = new Float32Array(NP);
    for (let i = 0; i < NP; i++) {
      const r = r0 + (R - r0) * Math.sqrt(i / NP), a = i * GA;
      pro.xs[i] = r * Math.cos(a); pro.ys[i] = r * Math.sin(a);
    }
    pro.bw = cv.w; pro.base = Math.max(1.1, cv.w / 300);
  }
  pro.rows.forEach((li) => {
    const z = +li.dataset.z;
    const on = () => { pro.hl = z; if (pro.cv) pro.cv.dirty = true; };
    const off = () => { pro.hl = -1; if (pro.cv) pro.cv.dirty = true; };
    li.addEventListener('pointerenter', on); li.addEventListener('pointerleave', off);
    li.addEventListener('focus', on); li.addEventListener('blur', off);
    li.addEventListener('click', () => { pro.hl = pro.hl === z ? -1 : z; if (pro.cv) pro.cv.dirty = true; });
  });
  function modPro(now, k) {
    if (!pro.pin) return;
    const r = pro.pin.getBoundingClientRect();
    if (r.bottom < -150 || r.top > S.vh + 150) return;
    const tgt = clamp(-r.top / Math.max(1, r.height - S.vh));
    pro.p += (tgt - pro.p) * k;
    const pp = clamp((pro.p - 0.05) / 0.8);
    const n = Math.round(pp * NP);
    if (pro.num) pro.num.textContent = n.toLocaleString('en-US');
    pro.rows.forEach((li, i) => li.classList.toggle('on', pp >= (i + 1) / 6 - 0.02 && pp > 0));
    const cv = pro.cv;
    if (!cv || !cv.vis || !cv.w) return;
    if (!pro.xs || pro.bw !== cv.w) buildPro();
    if (!pro.xs) return;
    if (reduce && !cv.dirty && pro._n === n) return;
    pro._n = n;
    const ctx = cv.ctx, W = cv.w, H = cv.h;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    if (!reduce) { pro.rot += 0.0004; ctx.rotate(pro.rot); }
    const xs = pro.xs, ys = pro.ys, b = pro.base, hl = pro.hl;
    ctx.fillStyle = 'rgba(185,180,198,.16)';
    for (let i = n; i < NP; i++) ctx.fillRect(xs[i] - 0.7, ys[i] - 0.7, 1.4, 1.4);
    for (let z = 0; z < 6; z++) {
      const from = z * ZN, to = Math.min(n, (z + 1) * ZN);
      if (from >= to) continue;
      ctx.globalAlpha = hl < 0 ? 1 : (hl === z ? 1 : 0.28);
      ctx.fillStyle = ZCOL[z];
      ctx.beginPath();
      for (let i = from; i < to; i++) {
        let rr = b * (i > n - 50 ? 1.9 : 1 + 0.3 * Math.sin(now * 0.002 + i * 0.37));
        if (hl === z) rr *= 1.6;
        ctx.moveTo(xs[i] + rr, ys[i]); ctx.arc(xs[i], ys[i], rr, 0, TAU);
      }
      ctx.fill();
    }
    // destello en los puntos recién encendidos
    if (n > 0 && n < NP) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      for (let i = Math.max(0, n - 30); i < n; i++) { ctx.moveTo(xs[i] + b * 3.4, ys[i]); ctx.arc(xs[i], ys[i], b * 3.4, 0, TAU); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    cv.dirty = false;
  }

  /* ======================================================================
     S5 · ADN: los telómeros se acortan con el scroll
     ====================================================================== */
  const adn = { pin: $('#adnPin'), txt: $('.adn-txt'), svg: $('#chromSvg'), gauge: $('#gaugeFill'), p: 0 };
  function modAdn(now, k) {
    if (!adn.pin || !adn.svg) return;
    const r = adn.pin.getBoundingClientRect();
    if (r.bottom < -150 || r.top > S.vh + 150) return;
    let tgt;
    if (mqDesk.matches) tgt = clamp(-r.top / Math.max(1, r.height - S.vh));
    else {
      const t = adn.txt.getBoundingClientRect();
      tgt = clamp((S.vh * 0.62 - t.top) / Math.max(200, t.height * 0.8));
    }
    adn.p += (tgt - adn.p) * k;
    const p = adn.p;
    adn.svg.style.setProperty('--tl', (1 - 0.65 * p).toFixed(3));
    adn.svg.style.setProperty('--dim', (1 - 0.35 * p).toFixed(3));
    adn.svg.parentElement.style.setProperty('--g', (1 - 0.65 * p).toFixed(3));
  }
  $$('.achip').forEach((b) => b.addEventListener('click', () => {
    if (!adn.svg) return;
    adn.svg.classList.remove('pulse'); void adn.svg.getBoundingClientRect(); adn.svg.classList.add('pulse');
    setTimeout(() => adn.svg.classList.remove('pulse'), 1400);
  }));

  /* ======================================================================
     S7 · Vitaminas: bloque activo → hotspot + zoom
     ====================================================================== */
  const vit = { scene: $('#vitScene'), blocks: $$('#vitList .vit-b'), zoom: $('#vitZoom'), spots: $$('#vitZoom .hs'), frame: $('.vit-frame'), cur: -2 };
  vit.spots.forEach((s) => { if (parseFloat(s.style.left) > 70) s.classList.add('flip'); });
  function setVit(i) {
    if (i === vit.cur) return;
    vit.cur = i;
    vit.blocks.forEach((b, j) => b.classList.toggle('on', j === i));
    const hasSpot = i >= 0 && i < vit.spots.length;
    vit.spots.forEach((s, j) => s.classList.toggle('on', j === i));
    vit.frame.classList.toggle('b12', !hasSpot && i >= 0);
    if (hasSpot) {
      const x = parseFloat(vit.blocks[i].dataset.x), y = parseFloat(vit.blocks[i].dataset.y);
      vit.zoom.style.transform = `translate(${((50 - x) * 0.18).toFixed(2)}%,${((50 - y) * 0.18).toFixed(2)}%) scale(1.18)`;
    } else vit.zoom.style.transform = 'translate(0,0) scale(1)';
  }
  function modVit() {
    if (!vit.scene || !vit.blocks.length) return;
    const r = vit.scene.getBoundingClientRect();
    if (r.bottom < -100 || r.top > S.vh + 100) return;
    const ref = mqDesk.matches ? S.vh * 0.5 : S.vh * 0.74;
    let best = 0, bd = 1e9;
    vit.blocks.forEach((b, i) => {
      const br = b.getBoundingClientRect();
      const d = Math.abs(br.top + br.height / 2 - ref);
      if (d < bd) { bd = d; best = i; }
    });
    setVit(best);
  }

  /* ======================================================================
     S8 · Proceso: línea de tiempo ligada al scroll
     ====================================================================== */
  const proc = { tl: $('#tl'), fg: $('#tlFg'), steps: $$('#tl .step'), p: 0 };
  function modProc(now, k) {
    if (!proc.tl) return;
    const line = proc.tl.querySelector('.tl-line');
    const r = line.getBoundingClientRect();
    if (r.bottom < -100 || r.top > S.vh + 100) return;
    const ref = S.vh * 0.62;
    const tgt = clamp((ref - r.top) / Math.max(1, r.height));
    proc.p += (tgt - proc.p) * k;
    proc.fg.style.setProperty('--p', proc.p.toFixed(3));
    proc.steps.forEach((s) => {
      const n = s.querySelector('.node').getBoundingClientRect();
      const on = n.top + n.height / 2 < ref;
      if (on !== s.classList.contains('on')) {
        s.classList.toggle('on', on);
        if (on && window.anime && !reduce) window.anime({ targets: s.querySelector('.node'), scale: [0.7, 1], duration: 900, easing: 'easeOutElastic(1, .6)' });
      }
    });
  }

  /* ======================================================================
     Encabezado, menú, progreso, cursor
     ====================================================================== */
  const nav = $('#nav');
  const prog = $('#progreso');
  const halo = $('#halo');
  let lastY = scrollY;
  function modChrome(now, dt) {
    const y = S.raw;
    const max = Math.max(1, document.documentElement.scrollHeight - S.vh);
    if (prog) prog.style.transform = `scaleX(${clamp(y / max).toFixed(4)})`;
    if (nav && !root.classList.contains('menu-open')) {
      const dy = y - lastY;
      if (y > 220 && dy > 4) nav.classList.add('hide');
      else if (dy < -4 || y < 120) nav.classList.remove('hide');
    }
    lastY = y;
    if (halo && fine && S.hasPtr) {
      S.hx += (S.cx - S.hx) * 0.12; S.hy += (S.cy - S.hy) * 0.12;
      halo.style.transform = `translate3d(${S.hx.toFixed(1)}px,${S.hy.toFixed(1)}px,0)`;
    }
  }
  const burger = $('#burger'), menu = $('#menu');
  function setMenu(open) {
    root.classList.toggle('menu-open', open);
    if (burger) { burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú'); }
    if (menu) menu.setAttribute('aria-hidden', String(!open));
    if (open && nav) nav.classList.remove('hide');
  }
  if (burger) burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  if (menu) menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  mqDesk.addEventListener && mqDesk.addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* Puntero: halo, inclinación del frasco, botones magnéticos, tilt de tarjetas */
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    S.cx = e.clientX; S.cy = e.clientY;
    S.mx = (e.clientX / S.vw - 0.5) * 2; S.my = (e.clientY / S.vh - 0.5) * 2;
    if (!S.hasPtr) { S.hasPtr = true; S.hx = e.clientX; S.hy = e.clientY; if (halo) halo.classList.add('on'); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (halo) halo.classList.remove('on'); S.hasPtr = false; });
  if (fine && !reduce) {
    $$('.btn-mag').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        b.style.setProperty('--mx', (clamp(dx, -1, 1) * 8).toFixed(1) + 'px');
        b.style.setProperty('--my', (clamp(dy, -1, 1) * 6).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
    });
    $$('[data-tilt]').forEach((t) => {
      t.addEventListener('pointermove', (e) => {
        const r = t.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        t.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
        t.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
      });
      t.addEventListener('pointerleave', () => { t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); });
    });
  }

  /* FAQ: altura animada */
  $$('.qa').forEach((d) => {
    const sum = d.querySelector('summary');
    sum.addEventListener('click', (e) => {
      e.preventDefault();
      if (d.classList.contains('is-open')) {
        d.classList.remove('is-open');
        setTimeout(() => { if (!d.classList.contains('is-open')) d.removeAttribute('open'); }, reduce ? 0 : 520);
      } else {
        d.setAttribute('open', '');
        requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('is-open')));
      }
    });
  });

  /* ======================================================================
     Bucle principal
     ====================================================================== */
  let last = performance.now();
  let frameN = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(64, now - last); last = now;
    const k = reduce ? 1 : 1 - Math.pow(1 - 0.08, dt / 16.667);
    S.raw = window.scrollY;
    S.v += ((S.raw - S.prev) - S.v) * 0.15;
    S.prev = S.raw;
    S.sy += (S.raw - S.sy) * k;
    S.vh = innerHeight; S.vw = innerWidth;
    frameN++;
    safe(() => modChrome(now, dt));
    safe(() => modHero(now, dt));
    safe(() => modMarq(now, dt));
    safe(() => modDual(now, k));
    safe(modStack);
    safe(modPar);
    safe(() => modPro(now, k));
    safe(() => modAdn(now, k));
    safe(modVit);
    safe(() => modProc(now, k));
    if (frameN % 24 === 0) geo();
  }
  requestAnimationFrame(frame);

  addEventListener('resize', () => {
    S.vw = innerWidth; S.vh = innerHeight;
    [heroBack, heroFront, spores, dual.cv, pro.cv].forEach((c) => { if (c) c.dirty = true; });
    if (spores && ps.length) makeSpores();
    pro.xs = null;
  });

  runLoader();
})();

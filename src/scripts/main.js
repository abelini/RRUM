/* ═══════════════════════════════════════════════════════════════
   RRUM — Interacciones «Estación RRUM»
   1. Canvas de ondas (interferencia reactiva al cursor)
   2. Ecualizador del hero (barras según ancho del contenedor)
   3. Dial de sintonía ligado al scroll
   4. Reveal + contadores
   5. Nav móvil
   6. Noticias + ticker via WP REST API (con fallback amable)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ────────────────────────────────────────────────────────────
     1 · CANVAS DE ONDAS
     ──────────────────────────────────────────────────────────── */
  function initWaveCanvas(canvas, opts) {
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext("2d");
    let raf = null;
    const cfg = Object.assign(
      {
        waves: 3,
        amp: 46,
        baseY: 0.62,
        speed: 0.014,
        // mezcla naranja + teal: la «interferencia constructiva» de la RRUM
        colors: ["rgba(255,90,31,.55)", "rgba(47,209,194,.38)", "rgba(245,244,242,.10)"],
      },
      opts
    );
    const mouse = { x: -9999, y: -9999 };
    let t = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      const W = canvas.getBoundingClientRect().width;
      const H = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, W, H);
      t += cfg.speed;

      for (let i = 0; i < cfg.waves; i++) {
        ctx.beginPath();
        const phase = t * (1 + i * 0.28) + i * 2.1;
        const localAmp = cfg.amp * (1 - i * 0.22);
        const my0 = cfg.baseY * H;
        let boost = 0;
        if (mouse.x > -9000) {
          const d = Math.hypot(mouse.x - W / 2, Math.abs(mouse.y - my0));
          boost = Math.max(0, 1 - d / (H * 0.5)) * localAmp * 0.5 * (Math.sign(mouse.y - my0) || 1) * -1;
        }
        for (let x = 0; x <= W; x += 6) {
          const y =
            my0 +
            Math.sin(x * 0.012 + phase) * localAmp +
            Math.sin(x * 0.03 - phase * 1.6) * localAmp * 0.35 +
            Math.sin((x - mouse.x) * 0.045 + phase) * boost;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = cfg.colors[i];
        ctx.lineWidth = i === 0 ? 2.2 : 1.4;
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    }

    const section = canvas.parentElement;
    section.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    section.addEventListener("mouseleave", () => { mouse.x = -9999; });
    window.addEventListener("resize", resize, { passive: true });
    resize();

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { if (!raf) draw(); }
        else if (raf) { cancelAnimationFrame(raf); raf = null; }
      });
    }, { threshold: 0.05 });
    io.observe(canvas);
  }

  const heroCanvas = document.getElementById("heroCanvas");
  if (heroCanvas) initWaveCanvas(heroCanvas, { baseY: 0.58, amp: 52 });

  const joinCanvas = document.getElementById("joinCanvas");
  if (joinCanvas) {
    initWaveCanvas(joinCanvas, {
      baseY: 0.4, amp: 36, waves: 2,
      colors: ["rgba(47,209,194,.45)", "rgba(245,244,242,.08)"],
    });
  }

  /* ────────────────────────────────────────────────────────────
     2 · DIAL DE SINTONÍA — dos variantes
     · vertical (desktop .dial-v): needle viaja top→bottom (87.9→108.0)
     · horizontal (móvil .dial): needle viaja izq→der
     Ambas se actualizan; solo se mueve la aguja cuya pista está visible.
     ──────────────────────────────────────────────────────────── */
  const FMIN = 87.9, FMAX = 108.0;

  const dialVScale = document.getElementById("dialVScale");
  if (dialVScale) {
    // iterar en décimas exactas para que enteros y medios (x.5) sí coincidan
    for (let f10 = 879; f10 <= 1080; f10++) {
      const f = f10 / 10;
      const top = ((f - FMIN) / (FMAX - FMIN)) * 100;
      const tick = document.createElement("span");
      const isInt = f10 % 10 === 0;
      if (isInt) tick.className = "major";
      else if (f10 % 5 === 0) tick.className = "half";
      tick.style.top = top + "%";
      dialVScale.appendChild(tick);
      // números cada 4 MHz (88, 92, 96, 100, 104, 108)
      if (isInt && Math.round(f) % 4 === 0) {
        const lbl = document.createElement("b");
        lbl.textContent = Math.round(f);
        lbl.style.top = top + "%";
        dialVScale.appendChild(lbl);
      }
    }
  }

  const dialScale = document.getElementById("dialScale");
  if (dialScale) {
    for (let f = FMIN; f <= FMAX + 0.001; f += 0.2) {
      const tick = document.createElement("span");
      if (Math.abs((f * 10) % 5) < 0.011) tick.className = "major";
      tick.style.left = ((f - FMIN) / (FMAX - FMIN)) * 100 + "%";
      dialScale.appendChild(tick);
    }
  }

  const freqEls = document.querySelectorAll("[data-dial-freq]");
  const nameEls = document.querySelectorAll("[data-dial-name]");
  const needleH = document.getElementById("dialNeedle");
  const trackH = needleH?.parentElement;
  const needleV = document.getElementById("dialNeedleV");
  const trackV = document.getElementById("dialVTrack");

  function visible(el) {
    return el && getComputedStyle(el).display !== "none" && el.getClientRects().length > 0;
  }

  let lastFreq = 87.9, lastName = "Señal RRUM";

  function tune(freq, name) {
    lastFreq = freq; lastName = name;
    freqEls.forEach((el) => { el.textContent = freq.toFixed(1); el.classList.add("tuned"); });
    nameEls.forEach((el) => { el.textContent = name; });
    const pct = (freq - FMIN) / (FMAX - FMIN);

    // regleta vertical (desktop)
    if (needleV && visible(needleV.closest(".dial-v"))) {
      needleV.style.transform = `translateY(${(pct * (trackV.clientHeight - 2)).toFixed(1)}px)`;
    }
    // pastilla horizontal (móvil)
    if (needleH && visible(trackH)) {
      needleH.style.transform = `translateX(${(pct * (trackH.clientWidth - 2)).toFixed(1) - 1}px)`;
    }
  }

  const sections = Array.from(document.querySelectorAll("section[data-freq]"));

  // Bloqueo de ancla: tras hacer clic en un enlace del nav, el spy queda
  // «congelado» en la frecuencia destino hasta que el scroll termina
  // (evita que secciones cortas como Radios cedan el paso al spy).
  let anchorLockTimer = null;

  // Determinista: sintoniza SIEMPRE la sección que cruza el centro del
  // viewport, independiente del orden en que llegue cada evento.
  function tuneCurrent() {
    if (anchorLockTimer) return;
    const center = window.innerHeight * 0.5;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= center && r.bottom >= center) {
        tune(parseFloat(s.dataset.freq), s.dataset.name || "");
        return;
      }
    }
  }

  // Anclas de navegación: sintoniza de inmediato la sección destino
  // (el scroll animado ya no puede dejar la aguja «desfasada»)
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", () => {
      const target = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
      if (!target?.dataset.freq) return;
      tune(parseFloat(target.dataset.freq), target.dataset.name || "");
      clearTimeout(anchorLockTimer);
      anchorLockTimer = setTimeout(() => {
        anchorLockTimer = null;
        tuneCurrent();
      }, 1500);
    });
  });

  // El navegador avisa cuando el scroll (animado por el ancla) terminó:
  // se libera el bloqueo y el spy retoma el control.
  window.addEventListener("scrollend", () => {
    clearTimeout(anchorLockTimer);
    anchorLockTimer = null;
  });

  let spyRaf = null;
  if (sections.length) {
    const spy = new IntersectionObserver(() => {
      if (spyRaf) return;
      spyRaf = requestAnimationFrame(() => {
        spyRaf = null;
        tuneCurrent();
      });
    });
    sections.forEach((s) => spy.observe(s));
    tuneCurrent();
  }
  tune(87.9, "Señal RRUM");
  // re-tune tras resize (la pista vertical cambia de altura)
  let dialResize;
  window.addEventListener("resize", () => {
    clearTimeout(dialResize);
    dialResize = setTimeout(() => tune(lastFreq, lastName), 180);
  }, { passive: true });

  /* ────────────────────────────────────────────────────────────
     4 · REVEAL + CONTADORES
     ──────────────────────────────────────────────────────────── */
  const reveals = document.querySelectorAll(".reveal");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); ro.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach((el) => ro.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        co.unobserve(en.target);
        const el = en.target;
        const target = parseFloat(el.dataset.count);
        const prefix = el.dataset.prefix || "";
        const suffix = el.dataset.suffix || "";
        if (reduceMotion) { el.textContent = prefix + target + suffix; return; }
        const dur = 1600, t0 = performance.now();
        (function tick(now) {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = prefix + Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: 0.5 });
    counters.forEach((c) => co.observe(c));
  }

  /* ────────────────────────────────────────────────────────────
     5 · NAV móvil
     ──────────────────────────────────────────────────────────── */
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => nav.classList.remove("open"))
    );
  }

  /* ────────────────────────────────────────────────────────────
     6 · NOTICIAS + TICKER — WP REST API
     Fetch directo, sin caché. Si el WP falla: mensaje discreto en
     el grid y el ticker conserva sus ítems estáticos.
     ──────────────────────────────────────────────────────────── */
  const WP_BASE = "https://rrum.mx"; // en producción basta '/wp-json/...'
  // Categorías «Noticias» (2) y «Comunicados» (7) — la query acepta ambas a la vez
  const POSTS_URL = WP_BASE + "/wp-json/wp/v2/posts?per_page=6&categories=2,7&_embed";

  const grid = document.getElementById("postsGrid");
  const postsError = document.getElementById("postsError");
  const tickerLive = document.getElementById("tickerLive");
  const tickerStatic = document.getElementById("tickerStatic");

  function stripHtml(html) {
    const d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.textContent || "").trim();
  }

  function truncate(text, max = 140) {
    return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
  }

  function fmtDate(iso) {
    try {
      return new Intl.DateTimeFormat("es-MX", { day: "long", month: "long", year: "numeric" })
        .format(new Date(iso)).replace(/^./, (c) => c.toUpperCase());
    } catch { return ""; }
  }

  function postCard(post, i) {
    const media = post._embedded?.["wp:featuredmedia"]?.[0];
    const img = media?.source_url;
    const alt = media?.alt_text || stripHtml(post.title.rendered);
    const cat = post._embedded?.["wp:term"]?.[0]?.[0]?.name || "RRUM";
    const date = fmtDate(post.date);
    const title = stripHtml(post.title.rendered);
    const excerpt = truncate(stripHtml(post.excerpt?.rendered || ""));
    const link = post.link;

    const card = document.createElement("article");
    card.className =
      "group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-linen transition hover:-translate-y-1.5 hover:shadow-xl";
    card.innerHTML = "";
    card.innerHTML = `
      <a class="relative block overflow-hidden" href="${link}" target="_blank" rel="noopener" aria-label="${title}"></a>
    `;

    const a = card.firstElementChild;

    if (img) {
      const im = document.createElement("img");
      im.src = img; im.alt = alt; im.loading = "lazy";
      im.className = "h-40 w-full object-cover transition duration-500 group-hover:scale-105";
      a.appendChild(im);
    } else {
      const ph = document.createElement("div");
      ph.className = `relative h-40 w-full cover-${(i % 6) + 1}`;
      a.appendChild(ph);
    }

    const pill = document.createElement("span");
    pill.className =
      "absolute left-4 top-4 rounded-full border border-white/15 bg-ink-0/75 px-3 py-1.5 font-head text-[11px] uppercase tracking-[.14em] text-cream";
    pill.textContent = cat;
    a.appendChild(pill);

    const body = document.createElement("a");
    body.className = "block px-6 pb-7 pt-5";
    body.href = link; body.target = "_blank"; body.rel = "noopener";
    body.innerHTML = `
      <p class="m-0 font-head text-[13px] text-[#8b897f]">${date}</p>
      <h3 class="mt-2 font-head font-medium text-lg leading-snug text-ink-1 transition group-hover:text-orange-deep"></h3>
      <p class="mt-3 text-[15px] leading-relaxed text-[#6b6a63]"></p>
    `;
    body.querySelector("h3").textContent = title;
    body.querySelector("p:last-child").textContent = excerpt || "—";
    card.appendChild(body);

    return card;
  }

  function renderPosts(posts) {
    if (!grid) return;
    grid.innerHTML = "";
    posts.forEach((p, i) => grid.appendChild(postCard(p, i)));
    if (tickerLive && posts.length) {
      const items = posts.slice(0, 6).map((p) => stripHtml(p.title.rendered));
      tickerLive.innerHTML = [...items, ...items]
        .map((t) => `<span>${t}</span><i class="text-[9px] opacity-65">◆</i>`)
        .join("");
      tickerLive.style.display = "contents";
      if (tickerStatic) tickerStatic.style.display = "none";
    }
  }

  function showPostsError() {
    if (grid) grid.innerHTML = "";
    if (postsError) postsError.hidden = false;
  }

  fetch(POSTS_URL, { signal: AbortSignal.timeout(9000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((posts) => (Array.isArray(posts) ? renderPosts(posts) : Promise.reject("respuesta inesperada")))
    .catch((err) => {
      console.warn("[RRUM] WP API no disponible:", err?.message || err);
      showPostsError();
    });
})();

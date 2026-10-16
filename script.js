(() => {
  'use strict';

  const STORE_KEY = 'days-counter';
  const TAU = Math.PI * 2;

  // Each level sits one equal step further along the heat scale, so the colour
  // moves fast in the first week and every later level is still a visible jump.
  // Hues run past 360 on purpose: blue -> violet -> magenta -> red -> orange -> gold.
  const TIERS = [
    { at: 0,   name: 'Cold start', h: 215, s: 16,  l: 62, toast: '' },
    { at: 1,   name: 'Spark',      h: 222, s: 62,  l: 64, toast: 'Spark lit. Day 1 is in.' },
    { at: 7,   name: 'Ember',      h: 264, s: 80,  l: 67, toast: 'Ember reached. One full week.' },
    { at: 21,  name: 'Flame',      h: 302, s: 88,  l: 63, toast: 'Flame reached. 21 days.' },
    { at: 30,  name: 'Blaze',      h: 338, s: 96,  l: 61, toast: 'Blaze reached. One month.' },
    { at: 66,  name: 'Inferno',    h: 366, s: 100, l: 57, toast: 'Inferno reached. 66 days.' },
    { at: 100, name: 'Supernova',  h: 388, s: 100, l: 56, toast: 'Supernova. 100 days.' },
    { at: 365, name: 'Legend',     h: 412, s: 100, l: 62, toast: 'Legend. One full year.' },
  ];
  const LAST = TIERS.length - 1;
  // Past a year the colour keeps heating toward white until this day
  const WHITE_HOT_AT = 1000;

  // The first line of each level is shown the moment that level is reached
  const LINES = [
    ['Tap the circle to add your first day.'],
    ['The first day is the hardest, and it is done.', 'Keep the spark going.', 'Small days add up fast.', 'Come back and add the next one.', 'You are warming up.'],
    ['A full week behind you.', 'The colour is heating up.', 'Momentum is on your side now.', 'Keep feeding the fire.', 'Every tap makes it brighter.'],
    ['21 days. This is turning into a habit.', 'You are on fire now.', 'Most people stop before this point.', 'Protect the streak.'],
    ['A whole month. Look at that colour.', 'This is who you are now.', 'The waves are getting wild.', 'Keep the heat on.'],
    ['66 days is about when a habit starts running on autopilot.', 'Unstoppable.', 'Triple digits are in sight.', 'Too hot to stop now.'],
    ['Triple digits. Very few people get here.', 'You are glowing.', 'Keep going all the way to 365.', 'Pure heat.'],
    ['A full year. Legendary.', 'White hot.', 'Nothing can cool this down.', 'Every day now adds more heat.'],
  ];

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const dial = $('dial');
  const countEl = $('count');
  const unitEl = $('unit');
  const tierEl = $('tier');
  const msgEl = $('msg');
  const nextEl = $('next');
  const bestEl = $('best');
  const toastEl = $('toast');
  const undoBtn = $('undo');
  const resetBtn = $('reset');
  const tools = $('tools');
  const confirmBox = $('confirm');
  const confirmYes = $('confirm-yes');
  const confirmNo = $('confirm-no');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const canvas = $('waves');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const lerp = (a, b, f) => a + (b - a) * f;
  const hsla = (c, a = 1, lift = 0) =>
    `hsla(${(((c.h % 360) + 360) % 360).toFixed(1)}, ${c.s.toFixed(1)}%, ${Math.min(c.l + lift, 96).toFixed(1)}%, ${a.toFixed(3)})`;
  const plural = (n) => (n === 1 ? 'day' : 'days');

  /* ---------- State ---------- */

  const state = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      const count = Math.max(0, Math.floor(Number(raw.count) || 0));
      const best = Math.max(count, Math.floor(Number(raw.best) || 0));
      return { count, best };
    } catch {
      return { count: 0, best: 0 };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be blocked (private mode); the counter still works for this visit
    }
  }

  /* ---------- Heat scale ---------- */

  function tierIndex(days) {
    let i = 0;
    while (i < LAST && days >= TIERS[i + 1].at) i++;
    return i;
  }

  function heatOf(days) {
    const i = tierIndex(days);
    const a = TIERS[i];
    const b = TIERS[Math.min(i + 1, LAST)];
    const f = i === LAST ? 0 : (days - a.at) / (b.at - a.at);
    const over = i === LAST ? Math.min((days - a.at) / (WHITE_HOT_AT - a.at), 1) : 0;
    const p = (i + f) / LAST;
    return {
      i,
      p, // position on the heat track, 0..1
      t: p + over * 0.35, // effect intensity, keeps growing past a year
      h: lerp(a.h, b.h, f),
      s: lerp(a.s, b.s, f),
      l: lerp(a.l, b.l, f) + over * 18,
    };
  }

  /* ---------- Page ---------- */

  function buildTrack() {
    const stops = TIERS.map((tier, k) => `${hsla(tier)} ${((k / LAST) * 100).toFixed(2)}%`);
    $('track-bar').style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
    const list = $('ticks');
    TIERS.forEach((tier, k) => {
      const li = document.createElement('li');
      li.textContent = tier.at;
      li.title = tier.name;
      li.style.setProperty('--at', (k / LAST).toFixed(4));
      list.appendChild(li);
    });
  }

  function render() {
    const { count, best } = state;
    const heat = heatOf(count);
    const next = TIERS[heat.i + 1];

    countEl.textContent = count;
    countEl.dataset.len = String(Math.min(String(count).length, 5));
    unitEl.textContent = plural(count);
    tierEl.textContent = TIERS[heat.i].name;
    bestEl.textContent = best;
    undoBtn.disabled = count === 0;
    resetBtn.disabled = count === 0;
    dial.setAttribute('aria-label', `Add a day. ${count} ${plural(count)} so far.`);

    nextEl.replaceChildren();
    if (next) {
      const left = next.at - count;
      const b = document.createElement('b');
      b.textContent = left;
      nextEl.append(b, ` ${plural(left)} to ${next.name}`);
    } else {
      nextEl.textContent = 'Top level reached. Every day still adds heat.';
    }

    $('ticks').querySelectorAll('li').forEach((li, k) => li.classList.toggle('on', count >= TIERS[k].at));

    const bg = hsla({ h: heat.h, s: 10 + 26 * heat.p, l: 5 + 2.5 * heat.p });
    root.style.setProperty('--heat', hsla(heat));
    root.style.setProperty('--heat-hi', hsla(heat, 1, 16));
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--aura', (0.08 + 0.42 * Math.min(heat.t, 1.2)).toFixed(3));
    root.style.setProperty('--glow', (4 + 36 * heat.p).toFixed(1));
    root.style.setProperty('--p', heat.p.toFixed(4));
    if (themeMeta) themeMeta.setAttribute('content', bg);

    target = heat;
    if (reduceMotion.matches) drawStill();
  }

  function pickLine(i, milestone) {
    const pool = LINES[i];
    if (milestone || pool.length === 1) return pool[0];
    let line;
    do {
      line = pool[Math.floor(Math.random() * pool.length)];
    } while (line === msgEl.textContent);
    return line;
  }

  let toastTimer = 0;
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function popNumber(milestone) {
    if (reduceMotion.matches || !countEl.animate) return;
    const peak = milestone ? 1.28 : 1.14;
    countEl.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(${peak})` }, { transform: 'scale(1)' }],
      { duration: milestone ? 520 : 320, easing: 'cubic-bezier(.2,.8,.3,1)' }
    );
  }

  function buzz(milestone) {
    try {
      if (navigator.vibrate) navigator.vibrate(milestone ? [18, 40, 28] : 10);
    } catch {
      // Vibration is optional
    }
  }

  /* ---------- Actions ---------- */

  function addDay() {
    state.count += 1;
    if (state.count > state.best) state.best = state.count;
    save();

    const heat = heatOf(state.count);
    const milestone = TIERS[heat.i].at === state.count;
    render();
    msgEl.textContent = pickLine(heat.i, milestone);
    if (milestone) showToast(TIERS[heat.i].toast);
    pulse(heat, milestone);
    popNumber(milestone);
    buzz(milestone);
  }

  function removeDay() {
    if (!state.count) return;
    state.count -= 1;
    save();
    render();
    msgEl.textContent = state.count ? 'One day removed.' : LINES[0][0];
    kick = Math.min(kick + 3, 34);
  }

  function openConfirm() {
    tools.hidden = true;
    confirmBox.hidden = false;
    confirmNo.focus();
  }

  function closeConfirm() {
    confirmBox.hidden = true;
    tools.hidden = false;
    (resetBtn.disabled ? dial : resetBtn).focus();
  }

  function resetCount() {
    state.count = 0;
    save();
    render();
    msgEl.textContent = state.best
      ? `Back to zero. Your best of ${state.best} ${plural(state.best)} is saved.`
      : LINES[0][0];
    closeConfirm();
  }

  dial.addEventListener('click', addDay);
  undoBtn.addEventListener('click', removeDay);
  resetBtn.addEventListener('click', openConfirm);
  confirmNo.addEventListener('click', closeConfirm);
  confirmYes.addEventListener('click', resetCount);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !confirmBox.hidden) closeConfirm();
  });

  /* ---------- Waves ---------- */

  let W = 0;
  let H = 0;
  let target = heatOf(state.count);
  const shown = { ...target }; // what the canvas draws; eases toward target
  let phase = 0;
  let kick = 0; // extra wave height from recent taps, decays over time
  let running = false;
  let lastTime = 0;
  const ripples = [];
  const sparks = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduceMotion.matches) drawStill();
  }

  // A circle whose radius rides two sine waves, so the rim looks like moving water
  function ring(cx, cy, r, amp, lobes, ph) {
    const n = 200;
    ctx.beginPath();
    for (let j = 0; j <= n; j++) {
      const a = (j / n) * TAU;
      const d = amp * (0.62 * Math.sin(lobes * a + ph) + 0.38 * Math.sin((lobes + 3) * a - ph * 1.6));
      const x = cx + (r + d) * Math.cos(a);
      const y = cy + (r + d) * Math.sin(a);
      if (j) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function pulse(heat, milestone) {
    kick = Math.min(kick + 9 + 10 * heat.t, 34);
    if (reduceMotion.matches) return;

    const t = Math.min(heat.t, 1.35);
    const waves = milestone ? 6 : 1 + Math.round(t * 3);
    for (let k = 0; k < waves; k++) {
      ripples.push({
        age: -k * 0.11,
        life: 1.3 + t * 0.5,
        reach: 140 + 260 * t + (milestone ? 180 : 0),
        width: 3 + 5 * t,
        amp: 6 + 10 * t,
        seed: Math.random() * TAU,
      });
    }

    const sparkCount = milestone ? 64 : Math.round(t * t * 14);
    for (let k = 0; k < sparkCount; k++) {
      sparks.push({
        a: Math.random() * TAU,
        d: 0,
        v: 90 + Math.random() * (160 + 220 * t),
        age: 0,
        life: 0.6 + Math.random() * 0.7,
        size: 1 + Math.random() * 2.2,
      });
    }
    if (ripples.length > 40) ripples.splice(0, ripples.length - 40);
    if (sparks.length > 320) sparks.splice(0, sparks.length - 320);
  }

  function step(dt) {
    const ease = 1 - Math.exp(-dt * 5);
    for (const key of ['h', 's', 'l', 't', 'p']) shown[key] += (target[key] - shown[key]) * ease;
    kick *= Math.exp(-dt * 2.6);
    phase += dt * (0.7 + 1.8 * Math.min(shown.t, 1.35) + kick * 0.09);

    for (let k = ripples.length - 1; k >= 0; k--) {
      ripples[k].age += dt;
      if (ripples[k].age > ripples[k].life) ripples.splice(k, 1);
    }
    for (let k = sparks.length - 1; k >= 0; k--) {
      const sp = sparks[k];
      sp.age += dt;
      sp.d += sp.v * dt;
      sp.v *= Math.exp(-dt * 2.4);
      if (sp.age > sp.life) sparks.splice(k, 1);
    }
  }

  function draw() {
    const rect = dial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const R = rect.width / 2 + 3;
    const t = Math.min(shown.t, 1.35);
    const lobes = 5 + target.i; // more crests around the rim at higher levels
    const amp = 1.2 + 4.5 * t + kick;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    for (const rp of ripples) {
      if (rp.age < 0) continue;
      const k = rp.age / rp.life;
      const out = 1 - Math.pow(1 - k, 3);
      ctx.lineWidth = Math.max(0.6, rp.width * (1 - k));
      ctx.strokeStyle = hsla(shown, Math.pow(1 - k, 1.6) * (0.55 + 0.3 * Math.min(t, 1)), 8);
      ring(cx, cy, R + rp.reach * out, rp.amp * (1 - k) + 1, lobes, phase * 1.4 + rp.seed);
      ctx.stroke();
    }

    // Soft halo under the rim
    ctx.lineWidth = 12 + 22 * t;
    ctx.strokeStyle = hsla(shown, 0.07 + 0.16 * t);
    ring(cx, cy, R, amp, lobes, phase);
    ctx.stroke();

    // The rim itself
    ctx.shadowBlur = 8 + 30 * t;
    ctx.shadowColor = hsla(shown, 0.9);
    ctx.lineWidth = 2.5 + 2.5 * t;
    ctx.strokeStyle = hsla(shown);
    ring(cx, cy, R, amp, lobes, phase);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // A thin bright trace moving against the rim
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = hsla(shown, 0.55, 22);
    ring(cx, cy, R, amp * 0.6, lobes + 2, -phase * 0.8 + 1.7);
    ctx.stroke();

    for (const sp of sparks) {
      const k = sp.age / sp.life;
      const d = R + sp.d;
      ctx.fillStyle = hsla(shown, (1 - k) * 0.9, 20);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(sp.a) * d, cy + Math.sin(sp.a) * d, sp.size * (1 - k * 0.5), 0, TAU);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  function drawStill() {
    Object.assign(shown, target);
    ripples.length = 0;
    sparks.length = 0;
    kick = 0;
    draw();
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    step(dt);
    draw();
    requestAnimationFrame(tick);
  }

  function setMotion() {
    if (reduceMotion.matches) {
      running = false;
      drawStill();
    } else if (!running) {
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(tick);
    }
  }

  /* ---------- Start ---------- */

  buildTrack();
  render();
  msgEl.textContent = state.count ? pickLine(heatOf(state.count).i, false) : LINES[0][0];
  resize();
  setMotion();
  window.addEventListener('resize', resize);
  reduceMotion.addEventListener?.('change', setMotion);
  if (document.fonts) document.fonts.ready.then(() => reduceMotion.matches && drawStill());
})();

(() => {
  'use strict';

  const STORE_KEY = 'days-counter';
  const PROBE_KEY = 'days-counter:probe';
  const MAX_DAYS = 99999;
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

  // What tends to change as the streak grows. `kind` says how solid each point is:
  // Research = published studies, Reported = what people commonly describe.
  const CHANGES = [
    { at: 1, kind: 'Tip', title: 'Day one is done', text: 'Urges rise, peak and fade, often within minutes. When one hits, change rooms, move your body or step outside until it passes.' },
    { at: 3, kind: 'Reported', title: 'Urges at their strongest', text: 'The first days are usually the hardest. Your brain still expects the old reward at the usual times, so cravings spike around your old triggers.' },
    { at: 7, kind: 'Research', title: 'Testosterone peak', text: 'In a small 2003 study of 28 men, testosterone peaked on day 7 of abstinence at about 1.5 times the starting level, then returned to normal. The rise is short-lived.' },
    { at: 14, kind: 'Reported', title: 'More time and focus', text: 'Many people notice more free time and fewer distractions, especially late at night. Put that time into something you want more of.' },
    { at: 21, kind: 'Research', title: 'Triggers lose their pull', text: 'When a trigger keeps showing up without the old reward, its pull weakens. Psychologists call this extinction, and it is why urges get quieter with time.' },
    { at: 30, kind: 'Reported', title: 'A month of self-control', text: 'People often report feeling more confident and more in control after a month. Every urge you rode out was practice.' },
    { at: 66, kind: 'Research', title: 'Running on autopilot', text: 'In a 2009 study by Lally and colleagues, new habits took 66 days on average to become automatic. Staying on track now takes much less effort.' },
    { at: 90, kind: 'Reported', title: 'The 90-day reset', text: '90 days is a common goal in quit communities. People describe steadier mood, better sleep and more energy, though studies have not confirmed these effects.' },
    { at: 365, kind: 'Milestone', title: 'A year of keeping your word', text: 'A full year of keeping a promise to yourself. That record is proof you can change a habit when you decide to.' },
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
  const footEl = $('foot');
  const statusEl = $('save-status');
  const editBtn = $('edit');
  const editForm = $('edit-form');
  const editInput = $('edit-input');
  const editCancel = $('edit-cancel');
  const choiceEl = $('choice');
  const choiceText = $('choice-text');
  const keepAccountBtn = $('keep-account');
  const keepDeviceBtn = $('keep-device');
  const teaserBtn = $('teaser');
  const teaserText = $('teaser-text');
  const changesEl = $('changes');
  const stepEls = [];
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const canvas = $('waves');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const lerp = (a, b, f) => a + (b - a) * f;
  const hsla = (c, a = 1, lift = 0) =>
    `hsla(${(((c.h % 360) + 360) % 360).toFixed(1)}, ${c.s.toFixed(1)}%, ${Math.min(c.l + lift, 96).toFixed(1)}%, ${a.toFixed(3)})`;
  const plural = (n) => (n === 1 ? 'day' : 'days');

  /* ---------- Saving ----------
   * The count never resets on its own: only the Reset button sets it to 0.
   *
   * This device keeps a copy in localStorage, written on every change. When
   * someone signs in, the count is also kept in their account. The account
   * store is plugged in at run time through window.daysCounter.useAccounts()
   * (see account.js), so the counter works the same with or without it.
   *
   * Every change carries an `updated` time, and copies of the count (other
   * tabs, the account) always settle on the most recent one, so an old copy
   * never overwrites a newer count. `owner` is the account this device's copy
   * belongs to (null before anyone signs in), `synced` is the `updated` time
   * the account last confirmed, and `saved` orders writes between tabs.
   */

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const count = Math.floor(Number(raw.count));
    if (!Number.isFinite(count) || count < 0) return null;
    const best = Math.max(count, Math.floor(Number(raw.best)) || 0);
    const updated = Number(raw.updated) || 0;
    const owner = typeof raw.owner === 'string' && raw.owner ? raw.owner : null;
    const synced = Number(raw.synced) || 0;
    const saved = Number(raw.saved) || updated;
    return { count, best, updated, owner, synced, saved };
  }

  const hasDays = (rec) => rec.count > 0 || rec.best > 0;

  function readLocal() {
    try {
      return sanitize(JSON.parse(localStorage.getItem(STORE_KEY)));
    } catch {
      return null;
    }
  }

  function writeLocal() {
    state.saved = Math.max(Date.now(), state.saved + 1);
    try {
      const text = JSON.stringify(state);
      localStorage.setItem(STORE_KEY, text);
      return localStorage.getItem(STORE_KEY) === text;
    } catch {
      return false;
    }
  }

  function storageWorks() {
    try {
      localStorage.setItem(PROBE_KEY, '1');
      localStorage.removeItem(PROBE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  const state = readLocal() || { count: 0, best: 0, updated: 0, owner: null, synced: 0, saved: 0 };
  let localOk = storageWorks();

  // Take a newer copy written by another tab, so a stale tab never overwrites it
  function pullLocal() {
    const rec = readLocal();
    if (rec && rec.saved > state.saved) {
      Object.assign(state, rec);
      return true;
    }
    return false;
  }

  function commit() {
    state.updated = Math.max(Date.now(), state.updated + 1);
    localOk = writeLocal();
    pushToAccount();
    renderStatus();
  }

  /* Account sync. A provider (account.js) calls onAccount(account, reason)
   * whenever the signed-in account changes:
   *   account: null, or { id, load() -> Promise<record|null>, save(record) -> Promise<record> }
   *            where record is { count, best, updated } and save() resolves with
   *            the account's copy after the save. Both reject with an error whose
   *            `kind` is 'offline' (try again later), 'setup' (the database isn't
   *            ready) or 'refused' (the account won't accept it).
   *   reason:  'initial' | 'signed-in' | 'signed-out' (on purpose, after flush())
   *            | 'expired' (the session ended by itself)
   */

  const ACCOUNT_TIMEOUT = 15000;
  let account = null; // the signed-in account's store
  let accountStatus = 'none'; // none | signed-out | expired | loading | ready | offline | setup | refused | choice
  let merged = false; // this device's copy has been reconciled with the account
  let busy = false; // taps wait while a count that may replace this one loads, or a choice is open
  let pendingChoice = null; // { device, account } when both hold different days
  let pushLoop = null;
  let pushAgain = false;
  let retryTimer = 0;
  let lastRefresh = 0;

  function withTimeout(promise) {
    let timer;
    const late = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Timed out'), { kind: 'offline' })), ACCOUNT_TIMEOUT);
    });
    return Promise.race([promise, late]).finally(() => clearTimeout(timer));
  }

  function useAccounts(provider) {
    if (accountStatus === 'none') accountStatus = state.owner ? 'loading' : 'signed-out';
    renderStatus();
    provider.start(onAccount);
  }

  function onAccount(next, reason) {
    if (next && account && next.id === account.id) return;
    account = next || null;
    merged = false;
    pendingChoice = null;
    hideChoice();
    clearTimeout(retryTimer);

    if (account) {
      connect(account);
      return;
    }
    if (reason === 'signed-out') {
      // Signed out on purpose, after flush() confirmed the account has every day:
      // take this person's count off the device
      Object.assign(state, { count: 0, best: 0, updated: Math.max(Date.now(), state.updated + 1), owner: null, synced: 0 });
      localOk = writeLocal();
      accountStatus = 'signed-out';
      setBusy(false);
      msgEl.textContent = 'Signed out. Your days are safe in your account.';
      return;
    }
    accountStatus = state.owner ? 'expired' : 'signed-out';
    setBusy(false);
  }

  async function connect(acc) {
    accountStatus = 'loading';
    // Taps that belong to this account are safe to keep; anything else waits for its count
    setBusy(state.owner !== acc.id);
    let remote;
    try {
      remote = await withTimeout(acc.load());
    } catch (err) {
      if (acc !== account) return;
      failed(err);
      setBusy(false);
      return;
    }
    if (acc !== account) return;
    reconcile(acc, remote ? sanitize(remote) : null);
  }

  function reconcile(acc, remote) {
    pullLocal();
    const local = { ...state };
    if (local.owner === acc.id) {
      if (remote && remote.updated > local.updated) takeAccount(remote);
    } else if (local.owner || !hasDays(local)) {
      // Another account's copy, or nothing counted yet: show this account's days
      takeAccount(remote || { count: 0, best: 0, updated: 0 });
    } else if (!remote || !hasDays(remote)) {
      // Days counted before signing in move into the account
      state.owner = acc.id;
      state.synced = 0;
      state.updated = Math.max(state.updated, (remote ? remote.updated : 0) + 1);
      localOk = writeLocal();
    } else if (remote.count === local.count && remote.best === local.best) {
      takeAccount(remote);
    } else {
      pendingChoice = { device: local, account: remote };
      accountStatus = 'choice';
      showChoice();
      setBusy(true);
      return;
    }
    finishMerge();
  }

  function takeAccount(remote) {
    const before = state.count;
    Object.assign(state, {
      count: remote.count,
      best: Math.max(remote.best, remote.count),
      updated: remote.updated,
      owner: account.id,
      synced: remote.updated,
    });
    localOk = writeLocal();
    if (state.count !== before) msgEl.textContent = `Loaded ${state.count} ${plural(state.count)} from your account.`;
  }

  function finishMerge() {
    merged = true;
    accountStatus = 'ready';
    lastRefresh = Date.now();
    setBusy(false);
    if (state.updated !== state.synced) pushToAccount();
  }

  function choose(keep) {
    const choice = pendingChoice;
    if (!choice || !account) return;
    pendingChoice = null;
    hideChoice();
    const picked = keep === 'device' ? choice.device : choice.account;
    Object.assign(state, {
      count: picked.count,
      best: Math.max(choice.device.best, choice.account.best),
      owner: account.id,
      synced: 0,
      // Newer than the account's copy, so the choice is what gets saved
      updated: Math.max(Date.now(), choice.account.updated + 1, state.updated + 1),
    });
    localOk = writeLocal();
    msgEl.textContent = `Keeping ${state.count} ${plural(state.count)}.`;
    finishMerge();
  }

  const canPush = () => Boolean(account && merged && state.owner === account.id && !pendingChoice);

  // Saves run one at a time; a burst of taps becomes one more save after the current one
  function pushToAccount() {
    if (!canPush()) return Promise.resolve();
    pushAgain = true;
    if (!pushLoop) {
      pushLoop = (async () => {
        while (pushAgain && canPush()) {
          pushAgain = false;
          if (!(await pushOnce(account))) break;
        }
        pushLoop = null;
        renderStatus();
      })();
    }
    return pushLoop;
  }

  async function pushOnce(acc) {
    const sent = { count: state.count, best: state.best, updated: state.updated };
    if (state.synced === sent.updated) return true;
    renderStatus();
    let remote;
    try {
      remote = sanitize(await withTimeout(acc.save(sent)));
    } catch (err) {
      if (acc === account) failed(err);
      return false;
    }
    if (acc !== account) return false;
    if (!remote) {
      failed(null);
      return false;
    }
    pullLocal();
    if (state.updated === sent.updated) {
      if (remote.updated > sent.updated || remote.count !== sent.count) {
        // The account had a newer count from another device; that one wins
        takeAccount(remote);
        render();
      } else {
        state.best = Math.max(state.best, remote.best);
        state.updated = remote.updated;
        state.synced = remote.updated;
        localOk = writeLocal();
      }
    } else if (state.updated <= remote.updated) {
      // More taps landed while saving; keep them ahead of the account's copy
      state.updated = remote.updated + 1;
      localOk = writeLocal();
    }
    accountStatus = 'ready';
    return true;
  }

  function failed(err) {
    const kind = err && err.kind;
    accountStatus = kind === 'setup' || kind === 'refused' ? kind : 'offline';
    if (accountStatus === 'offline') {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(retry, 30000);
    }
    renderStatus();
  }

  function retry() {
    if (!account || pendingChoice) return;
    if (!merged) connect(account);
    else refreshFromAccount();
  }

  // Pick up changes made on other devices when this page comes back into view
  async function refreshFromAccount() {
    const acc = account;
    if (!acc || !merged || pendingChoice) return;
    lastRefresh = Date.now();
    let remote;
    try {
      remote = await withTimeout(acc.load());
    } catch (err) {
      if (acc === account) failed(err);
      return;
    }
    if (acc !== account) return;
    remote = remote ? sanitize(remote) : null;
    pullLocal();
    if (remote && remote.updated > state.updated) {
      takeAccount(remote);
      render();
    }
    accountStatus = 'ready';
    if (state.updated !== state.synced) pushToAccount();
    else renderStatus();
  }

  // Resolves true once the account holds every day on this device
  async function flush() {
    if (!account) return true;
    if (pendingChoice) return false;
    if (!merged) return state.owner === account.id ? state.updated === state.synced : !hasDays(state);
    if (state.updated !== state.synced) await pushToAccount();
    if (pushLoop) await pushLoop;
    return state.updated === state.synced;
  }

  function setBusy(on) {
    busy = on;
    dial.disabled = on;
    dial.setAttribute('aria-busy', String(on));
    render();
  }

  const BLOCKED = 'Not saved. This browser is blocking storage, so the count will be lost when you close the page.';

  function renderStatus() {
    let text;
    let warn = false;
    switch (accountStatus) {
      case 'loading':
        text = 'Loading your saved days…';
        break;
      case 'ready':
        text = state.updated === state.synced ? 'Saved to your account' : 'Saving to your account…';
        break;
      case 'offline':
        text = "Saved on this device. It will back up to your account when you're online.";
        break;
      case 'expired':
        text = 'Signed out. Sign in again to back up your days.';
        warn = true;
        break;
      case 'setup':
        text = "Signed in, but account saving isn't set up yet. Your days are saved in this browser.";
        warn = true;
        break;
      case 'refused':
        text = "Your account didn't accept the save. Your days are saved in this browser.";
        warn = true;
        break;
      case 'choice':
        text = 'Choose which count to keep';
        break;
      default:
        text = accountStatus === 'signed-out' ? 'Saved only in this browser' : 'Saved in this browser';
        if (!localOk) {
          text = BLOCKED;
          warn = true;
        }
    }
    if (statusEl.textContent !== text) statusEl.textContent = text;
    statusEl.classList.toggle('warn', warn);
  }

  function showChoice() {
    const { device, account: remote } = pendingChoice;
    choiceText.textContent = `Your account has ${remote.count} ${plural(remote.count)}. This device has ${device.count} ${plural(device.count)}. Which count do you want to keep?`;
    keepAccountBtn.textContent = `Keep ${remote.count} from my account`;
    keepDeviceBtn.textContent = `Keep ${device.count} from this device`;
    editForm.hidden = true;
    footEl.hidden = true;
    choiceEl.hidden = false;
  }

  function hideChoice() {
    if (choiceEl.hidden) return;
    choiceEl.hidden = true;
    footEl.hidden = false;
  }

  // Ask the browser not to clear this site's data when the device runs low on space
  let persistAsked = false;
  function askPersist() {
    if (persistAsked) return;
    persistAsked = true;
    try {
      const store = navigator.storage;
      if (store && store.persist) store.persisted().then((kept) => kept || store.persist()).catch(() => {});
    } catch {
      // Not supported here; localStorage still works
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

  function buildChanges() {
    const list = $('steps');
    CHANGES.forEach((change) => {
      const li = document.createElement('li');
      li.className = 'step';
      li.style.setProperty('--c', hsla(heatOf(change.at)));

      const dot = document.createElement('span');
      dot.className = 'step-dot';
      dot.setAttribute('aria-hidden', 'true');

      const body = document.createElement('div');
      body.className = 'step-body';
      const head = document.createElement('div');
      head.className = 'step-head';
      const day = document.createElement('span');
      day.className = 'step-day';
      day.textContent = `Day ${change.at}`;
      const tag = document.createElement('span');
      tag.className = `tag tag-${change.kind.toLowerCase()}`;
      tag.textContent = change.kind;
      const when = document.createElement('span');
      when.className = 'step-when';
      head.append(day, tag, when);

      const title = document.createElement('h3');
      title.className = 'step-title';
      title.textContent = change.title;
      const text = document.createElement('p');
      text.className = 'step-text';
      text.textContent = change.text;

      body.append(head, title, text);
      li.append(dot, body);
      list.appendChild(li);
      stepEls.push(li);
    });
  }

  function renderChanges(count) {
    let current = -1;
    CHANGES.forEach((change, k) => {
      if (count >= change.at) current = k;
    });
    stepEls.forEach((li, k) => {
      const left = CHANGES[k].at - count;
      li.classList.toggle('done', k <= current);
      li.classList.toggle('current', k === current);
      li.classList.toggle('linked', k < current);
      li.querySelector('.step-when').textContent = left <= 0 ? 'Unlocked' : `in ${left} ${plural(left)}`;
    });
    const next = CHANGES[current + 1];
    teaserText.textContent = next
      ? `Next change in you: ${next.title}, day ${next.at}`
      : 'Every change unlocked. See them all';
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
    undoBtn.disabled = busy || count === 0;
    resetBtn.disabled = busy || count === 0;
    editBtn.disabled = busy;
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
    renderChanges(count);

    const bg = hsla({ h: heat.h, s: 10 + 26 * heat.p, l: 5 + 2.5 * heat.p });
    root.style.setProperty('--heat', hsla(heat));
    root.style.setProperty('--heat-hi', hsla(heat, 1, 16));
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--aura', (0.08 + 0.42 * Math.min(heat.t, 1.2)).toFixed(3));
    root.style.setProperty('--glow', (4 + 36 * heat.p).toFixed(1));
    root.style.setProperty('--p', heat.p.toFixed(4));
    if (themeMeta) themeMeta.setAttribute('content', bg);

    renderStatus();
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
  function showToast(lines) {
    toastEl.replaceChildren(
      ...lines.map((line, k) => {
        const span = document.createElement('span');
        if (k) span.className = 'toast-sub';
        span.textContent = line;
        return span;
      })
    );
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
    if (busy) return;
    pullLocal();
    state.count += 1;
    if (state.count > state.best) state.best = state.count;
    commit();
    askPersist();

    const heat = heatOf(state.count);
    const levelUp = TIERS[heat.i].at === state.count;
    const change = CHANGES.find((c) => c.at === state.count);
    const milestone = levelUp || Boolean(change);
    render();
    msgEl.textContent = levelUp || !change
      ? pickLine(heat.i, levelUp)
      : `Day ${change.at} unlocked: ${change.title}.`;
    const toast = [];
    if (levelUp) toast.push(TIERS[heat.i].toast);
    if (change) toast.push(`Unlocked: ${change.title}`);
    if (toast.length) showToast(toast);
    pulse(heat, milestone);
    popNumber(milestone);
    buzz(milestone);
  }

  function removeDay() {
    if (busy) return;
    pullLocal();
    if (!state.count) return render();
    state.count -= 1;
    commit();
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
    if (busy) return;
    pullLocal();
    state.count = 0;
    commit();
    render();
    msgEl.textContent = state.best
      ? `Back to zero. Your best of ${state.best} ${plural(state.best)} is saved.`
      : LINES[0][0];
    closeConfirm();
  }

  function openEdit() {
    pullLocal();
    render();
    editInput.value = state.count;
    footEl.hidden = true;
    editForm.hidden = false;
    editInput.focus();
    editInput.select();
  }

  function closeEdit() {
    editForm.hidden = true;
    footEl.hidden = false;
    editBtn.focus();
  }

  function saveEdit(e) {
    e.preventDefault();
    const n = Math.floor(Number(editInput.value));
    if (busy || !Number.isFinite(n) || n < 0 || n > MAX_DAYS) return;
    pullLocal();
    state.count = n;
    if (n > state.best) state.best = n;
    commit();
    render();
    msgEl.textContent = `Count set to ${n} ${plural(n)}.`;
    pulse(heatOf(n), false);
    closeEdit();
  }

  dial.addEventListener('click', addDay);
  undoBtn.addEventListener('click', removeDay);
  resetBtn.addEventListener('click', openConfirm);
  confirmNo.addEventListener('click', closeConfirm);
  confirmYes.addEventListener('click', resetCount);
  editBtn.addEventListener('click', openEdit);
  editCancel.addEventListener('click', closeEdit);
  editForm.addEventListener('submit', saveEdit);
  keepAccountBtn.addEventListener('click', () => choose('account'));
  keepDeviceBtn.addEventListener('click', () => choose('device'));
  teaserBtn.addEventListener('click', () => {
    const current = changesEl.querySelector('.step.current') || changesEl;
    current.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!confirmBox.hidden) closeConfirm();
    if (!editForm.hidden) closeEdit();
  });

  // Stay in step with other tabs, and with this tab after it was in the background
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY && pullLocal()) render();
  });
  // Coming back to the page: catch up with other tabs, then with other devices
  function onReturn() {
    if (document.hidden) return;
    if (pullLocal()) render();
    if (account && (accountStatus === 'offline' || Date.now() - lastRefresh > 5000)) retry();
  }
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('focus', onReturn);
  window.addEventListener('online', retry);
  window.addEventListener('pageshow', () => {
    if (pullLocal()) render();
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
  buildChanges();
  render();
  msgEl.textContent = state.count ? pickLine(heatOf(state.count).i, false) : LINES[0][0];
  resize();
  setMotion();
  window.addEventListener('resize', resize);
  reduceMotion.addEventListener?.('change', setMotion);
  if (document.fonts) document.fonts.ready.then(() => reduceMotion.matches && drawStill());

  // Lets account.js (or another host) plug in an account store
  window.daysCounter = {
    useAccounts,
    flush,
    snapshot: () => ({ count: state.count, best: state.best }),
  };
})();

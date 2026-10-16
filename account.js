(() => {
  'use strict';

  // Sign-in and cloud saving with Supabase. Without a project URL and key in
  // config.js this file does nothing, and the counter keeps working on its own.

  const config = window.DAYS_COUNTER_CONFIG || {};
  const app = window.daysCounter;
  const lib = window.supabase;
  if (!app || !config.supabaseUrl || !config.supabaseKey || !lib || !lib.createClient) return;

  const $ = (id) => document.getElementById(id);
  const entry = $('account-entry');
  const openBtn = $('account-btn');
  const dialog = $('account-dialog');
  const titleEl = $('account-title');
  const msgEl = $('account-msg');
  const emailEl = $('account-email');
  const syncEl = $('account-sync');
  const signOutBtn = $('signout');
  const signOutAnywayBtn = $('signout-anyway');
  const resendBtn = $('resend');

  const VIEWS = {
    signin: { el: $('view-signin'), title: 'Back up your days' },
    signup: { el: $('view-signup'), title: 'Create your account' },
    forgot: { el: $('view-forgot'), title: 'Reset your password' },
    recovery: { el: $('view-recovery'), title: 'Set a new password' },
    account: { el: $('view-account'), title: 'Your account' },
  };

  // Where email links (confirm sign-up, reset password) bring people back to
  const pageUrl = window.location.origin + window.location.pathname;

  // Read what an email link put in the address before the client clears it
  const landing = readLanding();

  const client = lib.createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'days-counter-auth',
    },
  });

  let user = null;
  let signingOut = false; // set while this page signs out on purpose
  let view = 'signin';

  /* ---------- Account store for script.js ---------- */

  function toRecord(row) {
    if (!row || row.days == null) return null;
    return { count: row.days, best: row.best, updated: Number(row.changed_ms) };
  }

  // Sorts a failed request into what script.js needs to know
  function storeError(error) {
    const code = String((error && error.code) || '');
    const status = Number(error && error.status) || 0;
    let kind = 'offline';
    // Table or function missing: the migration hasn't been applied yet
    if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205' || status === 404) kind = 'setup';
    // An expired sign-in token is refreshed automatically, so try again later
    else if (code.startsWith('PGRST30') || status === 401) kind = 'offline';
    // Permission or data problems the account won't accept on a retry
    else if (code === '42501' || code.startsWith('23') || status === 403) kind = 'refused';
    return Object.assign(new Error((error && error.message) || 'Request failed'), { kind });
  }

  // Until the counters table exists (see supabase/migrations), the count is kept
  // in the account's own profile data (user_metadata), which every project has.
  // Only the signed-in person can change their own profile data.
  const META_KEY = 'days_counter';

  function fromMeta(person) {
    const saved = person && person.user_metadata && person.user_metadata[META_KEY];
    if (!saved || typeof saved !== 'object' || saved.count == null) return null;
    return { count: saved.count, best: saved.best, updated: Number(saved.updated) || 0 };
  }

  function accountFor(person) {
    let tableReady = null; // null until the first request finds out

    async function loadRow() {
      const { data, error } = await client
        .from('counters')
        .select('days, best, changed_ms')
        .eq('user_id', person.id)
        .maybeSingle();
      if (error) throw storeError(error);
      return toRecord(data);
    }

    async function saveRow(record) {
      const { data, error } = await client.rpc('save_counter', {
        p_days: record.count,
        p_best: record.best,
        p_changed_ms: Math.round(record.updated),
      });
      if (error) throw storeError(error);
      return toRecord(Array.isArray(data) ? data[0] : data);
    }

    async function loadMeta() {
      const { data, error } = await client.auth.getUser();
      if (error) throw storeError(error);
      return fromMeta(data.user);
    }

    async function saveMeta(record) {
      const value = { count: record.count, best: record.best, updated: Math.round(record.updated) };
      const { data, error } = await client.auth.updateUser({ data: { [META_KEY]: value } });
      if (error) throw storeError(error);
      return fromMeta(data.user) || value;
    }

    return {
      id: person.id,
      async load() {
        // Try the table every time, so it takes over as soon as it's created
        try {
          const row = await loadRow();
          tableReady = true;
          // An empty row may mean the table is new: bring over the profile copy
          return row || (await loadMeta());
        } catch (error) {
          if (error.kind !== 'setup') throw error;
          tableReady = false;
          return loadMeta();
        }
      },
      async save(record) {
        if (tableReady !== false) {
          try {
            const row = await saveRow(record);
            tableReady = true;
            return row;
          } catch (error) {
            if (error.kind !== 'setup') throw error;
            tableReady = false;
          }
        }
        return saveMeta(record);
      },
    };
  }

  let report = null;
  app.useAccounts({
    start(onAccount) {
      report = onAccount;
    },
  });

  /* ---------- Session changes ---------- */

  // Supabase recommends not awaiting other client calls inside this callback,
  // so the work runs on the next tick
  client.auth.onAuthStateChange((event, session) => {
    setTimeout(() => handleAuth(event, session), 0);
  });

  function handleAuth(event, session) {
    try {
      onAuthEvent(event, session);
    } catch (error) {
      console.error('Days Counter: could not handle the sign-in change', error);
    }
  }

  function onAuthEvent(event, session) {
    const person = session ? session.user : null;

    if (event === 'SIGNED_OUT') {
      const onPurpose = signingOut;
      signingOut = false;
      user = null;
      if (report) report(null, onPurpose ? 'signed-out' : 'expired');
      renderEntry();
      if (dialog.open) {
        showView('signin');
        if (onPurpose) showMessage('Signed out. Sign in any time to load your days.');
      }
      return;
    }

    if (event === 'PASSWORD_RECOVERY') {
      setUser(person, 'signed-in');
      openDialog('recovery');
      return;
    }

    if (event === 'INITIAL_SESSION') {
      setUser(person, 'initial');
      if (!person && report) report(null, 'initial');
      handleLanding();
      return;
    }

    if (person) setUser(person, 'signed-in');
    if (event === 'USER_UPDATED') renderAccount();
  }

  function setUser(person, reason) {
    if (!person) return;
    const changed = !user || user.id !== person.id;
    user = person;
    if (changed && report) report(accountFor(person), reason);
    renderEntry();
    renderAccount();
  }

  /* ---------- Email links ---------- */

  function readLanding() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const pick = (key) => hash.get(key) || query.get(key);
    return {
      type: pick('type'),
      error: pick('error_description') || pick('error'),
      errorCode: pick('error_code'),
    };
  }

  function handleLanding() {
    if (landing.error) {
      const expired = landing.errorCode === 'otp_expired' || /expired|invalid/i.test(landing.error);
      openDialog(user ? 'account' : 'signin');
      showMessage(
        expired
          ? 'That email link has expired or was already used. Sign in, or ask for a new link.'
          : `That email link didn't work: ${landing.error}`,
        true
      );
      cleanAddress();
      return;
    }
    if (landing.type === 'signup' && user) {
      openDialog('account');
      showMessage('Email confirmed. You are signed in and your days are backed up.');
    }
    // Normally PASSWORD_RECOVERY opens this; the address is a fallback
    if (landing.type === 'recovery' && user) openDialog('recovery');
    if (landing.type) cleanAddress();
  }

  function cleanAddress() {
    try {
      window.history.replaceState(null, '', pageUrl);
    } catch {
      // Leaving the address as it is does no harm
    }
  }

  /* ---------- Dialog ---------- */

  function renderEntry() {
    entry.hidden = false;
    openBtn.textContent = user ? 'Account' : 'Sign in';
  }

  function renderAccount() {
    if (!user) return;
    emailEl.textContent = user.email || 'your account';
    syncEl.textContent = 'Your days are backed up to this account. Sign in with it on any device to see them.';
  }

  function showView(name) {
    view = name;
    Object.entries(VIEWS).forEach(([key, v]) => {
      v.el.hidden = key !== name;
    });
    titleEl.textContent = VIEWS[name].title;
    signOutAnywayBtn.hidden = true;
    resendBtn.hidden = true;
    clearMessage();
  }

  function openDialog(name) {
    showView(name || (user ? 'account' : 'signin'));
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    }
    const first = VIEWS[view].el.querySelector('input');
    if (first) first.focus();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function showMessage(text, isError) {
    msgEl.textContent = text;
    msgEl.classList.toggle('error', Boolean(isError));
    msgEl.hidden = false;
  }

  function clearMessage() {
    msgEl.hidden = true;
    msgEl.textContent = '';
  }

  // Turns Supabase errors into plain advice
  function explain(error) {
    const code = (error && error.code) || '';
    const text = (error && error.message) || '';
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) return 'That email and password don’t match. Check them and try again.';
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(text)) return 'Confirm your email first. Open the link we sent you, then sign in.';
    if (code === 'email_address_not_authorized') return 'This site can’t send email to that address yet. The site owner needs to set up email sending (custom SMTP) in Supabase.';
    if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(text)) return 'There’s already an account with this email. Sign in instead.';
    if (code === 'weak_password' || /password should/i.test(text)) return text || 'Choose a longer or stronger password.';
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit/i.test(text)) return 'Too many attempts. Wait a few minutes and try again.';
    if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(text)) return 'That email address doesn’t look right.';
    if (code === 'signup_disabled') return 'New sign-ups are turned off for this site.';
    if (code === 'same_password') return 'Choose a password that’s different from your current one.';
    if (/fetch|network|load failed/i.test(text) || (error && error.name === 'AuthRetryableFetchError')) return 'Couldn’t reach the server. Check your connection and try again.';
    return text || 'Something went wrong. Try again.';
  }

  async function submit(form, work) {
    const button = form.querySelector('button[type="submit"]');
    const fields = [...form.querySelectorAll('input')];
    const invalid = fields.find((input) => !input.checkValidity());
    if (invalid) {
      invalid.focus();
      const min = invalid.minLength > 0 ? invalid.minLength : 0;
      showMessage(
        invalid.type === 'email'
          ? 'Enter a valid email address.'
          : min
            ? `Use a password with at least ${min} characters.`
            : 'Enter your password.',
        true
      );
      return;
    }
    clearMessage();
    button.disabled = true;
    try {
      await work(Object.fromEntries(fields.map((input) => [input.name, input.value])));
    } catch (error) {
      showMessage(explain(error), true);
    } finally {
      button.disabled = false;
    }
  }

  VIEWS.signin.el.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    submit(form, async ({ email, password }) => {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        resendBtn.hidden = error.code !== 'email_not_confirmed';
        throw error;
      }
      form.reset();
      closeDialog();
    });
  });

  VIEWS.signup.el.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    submit(form, async ({ email, password }) => {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: pageUrl },
      });
      if (error) throw error;
      form.reset();
      if (data && data.session) {
        closeDialog();
        return;
      }
      showView('signin');
      $('signin-email').value = email.trim();
      // With email confirmation on, Supabase answers a sign-up for an existing
      // address with a placeholder user that has no identities
      const created = data && data.user;
      if (created && Array.isArray(created.identities) && created.identities.length === 0) {
        showMessage('There’s already an account with this email. Sign in, or use “Forgot password?” to set a new one.', true);
        return;
      }
      showMessage(`Almost done. We sent a link to ${email.trim()}. Open it to confirm your email, then sign in.`);
    });
  });

  VIEWS.forgot.el.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    submit(form, async ({ email }) => {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: pageUrl });
      if (error) throw error;
      form.reset();
      showView('signin');
      showMessage(`If there’s an account for ${email.trim()}, a reset link is on its way. Open it on this device to set a new password.`);
    });
  });

  VIEWS.recovery.el.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    submit(form, async ({ password }) => {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      form.reset();
      showView('account');
      showMessage('Password updated. You are signed in.');
    });
  });

  async function signOut(keepOnDevice) {
    signOutBtn.disabled = true;
    signOutAnywayBtn.hidden = true;
    clearMessage();
    if (!keepOnDevice) {
      showMessage('Saving your days to your account…');
      const safe = await app.flush();
      if (!safe) {
        signOutBtn.disabled = false;
        showMessage(
          'Your latest days aren’t in your account yet, so signing out now could lose them. Check your connection and try again.',
          true
        );
        signOutAnywayBtn.hidden = false;
        return;
      }
    }
    // Only a deliberate, fully saved sign-out clears this device's copy
    signingOut = !keepOnDevice;
    const { error } = await client.auth.signOut({ scope: 'local' });
    signOutBtn.disabled = false;
    if (error) {
      signingOut = false;
      showMessage(explain(error), true);
    }
  }

  resendBtn.addEventListener('click', async () => {
    const email = $('signin-email').value.trim();
    if (!email) {
      showMessage('Enter your email first.', true);
      return;
    }
    resendBtn.disabled = true;
    const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: pageUrl } });
    resendBtn.disabled = false;
    if (error) showMessage(explain(error), true);
    else {
      resendBtn.hidden = true;
      showMessage(`We sent a new confirmation link to ${email}.`);
    }
  });

  signOutBtn.addEventListener('click', () => signOut(false));
  signOutAnywayBtn.addEventListener('click', () => signOut(true));

  dialog.addEventListener('click', (e) => {
    const go = e.target.closest('[data-view]');
    if (go) showView(go.dataset.view);
    // A click on the backdrop (outside the dialog's box) closes it
    if (e.target === dialog) {
      const box = dialog.getBoundingClientRect();
      const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
      if (!inside) closeDialog();
    }
  });
  $('account-close').addEventListener('click', closeDialog);
  openBtn.addEventListener('click', () => openDialog());

  renderEntry();
})();

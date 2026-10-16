# Days Counter

A one-screen streak counter. Tap the circle to add a day. Every tap sends waves through the circle's border, and the colour heats up as the count grows, from a cold steel blue through violet, magenta, red and orange to a white-hot gold.

## Levels

The colour moves one equal step between each level, so the first week changes fast and every later level is a visible jump.

| Days | Level      |
| ---- | ---------- |
| 0    | Cold start |
| 1    | Spark      |
| 7    | Ember      |
| 21   | Flame      |
| 30   | Blaze      |
| 66   | Inferno    |
| 100  | Supernova  |
| 365  | Legend     |

After 365 the colour keeps whitening until day 1000. Higher levels also add more wave crests, stronger ripples and sparks on each tap.

## What's changing in you

Below the counter, a timeline shows what tends to change as the streak grows. Each step unlocks on its day, with a pop-up when you reach it, and the main screen links to the next one coming up.

| Day | Change                      | Basis     |
| --- | --------------------------- | --------- |
| 1   | Day one is done             | Tip       |
| 3   | Urges at their strongest    | Reported  |
| 7   | Testosterone peak           | Research  |
| 14  | More time and focus         | Reported  |
| 21  | Triggers lose their pull    | Research  |
| 30  | A month of self-control     | Reported  |
| 66  | Running on autopilot        | Research  |
| 90  | The 90-day reset            | Reported  |
| 365 | A year of keeping your word | Milestone |

Each step is labelled honestly. **Research** means a published study or established psychology backs it; **Reported** means people commonly describe it but studies haven't confirmed it.

- Day 7: Jiang et al. (2003), *Journal of Zhejiang University Science*. In 28 men, testosterone peaked on day 7 of abstinence (about 146% of baseline) and then returned to normal.
- Day 21: extinction, the learning principle that a cue repeated without its reward loses its pull.
- Day 66: Lally et al. (2009), *European Journal of Social Psychology*. New habits took 66 days on average (range 18 to 254) to become automatic.

The content lives in the `CHANGES` list at the top of `script.js`, so it's easy to edit.

## Features

- Tap or press Space/Enter on the circle to add a day.
- **−1** removes a day if you tapped by mistake.
- **Reset** asks for confirmation and keeps your best count.
- **Set count** lets you type a number, for example to restore your count on a new phone.
- Respects reduced-motion settings: the colour still changes, the waves stay still.

## Saving

The count never resets on its own. There is no timer, daily cutoff or expiry: only the **Reset** button sets it back to 0.

- Every change is saved straight away in the browser (`localStorage`), so it survives reloads, closing the tab and restarting the browser.
- Each save is time-stamped. If the site is open in more than one tab, every tab follows the newest count, so an old tab can't overwrite it.
- On the first tap the site asks the browser for persistent storage, so the data isn't cleared when the device runs low on space.
- If the browser blocks storage (some private modes do), the page says so under the level track instead of silently losing the count.

Browser data is still cleared if you clear your browsing data. Safari can also clear it if you don't open the site for 7 days, unless you add it to your Home Screen. If that happens, use **Set count** to put your number back, or sign in (below).

## Accounts

With a Supabase project connected, people can create an account with their email and a password. Their count is then saved to the account as well as the browser, so it survives a cleared browser or a new phone, and it follows them across devices.

- The status line under the level track shows where the count is saved: *Saved only in this browser*, *Saved to your account*, or *Saved on this device. It will back up to your account when you're online.*
- Signing in on a device that already has days: if the account is empty, those days move into it. If the account has a different count, the page asks which one to keep.
- When the same account is used on two devices, the most recent change wins, and each device picks up the other's changes when it's opened again.
- Signing out saves everything to the account first, then removes the count from that device. If the account can't be reached, the page won't sign out unless you choose to keep the days on the device.
- Without a Supabase project in `config.js`, the sign-in option is hidden and the counter works on its own.

### Setting up Supabase

1. **Add your project details.** In the Supabase dashboard, click **Connect** (or open **Project Settings → API Keys**). Copy the **Project URL** and the **publishable key** (`sb_publishable_…`; the legacy `anon` key also works) into `config.js`. Both are safe to publish. Never put a `service_role` or `sb_secret_` key in this repo.
2. **Create the table.** The database setup is in `supabase/migrations/20261016120000_create_counters.sql`.
   - With the GitHub integration (**Project Settings → Integrations → GitHub**), check that **Working directory** is `.`, the production branch is `master`, and **Deploy to production** is on. The migration then runs when it reaches `master`. You can follow it under **Branches → View logs**.
   - Otherwise, open **SQL Editor**, paste the whole file and run it. It is safe to run more than once.
   - Don't add a `supabase/config.toml` to this repo. Keep auth settings in the dashboard.
3. **Allow the site's address.** In **Authentication → URL Configuration**, set **Site URL** to `https://singhress.github.io/Days-counter/` and add `https://singhress.github.io/Days-counter/**` to **Redirect URLs**. Add `http://localhost:8000/**` as well if you test locally. Email links (confirm sign-up, reset password) only return to these addresses.
4. **Set up email.** Supabase's built-in email only delivers to members of your Supabase team, and only 2 emails an hour. For real users, add your own email provider under **Authentication → Emails → SMTP Settings** (Resend, Brevo, Postmark and others work). Until then you can turn off **Confirm email** under **Authentication → Sign In / Providers** so sign-ups work straight away, but password reset emails still need SMTP.
5. **Match the password rule.** The site asks for at least 8 characters. Set **Minimum password length** to 8 under **Authentication → Sign In / Providers → Email**.

### How the data is protected

- Each person's count is one row in `public.counters`. Row level security lets a signed-in person read and write only their own row, and people who aren't signed in can't reach the table at all.
- Saves go through `save_counter()`, which keeps whichever copy changed most recently. An older device can't overwrite a newer count, and a device whose clock is wrong can't block later saves.
- Deleting a user in **Authentication → Users** also deletes their row.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

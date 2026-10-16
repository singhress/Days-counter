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

Browser data is still cleared if you clear your browsing data. Safari can also clear it if you don't open the site for 7 days, unless you add it to your Home Screen. If that happens, use **Set count** to put your number back.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

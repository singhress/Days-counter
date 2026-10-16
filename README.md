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
- The count and best are saved in the browser (`localStorage`).
- Respects reduced-motion settings: the colour still changes, the waves stay still.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

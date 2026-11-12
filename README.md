# Momentle

Momentle is a frontend-only daily timing game. Watch five coloured orbs move around their repeating paths, then freeze time when they are closest to their matching rings.

## Controls

- Select **Start** to begin an attempt.
- Select **Freeze** when the orbs align.
- You get three attempts per UTC date.
- After finishing, **Watch Perfect Moment** replays the ideal alignment.
- **Copy Result** creates a spoiler-free share message.

## Daily seed

The current UTC date (`YYYY-MM-DD`) is hashed into a deterministic pseudo-random seed. That seed creates the orb paths, targets, perfect moment, and puzzle number. The same date therefore produces the same challenge for everyone.

Progress is stored locally in `localStorage` under a key for the current UTC date. No server, account, API, or database is used.

## Run locally

From this folder, start any static HTTP server. For example, with Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Project structure

- `index.html` — semantic page structure and controls
- `styles.css` — responsive visual styling
- `app.js` — deterministic puzzle generation, canvas rendering, game flow, scoring, persistence, and sharing
- `README.md` — project notes

This is an intentionally small frontend-only MVP. Backend accounts, leaderboards, analytics, and multiplayer features can be added later.

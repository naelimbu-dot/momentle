# Momentle

Momentle is a frontend-only daily timing game. Each UTC day contains five progressively harder orb-alignment challenges. Tap the playfield once to start a challenge, then tap again when every orb is closest to its matching ring.

## Rules and scoring

- You get five challenges per UTC day.
- Each challenge has exactly one scored attempt and no retries.
- Each challenge has a 25-second limit. Running out of time scores zero points.
- The loop becomes faster and adds more decoy alignments in every round. A decoy places one orb perfectly in its ring while the others are still out of position.
- Accuracy is the average spatial proximity of the five orbs, shown as a percentage.
- The round score is `round(100 × (accuracy / 100) ^ 1.5)` out of 100.
- The final report shows each round, a total out of 500, an overall score out of 100, and average accuracy.
- The distribution curve and percentile are simulated locally until a backend leaderboard exists.

## Controls

- Tap or click the playfield to start the current challenge.
- Tap or click the playfield again to lock in your timing.
- Use Enter or Space while the playfield is focused for keyboard control.
- Select **Next Challenge** after each result.
- Select **Copy Result** after challenge five to copy a spoiler-free summary.
- New players are offered a three-step tutorial, which can be reopened with **How to play**.

## Daily seed and persistence

The current UTC date (`YYYY-MM-DD`) and round number are hashed into deterministic seeds in the form `YYYY-MM-DD:round:1` through `YYYY-MM-DD:round:5`. The same date produces the same five challenges for everyone.

Progress is stored locally under the versioned `momentle-v3-progress-YYYY-MM-DD` key. Tutorial completion is also remembered locally. No server, account, API, or database is used.

## Run locally

From this folder, start any static HTTP server. For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Project structure

- `index.html` — semantic page structure and controls
- `styles.css` — responsive visual styling
- `app.js` — deterministic five-round generation, Canvas rendering, input handling, scoring, persistence, distribution curve, and sharing
- `README.md` — project notes

This is an intentionally small frontend-only MVP. Backend accounts, live leaderboards, analytics, and multiplayer features can be added later.

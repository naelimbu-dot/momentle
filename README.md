# Momentle

Momentle is a frontend-only timing game with Daily and Endless modes. Each UTC day contains one shared five-challenge Daily run, while Endless mode generates replayable sets of five. Tap the playfield once to start a challenge, then tap again when every orb is closest to its matching ring.

## Rules and scoring

- You get five challenges per UTC day.
- Endless mode generates unlimited five-challenge sets. Finishing challenge five opens a final-score prompt with **Play Another Set**, while the full summary remains available underneath.
- Finishing the Daily also opens a score-and-percentile prompt with **Play Endless**. The percentile remains explicitly simulated until the future leaderboard backend is connected.
- Every Daily or Endless set uses the same deliberate difficulty ramp: faster loops and more decoy orbs from challenge one through five.
- Each challenge has exactly one scored attempt and no retries.
- Each challenge has a 20-second limit. Running out of time scores zero points.
- The loop becomes faster and adds more decoy alignments in every round. A decoy places one orb perfectly in its ring while the others are still out of position.
- Score-based feedback adds generated sound cues, sparkle bursts for strong shots, enhanced effects from 92/100, a golden celebration at 100/100, and a brief red shake below 50/100 or on timeouts.
- Accuracy is the average spatial proximity of the five orbs, shown as a percentage.
- The round score is `round(100 × (accuracy / 100) ^ 1.5)` out of 100.
- Accuracy of 98.0% or higher is awarded the full 100/100 score, making the perfect tier attainable without changing lower-score scoring.
- The final report shows each round, a total out of 500, an overall score out of 100, and average accuracy.
- The distribution curve and percentile are simulated locally until a backend leaderboard exists.

## Controls

- Tap or click the playfield to start the current challenge.
- Tap or click the playfield again to lock in your timing.
- Use Enter or Space while the playfield is focused for keyboard control.
- Select **Next Challenge** after each result.
- Select **Copy Result** after challenge five to copy a spoiler-free summary.
- Use the **Daily / Endless** switch to change modes. Switching modes preserves each mode's separate progress.
- New players are offered a three-step tutorial, which can be reopened with **How to play**.
- Use **Sound on/off** to control effects. The preference is remembered locally, and no audio files are downloaded.

## Daily seed and persistence

The current UTC date (`YYYY-MM-DD`) and round number are hashed into Daily seeds in the form `YYYY-MM-DD:round:1` through `YYYY-MM-DD:round:5`. The same date produces the same five Daily challenges for everyone, and a new Daily run appears automatically at midnight UTC.

Endless mode creates one random session seed with `crypto.getRandomValues()`, then deterministically derives each set and round from `endless:{seed}:set:{number}:round:{number}`. This produces unlimited distinct sets without hard-coded challenges.

Daily progress is stored under `momentle-v3-progress-YYYY-MM-DD`. Endless progress, its seed, and current set number use a separate localStorage key. Tutorial, sound, and selected-mode preferences are also remembered locally. No server, account, API, or database is used.

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

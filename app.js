(() => {
  "use strict";

  const ROUND_COUNT = 5;
  const ORB_COUNT = 5;
  const START_LOCK_MS = 300;
  const ROUND_TIME_LIMIT_MS = 25000;
  const STORAGE_PREFIX = "momentle-v3-progress-";
  const TUTORIAL_KEY = "momentle-tutorial-seen-v1";
  const SOUND_KEY = "momentle-sound-enabled-v1";
  const ROUND_DIFFICULTY = [
    { loopMs: 3800, decoyOrbs: 1, label: "Fast" },
    { loopMs: 3300, decoyOrbs: 2, label: "Faster" },
    { loopMs: 2850, decoyOrbs: 3, label: "Rapid" },
    { loopMs: 2450, decoyOrbs: 4, label: "Intense" },
    { loopMs: 2100, decoyOrbs: 5, label: "Maximum" }
  ];
  const TUTORIAL_STEPS = [
    { title: "Match every orb", text: "Each glowing orb has a ring in the same colour. Watch how their paths cross the rings." },
    { title: "Ignore the decoys", text: "A single orb may land perfectly while the others miss. Wait for the one moment when all five align." },
    { title: "Lock it in", text: "Tap once to start, then tap again to score. You get one chance and 25 seconds; each round gets faster." }
  ];
  const COLOURS = [
    { name: "mint", value: "#5ee7c4" },
    { name: "coral", value: "#ff8f8f" },
    { name: "gold", value: "#ffc86b" },
    { name: "sky", value: "#7bc7ff" },
    { name: "violet", value: "#b39aff" }
  ];

  const els = {
    canvas: document.getElementById("gameCanvas"),
    distributionCanvas: document.getElementById("distributionCanvas"),
    playfield: document.getElementById("playfield"),
    canvasOverlay: document.getElementById("canvasOverlay"),
    overlayKicker: document.querySelector(".overlay-kicker"),
    overlayMessage: document.getElementById("overlayMessage"),
    overlayHint: document.getElementById("overlayHint"),
    canvasStatus: document.getElementById("canvasStatus"),
    puzzleNumber: document.getElementById("puzzleNumber"),
    roundIndicator: document.getElementById("roundIndicator"),
    roundProgress: document.getElementById("roundProgress"),
    roundResult: document.getElementById("roundResult"),
    resultRoundLabel: document.getElementById("resultRoundLabel"),
    resultAccuracy: document.getElementById("resultAccuracy"),
    resultScore: document.getElementById("resultScore"),
    resultState: document.getElementById("resultState"),
    distanceList: document.getElementById("distanceList"),
    nextRow: document.getElementById("nextRow"),
    nextMessage: document.getElementById("nextMessage"),
    nextButton: document.getElementById("nextButton"),
    finalPanel: document.getElementById("finalPanel"),
    finalTotalScore: document.getElementById("finalTotalScore"),
    finalOverallScore: document.getElementById("finalOverallScore"),
    finalAverageAccuracy: document.getElementById("finalAverageAccuracy"),
    scoreTable: document.getElementById("scoreTable"),
    percentileText: document.getElementById("percentileText"),
    copyButton: document.getElementById("copyButton"),
    effectsLayer: document.getElementById("effectsLayer"),
    timerBadge: document.getElementById("timerBadge"),
    timerValue: document.getElementById("timerValue"),
    helpButton: document.getElementById("helpButton"),
    soundButton: document.getElementById("soundButton"),
    soundIcon: document.getElementById("soundIcon"),
    soundLabel: document.getElementById("soundLabel"),
    tutorialDialog: document.getElementById("tutorialDialog"),
    tutorialClose: document.getElementById("tutorialClose"),
    tutorialSkip: document.getElementById("tutorialSkip"),
    tutorialNext: document.getElementById("tutorialNext"),
    tutorialNumber: document.getElementById("tutorialNumber"),
    tutorialStepTitle: document.getElementById("tutorialStepTitle"),
    tutorialStepText: document.getElementById("tutorialStepText"),
    tutorialDots: document.getElementById("tutorialDots")
  };

  const ctx = els.canvas.getContext("2d");
  const distributionCtx = els.distributionCanvas.getContext("2d");
  const state = {
    mode: "round-ready",
    roundIndex: 0,
    rounds: [],
    roundResults: Array.from({ length: ROUND_COUNT }, () => null),
    runningStartedAt: 0,
    displayElapsed: 0,
    tutorialStep: 0,
    urgentTimerAnnounced: false,
    lastTimerTick: null,
    soundEnabled: true,
    audioContext: null,
    effectTimeout: null,
    animationFrame: null,
    dpr: 1,
    width: 0,
    height: 0
  };

  try {
    state.soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
  } catch (_) {
    state.soundEnabled = true;
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const puzzleNumber = daysSinceEpoch(dateKey);

  function daysSinceEpoch(key) {
    const date = new Date(`${key}T00:00:00Z`);
    const epoch = new Date("2026-01-01T00:00:00Z");
    return Math.floor((date.getTime() - epoch.getTime()) / 86400000) + 1;
  }

  function hashSeed(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRng(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getNormalizedPosition(orb, progress) {
    const angle = Math.PI * 2 * progress;
    return {
      x: orb.centerX + orb.amplitudeX * Math.sin(orb.frequencyX * angle + orb.phaseX),
      y: orb.centerY + orb.amplitudeY * Math.sin(orb.frequencyY * angle + orb.phaseY)
    };
  }

  function generateRound(roundNumber) {
    const random = createRng(hashSeed(`${dateKey}:round:${roundNumber}`));
    const difficulty = ROUND_DIFFICULTY[roundNumber - 1];
    const perfectProgress = 0.22 + random() * 0.56;
    const round = {
      roundNumber,
      perfectTime: perfectProgress * difficulty.loopMs,
      loopMs: difficulty.loopMs,
      decoyOrbs: difficulty.decoyOrbs,
      difficultyLabel: difficulty.label,
      orbs: []
    };

    for (let index = 0; index < ORB_COUNT; index += 1) {
      const amplitudeX = 0.08 + random() * 0.115;
      const amplitudeY = 0.08 + random() * 0.115;
      const orb = {
        colour: COLOURS[index],
        centerX: amplitudeX + 0.08 + random() * (0.84 - amplitudeX * 2),
        centerY: amplitudeY + 0.08 + random() * (0.84 - amplitudeY * 2),
        amplitudeX,
        amplitudeY,
        frequencyX: 1 + Math.floor(random() * 3),
        frequencyY: 1 + Math.floor(random() * 3),
        phaseX: random() * Math.PI * 2,
        phaseY: random() * Math.PI * 2,
        isDecoy: index < difficulty.decoyOrbs,
        target: { x: 0, y: 0 }
      };
      if (orb.isDecoy) {
        const decoyFrequency = 2 + ((index + roundNumber - 1) % 5);
        orb.frequencyX = decoyFrequency;
        orb.frequencyY = decoyFrequency;
      } else if (orb.frequencyX === orb.frequencyY && orb.frequencyX > 1) {
        orb.frequencyY = orb.frequencyY === 3 ? 2 : orb.frequencyY + 1;
      }
      orb.target = getNormalizedPosition(orb, perfectProgress);
      round.orbs.push(orb);
    }
    return round;
  }

  state.rounds = Array.from({ length: ROUND_COUNT }, (_, index) => generateRound(index + 1));

  function getCurrentRound() { return state.rounds[state.roundIndex]; }
  function getProgressAt(elapsed) {
    const loopMs = getCurrentRound().loopMs;
    return ((((elapsed % loopMs) + loopMs) % loopMs) / loopMs);
  }
  function getPositions(elapsed) {
    const progress = getProgressAt(elapsed);
    return getCurrentRound().orbs.map((orb) => getNormalizedPosition(orb, progress));
  }

  function storageKey() { return `${STORAGE_PREFIX}${dateKey}`; }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
      if (!saved || saved.version !== 3 || saved.dateKey !== dateKey || !Array.isArray(saved.roundResults)) return;
      state.roundResults = Array.from({ length: ROUND_COUNT }, (_, index) => {
        const result = saved.roundResults[index];
        if (!result || !Number.isFinite(result.accuracy) || !Number.isFinite(result.score)) return null;
        return {
          accuracy: Math.max(0, Math.min(100, result.accuracy)),
          score: Math.max(0, Math.min(100, Math.round(result.score))),
          timedOut: result.timedOut === true,
          details: Array.isArray(result.details) ? result.details.map((detail) => ({
            distance: Number.isFinite(detail.distance) ? detail.distance : 0,
            proximity: Number.isFinite(detail.proximity) ? detail.proximity : 0
          })) : []
        };
      });
      state.roundIndex = Math.max(0, Math.min(ROUND_COUNT - 1, Number(saved.currentRound) || 0));
      if (saved.completed && state.roundResults.every(Boolean)) state.mode = "finished";
      else if (state.roundResults[state.roundIndex]) state.mode = "round-result";
    } catch (_) {
      state.roundResults = Array.from({ length: ROUND_COUNT }, () => null);
      state.roundIndex = 0;
      state.mode = "round-ready";
    }
  }

  function saveProgress() {
    localStorage.setItem(storageKey(), JSON.stringify({
      version: 3,
      dateKey,
      currentRound: state.roundIndex,
      roundResults: state.roundResults.map((result) => result ? {
        accuracy: result.accuracy,
        score: result.score,
        timedOut: result.timedOut === true,
        details: result.details.map((detail) => ({ distance: detail.distance, proximity: detail.proximity }))
      } : null),
      completed: state.roundResults.every(Boolean)
    }));
  }

  function resizeCanvas() {
    const rect = els.canvas.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = rect.width;
    state.height = rect.height;
    els.canvas.width = Math.max(1, Math.floor(rect.width * state.dpr));
    els.canvas.height = Math.max(1, Math.floor(rect.height * state.dpr));
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    drawScene(state.displayElapsed, state.mode === "round-result" || state.mode === "finished");
    drawDistribution();
  }

  function normalizedToCanvas(position) {
    const padding = Math.min(state.width, state.height) * 0.08;
    return { x: padding + position.x * (state.width - padding * 2), y: padding + position.y * (state.height - padding * 2) };
  }

  function drawBackground() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#081522";
    ctx.fillRect(0, 0, state.width, state.height);
    const grid = Math.max(32, Math.min(52, state.width / 12));
    ctx.strokeStyle = "rgba(142, 192, 224, 0.055)";
    ctx.lineWidth = 1;
    for (let x = grid; x < state.width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, state.height); ctx.stroke(); }
    for (let y = grid; y < state.height; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.width, y); ctx.stroke(); }
    const glow = ctx.createRadialGradient(state.width * .52, state.height * .42, 0, state.width * .52, state.height * .42, Math.max(state.width, state.height) * .72);
    glow.addColorStop(0, "rgba(38, 96, 125, .12)");
    glow.addColorStop(1, "rgba(4, 10, 17, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function drawTarget(position, colour, radius, proximity) {
    const target = normalizedToCanvas(position);
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.globalAlpha = .72 + proximity * .28;
    ctx.shadowColor = colour;
    ctx.shadowBlur = proximity * 18;
    ctx.lineWidth = 2 + proximity * 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(target.x, target.y, radius * 1.1, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = .16;
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(target.x, target.y, radius * .44, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTrail(orb, elapsed) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (let step = 12; step >= 1; step -= 1) {
      const from = normalizedToCanvas(getNormalizedPosition(orb, getProgressAt(elapsed - step * 70)));
      const to = normalizedToCanvas(getNormalizedPosition(orb, getProgressAt(elapsed - (step - 1) * 70)));
      ctx.globalAlpha = (13 - step) / 12 * .2;
      ctx.strokeStyle = orb.colour.value;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawOrb(position, orb, radius, frozen) {
    const point = normalizedToCanvas(position);
    ctx.save();
    ctx.shadowColor = orb.colour.value;
    ctx.shadowBlur = frozen ? 22 : 17;
    ctx.fillStyle = orb.colour.value;
    ctx.globalAlpha = .96;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.beginPath(); ctx.arc(point.x - radius * .3, point.y - radius * .32, radius * .23, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawDistanceLine(position, orb) {
    const current = normalizedToCanvas(position);
    const target = normalizedToCanvas(orb.target);
    ctx.save();
    ctx.strokeStyle = orb.colour.value;
    ctx.globalAlpha = .32;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(current.x, current.y); ctx.lineTo(target.x, target.y); ctx.stroke();
    ctx.restore();
  }

  function drawScene(elapsed, showDistances) {
    if (!state.width || !state.height || !getCurrentRound()) return;
    drawBackground();
    const radius = Math.max(8, Math.min(15, state.width * .018));
    const positions = getPositions(elapsed);
    const round = getCurrentRound();
    round.orbs.forEach((orb, index) => {
      const distance = Math.hypot(positions[index].x - orb.target.x, positions[index].y - orb.target.y);
      drawTarget(orb.target, orb.colour.value, radius, Math.max(0, 1 - distance / .08));
    });
    round.orbs.forEach((orb) => drawTrail(orb, elapsed));
    if (showDistances) round.orbs.forEach((orb, index) => drawDistanceLine(positions[index], orb));
    round.orbs.forEach((orb, index) => drawOrb(positions[index], orb, radius, showDistances));
  }

  function scorePositions(positions) {
    const details = getCurrentRound().orbs.map((orb, index) => {
      const distance = Math.hypot(positions[index].x - orb.target.x, positions[index].y - orb.target.y);
      const proximity = Math.max(0, 1 - distance / .35);
      return { distance, proximity };
    });
    const accuracy = Math.max(0, Math.min(100, details.reduce((sum, item) => sum + item.proximity, 0) / details.length * 100));
    const score = Math.max(0, Math.min(100, Math.round(100 * Math.pow(accuracy / 100, 1.5))));
    return { accuracy, score, details };
  }

  function normalCdf(value) {
    const sign = value < 0 ? -1 : 1;
    const absolute = Math.abs(value) / Math.sqrt(2);
    const t = 1 / (1 + .3275911 * absolute);
    const polynomial = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-absolute * absolute);
    return .5 * (1 + sign * polynomial);
  }

  function getFinalTotals() {
    const results = state.roundResults.filter(Boolean);
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    const overallScore = Math.round(totalScore / ROUND_COUNT);
    const averageAccuracy = results.reduce((sum, result) => sum + result.accuracy, 0) / ROUND_COUNT;
    const percentile = Math.max(1, Math.min(99, Math.round(normalCdf((totalScore - 310) / 75) * 100)));
    return { totalScore, overallScore, averageAccuracy, percentile };
  }

  function formatScore(score) { return `${Math.round(score)}/100`; }
  function formatAccuracy(accuracy) { return `${accuracy.toFixed(1)}%`; }

  function updateSoundButton() {
    els.soundButton.setAttribute("aria-pressed", String(state.soundEnabled));
    els.soundButton.setAttribute("aria-label", state.soundEnabled ? "Turn sound off" : "Turn sound on");
    els.soundIcon.textContent = state.soundEnabled ? "♪" : "×";
    els.soundLabel.textContent = state.soundEnabled ? "Sound on" : "Sound off";
  }

  function ensureAudio() {
    if (!state.soundEnabled) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!state.audioContext) state.audioContext = new AudioContextClass();
    if (state.audioContext.state === "suspended") state.audioContext.resume().catch(() => {});
    return state.audioContext;
  }

  function playTone(frequency, duration, options = {}) {
    const audio = ensureAudio();
    if (!audio) return;
    const when = audio.currentTime + (options.delay || 0);
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(frequency, when);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, options.endFrequency || frequency), when + duration);
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(options.volume || .045, when + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(when);
    oscillator.stop(when + duration + .02);
  }

  function playStartSound() {
    playTone(260, .12, { volume: .025, endFrequency: 390 });
    playTone(520, .1, { delay: .06, volume: .018, endFrequency: 620 });
  }

  function playAdvanceSound() {
    playTone(330, .1, { volume: .024, endFrequency: 440 });
    playTone(550, .13, { delay: .065, volume: .022, endFrequency: 660 });
  }

  function playTimerTick(second) {
    playTone(second === 1 ? 920 : 720, .055, { volume: second === 1 ? .038 : .022, type: "triangle", endFrequency: second === 1 ? 760 : 660 });
  }

  function playShotSound(result) {
    if (result.timedOut) {
      playTone(190, .24, { volume: .05, type: "sawtooth", endFrequency: 105 });
      playTone(120, .26, { delay: .13, volume: .035, type: "triangle", endFrequency: 82 });
    } else if (result.accuracy >= 95) {
      [523, 659, 784, 1047].forEach((frequency, index) => playTone(frequency, .34, { delay: index * .055, volume: .035, type: index === 3 ? "triangle" : "sine", endFrequency: frequency * 1.04 }));
    } else if (result.accuracy >= 80) {
      [440, 554, 659].forEach((frequency, index) => playTone(frequency, .27, { delay: index * .065, volume: .032, endFrequency: frequency * 1.03 }));
    } else if (result.accuracy >= 60) {
      playTone(350, .2, { volume: .028, endFrequency: 440 });
      playTone(523, .2, { delay: .08, volume: .024, endFrequency: 590 });
    } else if (result.accuracy >= 50) {
      playTone(300, .16, { volume: .024, type: "triangle", endFrequency: 330 });
    } else {
      playTone(170, .22, { volume: .045, type: "square", endFrequency: 112 });
      playTone(105, .18, { delay: .1, volume: .028, type: "sawtooth", endFrequency: 78 });
    }
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    try { localStorage.setItem(SOUND_KEY, state.soundEnabled ? "on" : "off"); } catch (_) {}
    updateSoundButton();
    if (state.soundEnabled) {
      ensureAudio();
      playTone(440, .12, { volume: .026, endFrequency: 660 });
    }
  }

  function clearShotEffects() {
    if (state.effectTimeout) window.clearTimeout(state.effectTimeout);
    state.effectTimeout = null;
    els.playfield.classList.remove("good-shot", "okay-shot", "bad-shot");
    els.effectsLayer.replaceChildren();
  }

  function addSparkles(position, colour, count) {
    const point = normalizedToCanvas(position);
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * index / count + (index % 2) * .18;
      const distance = 24 + (index % 3) * 11;
      const sparkle = document.createElement("span");
      sparkle.className = `sparkle${index % 3 === 0 ? " star" : ""}`;
      sparkle.style.left = `${point.x}px`;
      sparkle.style.top = `${point.y}px`;
      sparkle.style.setProperty("--sparkle-colour", colour);
      sparkle.style.setProperty("--sparkle-x", `${Math.cos(angle) * distance}px`);
      sparkle.style.setProperty("--sparkle-y", `${Math.sin(angle) * distance}px`);
      sparkle.style.setProperty("--sparkle-delay", `${(index % 4) * 22}ms`);
      els.effectsLayer.appendChild(sparkle);
    }
  }

  function showShotEffects(result, positions) {
    clearShotEffects();
    if (result.timedOut || result.accuracy < 50) {
      els.playfield.classList.add("bad-shot");
    } else if (result.accuracy >= 75) {
      els.playfield.classList.add("good-shot");
      result.details.forEach((detail, index) => {
        if (detail.proximity >= .48) addSparkles(positions[index], getCurrentRound().orbs[index].colour.value, result.accuracy >= 95 ? 8 : 5);
      });
      const ring = document.createElement("span");
      ring.className = "shot-ring";
      els.effectsLayer.appendChild(ring);
    } else {
      els.playfield.classList.add("okay-shot");
    }
    state.effectTimeout = window.setTimeout(clearShotEffects, 900);
  }

  function renderProgress() {
    els.roundProgress.innerHTML = state.roundResults.map((result, index) => {
      const status = result ? "complete" : index === state.roundIndex && state.mode !== "finished" ? "current" : "";
      return `<div class="progress-item ${status}" aria-label="Challenge ${index + 1}${result ? ` complete with ${formatScore(result.score)}` : index === state.roundIndex ? " current" : " upcoming"}"><span>CH ${String(index + 1).padStart(2, "0")}</span><strong>${result ? formatScore(result.score) : "—"}</strong></div>`;
    }).join("");
    els.roundIndicator.textContent = state.mode === "finished" ? "Complete" : `Challenge ${state.roundIndex + 1} of ${ROUND_COUNT}`;
  }

  function updateOverlay() {
    const roundLabel = `CHALLENGE ${state.roundIndex + 1} OF ${ROUND_COUNT}`;
    const round = getCurrentRound();
    els.overlayKicker.textContent = roundLabel;
    const accessibleAction = state.mode === "round-running"
      ? "Tap to lock in your timing."
      : state.mode === "round-ready"
        ? "Tap to start."
        : state.mode === "round-result"
          ? state.roundIndex < ROUND_COUNT - 1
            ? "Tap the playfield or use the Next Challenge button to continue."
            : "Final challenge locked in."
          : "Today's run is complete.";
    els.playfield.setAttribute("aria-label", `Momentle ${roundLabel}. ${accessibleAction}`);
    if (state.mode === "round-ready") {
      els.canvasOverlay.classList.remove("is-result");
      els.canvasOverlay.classList.remove("is-hidden");
      els.overlayMessage.textContent = "Tap to start";
      els.overlayHint.textContent = `${round.difficultyLabel} · ${(round.loopMs / 1000).toFixed(2).replace(/0$/, "")}s loop · ${round.decoyOrbs} decoy ${round.decoyOrbs === 1 ? "orb" : "orbs"}`;
      els.canvasStatus.textContent = "Ready when you are.";
    } else if (state.mode === "round-running") {
      els.canvasOverlay.classList.remove("is-result");
      els.canvasOverlay.classList.add("is-hidden");
      els.canvasStatus.textContent = "Tap anywhere to lock it in.";
    } else if (state.mode === "round-result") {
      if (state.roundIndex < ROUND_COUNT - 1) {
        const result = state.roundResults[state.roundIndex];
        els.canvasOverlay.classList.add("is-result");
        els.canvasOverlay.classList.remove("is-hidden");
        els.overlayMessage.textContent = "Tap for next challenge";
        els.overlayHint.textContent = `Score ${formatScore(result.score)} · Accuracy ${formatAccuracy(result.accuracy)}`;
      } else {
        els.canvasOverlay.classList.remove("is-result");
        els.canvasOverlay.classList.add("is-hidden");
      }
      const result = state.roundResults[state.roundIndex];
      if (result && result.timedOut) {
        els.canvasStatus.textContent = state.roundIndex < ROUND_COUNT - 1 ? "Time expired. Tap the playfield for the next challenge." : "Time expired. This challenge scored zero.";
      } else {
        els.canvasStatus.textContent = state.roundIndex < ROUND_COUNT - 1 ? "Locked in. Tap the playfield for the next challenge." : "Locked in. No retries for this challenge.";
      }
    } else {
      els.canvasOverlay.classList.add("is-hidden");
      els.canvasStatus.textContent = "Today's five moments are complete.";
    }
  }

  function renderRoundResult(result) {
    els.roundResult.hidden = false;
    els.resultRoundLabel.textContent = `Challenge ${state.roundIndex + 1}`;
    els.resultAccuracy.textContent = `Accuracy ${formatAccuracy(result.accuracy)}`;
    els.resultScore.textContent = `Score ${formatScore(result.score)}`;
    els.resultState.textContent = result.timedOut ? "TIME'S UP" : "LOCKED IN";
    els.distanceList.innerHTML = result.details.map((item, index) => `<div class="distance-chip"><span>${getCurrentRound().orbs[index].colour.name}</span><strong>${formatAccuracy(item.proximity * 100)}</strong></div>`).join("");
  }

  function updateTimer(remainingMs) {
    const safeRemaining = Math.max(0, remainingMs);
    const remainingSecond = Math.ceil(safeRemaining / 1000);
    els.timerValue.textContent = (safeRemaining / 1000).toFixed(1);
    els.timerBadge.classList.toggle("is-running", state.mode === "round-running");
    els.timerBadge.classList.toggle("is-urgent", state.mode === "round-running" && safeRemaining <= 5000);
    if (state.mode === "round-running" && safeRemaining <= 5000 && !state.urgentTimerAnnounced) {
      state.urgentTimerAnnounced = true;
      els.canvasStatus.textContent = "Five seconds left. Tap to lock it in.";
    }
    if (state.mode === "round-running" && remainingSecond > 0 && remainingSecond <= 5 && state.lastTimerTick !== remainingSecond) {
      state.lastTimerTick = remainingSecond;
      playTimerTick(remainingSecond);
    }
  }

  function renderFinalPanel() {
    const totals = getFinalTotals();
    els.finalPanel.hidden = false;
    els.finalTotalScore.textContent = `${totals.totalScore}/500`;
    els.finalOverallScore.textContent = `${totals.overallScore}/100`;
    els.finalAverageAccuracy.textContent = formatAccuracy(totals.averageAccuracy);
    els.percentileText.textContent = `Better than ${totals.percentile}% of players`;
    els.scoreTable.innerHTML = state.roundResults.map((result, index) => `<div class="score-row"><span>CHALLENGE ${index + 1}</span><strong>${formatAccuracy(result.accuracy)}</strong><strong class="round-score">${formatScore(result.score)}</strong></div>`).join("");
    drawDistribution(totals.totalScore);
  }

  function drawDistribution(totalScore) {
    const rect = els.distributionCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.distributionCanvas.width = Math.floor(rect.width * dpr);
    els.distributionCanvas.height = Math.floor(rect.height * dpr);
    distributionCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width;
    const height = rect.height;
    distributionCtx.clearRect(0, 0, width, height);
    distributionCtx.strokeStyle = "rgba(171,207,235,.12)";
    distributionCtx.lineWidth = 1;
    distributionCtx.beginPath(); distributionCtx.moveTo(8, height - 24); distributionCtx.lineTo(width - 8, height - 24); distributionCtx.stroke();
    distributionCtx.beginPath();
    for (let x = 8; x <= width - 8; x += 2) {
      const score = ((x - 8) / (width - 16)) * 500;
      const normalized = (score - 310) / 75;
      const value = Math.exp(-.5 * normalized * normalized);
      const y = height - 26 - value * (height - 48);
      if (x === 8) distributionCtx.moveTo(x, y); else distributionCtx.lineTo(x, y);
    }
    distributionCtx.strokeStyle = "#5ee7c4";
    distributionCtx.lineWidth = 2;
    distributionCtx.stroke();
    const markerX = 8 + Math.max(0, Math.min(500, totalScore)) / 500 * (width - 16);
    distributionCtx.strokeStyle = "#ffb86b";
    distributionCtx.lineWidth = 2;
    distributionCtx.setLineDash([4, 4]);
    distributionCtx.beginPath(); distributionCtx.moveTo(markerX, 10); distributionCtx.lineTo(markerX, height - 24); distributionCtx.stroke();
    distributionCtx.setLineDash([]);
    distributionCtx.fillStyle = "#ffb86b";
    distributionCtx.beginPath(); distributionCtx.arc(markerX, 10, 4, 0, Math.PI * 2); distributionCtx.fill();
    distributionCtx.fillStyle = "rgba(140,163,185,.7)";
    distributionCtx.font = "11px system-ui, sans-serif";
    distributionCtx.fillText("0", 7, height - 8);
    distributionCtx.fillText("250", width / 2 - 10, height - 8);
    distributionCtx.fillText("500", width - 28, height - 8);
  }

  function cancelAnimation() {
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }

  function animationLoop(now) {
    if (state.mode !== "round-running") return;
    state.displayElapsed = now - state.runningStartedAt;
    const remaining = ROUND_TIME_LIMIT_MS - state.displayElapsed;
    if (remaining <= 0) {
      state.displayElapsed = ROUND_TIME_LIMIT_MS;
      drawScene(state.displayElapsed, false);
      completeRound(true);
      return;
    }
    updateTimer(remaining);
    drawScene(state.displayElapsed, false);
    state.animationFrame = requestAnimationFrame(animationLoop);
  }

  function startRound() {
    if (state.mode !== "round-ready" || state.roundResults[state.roundIndex]) return;
    clearShotEffects();
    state.displayElapsed = 0;
    state.runningStartedAt = performance.now();
    state.urgentTimerAnnounced = false;
    state.lastTimerTick = null;
    state.mode = "round-running";
    els.roundResult.hidden = true;
    els.nextRow.hidden = true;
    updateOverlay();
    updateTimer(ROUND_TIME_LIMIT_MS);
    renderProgress();
    playStartSound();
    cancelAnimation();
    state.animationFrame = requestAnimationFrame(animationLoop);
  }

  function completeRound(timedOut) {
    if (state.mode !== "round-running") return;
    cancelAnimation();
    const positions = getPositions(state.displayElapsed);
    const result = scorePositions(positions);
    result.timedOut = timedOut;
    if (timedOut) result.score = 0;
    state.roundResults[state.roundIndex] = result;
    state.mode = "round-result";
    drawScene(state.displayElapsed, true);
    showShotEffects(result, positions);
    playShotSound(result);
    renderRoundResult(result);
    updateTimer(timedOut ? 0 : Math.max(0, ROUND_TIME_LIMIT_MS - state.displayElapsed));
    saveProgress();
    if (state.roundIndex === ROUND_COUNT - 1) {
      state.mode = "finished";
      els.nextRow.hidden = true;
      renderFinalPanel();
    } else {
      els.nextMessage.textContent = `${ROUND_COUNT - state.roundIndex - 1} challenge${ROUND_COUNT - state.roundIndex - 1 === 1 ? "" : "s"} to go.`;
      els.nextButton.textContent = `Next Challenge`;
      els.nextRow.hidden = false;
    }
    updateOverlay();
    renderProgress();
  }

  function freezeRound() {
    if (state.mode !== "round-running" || state.displayElapsed < START_LOCK_MS) return;
    completeRound(false);
  }

  function advanceRound() {
    if (state.mode !== "round-result" || state.roundIndex >= ROUND_COUNT - 1) return;
    playAdvanceSound();
    clearShotEffects();
    state.roundIndex += 1;
    state.displayElapsed = 0;
    state.mode = "round-ready";
    state.urgentTimerAnnounced = false;
    state.lastTimerTick = null;
    els.roundResult.hidden = true;
    els.nextRow.hidden = true;
    updateOverlay();
    updateTimer(ROUND_TIME_LIMIT_MS);
    renderProgress();
    drawScene(0, false);
    saveProgress();
  }

  function handlePlayfieldInput() {
    if (state.mode === "round-ready") startRound();
    else if (state.mode === "round-running") freezeRound();
    else if (state.mode === "round-result") advanceRound();
  }

  function handlePlayfieldKey(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handlePlayfieldInput();
  }

  function renderTutorialStep() {
    const step = TUTORIAL_STEPS[state.tutorialStep];
    els.tutorialNumber.textContent = String(state.tutorialStep + 1);
    els.tutorialStepTitle.textContent = step.title;
    els.tutorialStepText.textContent = step.text;
    els.tutorialNext.textContent = state.tutorialStep === TUTORIAL_STEPS.length - 1 ? "Got it" : "Next";
    els.tutorialDots.innerHTML = TUTORIAL_STEPS.map((_, index) => `<span class="tutorial-dot ${index === state.tutorialStep ? "current" : ""}" aria-label="Step ${index + 1}${index === state.tutorialStep ? ", current" : ""}"></span>`).join("");
  }

  function openTutorial() {
    state.tutorialStep = 0;
    renderTutorialStep();
    if (!els.tutorialDialog.open) els.tutorialDialog.showModal();
  }

  function closeTutorial() {
    localStorage.setItem(TUTORIAL_KEY, "true");
    if (els.tutorialDialog.open) els.tutorialDialog.close();
    els.playfield.focus({ preventScroll: true });
  }

  function advanceTutorial() {
    if (state.tutorialStep < TUTORIAL_STEPS.length - 1) {
      state.tutorialStep += 1;
      renderTutorialStep();
    } else closeTutorial();
  }

  async function copyResult() {
    const totals = getFinalTotals();
    const lines = state.roundResults.map((result, index) => `${index + 1}: ${result.score}/100`);
    const text = [`MOMENTLE #${puzzleNumber}`, ...lines, `Total: ${totals.totalScore}/500`, `Overall: ${totals.overallScore}/100`, `Better than ${totals.percentile}% (simulated)`].join("\n");
    try {
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch (_) {
          copied = false;
        }
      }
      if (!copied) {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.inset = "0 auto auto -9999px";
        document.body.appendChild(area);
        area.select();
        copied = document.execCommand("copy");
        area.remove();
      }
      if (!copied) throw new Error("Copy unavailable");
      els.copyButton.textContent = "Copied!";
      window.setTimeout(() => { els.copyButton.textContent = "Copy Result"; }, 1400);
    } catch (_) {
      els.copyButton.textContent = "Copy failed";
      window.setTimeout(() => { els.copyButton.textContent = "Copy Result"; }, 1400);
    }
  }

  els.playfield.addEventListener("pointerup", (event) => { event.preventDefault(); handlePlayfieldInput(); });
  els.playfield.addEventListener("keydown", handlePlayfieldKey);
  els.nextButton.addEventListener("click", advanceRound);
  els.copyButton.addEventListener("click", copyResult);
  els.helpButton.addEventListener("click", openTutorial);
  els.soundButton.addEventListener("click", toggleSound);
  els.tutorialClose.addEventListener("click", closeTutorial);
  els.tutorialSkip.addEventListener("click", closeTutorial);
  els.tutorialNext.addEventListener("click", advanceTutorial);
  els.tutorialDialog.addEventListener("close", () => localStorage.setItem(TUTORIAL_KEY, "true"));
  window.addEventListener("resize", resizeCanvas);

  els.puzzleNumber.textContent = `#${String(puzzleNumber).padStart(3, "0")}`;
  updateSoundButton();
  loadProgress();
  renderProgress();
  updateOverlay();
  updateTimer(state.mode === "round-running" ? ROUND_TIME_LIMIT_MS - state.displayElapsed : ROUND_TIME_LIMIT_MS);
  if (state.mode === "finished") renderFinalPanel();
  else if (state.mode === "round-result") {
    const result = state.roundResults[state.roundIndex];
    renderRoundResult(result);
    els.nextMessage.textContent = `${ROUND_COUNT - state.roundIndex - 1} challenge${ROUND_COUNT - state.roundIndex - 1 === 1 ? "" : "s"} to go.`;
    els.nextButton.textContent = "Next Challenge";
    els.nextRow.hidden = false;
  }
  resizeCanvas();
  if (!localStorage.getItem(TUTORIAL_KEY)) window.setTimeout(openTutorial, 250);
})();

(() => {
  "use strict";

  const LOOP_MS = 8000;
  const ORB_COUNT = 5;
  const STORAGE_PREFIX = "momentle-progress-";
  const COLOURS = [
    { name: "mint", value: "#5ee7c4" },
    { name: "coral", value: "#ff8f8f" },
    { name: "gold", value: "#ffc86b" },
    { name: "sky", value: "#7bc7ff" },
    { name: "violet", value: "#b39aff" }
  ];

  const els = {
    canvas: document.getElementById("gameCanvas"),
    canvasStatus: document.getElementById("canvasStatus"),
    puzzleNumber: document.getElementById("puzzleNumber"),
    attemptIndicator: document.getElementById("attemptIndicator"),
    mainButton: document.getElementById("mainButton"),
    bestScore: document.getElementById("bestScore"),
    attemptResult: document.getElementById("attemptResult"),
    resultLabel: document.getElementById("resultLabel"),
    resultScore: document.getElementById("resultScore"),
    distanceList: document.getElementById("distanceList"),
    finalPanel: document.getElementById("finalPanel"),
    finalTitle: document.getElementById("finalTitle"),
    finalRating: document.getElementById("finalRating"),
    finalBestScore: document.getElementById("finalBestScore"),
    summaryAttempts: document.getElementById("summaryAttempts"),
    replayButton: document.getElementById("replayButton"),
    copyButton: document.getElementById("copyButton")
  };

  const ctx = els.canvas.getContext("2d");
  const state = {
    mode: "ready",
    attempts: [],
    bestScore: null,
    runningStartedAt: 0,
    displayElapsed: 0,
    animationFrame: null,
    replayFrame: null,
    replaying: false,
    dpr: 1,
    width: 0,
    height: 0
  };

  const nowUtcKey = () => {
    const date = new Date();
    return date.toISOString().slice(0, 10);
  };

  const daysSinceEpoch = (dateKey) => {
    const date = new Date(`${dateKey}T00:00:00Z`);
    const epoch = new Date("2026-01-01T00:00:00Z");
    return Math.floor((date.getTime() - epoch.getTime()) / 86400000) + 1;
  };

  const hashSeed = (text) => {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const createRng = (seed) => {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  };

  const dateKey = nowUtcKey();
  const puzzleNumber = daysSinceEpoch(dateKey);
  const puzzleSeed = hashSeed(dateKey);
  const random = createRng(puzzleSeed);
  const perfectProgress = 0.3125 + random() * 0.5;

  const puzzle = {
    dateKey,
    puzzleNumber,
    perfectTime: perfectProgress * LOOP_MS,
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
      target: { x: 0, y: 0 }
    };
    orb.target = getNormalizedPosition(orb, perfectProgress);
    puzzle.orbs.push(orb);
  }

  function getNormalizedPosition(orb, progress) {
    const angle = Math.PI * 2 * progress;
    return {
      x: orb.centerX + orb.amplitudeX * Math.sin(orb.frequencyX * angle + orb.phaseX),
      y: orb.centerY + orb.amplitudeY * Math.sin(orb.frequencyY * angle + orb.phaseY)
    };
  }

  function getProgressAt(elapsed) {
    const loopElapsed = ((elapsed % LOOP_MS) + LOOP_MS) % LOOP_MS;
    return loopElapsed / LOOP_MS;
  }

  function getPositions(elapsed) {
    const progress = getProgressAt(elapsed);
    return puzzle.orbs.map((orb) => getNormalizedPosition(orb, progress));
  }

  function resizeCanvas() {
    const rect = els.canvas.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = rect.width;
    state.height = rect.height;
    els.canvas.width = Math.max(1, Math.floor(rect.width * state.dpr));
    els.canvas.height = Math.max(1, Math.floor(rect.height * state.dpr));
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    drawScene(state.displayElapsed, state.mode === "attempt-result" || state.mode === "finished");
  }

  function normalizedToCanvas(position) {
    const padding = Math.min(state.width, state.height) * 0.08;
    return {
      x: padding + position.x * (state.width - padding * 2),
      y: padding + position.y * (state.height - padding * 2)
    };
  }

  function drawBackground() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#081522";
    ctx.fillRect(0, 0, state.width, state.height);

    const grid = Math.max(32, Math.min(52, state.width / 12));
    ctx.strokeStyle = "rgba(142, 192, 224, 0.055)";
    ctx.lineWidth = 1;
    for (let x = grid; x < state.width; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, state.height); ctx.stroke();
    }
    for (let y = grid; y < state.height; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.width, y); ctx.stroke();
    }

    const glow = ctx.createRadialGradient(state.width * .52, state.height * .42, 0, state.width * .52, state.height * .42, Math.max(state.width, state.height) * .72);
    glow.addColorStop(0, "rgba(38, 96, 125, .12)");
    glow.addColorStop(1, "rgba(4, 10, 17, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function drawTarget(position, colour, radius) {
    const target = normalizedToCanvas(position);
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(target.x, target.y, radius * 1.1, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(target.x, target.y, radius * .44, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTrail(orb, elapsed, radius) {
    const trailPoints = 12;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (let step = trailPoints; step >= 1; step -= 1) {
      const position = normalizedToCanvas(getNormalizedPosition(orb, getProgressAt(elapsed - step * 100)));
      const nextPosition = normalizedToCanvas(getNormalizedPosition(orb, getProgressAt(elapsed - (step - 1) * 100)));
      ctx.globalAlpha = (trailPoints - step + 1) / trailPoints * .18;
      ctx.strokeStyle = orb.colour.value;
      ctx.beginPath(); ctx.moveTo(position.x, position.y); ctx.lineTo(nextPosition.x, nextPosition.y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawOrb(position, orb, radius, frozen) {
    const point = normalizedToCanvas(position);
    ctx.save();
    ctx.shadowColor = orb.colour.value;
    ctx.shadowBlur = frozen ? 22 : 17;
    ctx.fillStyle = orb.colour.value;
    ctx.globalAlpha = frozen ? 1 : .96;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.beginPath(); ctx.arc(point.x - radius * .3, point.y - radius * .32, radius * .23, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawDistanceLine(position, orb, radius) {
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
    if (!state.width || !state.height) return;
    drawBackground();
    const radius = Math.max(8, Math.min(15, state.width * .018));
    const positions = getPositions(elapsed);
    puzzle.orbs.forEach((orb) => drawTarget(orb.target, orb.colour.value, radius));
    puzzle.orbs.forEach((orb) => drawTrail(orb, elapsed, radius));
    if (showDistances) puzzle.orbs.forEach((orb, index) => drawDistanceLine(positions[index], orb, radius));
    puzzle.orbs.forEach((orb, index) => drawOrb(positions[index], orb, radius, showDistances));
  }

  function scorePositions(positions) {
    const details = positions.map((position, index) => {
      const target = puzzle.orbs[index].target;
      const distance = Math.hypot(position.x - target.x, position.y - target.y);
      const proximity = Math.max(0, 1 - distance / 0.35);
      return { distance, proximity };
    });
    const score = Math.max(0, Math.min(100, details.reduce((sum, item) => sum + item.proximity, 0) / details.length * 100));
    return { score, details };
  }

  function ratingFor(score) {
    if (score >= 99) return { label: "Perfect", symbol: "🎯" };
    if (score >= 95) return { label: "Incredible", symbol: "🔥" };
    if (score >= 85) return { label: "So close", symbol: "🟢" };
    if (score >= 70) return { label: "Great timing", symbol: "🟡" };
    return { label: "Try again tomorrow", symbol: "⚪" };
  }

  function storageKey() { return `${STORAGE_PREFIX}${puzzle.dateKey}`; }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
      if (!saved || !Array.isArray(saved.attempts) || saved.attempts.length > 3) return;
      state.attempts = saved.attempts.filter((value) => Number.isFinite(value)).map((value) => Math.max(0, Math.min(100, value)));
      state.bestScore = state.attempts.length ? Math.max(...state.attempts) : null;
      if (saved.completed && state.attempts.length === 3) state.mode = "finished";
    } catch (_) {
      state.attempts = [];
      state.bestScore = null;
    }
  }

  function saveProgress() {
    localStorage.setItem(storageKey(), JSON.stringify({
      attempts: state.attempts,
      bestScore: state.bestScore,
      completed: state.attempts.length === 3
    }));
  }

  function formatScore(score) { return `${score.toFixed(1)}%`; }

  function updateAttemptCopy() {
    if (state.mode === "finished" || state.attempts.length === 3) {
      els.attemptIndicator.textContent = "Complete";
      return;
    }
    els.attemptIndicator.textContent = `${3 - state.attempts.length} attempt${3 - state.attempts.length === 1 ? "" : "s"} left`;
  }

  function updateBest() { els.bestScore.textContent = state.bestScore == null ? "—" : formatScore(state.bestScore); }

  function renderAttemptResult(scoreData) {
    const attemptNumber = state.attempts.length;
    els.attemptResult.hidden = false;
    els.resultLabel.textContent = `Attempt ${attemptNumber}`;
    els.resultScore.textContent = formatScore(scoreData.score);
    els.distanceList.innerHTML = scoreData.details.map((item, index) => `<div class="distance-chip"><span>${puzzle.orbs[index].colour.name}</span><strong>${formatScore(item.proximity * 100)}</strong></div>`).join("");
  }

  function renderFinalPanel() {
    const rating = ratingFor(state.bestScore || 0);
    els.finalPanel.hidden = false;
    els.finalBestScore.textContent = formatScore(state.bestScore || 0);
    els.finalTitle.textContent = rating.label === "Perfect" ? "You found your moment." : "That was beautifully close.";
    els.finalRating.textContent = rating.label === "Try again tomorrow"
      ? `${rating.label} ${rating.symbol}`
      : `${rating.label} timing ${rating.symbol}`;
    els.summaryAttempts.innerHTML = state.attempts.map((score) => `<span>${formatScore(score)}</span>`).join("");
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === "ready") {
      els.mainButton.textContent = "Start";
      els.mainButton.disabled = false;
      els.canvasStatus.textContent = "Ready when you are.";
    } else if (mode === "running") {
      els.mainButton.textContent = "Freeze";
      els.mainButton.disabled = false;
      els.canvasStatus.textContent = "Find the alignment.";
    } else if (mode === "attempt-result") {
      els.mainButton.textContent = state.attempts.length === 3 ? "Complete" : "Try Again";
      els.mainButton.disabled = state.attempts.length === 3;
      els.canvasStatus.textContent = "Distances shown. Learn the rhythm, then try again.";
    } else if (mode === "finished") {
      els.mainButton.textContent = "Complete";
      els.mainButton.disabled = true;
      els.canvasStatus.textContent = "Today's moment is captured.";
    }
    updateAttemptCopy();
    updateBest();
  }

  function cancelAnimation() {
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }

  function animationLoop(now) {
    if (state.mode !== "running") return;
    state.displayElapsed = now - state.runningStartedAt;
    drawScene(state.displayElapsed, false);
    state.animationFrame = requestAnimationFrame(animationLoop);
  }

  function startAttempt() {
    state.displayElapsed = 0;
    state.runningStartedAt = performance.now();
    els.attemptResult.hidden = true;
    setMode("running");
    cancelAnimation();
    state.animationFrame = requestAnimationFrame(animationLoop);
  }

  function freezeAttempt() {
    cancelAnimation();
    const positions = getPositions(state.displayElapsed);
    const scoreData = scorePositions(positions);
    state.attempts.push(scoreData.score);
    state.bestScore = state.bestScore == null ? scoreData.score : Math.max(state.bestScore, scoreData.score);
    state.displayElapsed = state.displayElapsed % LOOP_MS;
    drawScene(state.displayElapsed, true);
    renderAttemptResult(scoreData);
    saveProgress();
    setMode(state.attempts.length === 3 ? "finished" : "attempt-result");
    if (state.attempts.length === 3) renderFinalPanel();
  }

  function watchPerfectMoment() {
    cancelAnimation();
    state.replaying = true;
    state.mode = "replay";
    els.mainButton.disabled = true;
    els.canvasStatus.textContent = "The perfect moment.";
    state.displayElapsed = 0;
    const replayStartedAt = performance.now();
    const replayLoop = (now) => {
      if (!state.replaying) return;
      state.displayElapsed = Math.min(puzzle.perfectTime, now - replayStartedAt);
      drawScene(state.displayElapsed, false);
      if (state.displayElapsed < puzzle.perfectTime) {
        state.replayFrame = requestAnimationFrame(replayLoop);
      } else {
        drawScene(puzzle.perfectTime, true);
        els.canvasStatus.textContent = "Perfect alignment.";
        state.replaying = false;
        state.mode = "finished";
        els.mainButton.disabled = true;
      }
    };
    state.replayFrame = requestAnimationFrame(replayLoop);
  }

  async function copyResult() {
    const best = state.bestScore || 0;
    const rating = ratingFor(best);
    const text = `PERFECT MOMENT #${puzzle.puzzleNumber}\nAttempts: ${state.attempts.map((score) => score.toFixed(1)).join(" · ")}\nBest: ${best.toFixed(1)}% ${rating.symbol}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      const original = els.copyButton.textContent;
      els.copyButton.textContent = "Copied!";
      window.setTimeout(() => { els.copyButton.textContent = original; }, 1400);
    } catch (_) {
      els.copyButton.textContent = "Copy failed";
      window.setTimeout(() => { els.copyButton.textContent = "Copy Result"; }, 1400);
    }
  }

  els.mainButton.addEventListener("click", () => {
    if (state.mode === "ready" || state.mode === "attempt-result") startAttempt();
    else if (state.mode === "running") freezeAttempt();
  });
  els.replayButton.addEventListener("click", watchPerfectMoment);
  els.copyButton.addEventListener("click", copyResult);
  window.addEventListener("resize", resizeCanvas);

  els.puzzleNumber.textContent = `#${String(puzzle.puzzleNumber).padStart(3, "0")}`;
  loadProgress();
  if (state.mode === "finished") {
    setMode("finished");
    renderFinalPanel();
  } else {
    setMode("ready");
  }
  resizeCanvas();
})();

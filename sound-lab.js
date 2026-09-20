/* Test Lab v0.1 — Sound/Buzz experiment */
(() => {
  "use strict";

  const PATTERNS = {
    a: { label: "A · 85 Hz square", freqs: [85], type: "square", pulses: 3, on: 0.18, off: 0.11 },
    b: { label: "B · 105 Hz square", freqs: [105], type: "square", pulses: 3, on: 0.18, off: 0.11 },
    c: { label: "C · 125 Hz saw", freqs: [125], type: "sawtooth", pulses: 3, on: 0.17, off: 0.11 },
    d: { label: "D · 145 Hz square", freqs: [145], type: "square", pulses: 3, on: 0.16, off: 0.10 },
    e: { label: "E · 170 Hz saw", freqs: [170], type: "sawtooth", pulses: 3, on: 0.15, off: 0.10 },
    f: { label: "F · layered 105 + 210", freqs: [105, 210], type: "square", pulses: 3, on: 0.18, off: 0.11 }
  };

  const RATING_KEY = "billsResearchSoundLabRatings";
  let audioCtx = null;
  let masterGain = null;
  let activeNodes = [];
  let activePattern = "";
  let stopTimer = 0;

  const $ = id => document.getElementById(id);
  const qsa = selector => Array.from(document.querySelectorAll(selector));

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Web Audio is not available in this browser.");
    if (!audioCtx) {
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = strength();
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") return audioCtx.resume();
    return Promise.resolve();
  }

  function strength() {
    const slider = $("labStrength");
    return slider ? Math.max(0.08, Math.min(1, Number(slider.value) / 100)) : 0.7;
  }

  function stopSound(message) {
    clearTimeout(stopTimer);
    activeNodes.forEach(node => {
      try { node.stop(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
    });
    activeNodes = [];
    qsa(".sound-test").forEach(btn => btn.classList.remove("is-playing"));
    if (message) $("labStatus").textContent = message;
  }

  async function playPattern(key) {
    const pattern = PATTERNS[key];
    if (!pattern) return;
    stopSound();
    activePattern = key;
    try {
      await ensureAudio();
      masterGain.gain.setValueAtTime(strength(), audioCtx.currentTime);
      const start = audioCtx.currentTime + 0.025;
      const pulseSpan = pattern.on + pattern.off;

      for (let pulse = 0; pulse < pattern.pulses; pulse += 1) {
        const pulseStart = start + pulse * pulseSpan;
        const pulseEnd = pulseStart + pattern.on;

        pattern.freqs.forEach((frequency, layerIndex) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = pattern.type;
          osc.frequency.value = frequency;

          const layerScale = pattern.freqs.length > 1 ? (layerIndex === 0 ? 0.58 : 0.26) : 0.7;
          gain.gain.setValueAtTime(0.0001, pulseStart);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.02, strength() * layerScale), pulseStart + 0.012);
          gain.gain.setValueAtTime(Math.max(0.02, strength() * layerScale), Math.max(pulseStart + 0.013, pulseEnd - 0.018));
          gain.gain.exponentialRampToValueAtTime(0.0001, pulseEnd);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(pulseStart);
          osc.stop(pulseEnd + 0.02);
          activeNodes.push(osc, gain);
        });
      }

      const total = pattern.pulses * pattern.on + (pattern.pulses - 1) * pattern.off;
      const button = document.querySelector('[data-sound-pattern="' + key + '"]');
      button?.classList.add("is-playing");
      $("labStatus").textContent = "Playing " + pattern.label + " — buzz · buzz · buzz. Hold the phone normally, away from your ear.";
      stopTimer = window.setTimeout(() => {
        qsa(".sound-test").forEach(btn => btn.classList.remove("is-playing"));
        activeNodes = [];
        $("labStatus").textContent = "Finished " + pattern.label + ". Rate what you actually felt, not what you expected to feel.";
      }, Math.ceil((total + 0.12) * 1000));
    } catch (error) {
      stopSound("Sound test could not start: " + (error?.message || "unknown error"));
    }
  }

  function getRatings() {
    try { return JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function saveRating(rating) {
    if (!activePattern) {
      $("labStatus").textContent = "Play a pattern first, then rate it.";
      return;
    }
    const ratings = getRatings();
    ratings[activePattern] = rating;
    localStorage.setItem(RATING_KEY, JSON.stringify(ratings));
    renderRatings();
    $("labStatus").textContent = PATTERNS[activePattern].label + " marked: " + rating + ".";
  }

  function renderRatings() {
    const ratings = getRatings();
    qsa("[data-rating-for]").forEach(el => {
      const value = ratings[el.dataset.ratingFor];
      el.textContent = value ? "rated: " + value : "not rated yet";
    });
    qsa("[data-lab-rate]").forEach(btn => {
      btn.classList.toggle("selected", !!activePattern && ratings[activePattern] === btn.dataset.labRate);
    });
  }

  function setView(view) {
    const lab = $("soundLabView");
    const scannerSections = qsa("main.app > section").filter(section => section.id !== "soundLabView");
    const labMode = view === "lab";

    scannerSections.forEach(section => section.classList.toggle("hidden", labMode));
    lab?.classList.toggle("hidden", !labMode);

    qsa("[data-research-tab]").forEach(btn => {
      const selected = btn.dataset.researchTab === view;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-selected", String(selected));
    });

    if (!labMode) stopSound();
  }

  function init() {
    qsa("[data-research-tab]").forEach(btn => {
      btn.addEventListener("click", () => setView(btn.dataset.researchTab));
    });

    qsa("[data-sound-pattern]").forEach(btn => {
      btn.addEventListener("click", () => playPattern(btn.dataset.soundPattern));
    });

    qsa("[data-lab-rate]").forEach(btn => {
      btn.addEventListener("click", () => saveRating(btn.dataset.labRate));
    });

    $("labStop")?.addEventListener("click", () => stopSound("Stopped."));
    $("labStrength")?.addEventListener("input", event => {
      const value = Math.max(8, Math.min(100, Number(event.target.value)));
      $("labStrengthValue").textContent = value + "%";
      if (masterGain && audioCtx) masterGain.gain.setValueAtTime(value / 100, audioCtx.currentTime);
    });

    const audioSupported = !!(window.AudioContext || window.webkitAudioContext);
    const vibrationSupported = typeof navigator.vibrate === "function";
    $("labCapability").textContent =
      "Web Audio: " + (audioSupported ? "available" : "not available") +
      " · Web vibration: " + (vibrationSupported ? "available" : "not available") +
      ". The sound test does not depend on web vibration.";

    if (!audioSupported) {
      qsa("[data-sound-pattern]").forEach(btn => btn.disabled = true);
      $("labStatus").textContent = "This browser does not expose Web Audio, so the buzz tests are disabled.";
    }

    renderRatings();
    setView("scanner");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

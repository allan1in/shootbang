import { getCtx, getEffectiveVolume, getMasterGainNode } from "@/lib/sounds";

let noiseBuffer: AudioBuffer | null = null;

let currentRainCleanup: (() => void) | null = null;

export function stopRain() {
  if (currentRainCleanup) {
    currentRainCleanup();
    currentRainCleanup = null;
  }
}

export function startRain() {
  stopRain();
  if (getEffectiveVolume() === 0) return;
  currentRainCleanup = createRain();
}

function getNoiseBuffer(): AudioBuffer | null {
  if (noiseBuffer) return noiseBuffer;
  const ctx = getCtx();
  if (!ctx) return null;
  const length = ctx.sampleRate * 4; // 4 seconds
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

export function createRain(): () => void {
  if (getEffectiveVolume() === 0) return () => {};
  let stopped = false;
  let cleanup: (() => void) | null = null;

  function start(ctx: AudioContext) {
    if (stopped) return;

    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(getMasterGainNode() ?? ctx.destination);

    const buffer = getNoiseBuffer();
    if (!buffer) return;

    // Subtle background noise bed — barely audible but fills the spectrum
    const bedSrc = ctx.createBufferSource();
    bedSrc.buffer = buffer;
    bedSrc.loop = true;
    const bedLP = ctx.createBiquadFilter();
    bedLP.type = "lowpass";
    bedLP.frequency.value = 800;
    bedLP.Q.value = 0.7;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.015;
    bedSrc.connect(bedLP);
    bedLP.connect(bedGain);
    bedGain.connect(masterGain);
    bedSrc.start();

    // Fade in over 2 seconds
    masterGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 2.0);

    function scheduleBatch() {
      if (stopped) return;

      const count = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        const t = ctx.currentTime + Math.random() * 0.04;
        const dur = 0.01 + Math.random() * 0.03;

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.start(t, Math.random() * 3.9, dur);

        const freq = Math.random() < 0.2
          ? 350 + Math.random() * 550
          : 900 + Math.random() * 4000;

        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = freq;
        bp.Q.value = 1.5 + Math.random() * 4.0;

        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.random() * 2 - 1;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.025 + Math.random() * 0.015, t + 0.0015);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);

        src.connect(bp);
        bp.connect(g);
        g.connect(pan);
        pan.connect(masterGain);

        src.stop(t + dur);
      }

      setTimeout(scheduleBatch, 15 + Math.random() * 15);
    }

    setTimeout(scheduleBatch, 0);

    cleanup = () => {
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
      setTimeout(() => {
        bedSrc.stop();
        bedSrc.disconnect();
        bedLP.disconnect();
        bedGain.disconnect();
        masterGain.disconnect();
      }, 1500);
    };
  }

  // Try starting immediately if AudioContext is already available
  const ctx = getCtx();
  if (ctx) {
    start(ctx);
  } else {
    // Wait for user gesture, then start
    const onReady = () => {
      document.removeEventListener("pointerdown", onReady);
      document.removeEventListener("keydown", onReady);
      const readyCtx = getCtx();
      if (readyCtx) start(readyCtx);
    };
    document.addEventListener("pointerdown", onReady);
    document.addEventListener("keydown", onReady);

    cleanup = () => {
      document.removeEventListener("pointerdown", onReady);
      document.removeEventListener("keydown", onReady);
    };
  }

  return () => {
    stopped = true;
    cleanup?.();
  };
}

export function playThunder(delaySeconds: number) {
  if (getEffectiveVolume() === 0) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const buffer = getNoiseBuffer();
  if (!buffer) return;

  const t = ctx.currentTime + delaySeconds;
  const decayDuration = 2 + Math.random() * 2; // 2-4 seconds

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 6;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.001;
  compressor.release.value = 0.2;
  compressor.connect(getMasterGainNode() ?? ctx.destination);

  const master = ctx.createGain();
  master.gain.value = 1.2;
  master.connect(compressor);

  // Low-frequency noise rumble
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 120;
  lowpass.Q.value = 1.0;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, t);
  noiseGain.gain.linearRampToValueAtTime(1.0, t + 0.05);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + decayDuration);
  noiseSource.connect(lowpass);
  lowpass.connect(noiseGain);
  noiseGain.connect(master);
  noiseSource.start(t);
  noiseSource.stop(t + decayDuration);

  // Sub-bass sine rumble
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 30 + Math.random() * 20; // 30-50 Hz
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, t);
  oscGain.gain.linearRampToValueAtTime(0.5, t + 0.05);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + decayDuration);
  osc.connect(oscGain);
  oscGain.connect(master);
  osc.start(t);
  osc.stop(t + decayDuration);
}

import { getCtx, getMasterGainNode } from "@/lib/sounds";
import { useSettingsStore } from "@/stores/gameStore";

let noiseBuffer: AudioBuffer | null = null;

interface WindHandle {
  cleanup: (immediate?: boolean) => void;
  setWhiteout: (t: number) => void;
  setMuted: (muted: boolean) => void;
}

let currentWind: WindHandle | null = null;

export function stopWind(immediate = false) {
  if (currentWind) {
    currentWind.cleanup(immediate);
    currentWind = null;
  }
}

export function setWindWhiteout(t: number) {
  currentWind?.setWhiteout(t);
}

export function muteWind(muted: boolean) {
  currentWind?.setMuted(muted);
}

export function startWind(onGust?: (duration: number) => void) {
  stopWind(true);
  currentWind = createWind(onGust);
}

function getNoiseBuffer(): AudioBuffer | null {
  if (noiseBuffer) return noiseBuffer;
  const ctx = getCtx();
  if (!ctx) return null;
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

export function createWind(onGust?: (duration: number) => void): WindHandle {
  if (useSettingsStore.getState().muted) return { cleanup: () => {}, setWhiteout: () => {}, setMuted: () => {} };
  let stopped = false;
  let isMuted = false;
  let cleanup: ((immediate?: boolean) => void) | null = null;
  let whiteoutFn: (t: number) => void = () => {};
  let setMutedFn: (muted: boolean) => void = () => {};

  function start(ctx: AudioContext) {
    if (stopped) return;

    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(getMasterGainNode() ?? ctx.destination);

    const buffer = getNoiseBuffer();
    if (!buffer) return;

    // Layer 1: Low rumble bed — deep constant wind undertone
    const bedSrc = ctx.createBufferSource();
    bedSrc.buffer = buffer;
    bedSrc.loop = true;
    const bedLP = ctx.createBiquadFilter();
    bedLP.type = "lowpass";
    bedLP.frequency.value = 80;
    bedLP.Q.value = 0.5;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.035;
    bedSrc.connect(bedLP);
    bedLP.connect(bedGain);
    bedGain.connect(masterGain);
    bedSrc.start();

    // Layer 2: Main howling wind — bandpass with LFO sweep
    const howlSrc = ctx.createBufferSource();
    howlSrc.buffer = buffer;
    howlSrc.loop = true;
    const howlBP = ctx.createBiquadFilter();
    howlBP.type = "bandpass";
    howlBP.frequency.value = 400;
    howlBP.Q.value = 4.0;
    const howlGain = ctx.createGain();
    howlGain.gain.value = 0.15;
    howlSrc.connect(howlBP);
    howlBP.connect(howlGain);
    howlGain.connect(masterGain);
    howlSrc.start();

    // LFO 1: Slow sweep for the howl — 200-800 Hz range
    const lfo1 = ctx.createOscillator();
    lfo1.type = "sine";
    lfo1.frequency.value = 0.12;
    const lfo1Gain = ctx.createGain();
    lfo1Gain.gain.value = 300;
    lfo1.connect(lfo1Gain);
    lfo1Gain.connect(howlBP.frequency);
    lfo1.start();

    // LFO 2: Slightly faster tremolo on gain for natural volume swell
    const lfo2 = ctx.createOscillator();
    lfo2.type = "sine";
    lfo2.frequency.value = 0.2;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 0.05;
    lfo2.connect(lfo2Gain);
    lfo2Gain.connect(howlGain.gain);
    lfo2.start();

    // Layer 3: Higher whistle layer — the "scream" in the howl
    const whistleSrc = ctx.createBufferSource();
    whistleSrc.buffer = buffer;
    whistleSrc.loop = true;
    const whistleBP = ctx.createBiquadFilter();
    whistleBP.type = "bandpass";
    whistleBP.frequency.value = 900;
    whistleBP.Q.value = 7.0;
    const whistleGain = ctx.createGain();
    whistleGain.gain.value = 0.04;
    whistleSrc.connect(whistleBP);
    whistleBP.connect(whistleGain);
    whistleGain.connect(masterGain);
    whistleSrc.start();

    // LFO 3: Sweep the whistle layer independently
    const lfo3 = ctx.createOscillator();
    lfo3.type = "sine";
    lfo3.frequency.value = 0.07;
    const lfo3Gain = ctx.createGain();
    lfo3Gain.gain.value = 400;
    lfo3.connect(lfo3Gain);
    lfo3Gain.connect(whistleBP.frequency);
    lfo3.start();

    masterGain.gain.value = 0.3;

    // Whiteout intensity control: boost volume + shift howl frequency
    whiteoutFn = (t: number) => {
      if (stopped || isMuted) return;
      const now = ctx.currentTime;
      masterGain.gain.setTargetAtTime(0.3 + t * 0.25, now, 0.3);
      howlBP.frequency.setTargetAtTime(400 + t * 200, now, 0.3);
      howlGain.gain.setTargetAtTime(0.15 + t * 0.1, now, 0.3);
    };

    // Mute control: fade volume without destroying the audio graph
    setMutedFn = (muted: boolean) => {
      if (stopped) return;
      isMuted = muted;
      const now = ctx.currentTime;
      if (muted) {
        masterGain.gain.setTargetAtTime(0, now, 0.5);
      } else {
        masterGain.gain.setTargetAtTime(0.3, now, 0.8);
      }
    };

    // Periodic strong gusts — louder, faster sweep
    let gustTimer: ReturnType<typeof setTimeout>;

    function scheduleGust() {
      if (stopped) return;
      const delay = 3 + Math.random() * 5;
      gustTimer = setTimeout(() => {
        if (stopped) return;

        const t = ctx.currentTime;
        const dur = 1.0 + Math.random() * 1.5;
        onGust?.(dur);

        const gustSrc = ctx.createBufferSource();
        gustSrc.buffer = buffer;
        const gustBP = ctx.createBiquadFilter();
        gustBP.type = "bandpass";
        // Sweep from low to high during the gust
        gustBP.frequency.setValueAtTime(200 + Math.random() * 200, t);
        gustBP.frequency.linearRampToValueAtTime(600 + Math.random() * 400, t + dur * 0.6);
        gustBP.frequency.linearRampToValueAtTime(300 + Math.random() * 200, t + dur);
        gustBP.Q.value = 2.5 + Math.random() * 2;
        const gustGain = ctx.createGain();
        gustGain.gain.setValueAtTime(0, t);
        gustGain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.04, t + dur * 0.3);
        gustGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        gustSrc.connect(gustBP);
        gustBP.connect(gustGain);
        gustGain.connect(masterGain);
        gustSrc.start(t);
        gustSrc.stop(t + dur);

        // Schedule next gust
        scheduleGust();
      }, delay * 1000);
    }

    scheduleGust();

    const disconnectAll = () => {
      bedSrc.stop();
      bedSrc.disconnect();
      bedLP.disconnect();
      bedGain.disconnect();
      howlSrc.stop();
      howlSrc.disconnect();
      howlBP.disconnect();
      howlGain.disconnect();
      whistleSrc.stop();
      whistleSrc.disconnect();
      whistleBP.disconnect();
      whistleGain.disconnect();
      lfo1.stop();
      lfo1.disconnect();
      lfo1Gain.disconnect();
      lfo2.stop();
      lfo2.disconnect();
      lfo2Gain.disconnect();
      lfo3.stop();
      lfo3.disconnect();
      lfo3Gain.disconnect();
      masterGain.disconnect();
    };

    cleanup = (immediate?: boolean) => {
      clearTimeout(gustTimer);
      if (immediate) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.value = 0;
        disconnectAll();
      } else {
        masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
        setTimeout(disconnectAll, 1500);
      }
    };
  }

  const ctx = getCtx();
  if (ctx) {
    start(ctx);
  } else {
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

  return {
    cleanup: (immediate?: boolean) => {
      stopped = true;
      cleanup?.(immediate);
    },
    setWhiteout: (t: number) => whiteoutFn(t),
    setMuted: (muted: boolean) => setMutedFn(muted),
  };
}

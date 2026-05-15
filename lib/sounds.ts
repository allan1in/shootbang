import { useSettingsStore } from "@/stores/gameStore";

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getMasterGain(): GainNode | null {
  if (!masterGain && audioCtx) {
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  }
  return masterGain;
}

export function setMasterMuted(muted: boolean) {
  const ctx = audioCtx;
  const gain = masterGain;
  if (!ctx || !gain) return;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
}

if (typeof window !== "undefined") {
  const init = () => {
    if (!audioCtx) {
      try {
        audioCtx = new AudioContext();
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
        getMasterGain();
      } catch {
        // ignore
      }
    }
  };

  const onFirstGesture = () => {
    init();
    document.removeEventListener("pointerdown", onFirstGesture);
    document.removeEventListener("keydown", onFirstGesture);
  };
  document.addEventListener("pointerdown", onFirstGesture);
  document.addEventListener("keydown", onFirstGesture);
}

export function getCtx(): AudioContext | null {
  return audioCtx;
}

export function getMasterGainNode(): GainNode | null {
  getMasterGain();
  return masterGain;
}

function playTone(frequency: number, volume: number, duration: number) {
  if (useSettingsStore.getState().muted) return;
  const ctx = getCtx();
  const gain = getMasterGain();
  if (!ctx || !gain) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const osc = ctx.createOscillator();
  const nodeGain = ctx.createGain();
  osc.connect(nodeGain);
  nodeGain.connect(gain);
  osc.frequency.value = frequency;
  osc.type = "sine";
  nodeGain.gain.setValueAtTime(volume, ctx.currentTime);
  nodeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export const playHitSound = () => playTone(880, 0.15, 0.1);
export const playMissSound = () => playTone(220, 0.1, 0.05);
export const playCountdownSound = () => playTone(440, 0.12, 0.08);

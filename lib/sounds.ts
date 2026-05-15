let audioCtx: AudioContext | null = null;

if (typeof window !== "undefined") {
  const init = () => {
    if (!audioCtx) {
      try {
        audioCtx = new AudioContext();
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
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

function playTone(frequency: number, volume: number, duration: number) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = frequency;
  osc.type = "sine";
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export const playHitSound = () => playTone(880, 0.15, 0.1);
export const playMissSound = () => playTone(220, 0.1, 0.05);
export const playCountdownSound = () => playTone(440, 0.12, 0.08);

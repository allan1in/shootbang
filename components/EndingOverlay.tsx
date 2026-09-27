import { COUNTDOWN_TEXT_CLASS } from "@/components/CountdownOverlay";

export function EndingOverlay() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
      <div className={COUNTDOWN_TEXT_CLASS}>结束</div>
    </div>
  );
}

export function Crosshair() {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
      <div className="relative">
        <div className="absolute w-6 h-0.5 bg-foreground/70 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
        <div className="absolute h-6 w-0.5 bg-foreground/70 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
      </div>
    </div>
  );
}

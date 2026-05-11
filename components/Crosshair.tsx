interface CrosshairProps {
  size?: number;
  style?: string;
}

export function Crosshair({ size = 24, style = "cross" }: CrosshairProps) {
  const halfSize = size / 2;
  const thickness = 2;
  const halfThick = thickness / 2;
  const color = "#ffffff";

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        {style === "cross" && (
          <>
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: size,
                height: thickness,
                backgroundColor: color,
                opacity: 0.7,
                transform: `translate(-${halfSize}px, -${halfThick}px)`,
              }}
            />
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: thickness,
                height: size,
                backgroundColor: color,
                opacity: 0.7,
                transform: `translate(-${halfThick}px, -${halfSize}px)`,
              }}
            />
          </>
        )}
        {style === "square" && (
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: size * 0.3,
              height: size * 0.3,
              backgroundColor: color,
              opacity: 0.8,
              transform: `translate(-${size * 0.15}px, -${size * 0.15}px)`,
            }}
          />
        )}
        {style === "dot" && (
          <div
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: size * 0.3,
              height: size * 0.3,
              backgroundColor: color,
              opacity: 0.8,
              transform: `translate(-${size * 0.15}px, -${size * 0.15}px)`,
            }}
          />
        )}
      </div>
    </div>
  );
}

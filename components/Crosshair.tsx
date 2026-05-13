import React from "react";

const SIZE = 16;
const HALF = SIZE / 2;
const THICKNESS = 2;
const HALF_THICK = THICKNESS / 2;
const COLOR = "#ffffff";

export const Crosshair = React.memo(function Crosshair() {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: SIZE,
            height: THICKNESS,
            backgroundColor: COLOR,
            opacity: 0.7,
            transform: `translate(-${HALF}px, -${HALF_THICK}px)`,
          }}
        />
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: THICKNESS,
            height: SIZE,
            backgroundColor: COLOR,
            opacity: 0.7,
            transform: `translate(-${HALF_THICK}px, -${HALF}px)`,
          }}
        />
      </div>
    </div>
  );
});

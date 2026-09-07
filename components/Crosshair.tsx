import React from "react";
import type { CrosshairSettings } from "@/lib/crosshair";

const VIEWBOX_SIZE = 64;
const VIEWBOX_HALF = VIEWBOX_SIZE / 2;
const CROSSHAIR_OPACITY = 0.7;
const OUTLINE_WIDTH = 2;

interface CrosshairGraphicProps {
  settings: CrosshairSettings;
  className?: string;
}

export const CrosshairGraphic = React.memo(function CrosshairGraphic({
  settings,
  className,
}: CrosshairGraphicProps) {
  const inner = settings.gap / 2;
  const outer = inner + settings.length;
  const centerDotSize = Math.max(1, settings.thickness);
  const outlinePadding = OUTLINE_WIDTH / 2;
  const lines = [
    { x1: -outer, y1: 0, x2: -inner, y2: 0 },
    { x1: inner, y1: 0, x2: outer, y2: 0 },
    { x1: 0, y1: -outer, x2: 0, y2: -inner },
    { x1: 0, y1: inner, x2: 0, y2: outer },
  ];
  const outlineLines = [
    {
      x1: -outer - outlinePadding,
      y1: 0,
      x2: -inner + outlinePadding,
      y2: 0,
    },
    {
      x1: inner - outlinePadding,
      y1: 0,
      x2: outer + outlinePadding,
      y2: 0,
    },
    {
      x1: 0,
      y1: -outer - outlinePadding,
      x2: 0,
      y2: -inner + outlinePadding,
    },
    {
      x1: 0,
      y1: inner - outlinePadding,
      x2: 0,
      y2: outer + outlinePadding,
    },
  ];
  const showLines = settings.length > 0 && settings.thickness > 0;

  const renderLines = (
    sourceLines: typeof lines,
    stroke: string,
    strokeWidth: number,
    opacity = 1,
    outline = false,
  ) => (
    <g
      data-crosshair-line-outline={outline || undefined}
      data-crosshair-lines={!outline || undefined}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      opacity={opacity}
    >
      {sourceLines.map((line, index) => (
        <line key={index} {...line} />
      ))}
    </g>
  );

  return (
    <svg
      aria-hidden="true"
      className={className}
      data-crosshair-graphic
      data-color={settings.color}
      data-length={settings.length}
      data-thickness={settings.thickness}
      data-gap={settings.gap}
      data-center-dot={settings.centerDot}
      data-outline={settings.outline}
      width={VIEWBOX_SIZE}
      height={VIEWBOX_SIZE}
      viewBox={`${-VIEWBOX_HALF} ${-VIEWBOX_HALF} ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
    >
      {showLines &&
        settings.outline &&
        renderLines(
          outlineLines,
          "#000000",
          settings.thickness + OUTLINE_WIDTH,
          1,
          true,
        )}
      {showLines &&
        renderLines(
          lines,
          settings.color,
          settings.thickness,
          CROSSHAIR_OPACITY,
        )}
      {settings.centerDot && settings.outline && (
        <rect
          data-crosshair-center-dot-outline
          x={-(centerDotSize + OUTLINE_WIDTH) / 2}
          y={-(centerDotSize + OUTLINE_WIDTH) / 2}
          width={centerDotSize + OUTLINE_WIDTH}
          height={centerDotSize + OUTLINE_WIDTH}
          fill="#000000"
        />
      )}
      {settings.centerDot && (
        <rect
          data-crosshair-center-dot
          x={-centerDotSize / 2}
          y={-centerDotSize / 2}
          width={centerDotSize}
          height={centerDotSize}
          fill={settings.color}
          opacity={CROSSHAIR_OPACITY}
        />
      )}
    </svg>
  );
});

export const Crosshair = React.memo(function Crosshair({
  settings,
}: {
  settings: CrosshairSettings;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <CrosshairGraphic settings={settings} />
    </div>
  );
});

"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

type SliderProps = SliderPrimitive.Root.Props<number> & {
  getAriaLabel?: (index: number) => string
}

function Slider({
  className,
  getAriaLabel,
  thumbAlignment = "edge",
  ...props
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      thumbAlignment={thumbAlignment}
      {...props}
    >
      <SliderPrimitive.Control
        data-slot="slider-control"
        className="relative flex w-full cursor-pointer items-center py-2"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative mx-2 h-1.5 w-[calc(100%-1rem)] overflow-hidden rounded-full bg-muted"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-indicator"
            className="h-full rounded-full bg-primary"
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          getAriaLabel={getAriaLabel}
          className="size-4 rounded-full border border-primary bg-background shadow-sm outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }

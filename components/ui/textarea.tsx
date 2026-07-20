import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        "[&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar]:cursor-default [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-button]:h-0 [&::-webkit-scrollbar-button]:w-0 [&::-webkit-scrollbar-track]:my-1 [&::-webkit-scrollbar-track]:cursor-default [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:cursor-default [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-x-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-foreground/30 [&::-webkit-scrollbar-thumb]:bg-clip-content [&::-webkit-scrollbar-thumb:hover]:bg-foreground/45",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }

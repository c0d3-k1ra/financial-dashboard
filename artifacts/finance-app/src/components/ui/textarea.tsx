import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-lg border border-[rgba(var(--glass-overlay-rgb),0.08)] bg-[rgba(var(--glass-overlay-rgb),0.03)] px-3 py-2 text-base shadow-sm transition-all duration-300 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary/30 focus-visible:bg-[rgba(var(--glass-overlay-rgb),0.05)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

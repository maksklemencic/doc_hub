import { cn } from "@/lib/utils"
import { CgSpinner } from "react-icons/cg"

interface SpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function Spinner({ className, size = "md" }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  }

  return (
    <CgSpinner
      className={cn(
        "animate-spin text-primary",
        sizeClasses[size],
        className
      )}
      style={{animationDuration: '1.2s'}}
      role="status"
      aria-label="Loading"
    />
  )
}
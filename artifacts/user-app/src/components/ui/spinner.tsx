import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "size-3",
  md: "size-4",
  lg: "size-8",
  xl: "size-12",
};

function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn(sizeMap[size], "animate-spin", className)}
    />
  )
}

export { Spinner }

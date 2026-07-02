import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-bold", {
  variants: {
    variant: {
      default: "bg-muted text-muted-foreground",
      dark: "bg-foreground text-background",
      green: "bg-[#e8fbf7] text-[#08796f]",
      blue: "bg-[#eef4ff] text-[#2f5fb8]",
      pulseBlue: "animate-pulse bg-[#e8f0ff] text-[#2454c7] ring-1 ring-[#6ea8ff]/45",
      pulseRed: "animate-pulse bg-[#fff0f0] text-[#cf2e2e] ring-1 ring-[#ff8a8a]/55"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

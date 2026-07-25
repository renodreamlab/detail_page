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
      solidBlue: "bg-[#2454c7] text-white",
      solidGray: "bg-[#6b7280] text-white"
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

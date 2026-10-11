import type { SelectHTMLAttributes } from "react";
import { cn } from "@/shared/cn";

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-theme border border-border bg-background px-3 text-sm",
        className,
      )}
      {...props}
    />
  );
}

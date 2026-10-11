import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/cn";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-theme border border-border bg-background px-3 py-2 text-sm",
        className,
      )}
      {...props}
    />
  );
}

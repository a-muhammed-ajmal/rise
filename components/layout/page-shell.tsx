import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("page-shell", className)} {...props} />;
}

export function PageHeader({
  title,
  eyebrow,
  icon,
  actions,
}: {
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 slide-up stagger-1">
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-label text-muted-foreground">{eyebrow}</p>}
        <h1 className={cn("flex items-center gap-2.5 font-semibold", eyebrow ? "text-display" : "text-h1")}>
          {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

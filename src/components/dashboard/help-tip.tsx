"use client";

import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function HelpTip({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CircleHelp className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-sm px-3 py-2 text-left text-xs leading-relaxed"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

export function PageHeading({
  title,
  help,
}: {
  title: string;
  help: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <HelpTip label={`About ${title}`}>{help}</HelpTip>
    </div>
  );
}

export function LabelWithHelp({
  children,
  help,
  helpLabel,
  className,
}: {
  children: React.ReactNode;
  help: React.ReactNode;
  helpLabel: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <HelpTip label={helpLabel}>{help}</HelpTip>
    </span>
  );
}

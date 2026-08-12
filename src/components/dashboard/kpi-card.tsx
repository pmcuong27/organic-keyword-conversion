"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTip } from "@/components/dashboard/help-tip";
import { cn } from "@/lib/utils";

export function KpiCard({
  title,
  value,
  hint,
  help,
  className,
}: {
  title: string;
  value: string;
  hint?: string;
  help?: string;
  className?: string;
}) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
          {help ? <HelpTip label={`About ${title}`}>{help}</HelpTip> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

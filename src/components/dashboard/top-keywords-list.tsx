import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTip } from "@/components/dashboard/help-tip";

export function TopKeywordsList({
  items,
}: {
  items: Array<{ keyword: string; clicks: number; conversions: number }>;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1 text-sm font-medium">
          Top Keywords
          <HelpTip label="About top keywords">
            Ranked by estimated organic conversions. The number on the right is that estimate, not
            raw GA4 sessions.
          </HelpTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.keyword}
            className="flex items-center gap-3 border-b border-border/60 py-2 last:border-0"
          >
            <span className="w-5 text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.keyword}</p>
              <p className="text-xs text-muted-foreground">
                {item.clicks.toLocaleString()} clicks
              </p>
            </div>
            <div className="text-right text-sm tabular-nums font-medium">
              {item.conversions.toFixed(2)}
            </div>
          </div>
        ))}
        {!items.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">No keyword data</p>
        )}
      </CardContent>
    </Card>
  );
}

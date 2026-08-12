"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTip } from "@/components/dashboard/help-tip";

export function PerformanceChart({
  data,
}: {
  data: Array<{ date: string; clicks: number; conversions: number }>;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1 text-sm font-medium">
          Organic Clicks vs Estimated Conversions
          <HelpTip label="About this chart">
            Left axis is Search Console clicks by day. Right axis is estimated organic conversions
            allocated to keywords on those days.
          </HelpTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[300px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickMargin={8}
              minTickGap={24}
              stroke="var(--muted-foreground)"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              stroke="var(--muted-foreground)"
              width={40}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              stroke="var(--muted-foreground)"
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="clicks"
              name="GSC Clicks"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="conversions"
              name="Est. Conversions"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

"use client";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-2))",
  },
  time: {
    label: "Time",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export const NodeCpuChart = ({ data }: any) => {
  if (data && data.status === 404) {
    return
  } else {
    if (data)
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg font-light">System Metrics</CardTitle>
        </CardHeader>
        <CardContent className="">
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <LineChart
              accessibilityLayer
              data={data.data}
              margin={{
                left: 12,
                right: 12,
              }}
              width={730}
              height={250}
            >
              <YAxis type="number" domain={[]} width={20} scale="linear" />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Line
                dataKey="value"
                type="monotone"
                stroke="#8884d8"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  }
};

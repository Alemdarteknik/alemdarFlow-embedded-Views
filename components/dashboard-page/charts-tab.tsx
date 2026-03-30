"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartsTabProps } from "./types";

export default function ChartsTab({ powerData }: ChartsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily Power Generation</CardTitle>
          <CardDescription>
            Real-time power output throughout the day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              power: {
                label: "Power (kW)",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-100"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={powerData}>
                <defs>
                  <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis domain={[0, 80]} className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="power"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorPower)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Efficiency Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                efficiency: {
                  label: "Efficiency %",
                  color: "hsl(140 70% 50%)",
                },
              }}
              className="h-75"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[
                    { time: "6am", efficiency: 95 },
                    { time: "9am", efficiency: 97 },
                    { time: "12pm", efficiency: 98 },
                    { time: "3pm", efficiency: 97.5 },
                    { time: "6pm", efficiency: 96 },
                  ]}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis domain={[90, 100]} className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="efficiency"
                    stroke="hsl(140 70% 50%)"
                    strokeWidth={2}
                    dot={true}
                    name="Efficiency %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Temperature Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                temperature: {
                  label: "Temperature °C",
                  color: "hsl(30 70% 50%)",
                },
              }}
              className="h-75"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { time: "6am", temperature: 18 },
                    { time: "9am", temperature: 22 },
                    { time: "12pm", temperature: 28 },
                    { time: "3pm", temperature: 30 },
                    { time: "6pm", temperature: 26 },
                  ]}
                >
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(30 70% 50%)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(30 70% 50%)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="temperature"
                    stroke="hsl(30 70% 50%)"
                    strokeWidth={2}
                    fill="url(#colorTemp)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

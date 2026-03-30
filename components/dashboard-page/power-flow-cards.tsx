"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Battery, Home, Sun, Zap } from "lucide-react";
import type { PowerFlowCardsProps } from "./types";

export default function PowerFlowCards({
  apiData,
  inverter,
  gridPower,
  batteryPower,
  isCharging,
}: PowerFlowCardsProps) {
  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="text-base">Power Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Grid */}
          <div className="p-4 rounded-lg border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-red-400 to-red-600 flex items-center justify-center shadow-md">
                <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Grid
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Voltage</span>
                <span className="font-semibold text-red-700 dark:text-red-300">
                  {apiData?.grid?.voltage !== undefined
                    ? `${apiData.grid.voltage.toFixed(1)} V`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grid Power</span>
                <span className="font-semibold text-red-700 dark:text-red-300">
                  {gridPower.toFixed(2)} kW
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frequency</span>
                <span className="font-semibold text-red-700 dark:text-red-300">
                  {apiData?.grid?.frequency !== undefined
                    ? `${apiData.grid.frequency.toFixed(1)} Hz`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Load / House */}
          <div className="p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md">
                <Home className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                Load / House
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">AC Output Voltage</span>
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  {apiData?.acOutput?.voltage !== undefined
                    ? `${apiData.acOutput.voltage.toFixed(1)} V`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Load Power</span>
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  {apiData?.acOutput?.activePower !== undefined
                    ? `${(apiData.acOutput.activePower / 1000).toFixed(2)} kW`
                    : `${inverter?.powerUsage ?? "N/A"} kW`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Output Load</span>
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  {apiData?.acOutput?.load !== undefined
                    ? `${apiData.acOutput.load.toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
          {/* PV */}
          <div className="p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center shadow-md">
                <Sun className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                PV
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">PV Total Voltage</span>
                <span className="font-semibold text-green-700 dark:text-green-300">
                  {apiData?.solar?.pv1?.voltage !== undefined &&
                  apiData?.solar?.pv2?.voltage !== undefined
                    ? `${(
                        apiData.solar.pv1.voltage + apiData.solar.pv2.voltage
                      ).toFixed(1)} V`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PV Total Power</span>
                <span className="font-semibold text-green-700 dark:text-green-300">
                  {apiData?.solar?.pv1?.power !== undefined &&
                  apiData?.solar?.pv2?.power !== undefined
                    ? `${(
                        (apiData.solar.pv1.power + apiData.solar.pv2.power) /
                        1000
                      ).toFixed(2)} kW`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Battery */}
          <div className="p-4 rounded-lg border-2 border-amber-200 dark:border-amber-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
                <Battery className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Battery
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Voltage</span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  {apiData?.battery?.voltage !== undefined
                    ? `${apiData.battery.voltage.toFixed(1)} V`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Power</span>
                <span
                  className={`font-bold ${
                    isCharging
                      ? "text-green-700 dark:text-green-500"
                      : "text-red-700 dark:text-red-500"
                  }`}
                >
                  {batteryPower} kW
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  {apiData?.battery?.capacity !== undefined
                    ? `${apiData.battery.capacity.toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

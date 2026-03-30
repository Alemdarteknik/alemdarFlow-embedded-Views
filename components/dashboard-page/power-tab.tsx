"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PowerTabProps } from "./types";

export default function PowerTab({ inverter, getStatusBadge }: PowerTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inverter ID</span>
              <span className="font-medium">{inverter.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{inverter.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="font-medium">{inverter.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Capacity</span>
              <span className="font-medium">{inverter.capacity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              {getStatusBadge(inverter.status)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Electrical Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Voltage</span>
              <span className="font-medium">{inverter.voltage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current</span>
              <span className="font-medium">{inverter.current}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frequency</span>
              <span className="font-medium">{inverter.frequency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efficiency</span>
              <span className="font-medium">{inverter.efficiency}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Energy Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Daily Energy</span>
              <span className="font-medium">{inverter.dailyEnergy} kWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Energy</span>
              <span className="font-medium">{inverter.monthlyEnergy} kWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Power</span>
              <span className="font-medium">{inverter.currentPower} kW</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="font-medium">All Systems Normal</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              No alerts or warnings detected
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

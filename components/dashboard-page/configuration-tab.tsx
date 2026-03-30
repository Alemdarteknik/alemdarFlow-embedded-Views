"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ConfigurationTabProps } from "./types";

export default function ConfigurationTab({ inverter }: ConfigurationTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inverter Configuration</CardTitle>
          <CardDescription>View and manage inverter settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">System Name</label>
              <input
                type="text"
                value="Fi-Housing Panel"
                className="w-full px-3 py-2 border rounded-md bg-background"
                readOnly
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Name</label>
              <input
                type="text"
                value={inverter.customerName}
                className="w-full px-3 py-2 border rounded-md bg-background"
                readOnly
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <input
                type="text"
                value={inverter.location}
                className="w-full px-3 py-2 border rounded-md bg-background"
                readOnly
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">System Type</label>
              <input
                type="text"
                value={inverter.type}
                className="w-full px-3 py-2 border rounded-md bg-background"
                readOnly
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-4">Notification Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Email Alerts</span>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Performance Warnings</span>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">System Updates</span>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

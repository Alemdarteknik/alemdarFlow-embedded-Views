import { NextResponse } from "next/server";
import { transformInverterData } from "@/utils/transform-inverter-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const FLASK_API_URL =
  process.env.FLASK_API_URL ||
  `http://localhost:${process.env.FLASK_API_PORT || 5000}`;

export async function GET() {
  try {
    const response = await fetch(`${FLASK_API_URL}/api/inverters/status`, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch inverter statuses from Flask API" },
        { status: response.status },
      );
    }

    const payload = await response.json();
    const inverters = Array.isArray(payload?.inverters) ? payload.inverters : [];

    const transformed = inverters.map((inverter: any) => {
      if (inverter?.data) {
        const result = transformInverterData(inverter);
        return {
          serialNumber: result.data.serialNumber,
          health: result.data.health,
          faultMetrics: {
            gridVoltage: result.data.grid?.voltage ?? null,
            solarPv1Voltage: result.data.solar?.pv1?.voltage ?? null,
            solarPv2Voltage: result.data.solar?.pv2?.voltage ?? null,
          },
          telemetryHealth: result.data.telemetryHealth ?? null,
          statusSource: inverter.status_source ?? null,
          liveTelemetryTimestamp: inverter.live_telemetry_timestamp ?? null,
          liveCheckedAt: inverter.live_checked_at ?? null,
          persistedTelemetryTimestamp:
            inverter.persisted_telemetry_timestamp ?? null,
          persistenceLagMinutes: inverter.persistence_lag_minutes ?? null,
          inverterInfo: result.data.inverterInfo,
        };
      }

      const telemetryHealth = inverter?.telemetry_health ?? null;
      const synthesizedHealth = telemetryHealth
        ? {
            state: telemetryHealth.state === "online" ? "healthy" : "offline",
            reason:
              telemetryHealth.reason ??
              (telemetryHealth.state === "online"
                ? "Telemetry is current."
                : "This inverter is not connected to the internet. No recent inverter data is available."),
            isUsable: telemetryHealth.state === "online",
            staleMinutes: telemetryHealth.stale_minutes ?? null,
            batteryFault: {
              active: false,
              reason: null,
            },
          }
        : null;

      return {
        serialNumber: inverter?.serial_number ?? null,
        health: synthesizedHealth,
        faultMetrics: {
          gridVoltage: null,
          solarPv1Voltage: null,
          solarPv2Voltage: null,
        },
        telemetryHealth,
        statusSource: inverter?.status_source ?? null,
        liveTelemetryTimestamp: inverter?.live_telemetry_timestamp ?? null,
        liveCheckedAt: inverter?.live_checked_at ?? null,
        persistedTelemetryTimestamp:
          inverter?.persisted_telemetry_timestamp ?? null,
        persistenceLagMinutes: inverter?.persistence_lag_minutes ?? null,
        inverterInfo: null,
      };
    });

    return NextResponse.json({
      success: true,
      count: transformed.length,
      inverters: transformed,
    });
  } catch (error) {
    console.error("Error fetching inverter statuses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

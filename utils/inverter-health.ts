export type InverterHealthState = "healthy" | "degraded" | "offline";

export type TelemetryFreshnessState = "online" | "offline";

export type TelemetryHealth = {
  state: TelemetryFreshnessState;
  reason: string;
  staleMinutes: number | null;
  thresholdMinutes: number;
  telemetryTimestamp: string | null;
  timezone: string | null;
};

export type BatteryFault = {
  active: boolean;
  reason: string | null;
};

export type InverterHealth = {
  state: InverterHealthState;
  reason: string;
  isUsable: boolean;
  staleMinutes: number | null;
  batteryFault: BatteryFault;
};

type NumericSection = Record<string, number | undefined> | undefined;

type BatterySection = {
  voltage?: number;
  capacity?: number;
  chargingCurrent?: number;
  dischargeCurrent?: number;
  capacityReported?: boolean;
};

export type InverterHealthInput = {
  timestamp?: string | null;
  lastUpdate?: string | null;
  telemetryHealth?: {
    state?: TelemetryFreshnessState | null;
    reason?: string | null;
    staleMinutes?: number | null;
    stale_minutes?: number | null;
    thresholdMinutes?: number | null;
    threshold_minutes?: number | null;
    telemetryTimestamp?: string | null;
    telemetry_timestamp?: string | null;
    timezone?: string | null;
  } | null;
  acOutput?: NumericSection;
  battery?: BatterySection;
  solar?: {
    pv1?: NumericSection;
    pv2?: NumericSection;
    totalPower?: number;
  };
  grid?: NumericSection;
  status?: {
    inverterFaultStatus?: string;
  };
};

const NO_BATTERY_FAULT: BatteryFault = {
  active: false,
  reason: null,
};

export const FALLBACK_TELEMETRY_STALE_THRESHOLD_MINUTES = 8;

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const watchPowerMatch =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
      normalized,
    );

  if (watchPowerMatch) {
    const [, year, month, day, hours, minutes, seconds] = watchPowerMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds ?? "0"),
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeTelemetryHealth(
  value: InverterHealthInput["telemetryHealth"],
): TelemetryHealth | null {
  if (!value) return null;

  const state = value.state;
  if (state !== "online" && state !== "offline") return null;

  const staleMinutesCandidate = value.staleMinutes ?? value.stale_minutes ?? null;
  const thresholdCandidate =
    value.thresholdMinutes ?? value.threshold_minutes ?? null;
  const telemetryTimestamp =
    value.telemetryTimestamp ?? value.telemetry_timestamp ?? null;

  return {
    state,
    reason:
      typeof value.reason === "string" && value.reason.trim()
        ? value.reason.trim()
        : state === "offline"
          ? "This inverter is not connected to the internet. No valid recent inverter data is available."
          : "Telemetry is current.",
    staleMinutes:
      typeof staleMinutesCandidate === "number" &&
      Number.isFinite(staleMinutesCandidate)
        ? staleMinutesCandidate
        : null,
    thresholdMinutes:
      typeof thresholdCandidate === "number" &&
      Number.isFinite(thresholdCandidate) &&
      thresholdCandidate > 0
        ? thresholdCandidate
        : FALLBACK_TELEMETRY_STALE_THRESHOLD_MINUTES,
    telemetryTimestamp:
      typeof telemetryTimestamp === "string" && telemetryTimestamp.trim()
        ? telemetryTimestamp.trim()
        : null,
    timezone:
      typeof value.timezone === "string" && value.timezone.trim()
        ? value.timezone.trim()
        : null,
  };
}

function hasMeaningfulNumber(value: number | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function hasFaultStatus(value: string | undefined): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) return false;

  return ![
    "0",
    "none",
    "normal",
    "no fault",
    "no faults",
    "fault status: 0",
  ].includes(normalized);
}

export function buildOfflineInverterHealth(
  reason = "This inverter is not connected to the internet. Live energy flow is paused until new data is received.",
): InverterHealth {
  return {
    state: "offline",
    reason,
    isUsable: false,
    staleMinutes: null,
    batteryFault: NO_BATTERY_FAULT,
  };
}

export function assessInverterHealth(
  payload: InverterHealthInput | null | undefined,
  now = new Date(),
): InverterHealth {
  if (!payload) {
    return buildOfflineInverterHealth(
      "This inverter is not connected to the internet. No recent inverter data is available.",
    );
  }

  const backendTelemetryHealth = normalizeTelemetryHealth(payload.telemetryHealth);
  const batteryFault =
    payload.battery?.capacityReported === true && payload.battery.capacity === 0
      ? {
          active: true,
          reason:
            "Battery fault detected. Reported battery capacity is 0%. Battery flow is paused until the battery percentage increases.",
        }
      : NO_BATTERY_FAULT;

  if (backendTelemetryHealth?.state === "offline") {
    return {
      state: "offline",
      reason: backendTelemetryHealth.reason,
      isUsable: false,
      staleMinutes: backendTelemetryHealth.staleMinutes,
      batteryFault,
    };
  }

  let staleMinutes = backendTelemetryHealth?.staleMinutes ?? null;

  if (!backendTelemetryHealth) {
    const telemetryTimestamp = parseTimestamp(payload.timestamp);
    if (!telemetryTimestamp) {
      return {
        state: "offline",
        reason:
          "This inverter is not connected to the internet. No valid recent inverter data is available.",
        isUsable: false,
        staleMinutes: null,
        batteryFault,
      };
    }

    const elapsedMs = Math.max(0, now.getTime() - telemetryTimestamp.getTime());
    staleMinutes = Math.floor(elapsedMs / 60000);

    if (elapsedMs >= FALLBACK_TELEMETRY_STALE_THRESHOLD_MINUTES * 60 * 1000) {
      return {
        state: "offline",
        reason:
          "This inverter is not connected to the internet. " +
          `No new data has been received for ${staleMinutes} minutes.`,
        isUsable: false,
        staleMinutes,
        batteryFault,
      };
    }
  }

  if (hasFaultStatus(payload.status?.inverterFaultStatus)) {
    return {
      state: "degraded",
      reason:
        "This inverter is reporting a fault. WatchPower is flagging the inverter as faulty.",
      isUsable: false,
      staleMinutes,
      batteryFault,
    };
  }

  const hasAcSignal =
    hasMeaningfulNumber(payload.acOutput?.voltage) ||
    hasMeaningfulNumber(payload.acOutput?.frequency) ||
    hasMeaningfulNumber(payload.acOutput?.activePower) ||
    hasMeaningfulNumber(payload.acOutput?.load);

  const hasGridSignal =
    hasMeaningfulNumber(payload.grid?.voltage) ||
    hasMeaningfulNumber(payload.grid?.frequency);

  const hasBatterySignal =
    hasMeaningfulNumber(payload.battery?.voltage) ||
    hasMeaningfulNumber(payload.battery?.capacity) ||
    hasMeaningfulNumber(payload.battery?.chargingCurrent) ||
    hasMeaningfulNumber(payload.battery?.dischargeCurrent);

  const hasSolarSignal =
    hasMeaningfulNumber(payload.solar?.totalPower) ||
    hasMeaningfulNumber(payload.solar?.pv1?.power) ||
    hasMeaningfulNumber(payload.solar?.pv2?.power);

  if (!hasAcSignal && !hasGridSignal && !hasBatterySignal && !hasSolarSignal) {
    return {
      state: "degraded",
      reason: "This inverter is sending incomplete data. Some metrics are missing or unusable.",
      isUsable: false,
      staleMinutes,
      batteryFault,
    };
  }

  return {
    state: "healthy",
    reason: "Telemetry is current.",
    isUsable: true,
    staleMinutes,
    batteryFault,
  };
}

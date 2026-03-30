import type { InverterHealth } from "@/utils/inverter-health";

export const SOLAR_FAULT_START_HOUR = 8;
export const SOLAR_FAULT_END_HOUR = 16;
export const SOLAR_FAULT_MIN_VOLTAGE = 90;

export type InverterBranchFaultSummary = {
  anyFault: boolean;
  inverter: {
    active: boolean;
    reason: string | null;
  };
  battery: {
    active: boolean;
    reason: string | null;
  };
  grid: {
    active: boolean;
    reason: string | null;
  };
  solar: {
    active: boolean;
    reason: string | null;
  };
};

export type InverterBranchFaultInput = {
  health: InverterHealth | null | undefined;
  gridVoltage?: number | null;
  solarPv1Voltage?: number | null;
  solarPv2Voltage?: number | null;
};

function isFinitePositiveNumber(
  value: number | null | undefined,
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isWithinSolarFaultWindow(now: Date): boolean {
  const hour = now.getHours();
  return hour >= SOLAR_FAULT_START_HOUR && hour < SOLAR_FAULT_END_HOUR;
}

export function getInverterBranchFaultSummary(
  {
    health,
    gridVoltage,
    solarPv1Voltage,
    solarPv2Voltage,
  }: InverterBranchFaultInput,
  now = new Date(),
): InverterBranchFaultSummary {
  const inverterFaultActive = health?.state === "degraded";
  const batteryFaultActive = health?.batteryFault.active === true;
  const healthIsUsable = health?.isUsable === true;

  const pvVoltages = [solarPv1Voltage, solarPv2Voltage].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  const highestPvVoltage =
    pvVoltages.length > 0 ? Math.max(...pvVoltages) : null;

  const gridFaultActive =
    healthIsUsable && !isFinitePositiveNumber(gridVoltage);
  const solarFaultActive =
    healthIsUsable &&
    isWithinSolarFaultWindow(now) &&
    (highestPvVoltage === null || highestPvVoltage < SOLAR_FAULT_MIN_VOLTAGE);

  return {
    anyFault:
      inverterFaultActive ||
      batteryFaultActive ||
      gridFaultActive ||
      solarFaultActive,
    inverter: {
      active: inverterFaultActive,
      reason: inverterFaultActive
        ? (health?.reason ?? "Inverter fault detected.")
        : null,
    },
    battery: {
      active: batteryFaultActive,
      reason: batteryFaultActive
        ? (health?.batteryFault.reason ?? "Battery fault detected.")
        : null,
    },
    grid: {
      active: gridFaultActive,
      reason: gridFaultActive
        ? "Grid fault detected. Grid voltage is unavailable or 0V."
        : null,
    },
    solar: {
      active: solarFaultActive,
      reason: solarFaultActive
        ? `Solar fault detected. Between 08:00 and 16:00, PV voltage should stay at or above ${SOLAR_FAULT_MIN_VOLTAGE}V.`
        : null,
    },
  };
}

export function isBatteryFaulty(batteryVoltage: number) {
  if (batteryVoltage === 0) {
    return true;
  }
  return false;
}

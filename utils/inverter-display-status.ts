import type { InverterHealth } from "./inverter-health";
import { hasFaultStatus } from "./inverter-health";

export type InverterDisplayStatus =
  | "online"
  | "offline"
  | "faulty"
  | "data-issue";

type InverterDisplayStatusInput = {
  health: InverterHealth;
  inverterFaultStatus?: string | null;
};

export function getInverterDisplayStatus({
  health,
  inverterFaultStatus,
}: InverterDisplayStatusInput): InverterDisplayStatus {
  if (health.state === "offline") {
    return "offline";
  }

  if (health.state === "healthy") {
    return "online";
  }

  return hasFaultStatus(inverterFaultStatus ?? undefined)
    ? "faulty"
    : "data-issue";
}

export function getInverterDisplayLabel(
  status: InverterDisplayStatus,
): string {
  if (status === "online") return "Online";
  if (status === "offline") return "Offline";
  if (status === "faulty") return "Faulty";
  return "Data issue";
}

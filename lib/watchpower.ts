import type { InverterHealth } from "@/utils/inverter-health";

export type InverterApiData = {
  serialNumber: string;
  timestamp: string | null;
  lastUpdate: string | null;
  nextPollDueAt: string | null;
  acOutput: {
    voltage: number;
    frequency: number;
    activePower: number;
    apparentPower: number;
    load: number;
  };
  battery: {
    voltage: number;
    capacity: number;
    chargingCurrent: number;
    dischargeCurrent: number;
    capacityReported: boolean;
  };
  solar: {
    pv1: {
      voltage: number;
      current: number;
      power: number;
    };
    pv2: {
      voltage: number;
      current: number;
      power: number;
    };
    totalPower: number;
    dailyEnergy: number;
  };
  grid: {
    voltage: number;
    frequency: number;
    power?: number;
    dailyEnergy?: number;
  };
  system: {
    temperature: number;
    loadOn: boolean;
    switchedOn?: boolean;
    chargingOn?: boolean;
  };
  status: {
    realtime?: boolean;
    chargerSource?: string;
    outputSource: string;
    batteryType?: string;
    inverterStatus: string;
    inverterFaultStatus: string;
  };
  inverterInfo: {
    serialNumber: string;
    wifiPN: string;
    alias?: string;
    description: string;
    customerName: string;
    systemType: string;
  };
  telemetryHealth?: unknown;
  health: InverterHealth;
  raw?: unknown;
};

export type DailyDataResponse = {
  success: boolean;
  rows: any[][];
  titles?: string[];
};

type InverterDetailResponse = {
  success?: boolean;
  data?: InverterApiData;
  error?: string;
};

type InverterListApiResponse = {
  success?: boolean;
  inverters?: Array<{
    serial_number?: string;
    alias?: string;
    description?: string;
    system_type?: string;
    location?: string;
    [key: string]: unknown;
  }>;
};

export type InverterStatusEntry = {
  serialNumber?: string | null;
  health?: InverterHealth | null;
  faultMetrics?: {
    gridVoltage?: number | null;
    solarPv1Voltage?: number | null;
    solarPv2Voltage?: number | null;
  } | null;
  telemetryHealth?: unknown;
  statusSource?: string | null;
  liveTelemetryTimestamp?: string | null;
  liveCheckedAt?: string | null;
  persistedTelemetryTimestamp?: string | null;
  persistenceLagMinutes?: number | null;
  inverterInfo?: {
    serialNumber?: string;
    [key: string]: unknown;
  } | null;
};

type InverterStatusResponse = {
  success?: boolean;
  inverters?: InverterStatusEntry[];
};

type HistoryRow = Record<string, unknown>;

type HistoryApiResponse = {
  success: boolean;
  serial_number?: string;
  count?: number;
  data?: HistoryRow[];
};

type EnergySummaryApiResponse = {
  success?: boolean;
  data?: InverterEnergySummaryData;
};

export type EnergySummaryBucket = {
  period: string;
  loadKwh: number;
  solarPvKwh: number;
  batteryChargedKwh: number;
  batteryDischargedKwh: number;
  gridUsedKwh: number;
  gridExportedKwh: number;
};

export type InverterEnergySummaryData = {
  inverterId: string;
  generatedAt: string;
  daily30d: EnergySummaryBucket[];
  monthly12m: EnergySummaryBucket[];
};

export type AggregateEnergySummaryResult = {
  summary: InverterEnergySummaryData;
  warning: string | null;
};

export const watchpowerKeys = {
  all: ["watchpower"] as const,
  inverterList: () => [...watchpowerKeys.all, "inverters"] as const,
  inverterStatus: () => [...watchpowerKeys.all, "status"] as const,
  inverter: (serialNumber: string) =>
    [...watchpowerKeys.all, "inverter", serialNumber] as const,
  inverterDaily: (serialNumber: string) =>
    [...watchpowerKeys.all, "inverter-daily", serialNumber] as const,
  inverterSummary: (serialNumber: string) =>
    [...watchpowerKeys.all, "inverter-summary", serialNumber] as const,
  inverterSummaryAggregate: (serialKey: string) =>
    [...watchpowerKeys.all, "inverter-summary-aggregate", serialKey] as const,
};

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchInverterData(
  serialNumber: string,
): Promise<InverterApiData | null> {
  if (!serialNumber) return null;

  const path =
    serialNumber === "fastify"
      ? "/api/fastify"
      : `/api/watchpower/${serialNumber}`;
  const result = await fetchJson<InverterDetailResponse>(path);

  if (result.success && result.data) {
    return result.data;
  }

  return null;
}

export async function fetchInverterDaily(
  serialNumber: string,
): Promise<DailyDataResponse | null> {
  if (!serialNumber) return null;

  const result = await fetchJson<DailyDataResponse>(
    `/api/watchpower/${serialNumber}/daily`,
  );

  if (result.success && Array.isArray(result.rows)) {
    return result;
  }

  return null;
}

export async function fetchInvertersList() {
  const result = await fetchJson<InverterListApiResponse>("/api/watchpower");
  return Array.isArray(result.inverters) ? result.inverters : [];
}

export async function fetchInverterStatuses() {
  const result =
    await fetchJson<InverterStatusResponse>("/api/watchpower/status");
  return Array.isArray(result.inverters) ? result.inverters : [];
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function firstNumberFromKeys(
  row: HistoryRow,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    if (key in row) {
      return toNumber(row[key]);
    }
  }
  return fallback;
}

function parseTimestampText(text: string): Date | null {
  const value = text.trim();
  if (!value) return null;

  const watchpowerMatch =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (watchpowerMatch) {
    const [, y, m, d, hh, mm, ss] = watchpowerMatch;
    const date = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss ?? "0"),
    );
    if (!Number.isNaN(date.getTime())) return date;
  }

  const isoDate = new Date(value);
  if (!Number.isNaN(isoDate.getTime())) return isoDate;
  return null;
}

function parseRowTimestamp(row: HistoryRow): Date | null {
  const candidates = [
    row["reading_at"],
    row["timestamp"],
    row["Data E Hora"],
    row["data_e_hora"],
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const parsed = parseTimestampText(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function isoDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function zeroBucket(period: string): EnergySummaryBucket {
  return {
    period,
    loadKwh: 0,
    solarPvKwh: 0,
    batteryChargedKwh: 0,
    batteryDischargedKwh: 0,
    gridUsedKwh: 0,
    gridExportedKwh: 0,
  };
}

function roundEnergy(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

type PowerSample = {
  timestamp: Date;
  loadW: number;
  solarW: number;
  batteryChargedW: number;
  batteryDischargedW: number;
  gridUsedW: number;
};

function parsePowerSamples(rows: HistoryRow[]): PowerSample[] {
  const points: PowerSample[] = [];

  for (const row of rows) {
    const timestamp = parseRowTimestamp(row);
    if (!timestamp) continue;

    const pv1 = firstNumberFromKeys(row, [
      "PV1 Charging Power",
      "PV1 Charging power",
      "pv1_charging_power",
      "pv_input_power",
    ]);
    const pv2 = firstNumberFromKeys(row, [
      "PV2 Charging Power",
      "PV2 Charging power",
      "pv2_charging_power",
      "pv2_Charging_Power",
    ]);
    const loadW = firstNumberFromKeys(row, [
      "AC Output Active Power",
      "ac_output_active_power",
    ]);
    const batteryVoltage = firstNumberFromKeys(row, [
      "Battery Voltage",
      "battery_voltage",
    ]);
    const batteryChargeCurrent = firstNumberFromKeys(row, [
      "Battery Charging Current",
      "battery_charging_current",
    ]);
    const batteryDischargeCurrent = firstNumberFromKeys(row, [
      "Battery Discharge Current",
      "battery_discharge_current",
    ]);

    const batteryChargedW = batteryVoltage * batteryChargeCurrent;
    const batteryDischargedW = batteryVoltage * batteryDischargeCurrent;
    const solarW = pv1 + pv2;
    const gridUsedW = Math.max(
      loadW - solarW - (batteryChargedW + batteryDischargedW),
      0,
    );

    points.push({
      timestamp,
      loadW,
      solarW,
      batteryChargedW,
      batteryDischargedW,
      gridUsedW,
    });
  }

  return points.sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );
}

function addIntervalKwh(
  target: EnergySummaryBucket,
  prev: PowerSample,
  curr: PowerSample,
  dtHours: number,
) {
  const toKwh = (prevW: number, currW: number) =>
    (((prevW + currW) / 2) * dtHours) / 1000;

  target.loadKwh += toKwh(prev.loadW, curr.loadW);
  target.solarPvKwh += toKwh(prev.solarW, curr.solarW);
  target.batteryChargedKwh += toKwh(prev.batteryChargedW, curr.batteryChargedW);
  target.batteryDischargedKwh += toKwh(
    prev.batteryDischargedW,
    curr.batteryDischargedW,
  );
  target.gridUsedKwh += toKwh(prev.gridUsedW, curr.gridUsedW);
}

function createRecentDayKeys(days: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - offset,
    );
    keys.push(isoDayKey(day));
  }
  return keys;
}

function createRecentMonthKeys(months: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    keys.push(isoMonthKey(monthDate));
  }
  return keys;
}

function finalizeBuckets(
  order: string[],
  source: Map<string, EnergySummaryBucket>,
): EnergySummaryBucket[] {
  return order.map((period) => {
    const bucket = source.get(period) ?? zeroBucket(period);
    return {
      period,
      loadKwh: roundEnergy(bucket.loadKwh),
      solarPvKwh: roundEnergy(bucket.solarPvKwh),
      batteryChargedKwh: roundEnergy(bucket.batteryChargedKwh),
      batteryDischargedKwh: roundEnergy(bucket.batteryDischargedKwh),
      gridUsedKwh: roundEnergy(bucket.gridUsedKwh),
      gridExportedKwh: 0,
    };
  });
}

function buildEnergySummary(
  inverterId: string,
  rows: HistoryRow[],
): InverterEnergySummaryData {
  const points = parsePowerSamples(rows);
  const dayMap = new Map<string, EnergySummaryBucket>();
  const monthMap = new Map<string, EnergySummaryBucket>();

  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const curr = points[index];
    const dtHours =
      (curr.timestamp.getTime() - prev.timestamp.getTime()) / 3600000;
    if (!Number.isFinite(dtHours) || dtHours <= 0) continue;

    const dayKey = isoDayKey(curr.timestamp);
    const monthKey = isoMonthKey(curr.timestamp);
    const dayBucket = dayMap.get(dayKey) ?? zeroBucket(dayKey);
    const monthBucket = monthMap.get(monthKey) ?? zeroBucket(monthKey);

    addIntervalKwh(dayBucket, prev, curr, dtHours);
    addIntervalKwh(monthBucket, prev, curr, dtHours);

    dayMap.set(dayKey, dayBucket);
    monthMap.set(monthKey, monthBucket);
  }

  return {
    inverterId,
    generatedAt: new Date().toISOString(),
    daily30d: finalizeBuckets(createRecentDayKeys(30), dayMap),
    monthly12m: finalizeBuckets(createRecentMonthKeys(12), monthMap),
  };
}

function buildSummarySignature(summary: InverterEnergySummaryData): string {
  const lastDay = summary.daily30d[summary.daily30d.length - 1];
  const lastMonth = summary.monthly12m[summary.monthly12m.length - 1];

  return [
    summary.inverterId,
    summary.daily30d.length,
    summary.monthly12m.length,
    lastDay
      ? `${lastDay.period}|${lastDay.loadKwh}|${lastDay.solarPvKwh}|${lastDay.gridUsedKwh}`
      : "none",
    lastMonth
      ? `${lastMonth.period}|${lastMonth.loadKwh}|${lastMonth.solarPvKwh}|${lastMonth.gridUsedKwh}`
      : "none",
  ].join("|");
}

function isLikelySerialNumber(value: string): boolean {
  return /^\d{8,}$/.test(value);
}

async function resolveSerialNumber(value: string): Promise<string> {
  if (!value || isLikelySerialNumber(value)) return value;

  try {
    const inverters = await fetchInvertersList();
    const match = inverters.find((inv) => {
      const alias = String(inv.alias ?? "")
        .trim()
        .toLowerCase();
      const serial = String(inv.serial_number ?? "")
        .trim()
        .toLowerCase();
      const target = value.trim().toLowerCase();
      return alias === target || serial === target;
    });

    return match?.serial_number?.trim() || value;
  } catch {
    return value;
  }
}

function mergeEnergyBucketsByPeriod(
  summaries: InverterEnergySummaryData[],
  bucketKey: "daily30d" | "monthly12m",
): EnergySummaryBucket[] {
  const merged = new Map<string, EnergySummaryBucket>();

  for (const summary of summaries) {
    for (const bucket of summary[bucketKey]) {
      const existing = merged.get(bucket.period) ?? zeroBucket(bucket.period);
      existing.loadKwh += bucket.loadKwh;
      existing.solarPvKwh += bucket.solarPvKwh;
      existing.batteryChargedKwh += bucket.batteryChargedKwh;
      existing.batteryDischargedKwh += bucket.batteryDischargedKwh;
      existing.gridUsedKwh += bucket.gridUsedKwh;
      existing.gridExportedKwh += bucket.gridExportedKwh;
      merged.set(bucket.period, existing);
    }
  }

  const periods = [...merged.keys()].sort((a, b) => a.localeCompare(b));
  return periods.map((period) => {
    const bucket = merged.get(period) ?? zeroBucket(period);
    return {
      period,
      loadKwh: roundEnergy(bucket.loadKwh),
      solarPvKwh: roundEnergy(bucket.solarPvKwh),
      batteryChargedKwh: roundEnergy(bucket.batteryChargedKwh),
      batteryDischargedKwh: roundEnergy(bucket.batteryDischargedKwh),
      gridUsedKwh: roundEnergy(bucket.gridUsedKwh),
      gridExportedKwh: roundEnergy(bucket.gridExportedKwh),
    };
  });
}

export async function fetchInverterEnergySummary(
  serialNumber: string,
): Promise<InverterEnergySummaryData | null> {
  if (!serialNumber) return null;

  const resolvedSerial = await resolveSerialNumber(serialNumber);
  const payload = await fetchJson<EnergySummaryApiResponse>(
    `/api/watchpower/${resolvedSerial}/energy-summary`,
  );
  return payload.success && payload.data ? payload.data : null;
}

export async function fetchInvertersEnergySummary(
  serialNumbers: string[],
): Promise<AggregateEnergySummaryResult | null> {
  const ids = [...new Set(serialNumbers.map((item) => item.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  if (ids.length === 0) return null;

  const settled = await Promise.allSettled(
    ids.map(async (id) => {
      const resolvedSerial = await resolveSerialNumber(id);
      const payload = await fetchJson<EnergySummaryApiResponse>(
        `/api/watchpower/${resolvedSerial}/energy-summary`,
      );
      if (!payload.success || !payload.data) {
        throw new Error(`Unable to load energy summary for ${resolvedSerial}`);
      }
      return payload.data;
    }),
  );

  const summaries = settled
    .filter(
      (
        item,
      ): item is PromiseFulfilledResult<InverterEnergySummaryData> =>
        item.status === "fulfilled",
    )
    .map((item) => item.value);

  if (summaries.length === 0) {
    throw new Error("Unable to load energy summary for selected inverters.");
  }

  const summary: InverterEnergySummaryData = {
    inverterId: "all",
    generatedAt: new Date().toISOString(),
    daily30d: mergeEnergyBucketsByPeriod(summaries, "daily30d"),
    monthly12m: mergeEnergyBucketsByPeriod(summaries, "monthly12m"),
  };

  return {
    summary,
    warning: buildAggregateSummaryWarning(ids.length, summaries.length),
  };
}

export function buildAggregateSummaryWarning(
  serialCount: number,
  summaryCount: number,
) {
  const failedCount = serialCount - summaryCount;
  if (failedCount <= 0) return null;

  return `${failedCount} inverter${failedCount > 1 ? "s" : ""} could not be included in combined totals.`;
}

export function summariesMatch(
  previous: InverterEnergySummaryData | null | undefined,
  next: InverterEnergySummaryData | null | undefined,
) {
  if (!previous || !next) return false;
  return buildSummarySignature(previous) === buildSummarySignature(next);
}

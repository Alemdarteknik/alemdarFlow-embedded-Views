"use client";

import { useRouter } from "next/navigation";
import { DaySun } from "@/components/day-sun";
import { Button } from "@/components/ui/button";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, HousePlug, Sigma } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { OverviewTab, TotalsTab } from "@/components/dashboard-page";
import type {
  ApiData,
  CurrentEnergyView,
  DailyEnergySummary,
  InverterData,
  TotalsReportContext,
} from "@/components/dashboard-page/types";
import { getInverterDisplayStatus } from "@/utils/inverter-display-status";
import {
  assessInverterHealth,
  buildOfflineInverterHealth,
  type InverterHealth,
  type InverterHealthState,
} from "@/utils/inverter-health";
import {
  buildUpdatedLabel,
  mergeChartData,
  normalizeDailyData,
} from "@/lib/dashboard-data";
import {
  fetchInverterDaily,
  fetchInverterData,
  watchpowerKeys,
} from "@/lib/watchpower";
import { useInverterStatusList } from "@/hooks/use-inverter-data";

type DashboardUserClientProps = {
  userKey: string;
  userDisplayName: string;
  inverterIds: string[];
  embed?: boolean;
};

type ViewMode = "all" | string;

const EMPTY_DAILY_ENERGY_SUMMARY: DailyEnergySummary = {
  pvEnergyKwh: 0,
  loadEnergyKwh: 0,
  gridEnergyKwh: 0,
  selfSuppliedEnergyKwh: 0,
  savingsTl: 0,
  pointCount: 0,
  usedTimestampDeltas: false,
};

function sumDailyEnergySummaries(
  summaries: DailyEnergySummary[],
): DailyEnergySummary {
  return summaries.reduce(
    (acc, summary) => ({
      pvEnergyKwh: acc.pvEnergyKwh + summary.pvEnergyKwh,
      loadEnergyKwh: acc.loadEnergyKwh + summary.loadEnergyKwh,
      gridEnergyKwh: acc.gridEnergyKwh + summary.gridEnergyKwh,
      selfSuppliedEnergyKwh:
        acc.selfSuppliedEnergyKwh + summary.selfSuppliedEnergyKwh,
      savingsTl: acc.savingsTl + summary.savingsTl,
      pointCount: Math.max(acc.pointCount, summary.pointCount),
      usedTimestampDeltas:
        acc.usedTimestampDeltas || summary.usedTimestampDeltas,
    }),
    EMPTY_DAILY_ENERGY_SUMMARY,
  );
}

function sumCurrentEnergyViews(
  views: CurrentEnergyView[],
): CurrentEnergyView | null {
  if (views.length === 0) return null;

  const latestTimestampMs = views.reduce<number | null>((latest, view) => {
    if (view.timestampMs === null) return latest;
    if (latest === null) return view.timestampMs;
    return view.timestampMs > latest ? view.timestampMs : latest;
  }, null);
  const latestView =
    views.find((view) => view.timestampMs === latestTimestampMs) ?? views[0];

  return views.reduce<CurrentEnergyView>(
    (acc, view) => ({
      timestampMs: latestTimestampMs,
      time: latestView.time,
      pvPowerKw: acc.pvPowerKw + view.pvPowerKw,
      pv1PowerKw: acc.pv1PowerKw + view.pv1PowerKw,
      pv2PowerKw: acc.pv2PowerKw + view.pv2PowerKw,
      loadPowerKw: acc.loadPowerKw + view.loadPowerKw,
      gridPowerKw: acc.gridPowerKw + view.gridPowerKw,
      batteryPowerKw: acc.batteryPowerKw + view.batteryPowerKw,
      batteryChargeKw: acc.batteryChargeKw + view.batteryChargeKw,
      batteryDischargeKw: acc.batteryDischargeKw + view.batteryDischargeKw,
      isCharging: acc.isCharging || view.isCharging,
      isDischarging: acc.isDischarging || view.isDischarging,
    }),
    {
      timestampMs: latestTimestampMs,
      time: latestView.time,
      pvPowerKw: 0,
      pv1PowerKw: 0,
      pv2PowerKw: 0,
      loadPowerKw: 0,
      gridPowerKw: 0,
      batteryPowerKw: 0,
      batteryChargeKw: 0,
      batteryDischargeKw: 0,
      isCharging: false,
      isDischarging: false,
    },
  );
}

function toInverterViewModel(
  id: string,
  apiData: ApiData | null,
  fallbackName: string,
  currentEnergyView: CurrentEnergyView | null,
  dailyEnergySummary: DailyEnergySummary,
): InverterData {
  const health = apiData?.health ?? buildOfflineInverterHealth();
  if (!apiData) {
    return {
      id,
      customerName: fallbackName,
      location: "N/A",
      capacity: "N/A",
      currentPower: 0,
      efficiency: 98,
      status: "offline",
      type: "Off-Grid",
      voltage: "0V",
      current: "0A",
      frequency: "0Hz",
      dailyEnergy: 0,
      monthlyEnergy: 0,
      totalCharging: 0,
      powerUsage: 0,
      hourUsage: 0,
      totalChargingKwh: 0,
      capacityKwh: 0,
      yieldKwh: 0,
      netBalance: { produced: 0, consumed: 0, estimate: 0, difference: 0 },
      weather: {
        temp: 0,
        condition: "N/A",
        windSpeed: "N/A",
        visibility: "N/A",
      },
      battery: { load: 0, charge: 0 },
      pv: { pv1: 0, pv2: 0, total: 0 },
      gridVoltage: "0V",
      houseVoltage: "0V",
    };
  }

  const displayStatus = getInverterDisplayStatus({
    health,
    inverterFaultStatus: apiData.status?.inverterFaultStatus,
  });

  return {
    id,
    customerName: apiData.inverterInfo.customerName || fallbackName,
    location: "N/A",
    capacity: "N/A",
    currentPower: currentEnergyView?.loadPowerKw ?? 0,
    efficiency: 98.0,
    status: displayStatus,
    inverterStatus:
      displayStatus === "faulty"
        ? "Faulty"
        : displayStatus === "data-issue"
          ? "Data issue"
          : displayStatus === "offline"
            ? "Offline"
            : apiData.status.inverterStatus || "Unknown",
    type: "Off-Grid",
    voltage: `${apiData.acOutput.voltage.toFixed(0)}V`,
    current: `${(
      ((currentEnergyView?.loadPowerKw ?? 0) * 1000) /
      (apiData.acOutput.voltage || 1)
    ).toFixed(0)}A`,
    frequency: `${apiData.acOutput.frequency.toFixed(1)}Hz`,
    dailyEnergy: dailyEnergySummary.pvEnergyKwh,
    monthlyEnergy: dailyEnergySummary.pvEnergyKwh * 30,
    totalCharging: apiData.battery.capacity,
    powerUsage: apiData.acOutput.load,
    hourUsage: currentEnergyView?.loadPowerKw ?? 0,
    totalChargingKwh: dailyEnergySummary.pvEnergyKwh,
    capacityKwh: apiData.battery.capacity,
    yieldKwh: dailyEnergySummary.pvEnergyKwh,
    netBalance: {
      produced: (currentEnergyView?.pvPowerKw ?? 0) * 1000,
      consumed: (currentEnergyView?.loadPowerKw ?? 0) * 1000,
      estimate: 0,
      difference:
        ((currentEnergyView?.pvPowerKw ?? 0) -
          (currentEnergyView?.loadPowerKw ?? 0)) *
        1000,
    },
    weather: {
      temp: apiData.system.temperature,
      condition: "N/A",
      windSpeed: "N/A",
      visibility: "N/A",
    },
    battery: {
      load: apiData.acOutput.load,
      charge: apiData.battery.capacity,
    },
    pv: {
      pv1: (currentEnergyView?.pv1PowerKw ?? 0) * 1000,
      pv2: (currentEnergyView?.pv2PowerKw ?? 0) * 1000,
      total: (currentEnergyView?.pvPowerKw ?? 0) * 1000,
    },
    gridVoltage: `${apiData.grid.voltage.toFixed(0)}V`,
    houseVoltage: `${apiData.acOutput.voltage.toFixed(0)}V`,
  };
}

function aggregateApiData(
  apiList: ApiData[],
  userDisplayName: string,
  health: InverterHealth,
): ApiData | null {
  if (apiList.length === 0) return null;

  const base = apiList[0];
  const total = apiList.reduce(
    (acc, data) => {
      acc.acVoltage += data.acOutput.voltage;
      acc.acFreq += data.acOutput.frequency;
      acc.acActive += data.acOutput.activePower;
      acc.acApparent += data.acOutput.apparentPower;
      acc.acLoad += data.acOutput.load;

      acc.gridVoltage += data.grid.voltage;
      acc.gridFreq += data.grid.frequency;

      acc.pv1Voltage += data.solar.pv1.voltage;
      acc.pv1Current += data.solar.pv1.current;
      acc.pv1Power += data.solar.pv1.power;
      acc.pv2Voltage += data.solar.pv2.voltage;
      acc.pv2Current += data.solar.pv2.current;
      acc.pv2Power += data.solar.pv2.power;
      acc.solarTotal += data.solar.totalPower;
      acc.solarDaily += data.solar.dailyEnergy;

      acc.batteryVoltage += data.battery.voltage;
      acc.batteryCapacity += data.battery.capacity;
      acc.batteryChargeCurrent += data.battery.chargingCurrent;
      acc.batteryDischargeCurrent += data.battery.dischargeCurrent;

      acc.temp += data.system.temperature;
      acc.loadOn = acc.loadOn || data.system.loadOn;

      return acc;
    },
    {
      acVoltage: 0,
      acFreq: 0,
      acActive: 0,
      acApparent: 0,
      acLoad: 0,
      gridVoltage: 0,
      gridFreq: 0,
      pv1Voltage: 0,
      pv1Current: 0,
      pv1Power: 0,
      pv2Voltage: 0,
      pv2Current: 0,
      pv2Power: 0,
      solarTotal: 0,
      solarDaily: 0,
      batteryVoltage: 0,
      batteryCapacity: 0,
      batteryChargeCurrent: 0,
      batteryDischargeCurrent: 0,
      temp: 0,
      loadOn: false,
    },
  );

  const count = apiList.length;
  const latestTimestamp = apiList.reduce<string | null>((latest, item) => {
    if (!latest) return item.timestamp;
    if (!item.timestamp) return latest;
    return new Date(item.timestamp).getTime() > new Date(latest).getTime()
      ? item.timestamp
      : latest;
  }, null);
  const latestUpdate = apiList.reduce<string | null>((latest, item) => {
    if (!latest) return item.lastUpdate;
    if (!item.lastUpdate) return latest;
    return new Date(item.lastUpdate).getTime() > new Date(latest).getTime()
      ? item.lastUpdate
      : latest;
  }, null);

  return {
    timestamp: latestTimestamp,
    lastUpdate: latestUpdate,
    nextPollDueAt: null,
    grid: {
      voltage: total.gridVoltage / count,
      frequency: total.gridFreq / count,
    },
    acOutput: {
      voltage: total.acVoltage / count,
      frequency: total.acFreq / count,
      activePower: total.acActive,
      apparentPower: total.acApparent,
      load: total.acLoad / count,
    },
    solar: {
      pv1: {
        voltage: total.pv1Voltage / count,
        current: total.pv1Current,
        power: total.pv1Power,
      },
      pv2: {
        voltage: total.pv2Voltage / count,
        current: total.pv2Current,
        power: total.pv2Power,
      },
      totalPower: total.solarTotal,
      dailyEnergy: total.solarDaily,
    },
    battery: {
      voltage: total.batteryVoltage / count,
      capacity: total.batteryCapacity / count,
      chargingCurrent: total.batteryChargeCurrent,
      dischargeCurrent: total.batteryDischargeCurrent,
      capacityReported: apiList.some((item) => item.battery.capacityReported),
    },
    system: {
      temperature: total.temp / count,
      loadOn: total.loadOn,
    },
    status: {
      outputSource: "Mixed",
      inverterStatus: "Unified",
      inverterFaultStatus: base.status.inverterFaultStatus || "0",
    },
    inverterInfo: {
      systemType: "Mixed",
      customerName: userDisplayName,
      description: `${count} inverters combined`,
      serialNumber: "UNIFIED",
      wifiPN: "N/A",
    },
    health,
  };
}

export default function DashboardUserClient({
  userKey,
  userDisplayName,
  inverterIds,
  embed = false,
}: DashboardUserClientProps) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<ViewMode>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [mainNavHeight, setMainNavHeight] = useState(0);
  const [miniNavHeight, setMiniNavHeight] = useState(0);
  const mainNavRef = useRef<HTMLElement | null>(null);
  const miniNavRef = useRef<HTMLDivElement | null>(null);

  const showNav = true;
  const isSingleInverterSystem = inverterIds.length === 1;
  const singleInverterId = isSingleInverterSystem ? inverterIds[0] : null;

  const apiQueries = useQueries({
    queries: inverterIds.map((id) => ({
      queryKey: watchpowerKeys.inverter(id),
      queryFn: () => fetchInverterData(id),
      refetchInterval: 300000,
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
    })),
  });
  const dailyQueries = useQueries({
    queries: inverterIds.map((id) => ({
      queryKey: watchpowerKeys.inverterDaily(id),
      queryFn: () => fetchInverterDaily(id),
      refetchInterval: 300000,
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
    })),
  });
  const { statuses } = useInverterStatusList();

  const apiDataById = useMemo<Record<string, ApiData | null>>(
    () =>
      Object.fromEntries(
        inverterIds.map((id, index) => [
          id,
          (apiQueries[index]?.data as ApiData | null) ?? null,
        ]),
      ),
    [apiQueries, inverterIds],
  );
  const dailySeriesById = useMemo<Record<string, any | null>>(
    () =>
      Object.fromEntries(
        inverterIds.map((id, index) => [id, dailyQueries[index]?.data ?? null]),
      ),
    [dailyQueries, inverterIds],
  );
  const normalizedDailyById = useMemo(
    () =>
      Object.fromEntries(
        inverterIds.map((id) => [id, normalizeDailyData(dailySeriesById[id])]),
      ),
    [dailySeriesById, inverterIds],
  );
  const apiQueryById = useMemo(
    () =>
      Object.fromEntries(
        inverterIds.map((id, index) => [id, apiQueries[index]]),
      ),
    [apiQueries, inverterIds],
  );
  const dailyQueryById = useMemo(
    () =>
      Object.fromEntries(
        inverterIds.map((id, index) => [id, dailyQueries[index]]),
      ),
    [dailyQueries, inverterIds],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const targetIds = selectedView === "all" ? inverterIds : [selectedView];
      await Promise.all(
        targetIds.flatMap((id) => [
          apiQueryById[id]?.refetch?.(),
          dailyQueryById[id]?.refetch?.(),
        ]),
      );
      toast.success("Data refreshed successfully");
    } catch {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  }, [apiQueryById, dailyQueryById, inverterIds, selectedView]);

  const healthByInverterId = useMemo(() => {
    const statusBySerial = Object.fromEntries(
      statuses
        .filter(
          (
            entry,
          ): entry is NonNullable<typeof entry> & { serialNumber: string } =>
            typeof entry.serialNumber === "string" &&
            entry.serialNumber.length > 0,
        )
        .map((entry) => [
          entry.serialNumber,
          entry.health ??
            buildOfflineInverterHealth(
              "This inverter is not connected to the internet. No recent inverter data is available.",
            ),
        ]),
    );

    return Object.fromEntries(
      inverterIds.map((id) => [
        id,
        statusBySerial[id] ??
          buildOfflineInverterHealth(
            "This inverter is not connected to the internet. No recent inverter data is available.",
          ),
      ]),
    );
  }, [inverterIds, statuses]);

  const inverterHealthEntries = useMemo(
    () =>
      inverterIds.map((id, index) => {
        const label = t("miniNav.inverter", { number: index + 1 });
        const apiData = apiDataById[id];
        const health =
          healthByInverterId[id] ??
          (apiData
            ? assessInverterHealth(apiData)
            : buildOfflineInverterHealth(
                `${label} is not connected to the internet. No recent inverter data is available.`,
              ));

        return {
          id,
          label,
          title: id,
          apiData,
          health,
        };
      }),
    [apiDataById, healthByInverterId, inverterIds, t],
  );

  const healthyInverterEntries = useMemo(
    () => inverterHealthEntries.filter((entry) => entry.health.isUsable),
    [inverterHealthEntries],
  );
  const unhealthyInverterEntries = useMemo(
    () => inverterHealthEntries.filter((entry) => !entry.health.isUsable),
    [inverterHealthEntries],
  );
  const aggregateHealth = useMemo(() => {
    if (unhealthyInverterEntries.length === 0) {
      return {
        state: "healthy" as const,
        reason: "All selected inverters are healthy.",
        isUsable: true,
        staleMinutes: null,
        batteryFault: { active: false, reason: null },
      };
    }

    if (healthyInverterEntries.length === 0) {
      const hasOfflineInverter = unhealthyInverterEntries.some(
        (entry) => entry.health.state === "offline",
      );

      return {
        state: hasOfflineInverter
          ? ("offline" as const)
          : ("degraded" as const),
        reason:
          "No healthy inverter telemetry is available. Total overview is paused.",
        isUsable: false,
        staleMinutes: null,
        batteryFault: { active: false, reason: null },
      };
    }

    return {
      state: "degraded" as const,
      reason: `Total overview currently excludes ${unhealthyInverterEntries
        .map((entry) => entry.label)
        .join(", ")}.`,
      isUsable: true,
      staleMinutes: null,
      batteryFault: { active: false, reason: null },
    };
  }, [healthyInverterEntries.length, unhealthyInverterEntries]);
  const aggregateOverviewNotice = useMemo(() => {
    if (unhealthyInverterEntries.length === 0) return null;
    if (healthyInverterEntries.length === 0) {
      return "No healthy inverter telemetry is available. Total overview is paused.";
    }

    return `Total overview currently reflects healthy inverter${
      healthyInverterEntries.length > 1 ? "s" : ""
    } only. Excluded: ${unhealthyInverterEntries
      .map((entry) => entry.label)
      .join(", ")}.`;
  }, [healthyInverterEntries.length, unhealthyInverterEntries]);
  const selectedHealth = useMemo(() => {
    if (selectedView === "all") {
      if (singleInverterId) {
        return (
          inverterHealthEntries.find((entry) => entry.id === singleInverterId)
            ?.health ??
          buildOfflineInverterHealth(
            "This inverter is not connected to the internet. No recent inverter data is available.",
          )
        );
      }

      return aggregateHealth;
    }

    return (
      inverterHealthEntries.find((entry) => entry.id === selectedView)
        ?.health ??
      buildOfflineInverterHealth(
        "This inverter is not connected to the internet. No recent inverter data is available.",
      )
    );
  }, [aggregateHealth, inverterHealthEntries, selectedView, singleInverterId]);
  const selectedBatteryFault = useMemo(() => {
    if (selectedView === "all") {
      if (!singleInverterId) return null;
      return (
        inverterHealthEntries.find((entry) => entry.id === singleInverterId)
          ?.health.batteryFault ?? null
      );
    }

    return (
      inverterHealthEntries.find((entry) => entry.id === selectedView)?.health
        .batteryFault ?? null
    );
  }, [inverterHealthEntries, selectedView, singleInverterId]);
  const selectedApiData = useMemo(() => {
    if (selectedView === "all") {
      if (singleInverterId) {
        return (
          inverterHealthEntries.find((entry) => entry.id === singleInverterId)
            ?.apiData ?? null
        );
      }

      const healthyApiData = healthyInverterEntries
        .map((entry) => entry.apiData)
        .filter((item): item is ApiData => Boolean(item));

      return aggregateApiData(healthyApiData, userDisplayName, aggregateHealth);
    }

    return (
      inverterHealthEntries.find((entry) => entry.id === selectedView)
        ?.apiData ?? null
    );
  }, [
    aggregateHealth,
    healthyInverterEntries,
    inverterHealthEntries,
    selectedView,
    singleInverterId,
    userDisplayName,
  ]);
  const selectedCurrentEnergyView = useMemo(() => {
    if (selectedView === "all") {
      if (singleInverterId) {
        return normalizedDailyById[singleInverterId]?.currentEnergyView ?? null;
      }

      return sumCurrentEnergyViews(
        healthyInverterEntries
          .map((entry) => normalizedDailyById[entry.id]?.currentEnergyView)
          .filter((view): view is CurrentEnergyView => Boolean(view)),
      );
    }

    return normalizedDailyById[selectedView]?.currentEnergyView ?? null;
  }, [
    healthyInverterEntries,
    normalizedDailyById,
    selectedView,
    singleInverterId,
  ]);
  const selectedDailyEnergySummary = useMemo(() => {
    if (selectedView === "all") {
      if (singleInverterId) {
        return (
          normalizedDailyById[singleInverterId]?.energySummary ??
          EMPTY_DAILY_ENERGY_SUMMARY
        );
      }

      return sumDailyEnergySummaries(
        healthyInverterEntries.map(
          (entry) =>
            normalizedDailyById[entry.id]?.energySummary ??
            EMPTY_DAILY_ENERGY_SUMMARY,
        ),
      );
    }

    return (
      normalizedDailyById[selectedView]?.energySummary ??
      EMPTY_DAILY_ENERGY_SUMMARY
    );
  }, [
    healthyInverterEntries,
    normalizedDailyById,
    selectedView,
    singleInverterId,
  ]);

  const selectedDailySeries = useMemo(() => {
    if (selectedView === "all") {
      if (singleInverterId) {
        return normalizedDailyById[singleInverterId]?.points ?? [];
      }

      const allSeries = healthyInverterEntries.map(
        (entry) => normalizedDailyById[entry.id]?.points ?? [],
      );
      return mergeChartData(allSeries);
    }
    return normalizedDailyById[selectedView]?.points ?? [];
  }, [
    healthyInverterEntries,
    normalizedDailyById,
    selectedView,
    singleInverterId,
  ]);

  const currentInverter = useMemo(() => {
    if (selectedView === "all") {
      if (singleInverterId) {
        return toInverterViewModel(
          singleInverterId,
          selectedApiData,
          userDisplayName,
          selectedCurrentEnergyView,
          selectedDailyEnergySummary,
        );
      }
      return toInverterViewModel(
        `user:${userKey}`,
        selectedApiData,
        userDisplayName,
        selectedCurrentEnergyView,
        selectedDailyEnergySummary,
      );
    }
    return toInverterViewModel(
      selectedView,
      selectedApiData,
      userDisplayName,
      selectedCurrentEnergyView,
      selectedDailyEnergySummary,
    );
  }, [
    selectedApiData,
    selectedCurrentEnergyView,
    selectedDailyEnergySummary,
    selectedView,
    singleInverterId,
    userDisplayName,
    userKey,
  ]);
  const aggregateTotalsNotice = useMemo(() => {
    if (
      selectedView !== "all" ||
      singleInverterId ||
      inverterHealthEntries.length === 0
    ) {
      return null;
    }

    const offlineEntries = inverterHealthEntries.filter(
      (entry) => entry.health.state === "offline",
    );
    if (offlineEntries.length === 0) {
      return null;
    }

    if (offlineEntries.length === inverterHealthEntries.length) {
      return "All selected inverters are currently offline. Historical totals remain available while live telemetry is paused.";
    }

    return `${offlineEntries.length} selected inverter${
      offlineEntries.length > 1 ? "s are" : " is"
    } currently offline. Combined totals continue to use available history while live telemetry is unavailable.`;
  }, [inverterHealthEntries, selectedView, singleInverterId]);
  const aggregateTotalsReportContext = useMemo<TotalsReportContext>(
    () => ({
      customerName: userDisplayName,
      description: `${inverterHealthEntries.length} inverters combined`,
      serialNumber: "UNIFIED",
      location: null,
    }),
    [inverterHealthEntries.length, userDisplayName],
  );
  const isAggregateTotalsView = selectedView === "all" && !singleInverterId;
  const selectedTotalsReportContext = useMemo<TotalsReportContext>(() => {
    if (isAggregateTotalsView) {
      return aggregateTotalsReportContext;
    }

    return {
      customerName:
        selectedApiData?.inverterInfo.customerName?.trim() || userDisplayName,
      description:
        selectedApiData?.inverterInfo.description?.trim() ||
        "Inverter totals report",
      serialNumber:
        selectedApiData?.inverterInfo.serialNumber?.trim() ||
        singleInverterId ||
        selectedView,
      location: null,
    };
  }, [
    aggregateTotalsReportContext,
    isAggregateTotalsView,
    selectedApiData,
    selectedView,
    singleInverterId,
    userDisplayName,
  ]);

  const lastUpdatedAt = useMemo(() => {
    if (selectedView === "all") {
      if (singleInverterId) {
        return Math.max(
          apiQueryById[singleInverterId]?.dataUpdatedAt ?? 0,
          dailyQueryById[singleInverterId]?.dataUpdatedAt ?? 0,
        );
      }

      return Math.max(
        0,
        ...healthyInverterEntries.flatMap((entry) => [
          apiQueryById[entry.id]?.dataUpdatedAt ?? 0,
          dailyQueryById[entry.id]?.dataUpdatedAt ?? 0,
        ]),
      );
    }

    return Math.max(
      apiQueryById[selectedView]?.dataUpdatedAt ?? 0,
      dailyQueryById[selectedView]?.dataUpdatedAt ?? 0,
    );
  }, [
    apiQueryById,
    dailyQueryById,
    healthyInverterEntries,
    selectedView,
    singleInverterId,
  ]);
  const updatedLabel = useMemo(
    () => buildUpdatedLabel(lastUpdatedAt),
    [lastUpdatedAt],
  );

  const showMiniNav = inverterIds.length > 1;
  const miniNavItems = useMemo(
    () => [
      {
        value: "all",
        label: t("miniNav.total"),
        title: aggregateOverviewNotice || "All healthy inverters",
        healthState:
          unhealthyInverterEntries.length > 0
            ? aggregateHealth.state
            : (null as InverterHealthState | null),
        batteryFaultActive: false,
      },
      ...inverterHealthEntries.map((entry) => ({
        value: entry.id,
        label: entry.label,
        title:
          entry.health.state === "healthy"
            ? entry.health.batteryFault.active
              ? `${entry.title} · ${entry.health.batteryFault.reason}`
              : entry.title
            : `${entry.title} · ${entry.health.reason}${
                entry.health.batteryFault.active &&
                entry.health.batteryFault.reason
                  ? ` · ${entry.health.batteryFault.reason}`
                  : ""
              }`,
        healthState:
          entry.health.state === "healthy"
            ? (null as InverterHealthState | null)
            : entry.health.state,
        batteryFaultActive: entry.health.batteryFault.active,
      })),
    ],
    [
      aggregateHealth.state,
      aggregateOverviewNotice,
      inverterHealthEntries,
      t,
      unhealthyInverterEntries.length,
    ],
  );
  const miniNavTop = showNav ? mainNavHeight + 8 : 8;
  const mainContentTopPadding = showMiniNav ? miniNavHeight + 16 : 0;

  useEffect(() => {
    const mainNavElement = mainNavRef.current;
    if (!mainNavElement) return;

    const syncMainNavHeight = () => {
      setMainNavHeight(mainNavElement.getBoundingClientRect().height);
    };

    syncMainNavHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncMainNavHeight)
        : null;
    resizeObserver?.observe(mainNavElement);
    window.addEventListener("resize", syncMainNavHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncMainNavHeight);
    };
  }, []);

  useEffect(() => {
    const miniNavElement = miniNavRef.current;
    if (!miniNavElement) return;

    const syncMiniNavHeight = () => {
      setMiniNavHeight(miniNavElement.getBoundingClientRect().height);
    };

    syncMiniNavHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncMiniNavHeight)
        : null;
    resizeObserver?.observe(miniNavElement);
    window.addEventListener("resize", syncMiniNavHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncMiniNavHeight);
    };
  }, [showMiniNav]);

  return (
    <div className="min-h-screen bg-muted/90 dark:bg-muted/30">
      <DaySun />
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <header
          ref={mainNavRef}
          className={`sticky top-0 z-50 w-full transition-transform duration-300 ${
            showNav ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className="mx-2 md:mx-6 pt-4">
            <div className="bg-background/85 backdrop-blur-xl border rounded-2xl shadow-lg">
              <div className="px-2 md:px-4 py-3">
                <div className="flex items-center md:gap-4">
                  {!embed ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.back()}
                      className="rounded-full shrink-0"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  ) : null}

                  <TabsList className="w-full overflow-x-auto md:flex-1 md:bg-muted/60 md:border-0 md:h-11 md:rounded-full md:px-1 md:gap-1 md:justify-start">
                    <TabsTrigger
                      value="overview"
                      className="flex-1 md:rounded-full data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                    >
                      <span className="max-md:hidden">Overview</span>
                      <span className="md:hidden">
                        <HousePlug className="h-4 w-4" />
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="totals"
                      className="flex-1 md:rounded-full data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:text-white data-[state=active]:shadow-sm"
                    >
                      <span className="max-md:hidden">Totals</span>
                      <span className="md:hidden">
                        <Sigma className="h-4 w-4" />
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <ThemeToggleButton className="rounded-full shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {showMiniNav && (
          <div
            className="fixed left-1/2 z-40 -translate-x-1/2 pointer-events-none transition-[top] duration-300"
            style={{ top: `${miniNavTop}px` }}
          >
            <div
              ref={miniNavRef}
              className="pointer-events-auto w-[min(16rem,calc(100vw-1rem))] rounded-full border border-white/35 bg-white/55 shadow-lg shadow-black/10 backdrop-blur-xl md:w-auto dark:border-white/15 dark:bg-zinc-900/45"
            >
              <div className="p-1.5">
                <div className="flex items-center justify-start gap-1 overflow-x-auto px-1 md:justify-center [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {miniNavItems.map((item) => {
                    const isActive = selectedView === item.value;
                    const statusDotClass =
                      item.healthState === "offline"
                        ? "bg-red-500"
                        : item.healthState === "degraded"
                          ? "bg-amber-500"
                          : item.batteryFaultActive
                            ? "bg-amber-500 ring-2 ring-amber-500/35 animate-pulse"
                            : "";
                    return (
                      <button
                        key={item.value}
                        type="button"
                        title={item.title}
                        onClick={() => setSelectedView(item.value)}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs md:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-white/35 hover:text-foreground dark:hover:bg-white/10"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {item.healthState || item.batteryFaultActive ? (
                            <span
                              className={`h-2 w-2 rounded-full ${statusDotClass}`}
                            />
                          ) : null}
                          <span>{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <main
          className="w-full px-4 md:px-6 pb-6"
          style={{ paddingTop: `${mainContentTopPadding}px` }}
        >
          <TabsContent value="overview" className="space-y-4 md:space-y-6 mt-0">
            <OverviewTab
              apiData={selectedApiData}
              inverter={currentInverter}
              health={selectedHealth}
              hideInverterDetails={embed}
              currentEnergyView={selectedCurrentEnergyView}
              dailyEnergySummary={selectedDailyEnergySummary}
              todayChartData={selectedDailySeries}
              lastUpdated={lastUpdatedAt ? new Date(lastUpdatedAt) : null}
              isRefreshing={isRefreshing}
              loading={false}
              theme={theme}
              onRefresh={handleRefresh}
              overviewNotice={
                selectedView === "all" && !singleInverterId
                  ? aggregateOverviewNotice
                  : null
              }
              updatedLabel={updatedLabel}
              batteryFaultActive={selectedBatteryFault?.active ?? false}
              batteryFaultReason={selectedBatteryFault?.reason ?? null}
            />
          </TabsContent>

          <TabsContent value="totals" className="space-y-6 mt-0">
            {isAggregateTotalsView ? (
              <TotalsTab
                mode="aggregate"
                inverterIds={inverterHealthEntries.map((entry) => entry.id)}
                statusNotice={aggregateTotalsNotice}
                enabled={activeTab === "totals"}
                allowPdfExport={true}
                reportContext={aggregateTotalsReportContext}
              />
            ) : (
              <TotalsTab
                inverterId={selectedView}
                inverterStatus={currentInverter.status}
                statusNotice={null}
                enabled={activeTab === "totals"}
                allowPdfExport={true}
                reportContext={selectedTotalsReportContext}
              />
            )}
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
}

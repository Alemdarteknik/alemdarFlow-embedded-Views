"use client";

import { useRouter, useParams } from "next/navigation";
// import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  X,
  Users,
  Cpu,
  Activity,
  Gauge,
  Zap,
  Filter,
} from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useInverterStatusList,
  useInvertersList,
} from "@/hooks/use-inverter-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  fetchInverterStatuses,
  type InverterStatusEntry,
  watchpowerKeys,
} from "@/lib/watchpower";
import { groupInvertersByUser } from "@/utils/user-groups";
import {
  getInverterBranchFaultSummary,
  type InverterBranchFaultSummary,
} from "@/utils/inverter-branch-faults";
import {
  buildOfflineInverterHealth,
  type InverterHealth,
} from "@/utils/inverter-health";

type InverterFormState = {
  serial_number: string;
  wifi_pn: string;
  device_code: string;
  device_address: string;
  system_type: string;
  alias: string;
  description: string;
  username: string;
  password: string;
};

type ApiInverter = {
  serial_number?: string;
  wifi_pn?: string;
  device_code?: number | string;
  device_address?: number | string;
  system_type?: string;
  alias?: string;
  description?: string;
  username?: string;
  password?: string;
};

type NormalizedSystemType =
  | "all"
  | "offgrid"
  | "ongrid"
  | "hybrid"
  | "mixed"
  | "unknown";
type RowStatus = "online" | "offline" | "faulty" | "unknown";

type GroupedSystemRow = {
  id: string;
  clientName: string;
  alias: string;
  systemType: Exclude<NormalizedSystemType, "all">;
  systemTypeLabel: string;
  inverterIds: string[];
  inverterCount: number;
  location: string;
  installDate: string;
};

type RowInverterHealthSummary = {
  id: string;
  label: string;
  health: InverterHealth | null;
  faultSummary: InverterBranchFaultSummary;
};

type RowHealthSummary = {
  status: RowStatus;
  isLoading: boolean;
  detail: string | null;
  inverters: RowInverterHealthSummary[];
  healthyCount: number;
  offlineCount: number;
  faultyCount: number;
  unknownCount: number;
};

const getDefaultSystemType = (type: string) => {
  if (type === "all") return "offgrid";
  if (type === "off-grid") return "offgrid";
  if (type === "on-grid") return "ongrid";
  if (type === "hybrid") return "hybrid";
  return "unknown";
};

const normalizeSystemType = (
  value: string | undefined | null,
): Exclude<NormalizedSystemType, "all"> => {
  const raw = (value ?? "").toLowerCase().replace(/[_\s-]/g, "");
  if (raw === "offgrid") return "offgrid";
  if (raw === "ongrid") return "ongrid";
  if (raw === "hybrid") return "hybrid";
  if (raw === "mixed") return "mixed";
  return "unknown";
};

const getSystemTypeLabel = (
  systemType: Exclude<NormalizedSystemType, "all">,
) => {
  if (systemType === "offgrid") return "Off-Grid";
  if (systemType === "ongrid") return "On-Grid";
  if (systemType === "hybrid") return "Hybrid";
  if (systemType === "mixed") return "Mixed";
  return "Unknown";
};

const getStatusBadge = (status: RowStatus) => {
  if (status === "faulty") {
    return <Badge variant="destructive">Faulty</Badge>;
  }
  if (status === "online") {
    return (
      <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600/90">
        Online
      </Badge>
    );
  }
  if (status === "offline") {
    return <Badge variant="secondary">Offline</Badge>;
  }
  return <Badge variant="outline">Unknown</Badge>;
};

const getStatusEmojiMeta = (status: RowStatus) => {
  if (status === "faulty") {
    return {
      emoji: "⚠️",
      label: "Faulty",
      className:
        "status-scale-alert text-destructive drop-shadow-[0_0_10px_rgba(220,38,38,0.25)]",
    };
  }

  if (status === "online") {
    return {
      emoji: "👍",
      label: "Online",
      className: "drop-shadow-[0_0_10px_rgba(34,197,94,0.25)]",
    };
  }

  if (status === "offline") {
    return {
      emoji: "❌",
      label: "Offline",
      className: "status-scale-alert opacity-80 grayscale-[0.1]",
    };
  }

  return {
    emoji: "❔",
    label: "Unknown",
    className: "opacity-70",
  };
};

const StatusEmoji = ({ status }: { status: RowStatus }) => {
  const { emoji, label, className } = getStatusEmojiMeta(status);

  return (
    <span
      role="img"
      aria-label={`${label} status`}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none",
        className,
      )}
    >
      <span aria-hidden="true">{emoji}</span>
    </span>
  );
};

const LoadingStatusBadge = () => (
  <Badge variant="outline" className="gap-1.5">
    <Spinner className="size-3.5" />
    Loading
  </Badge>
);

const LoadingStatusSignal = () => (
  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/35">
    <Spinner className="size-5 text-muted-foreground" />
  </span>
);

const InitialSystemsLoadOverlay = () => (
  <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6">
    <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" />
    <div className="relative w-full max-w-sm rounded-[1.75rem] border border-border/80 bg-card/88 px-8 py-7 text-center shadow-[0_18px_60px_-32px_hsl(24_18%_18%_/_0.18)]">
      <div className="flex flex-col items-center">
        <div className="mb-5 flex items-center gap-2.5">
          {["0ms", "180ms", "360ms"].map((delay, index) => (
            <span
              key={index}
              className="h-3 w-3 rounded-full bg-primary motion-safe:animate-bounce"
              style={{
                animationDelay: delay,
                animationDuration: "0.9s",
              }}
            />
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Systems
          </p>
          <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] font-semibold tracking-[-0.04em] text-foreground">
            Loading telemetry
          </h2>
          <p className="mx-auto max-w-xs text-sm leading-6 text-muted-foreground">
            Fetching inverter inventory and live system status.
          </p>
          <div className="pt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
            Please wait
          </div>
        </div>
      </div>
    </div>
  </div>
);

const getStatusLabel = (status: "all" | RowStatus) => {
  if (status === "all") return "All";
  if (status === "online") return "Online";
  if (status === "offline") return "Offline";
  if (status === "faulty") return "Faulty";
  return "Unknown";
};

const toFormNumberValue = (value: unknown) => {
  if (value === 0) return "0";
  if (value === undefined || value === null) return "";
  return String(value);
};

const joinInverterLabels = (entries: RowInverterHealthSummary[]) =>
  entries.map((entry) => entry.label).join(", ");

const buildInverterTooltip = (entry: RowInverterHealthSummary) => {
  if (!entry.health) {
    return `${entry.label} · Checking live telemetry...`;
  }

  const reasons = [
    entry.health.reason,
    entry.health.batteryFault.reason,
    entry.faultSummary.grid.reason,
    entry.faultSummary.solar.reason,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const detail =
    reasons.length > 0 ? reasons.join(" · ") : "Telemetry is current.";
  return `${entry.label} · ${detail}`;
};

const buildRowHoverSections = (rowHealth: RowHealthSummary) => {
  return rowHealth.inverters
    .map((entry) => {
      const reasons = [
        entry.health?.state === "offline" ? entry.health.reason : null,
        entry.health?.state === "degraded" ? entry.health.reason : null,
        entry.faultSummary.battery.reason,
        entry.faultSummary.grid.reason,
        entry.faultSummary.solar.reason,
      ].filter((value): value is string => Boolean(value && value.trim()));

      if (reasons.length === 0) {
        return null;
      }

      return {
        id: entry.id,
        label: entry.label,
        reasons,
      };
    })
    .filter(
      (
        value,
      ): value is {
        id: string;
        label: string;
        reasons: string[];
      } => value !== null,
    );
};

const getInverterChipClasses = (
  health: InverterHealth | null,
  faultSummary: InverterBranchFaultSummary,
) => {
  if (!health) {
    return "border-border/60 bg-muted/20 text-muted-foreground";
  }

  if (health.state === "degraded") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  if (faultSummary.anyFault) {
    return "border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-200";
  }

  if (health.state === "offline") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (health.batteryFault.active) {
    return "border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-200";
  }

  return "border-border/60 bg-muted/25 text-foreground/80";
};

const getInverterDotClasses = (
  health: InverterHealth | null,
  faultSummary: InverterBranchFaultSummary,
) => {
  if (!health) return "bg-muted-foreground/60";
  if (health.state === "degraded") return "bg-destructive";
  if (faultSummary.anyFault)
    return "bg-amber-500 ring-2 ring-amber-500/35 animate-pulse";
  if (health.state === "offline") return "bg-amber-500";
  if (health.batteryFault.active)
    return "bg-amber-500 ring-2 ring-amber-500/35 animate-pulse";
  return "bg-emerald-500/80";
};

const getRowSurfaceClasses = (status: RowStatus) => {
  if (status === "faulty") {
    return "border-destructive/30 bg-destructive/[0.04] hover:bg-destructive/[0.08]";
  }

  if (status === "offline") {
    return "border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.1]";
  }

  return "border-border bg-background/70 hover:bg-muted/40";
};

const getTableRowClasses = (status: RowStatus) => {
  if (status === "faulty") {
    return "cursor-pointer bg-destructive/[0.03] hover:bg-destructive/[0.07]";
  }

  if (status === "offline") {
    return "cursor-pointer bg-amber-500/[0.04] hover:bg-amber-500/[0.08]";
  }

  return "cursor-pointer hover:bg-muted/50";
};

const NO_BRANCH_FAULTS: InverterBranchFaultSummary = {
  anyFault: false,
  inverter: { active: false, reason: null },
  battery: { active: false, reason: null },
  grid: { active: false, reason: null },
  solar: { active: false, reason: null },
};

const STATUS_REFRESH_RETRY_DELAY_MS = 750;
const STATUS_REFRESH_MAX_ATTEMPTS = 6;
const AUTO_FORCE_POLL_ON_SYSTEMS_ALL =
  (process.env.NEXT_PUBLIC_SYSTEMS_ALL_FORCE_POLL_ON_MOUNT ?? "true") !==
  "false";

const hasAnyInverterFault = (
  faultSummary: InverterBranchFaultSummary | null | undefined,
) => faultSummary?.anyFault === true;

const delay = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const toTimestampMs = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildStatusSnapshotBySerial = (entries: InverterStatusEntry[]) =>
  new Map(
    entries
      .filter(
        (entry): entry is InverterStatusEntry & { serialNumber: string } =>
          typeof entry.serialNumber === "string" &&
          entry.serialNumber.length > 0,
      )
      .map((entry) => [
        entry.serialNumber,
        {
          liveCheckedAtMs: toTimestampMs(entry.liveCheckedAt),
          liveTelemetryTimestampMs: toTimestampMs(entry.liveTelemetryTimestamp),
          persistedTelemetryTimestampMs: toTimestampMs(
            entry.persistedTelemetryTimestamp,
          ),
        },
      ]),
  );

const isStatusEntryFresh = (
  entry: InverterStatusEntry,
  forcePollStartedAtMs: number,
  previousSnapshot: {
    liveCheckedAtMs: number | null;
    liveTelemetryTimestampMs: number | null;
    persistedTelemetryTimestampMs: number | null;
  } | null,
) => {
  const liveCheckedAtMs = toTimestampMs(entry.liveCheckedAt);
  const liveTelemetryTimestampMs = toTimestampMs(entry.liveTelemetryTimestamp);
  const persistedTelemetryTimestampMs = toTimestampMs(
    entry.persistedTelemetryTimestamp,
  );

  if (liveCheckedAtMs !== null && liveCheckedAtMs >= forcePollStartedAtMs) {
    return true;
  }

  if (
    liveTelemetryTimestampMs !== null &&
    previousSnapshot?.liveTelemetryTimestampMs !== null &&
    liveTelemetryTimestampMs > (previousSnapshot?.liveTelemetryTimestampMs || 0)
  ) {
    return true;
  }

  if (
    persistedTelemetryTimestampMs !== null &&
    previousSnapshot?.persistedTelemetryTimestampMs !== null &&
    persistedTelemetryTimestampMs >
      (previousSnapshot?.persistedTelemetryTimestampMs || 0)
  ) {
    return true;
  }

  if (
    liveTelemetryTimestampMs !== null &&
    liveTelemetryTimestampMs >= forcePollStartedAtMs
  ) {
    return true;
  }

  if (
    persistedTelemetryTimestampMs !== null &&
    persistedTelemetryTimestampMs >= forcePollStartedAtMs
  ) {
    return true;
  }

  return false;
};

const areStatusesFreshEnough = (
  entries: InverterStatusEntry[],
  forcePollStartedAtMs: number,
  previousSnapshotBySerial: Map<
    string,
    {
      liveCheckedAtMs: number | null;
      liveTelemetryTimestampMs: number | null;
      persistedTelemetryTimestampMs: number | null;
    }
  >,
) => {
  const comparableEntries = entries.filter(
    (entry): entry is InverterStatusEntry & { serialNumber: string } =>
      typeof entry.serialNumber === "string" && entry.serialNumber.length > 0,
  );

  if (comparableEntries.length === 0) {
    return false;
  }

  return comparableEntries.every((entry) =>
    isStatusEntryFresh(
      entry,
      forcePollStartedAtMs,
      previousSnapshotBySerial.get(entry.serialNumber) ?? null,
    ),
  );
};

const buildRowHealthSummary = (
  row: GroupedSystemRow,
  healthByInverterId: Record<string, InverterHealth | null>,
  faultSummaryByInverterId: Record<string, InverterBranchFaultSummary>,
  isHealthLoading: boolean,
): RowHealthSummary => {
  const inverters = row.inverterIds.map((id, index) => ({
    id,
    label: `Inverter ${index + 1}`,
    health: healthByInverterId[id] ?? null,
    faultSummary: faultSummaryByInverterId[id] ?? NO_BRANCH_FAULTS,
  }));

  const healthyEntries = inverters.filter(
    (entry) => entry.health?.state === "healthy",
  );
  const offlineEntries = inverters.filter(
    (entry) => entry.health?.state === "offline",
  );
  const degradedEntries = inverters.filter(
    (entry) => entry.health?.state === "degraded",
  );
  const batteryFaultEntries = inverters.filter(
    (entry) => entry.faultSummary.battery.active,
  );
  const gridFaultEntries = inverters.filter(
    (entry) => entry.faultSummary.grid.active,
  );
  const solarFaultEntries = inverters.filter(
    (entry) => entry.faultSummary.solar.active,
  );
  const faultyEntries = inverters.filter((entry) =>
    hasAnyInverterFault(entry.faultSummary),
  );
  const unknownEntries = inverters.filter((entry) => !entry.health);
  const isLoading = isHealthLoading && unknownEntries.length > 0;

  let status: RowStatus = "unknown";

  if (faultyEntries.length > 0) {
    status = "faulty";
  } else if (offlineEntries.length > 0) {
    status = "offline";
  } else if (
    healthyEntries.length === row.inverterCount &&
    row.inverterCount > 0
  ) {
    status = "online";
  }

  let detail: string | null = null;

  if (status === "faulty") {
    const healthyPrefix =
      healthyEntries.length > 0
        ? `Healthy inverters only: ${healthyEntries.length}/${row.inverterCount}. `
        : "";
    const offlineSuffix =
      offlineEntries.length > 0
        ? ` Offline: ${joinInverterLabels(offlineEntries)}.`
        : "";
    const faultMessages: string[] = [];

    if (degradedEntries.length > 0) {
      faultMessages.push(
        `Inverter fault on ${joinInverterLabels(degradedEntries)}.`,
      );
    }
    if (batteryFaultEntries.length > 0) {
      faultMessages.push(
        `Battery fault on ${joinInverterLabels(batteryFaultEntries)}.`,
      );
    }
    if (gridFaultEntries.length > 0) {
      faultMessages.push(
        `Grid fault on ${joinInverterLabels(gridFaultEntries)}.`,
      );
    }
    if (solarFaultEntries.length > 0) {
      faultMessages.push(
        `Solar fault on ${joinInverterLabels(solarFaultEntries)}.`,
      );
    }

    detail = `${healthyPrefix}${faultMessages.join(" ")}${offlineSuffix}`;
  } else if (status === "offline") {
    const healthyPrefix =
      healthyEntries.length > 0
        ? `Healthy inverters only: ${healthyEntries.length}/${row.inverterCount}. `
        : "";
    detail = `${healthyPrefix}Offline: ${joinInverterLabels(offlineEntries)}.`;
    if (batteryFaultEntries.length > 0) {
      detail += ` Battery fault: ${joinInverterLabels(batteryFaultEntries)}.`;
    }
  } else if (batteryFaultEntries.length > 0) {
    detail = `Battery fault on ${joinInverterLabels(batteryFaultEntries)}.`;
  } else if (unknownEntries.length > 0) {
    const healthyPrefix =
      healthyEntries.length > 0
        ? `Healthy inverters confirmed: ${healthyEntries.length}/${row.inverterCount}. `
        : "";
    detail = isHealthLoading
      ? `${healthyPrefix}Checking live telemetry...`
      : `${healthyPrefix}Live telemetry is not available yet.`;
  }

  return {
    status,
    isLoading,
    detail,
    inverters,
    healthyCount: healthyEntries.length,
    offlineCount: offlineEntries.length,
    faultyCount: faultyEntries.length,
    unknownCount: unknownEntries.length,
  };
};

function InverterHealthChips({
  inverters,
}: {
  inverters: RowInverterHealthSummary[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {inverters.map((entry) => (
        <span
          key={entry.id}
          title={buildInverterTooltip(entry)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-[box-shadow,transform]",
            getInverterChipClasses(entry.health, entry.faultSummary),
          )}
        >
          {entry.health ? (
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                getInverterDotClasses(entry.health, entry.faultSummary),
              )}
            />
          ) : (
            <Spinner className="size-3 text-muted-foreground" />
          )}
          <span>{entry.id}</span>
        </span>
      ))}
    </div>
  );
}

function RowStatusHoverCard({
  row,
  rowHealth,
  children,
}: {
  row: GroupedSystemRow;
  rowHealth: RowHealthSummary;
  children: ReactNode;
}) {
  const sections = buildRowHoverSections(rowHealth);
  const isInteractive =
    (rowHealth.status === "faulty" || rowHealth.status === "offline") &&
    sections.length > 0;
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  if (!isInteractive) {
    return <>{children}</>;
  }

  const updateCursorPosition = (event: MouseEvent<HTMLElement>) => {
    setCursorPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const clearCursorPosition = () => {
    setCursorPosition(null);
  };

  type HoverableElementProps = {
    onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
    onMouseMove?: (event: MouseEvent<HTMLElement>) => void;
    onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  };

  const child = isValidElement(children)
    ? cloneElement(children as React.ReactElement<HoverableElementProps>, {
        onMouseEnter: (event: MouseEvent<HTMLElement>) => {
          updateCursorPosition(event);
          (children.props as HoverableElementProps).onMouseEnter?.(event);
        },
        onMouseMove: (event: MouseEvent<HTMLElement>) => {
          updateCursorPosition(event);
          (children.props as HoverableElementProps).onMouseMove?.(event);
        },
        onMouseLeave: (event: MouseEvent<HTMLElement>) => {
          clearCursorPosition();
          (children.props as HoverableElementProps).onMouseLeave?.(event);
        },
      })
    : children;

  const cardWidth = 384;
  const xOffset = 18;
  const yOffset = 20;
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const left = cursorPosition
    ? Math.min(
        cursorPosition.x + xOffset,
        Math.max(16, viewportWidth - cardWidth - 16),
      )
    : 16;
  const top = cursorPosition
    ? Math.min(cursorPosition.y + yOffset, Math.max(16, viewportHeight - 280))
    : 16;

  return (
    <>
      {child}
      {cursorPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 w-[24rem] space-y-3 rounded-xl border border-border/70 bg-card/98 p-4 shadow-md"
              style={{ left, top }}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{row.clientName}</p>
                    <p className="text-xs text-muted-foreground">{row.alias}</p>
                  </div>
                  {getStatusBadge(rowHealth.status)}
                </div>
                {rowHealth.detail ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {rowHealth.detail}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className="rounded-lg border border-border/60 bg-muted/25 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/90">
                      {section.label}
                    </p>
                    <div className="mt-1 space-y-1">
                      {section.reasons.map((reason) => (
                        <p
                          key={`${section.id}-${reason}`}
                          className="text-xs leading-5 text-muted-foreground"
                        >
                          {reason}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const compareSystemIds = (left: string, right: string) => {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

function SystemListPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [systemFilter, setSystemFilter] = useState<NormalizedSystemType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | RowStatus>("all");
  const { toast } = useToast();

  const systemType = params.type as string;
  const shouldForceStartupRealtimeFetch = systemType === "all";

  const realtimeQueryOptions = useMemo(
    () =>
      shouldForceStartupRealtimeFetch
        ? {
            staleTime: 0,
            refetchOnMount: "always" as const,
          }
        : {},
    [shouldForceStartupRealtimeFetch],
  );

  const {
    inverters: apiInverters,
    loading,
    error,
    refetch: refetchInverters,
  } = useInvertersList(realtimeQueryOptions);
  const { statuses, loading: isHealthLoading } =
    useInverterStatusList(realtimeQueryOptions);
  const hasForcedStartupRealtimeRefreshRef = useRef(false);

  useEffect(() => {
    if (!shouldForceStartupRealtimeFetch) {
      return;
    }

    if (hasForcedStartupRealtimeRefreshRef.current) {
      return;
    }

    const hasCachedInverters =
      queryClient.getQueryData(watchpowerKeys.inverterList()) !== undefined;
    const hasCachedStatuses =
      queryClient.getQueryData(watchpowerKeys.inverterStatus()) !== undefined;

    if (!hasCachedInverters && !hasCachedStatuses) {
      return;
    }

    hasForcedStartupRealtimeRefreshRef.current = true;

    void queryClient.refetchQueries({
      queryKey: watchpowerKeys.inverterList(),
      type: "active",
    });
    void queryClient.refetchQueries({
      queryKey: watchpowerKeys.inverterStatus(),
      type: "active",
    });
  }, [queryClient, shouldForceStartupRealtimeFetch]);

  useEffect(() => {
    if (systemType !== "all" || !AUTO_FORCE_POLL_ON_SYSTEMS_ALL) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        const forcePollStartedAtMs = Date.now();
        const previousStatuses =
          queryClient.getQueryData<InverterStatusEntry[]>(
            watchpowerKeys.inverterStatus(),
          ) ?? [];
        const previousSnapshotBySerial =
          buildStatusSnapshotBySerial(previousStatuses);

        const response = await fetch("/api/watchpower/poll", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Systems/all force poll failed with status ${response.status}`,
          );
        }

        for (
          let attempt = 0;
          attempt < STATUS_REFRESH_MAX_ATTEMPTS;
          attempt += 1
        ) {
          if (isCancelled) {
            return;
          }

          const refreshedStatuses = await fetchInverterStatuses();

          if (isCancelled) {
            return;
          }

          queryClient.setQueryData(
            watchpowerKeys.inverterStatus(),
            refreshedStatuses,
          );

          if (
            areStatusesFreshEnough(
              refreshedStatuses,
              forcePollStartedAtMs,
              previousSnapshotBySerial,
            )
          ) {
            return;
          }

          if (attempt < STATUS_REFRESH_MAX_ATTEMPTS - 1) {
            await delay(STATUS_REFRESH_RETRY_DELAY_MS);
          }
        }

        console.warn(
          "Systems/all force poll completed, but fresh status was not confirmed before retry timeout.",
        );
      } catch (error) {
        console.error("Systems/all force poll failed:", error);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [queryClient, systemType]);

  const defaultSystemType = getDefaultSystemType(systemType);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingWebSocket, setIsTestingWebSocket] = useState(false);
  const [duplicateConfig, setDuplicateConfig] =
    useState<InverterFormState | null>(null);

  const nextIndex = apiInverters.length + 1;
  const nextAlias = `OG-${String(nextIndex).padStart(3, "0")}`;

  const buildInitialFormState = (): InverterFormState => ({
    serial_number: "",
    wifi_pn: "",
    device_code: "2449",
    device_address: String(nextIndex),
    system_type: defaultSystemType,
    alias: nextAlias,
    description: "",
    username: "",
    password: "",
  });

  const [formState, setFormState] = useState<InverterFormState>(
    buildInitialFormState(),
  );
  const defaultFormState = useMemo(
    () => buildInitialFormState(),
    [defaultSystemType, nextAlias, nextIndex],
  );

  const groupedRows = useMemo<GroupedSystemRow[]>(() => {
    const groups = groupInvertersByUser(apiInverters as ApiInverter[]);

    return groups.map((group) => {
      const distinctTypes = [
        ...new Set(group.systemTypes.map(normalizeSystemType)),
      ];
      const systemType =
        distinctTypes.length === 1 ? distinctTypes[0] : ("mixed" as const);

      return {
        id: group.groupKey,
        clientName: group.displayName,
        alias: group.alias,
        systemType,
        systemTypeLabel: getSystemTypeLabel(systemType),
        inverterIds: group.inverterIds,
        inverterCount: group.inverterIds.length,
        location: group.location,
        installDate: "N/A",
      };
    });
  }, [apiInverters]);

  const inverterSerialNumbers = useMemo(
    () =>
      Array.from(
        new Set(
          (apiInverters as ApiInverter[])
            .map((inverter) => inverter.serial_number?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [apiInverters],
  );

  const healthByInverterId = useMemo<
    Record<string, InverterHealth | null>
  >(() => {
    const shouldShowLoadingState = isHealthLoading && statuses.length === 0;
    const statusBySerial = Object.fromEntries(
      statuses
        .filter(
          (
            entry,
          ): entry is NonNullable<typeof entry> & { serialNumber: string } =>
            typeof entry.serialNumber === "string" &&
            entry.serialNumber.length > 0,
        )
        .map((entry) => [entry.serialNumber, entry.health ?? null]),
    );

    return Object.fromEntries(
      inverterSerialNumbers.map((serial) => [
        serial,
        statusBySerial[serial] ??
          (shouldShowLoadingState
            ? null
            : buildOfflineInverterHealth(
                "This inverter is not connected to the internet. No recent inverter data is available.",
              )),
      ]),
    );
  }, [inverterSerialNumbers, isHealthLoading, statuses]);

  const faultSummaryByInverterId = useMemo<
    Record<string, InverterBranchFaultSummary>
  >(() => {
    const statusBySerial = Object.fromEntries(
      statuses
        .filter(
          (
            entry,
          ): entry is NonNullable<typeof entry> & { serialNumber: string } =>
            typeof entry.serialNumber === "string" &&
            entry.serialNumber.length > 0,
        )
        .map((entry) => {
          const health =
            entry.health ??
            buildOfflineInverterHealth(
              "This inverter is not connected to the internet. No recent inverter data is available.",
            );

          return [
            entry.serialNumber,
            getInverterBranchFaultSummary({
              health,
              gridVoltage: entry.faultMetrics?.gridVoltage ?? null,
              solarPv1Voltage: entry.faultMetrics?.solarPv1Voltage ?? null,
              solarPv2Voltage: entry.faultMetrics?.solarPv2Voltage ?? null,
            }),
          ];
        }),
    );

    return Object.fromEntries(
      inverterSerialNumbers.map((serial) => [
        serial,
        statusBySerial[serial] ?? NO_BRANCH_FAULTS,
      ]),
    );
  }, [inverterSerialNumbers, statuses]);

  const rowHealthById = useMemo<Record<string, RowHealthSummary>>(
    () =>
      Object.fromEntries(
        groupedRows.map((row) => [
          row.id,
          buildRowHealthSummary(
            row,
            healthByInverterId,
            faultSummaryByInverterId,
            isHealthLoading,
          ),
        ]),
      ),
    [
      groupedRows,
      healthByInverterId,
      faultSummaryByInverterId,
      isHealthLoading,
    ],
  );

  const getOperationalStatus = (rowId: string): RowStatus => {
    return rowHealthById[rowId]?.status ?? "unknown";
  };

  const scopedRows = useMemo(() => {
    return groupedRows.filter((row) => {
      const matchesSystem =
        systemFilter === "all" || row.systemType === systemFilter;
      const rowStatus = getOperationalStatus(row.id);
      const matchesStatus =
        statusFilter === "all" || rowStatus === statusFilter;
      return matchesSystem && matchesStatus;
    });
  }, [groupedRows, systemFilter, statusFilter]);

  const filteredRows = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    const matchedRows = !query
      ? scopedRows
      : scopedRows.filter((row) => {
          return (
            row.id.toLowerCase().includes(query) ||
            row.clientName.toLowerCase().includes(query) ||
            row.alias.toLowerCase().includes(query) ||
            row.inverterIds.some((id) => id.toLowerCase().includes(query)) ||
            row.location.toLowerCase().includes(query) ||
            row.systemTypeLabel.toLowerCase().includes(query)
          );
        });

    return [...matchedRows].sort((a, b) => compareSystemIds(a.alias, b.alias));
  }, [deferredSearchQuery, scopedRows]);

  const totalClients = useMemo(() => {
    return scopedRows.length;
  }, [scopedRows]);

  const statusCounts = useMemo(
    () =>
      scopedRows.reduce(
        (acc, row) => {
          const status = rowHealthById[row.id]?.status ?? "unknown";
          if (status === "online") acc.online += 1;
          if (status === "offline") acc.offline += 1;
          if (status === "faulty") acc.faulty += 1;
          if (status === "unknown") acc.unknown += 1;
          return acc;
        },
        { online: 0, offline: 0, faulty: 0, unknown: 0 },
      ),
    [rowHealthById, scopedRows],
  );

  const onlineCount = statusCounts.online;
  const faultyCount = statusCounts.faulty;
  const offlineCount = statusCounts.offline;
  const isInitialStatusLoading =
    !loading &&
    isHealthLoading &&
    inverterSerialNumbers.length > 0 &&
    statuses.length === 0;

  const handleAddOpenChange = (open: boolean) => {
    setIsAddOpen(open);
    if (!open) return;

    setFormState(defaultFormState);
    setDuplicateConfig(null);
    setIsOverrideDialogOpen(false);
  };

  const mapConfigToForm = (config: ApiInverter): InverterFormState => ({
    serial_number: config?.serial_number ?? "",
    wifi_pn: config?.wifi_pn ?? "",
    device_code: toFormNumberValue(config?.device_code),
    device_address: toFormNumberValue(config?.device_address),
    system_type: config?.system_type ?? defaultSystemType,
    alias: config?.alias ?? "",
    description: config?.description ?? "",
    username: config?.username ?? "",
    password: config?.password ?? "",
  });

  const fetchDuplicateConfig = async (serial: string) => {
    if (!serial) return;
    const existing = (apiInverters as ApiInverter[]).find(
      (inv) => inv.serial_number === serial,
    );
    if (!existing) {
      setDuplicateConfig(null);
      return;
    }

    try {
      const response = await fetch(`/api/watchpower/${serial}/config`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setDuplicateConfig(null);
        return;
      }
      const result = await response.json();
      if (result?.success && result?.inverter) {
        const mapped = mapConfigToForm(result.inverter as ApiInverter);
        setDuplicateConfig(mapped);
        setFormState(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch duplicate config", err);
    }
  };

  const handleInputChange =
    (key: keyof InverterFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormState((prev) => ({ ...prev, [key]: value }));
      if (
        key === "serial_number" &&
        duplicateConfig &&
        value !== duplicateConfig.serial_number
      ) {
        setDuplicateConfig(null);
      }
    };

  const handleSubmit = async (override: boolean) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...formState,
        device_code: Number(formState.device_code),
        device_address: Number(formState.device_address),
        override,
      };

      const response = await fetch("/api/watchpower", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          if (result?.inverter) {
            const mapped = mapConfigToForm(result.inverter as ApiInverter);
            setDuplicateConfig(mapped);
            setFormState(mapped);
          }
          setIsOverrideDialogOpen(true);
          return;
        }

        throw new Error(result?.error || "Failed to save inverter");
      }

      toast({
        title: "Inverter saved",
        description: override
          ? "Existing inverter was overridden."
          : "Inverter added successfully.",
      });
      setIsAddOpen(false);
      setDuplicateConfig(null);
      refetchInverters();
    } catch (err) {
      toast({
        title: "Failed to save inverter",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const existing = (apiInverters as ApiInverter[]).find(
      (inv) => inv.serial_number === formState.serial_number,
    );
    if (existing) {
      if (!duplicateConfig) {
        await fetchDuplicateConfig(formState.serial_number);
      }
      setIsOverrideDialogOpen(true);
      return;
    }

    await handleSubmit(false);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSystemFilter("all");
    setStatusFilter("all");
  };

  const handleWebSocketTest = () => {
    if (typeof window === "undefined" || isTestingWebSocket) return;

    const endpoint = "ws://127.0.0.1:3000/ws";
    setIsTestingWebSocket(true);

    let settled = false;
    const ws = new WebSocket(endpoint);

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      setIsTestingWebSocket(false);
      toast({
        title: "WebSocket test failed",
        description: `Connection to ${endpoint} timed out.`,
        variant: "destructive",
      });
    }, 5000);

    ws.onopen = () => {
      if (settled) return;
      settled = true;
      // window.clearTimeout(timeout);
      // ws.close();
      // setIsTestingWebSocket(false);
      toast({
        title: "WebSocket connected",
        description: `Successfully connected to ${endpoint}.`,
      });
    };

    ws.onmessage = () => {};

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      ws.close();
      setIsTestingWebSocket(false);
      toast({
        title: "WebSocket test failed",
        description: `Unable to connect to ${endpoint}.`,
        variant: "destructive",
      });
    };
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    systemFilter !== "all" ||
    statusFilter !== "all";
  const showInitialLoadOverlay = loading || isInitialStatusLoading;

  return (
    <div
      className="min-h-screen bg-background"
      aria-busy={showInitialLoadOverlay}
    >
      {showInitialLoadOverlay ? <InitialSystemsLoadOverlay /> : null}
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold leading-none">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">
              Unified client systems overview
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              onClick={() => handleAddOpenChange(true)}
            >
              Add Inverter
            </Button>
            <ThemeToggleButton
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9"
            />
          </div>
        </div>
      </header>

      <main
        className={cn(
          "container mx-auto space-y-6 px-4 py-8 transition-[filter,opacity] duration-500 ease-out",
          showInitialLoadOverlay && "pointer-events-none blur-xs opacity-60",
        )}
      >
        <Dialog open={isAddOpen} onOpenChange={handleAddOpenChange}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Inverter</DialogTitle>
              <DialogDescription>
                Add a new inverter to the configuration. All fields are required
                unless marked optional.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    value={formState.serial_number}
                    onChange={handleInputChange("serial_number")}
                    onBlur={() => fetchDuplicateConfig(formState.serial_number)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wifi_pn">WiFi PN</Label>
                  <Input
                    id="wifi_pn"
                    value={formState.wifi_pn}
                    onChange={handleInputChange("wifi_pn")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="device_code">Device Code</Label>
                  <Input
                    id="device_code"
                    type="number"
                    value={formState.device_code}
                    onChange={handleInputChange("device_code")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="device_address">Device Address</Label>
                  <Input
                    id="device_address"
                    type="number"
                    value={formState.device_address}
                    onChange={handleInputChange("device_address")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="system_type">System Type</Label>
                  <Select
                    value={formState.system_type}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, system_type: value }))
                    }
                  >
                    <SelectTrigger id="system_type" className="w-full">
                      <SelectValue placeholder="Select system type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offgrid">Off-Grid</SelectItem>
                      <SelectItem value="ongrid">On-Grid</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alias">Alias</Label>
                  <Input
                    id="alias"
                    value={formState.alias}
                    onChange={handleInputChange("alias")}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formState.description}
                    onChange={handleInputChange("description")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formState.username}
                    onChange={handleInputChange("username")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formState.password}
                    onChange={handleInputChange("password")}
                    required
                  />
                </div>
              </div>
              {duplicateConfig && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Serial number already exists. You can override it after
                  confirmation.
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Inverter"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={isOverrideDialogOpen}
          onOpenChange={setIsOverrideDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicate Serial</AlertDialogTitle>
              <AlertDialogDescription>
                An inverter with this serial already exists. Override it with
                the current form values?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setIsOverrideDialogOpen(false);
                  handleSubmit(true);
                }}
              >
                Override
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {loading && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
            <Skeleton className="h-16 w-full" />
            <div className="rounded-lg border bg-card p-6">
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">
                Failed to load inverters
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Button onClick={refetchInverters}>Retry</Button>
              <p className="text-xs text-muted-foreground">
                Ensure the Flask backend is running and reachable.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>
            <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
              <div className="flex h-full flex-col rounded-xl border border-border bg-card/85 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Operations Overview
                    </p>
                    <p className="text-sm font-medium">
                      System performance snapshot
                    </p>
                  </div>
                  <Badge variant="outline" className="h-7 text-xs">
                    {isInitialStatusLoading
                      ? "Loading telemetry"
                      : isHealthLoading
                        ? "Syncing telemetry"
                        : scopedRows.length === 0
                          ? "0% online"
                          : `${Math.round((onlineCount / scopedRows.length) * 100)}% online`}
                  </Badge>
                </div>

                <div className="grid flex-1 auto-rows-fr content-stretch gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12">
                  <div className="flex h-full flex-col justify-between rounded-lg border border-border/60 bg-muted/25 p-3 sm:col-span-2 xl:col-span-4">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      Clients
                    </p>
                    <p className="mt-2 text-3xl font-semibold leading-none">
                      {totalClients}
                    </p>
                  </div>
                  <div className="flex h-full flex-col justify-between rounded-lg border border-border/60 bg-muted/25 p-3 xl:col-span-4">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <Cpu className="h-3.5 w-3.5" />
                      Systems
                    </p>
                    <p className="mt-2 text-3xl font-semibold leading-none">
                      {scopedRows.length}
                    </p>
                  </div>
                  <div className="flex h-full flex-col justify-between rounded-lg border border-border/60 bg-muted/25 p-3 xl:col-span-4">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      Online Inverters
                    </p>
                    <p className="mt-2 text-3xl font-semibold leading-none">
                      {onlineCount}
                    </p>
                  </div>
                  <div className="flex h-full flex-col justify-between rounded-lg border border-border/60 p-3 xl:col-span-2">
                    <p className="text-[11px] text-muted-foreground">
                      Offline Inverters
                    </p>
                    <p className="mt-1 text-2xl font-semibold leading-none">
                      {isInitialStatusLoading ? (
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Spinner className="size-4" />
                          Loading
                        </span>
                      ) : (
                        offlineCount
                      )}
                    </p>
                  </div>
                  <div className="flex h-full flex-col justify-between rounded-lg border border-border/60 p-3 xl:col-span-3">
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Gauge className="h-3.5 w-3.5" />
                      Daily Production
                    </p>
                    <p className="mt-1 text-2xl font-semibold leading-none">
                      --
                    </p>
                  </div>
                  <div className="flex h-full flex-col justify-between rounded-lg border border-border/60 p-3 xl:col-span-3">
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Zap className="h-3.5 w-3.5" />
                      Real-time Power
                    </p>
                    <p className="mt-1 text-2xl font-semibold leading-none">
                      --
                    </p>
                  </div>
                  <div className="flex h-full flex-col justify-between rounded-lg border border-border/60 p-3 xl:col-span-4">
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      Faulty Inverters
                    </p>
                    <p className="mt-1 text-2xl font-semibold leading-none">
                      {faultyCount}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/85 p-4">
                <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Filter Command
                </p>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search users, inverter IDs, or type"
                      className="pl-10 pr-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] text-muted-foreground">
                      System Type
                    </p>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                      {[
                        { label: "All", value: "all" as const },
                        { label: "Off-Grid", value: "offgrid" as const },
                        { label: "On-Grid", value: "ongrid" as const },
                        { label: "Hybrid", value: "hybrid" as const },
                        { label: "Mixed", value: "mixed" as const },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={
                            systemFilter === option.value
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          className="h-11 shrink-0 md:h-9"
                          onClick={() => setSystemFilter(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] text-muted-foreground">
                      Status
                    </p>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                      {[
                        { label: "All", value: "all" as const },
                        { label: "Online", value: "online" as const },
                        { label: "Offline", value: "offline" as const },
                        { label: "Faulty", value: "faulty" as const },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={
                            statusFilter === option.value
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          className="h-11 shrink-0 md:h-9"
                          onClick={() => setStatusFilter(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">
                      Type:{" "}
                      {systemFilter === "all"
                        ? "All"
                        : getSystemTypeLabel(systemFilter)}
                    </Badge>
                    <Badge variant="outline">
                      Status: {getStatusLabel(statusFilter)}
                    </Badge>
                    <Badge variant="outline">
                      Results: {filteredRows.length}
                    </Badge>
                    {hasActiveFilters && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-11 md:h-9"
                        onClick={clearFilters}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <Card className="rounded-xl border border-border bg-card/80 shadow-none py-0">
              <CardContent className="p-0">
                <div className="overflow-hidden rounded-xl">
                  <div className="space-y-3 p-3 md:hidden">
                    {filteredRows.length > 0 ? (
                      filteredRows.map((row) => {
                        const rowHealth = rowHealthById[row.id];

                        return (
                          <button
                            key={row.id}
                            type="button"
                            className={cn(
                              "w-full rounded-lg border p-3 text-left transition-colors",
                              getRowSurfaceClasses(rowHealth.status),
                            )}
                            onClick={() =>
                              router.push(`/dashboard/user/${row.id}`)
                            }
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <p className="text-sm font-semibold leading-none">
                                    {row.clientName}
                                  </p>
                                  <span className="text-sm">
                                    {row.location} 
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {row.inverterCount} inverter
                                  {row.inverterCount > 1 ? "s" : ""}
                                </p>
                              </div>
                              {rowHealth.isLoading ? (
                                <LoadingStatusBadge />
                              ) : (
                                getStatusBadge(rowHealth.status)
                              )}
                            </div>
                            {rowHealth.detail ? (
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                {rowHealth.detail}
                              </p>
                            ) : null}
                            <div className="mt-3 space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <Badge variant="outline">
                                  {row.systemTypeLabel}
                                </Badge>
                                <span className="text-muted-foreground">
                                  Install: {row.installDate}
                                </span>
                              </div>
                              <InverterHealthChips
                                inverters={rowHealth.inverters}
                              />
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-border bg-background/70 p-6 text-center text-sm text-muted-foreground">
                        {hasActiveFilters
                          ? "No clients match the current filters."
                          : "No inverters found. Add your first client inverter to begin."}
                      </div>
                    )}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-muted backdrop-blur-sm border-b">
                        <TableRow className="border-b border-border ">
                          <TableHead className="first:rounded-tl-xl">
                            ID
                          </TableHead>
                          <TableHead>Client </TableHead>
                          <TableHead>Inverters</TableHead>
                          <TableHead>System Type</TableHead>
                          <TableHead className="w-16 text-center">
                            Signal
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="last:rounded-tr-xl">
                            Inverter IDs
                          </TableHead>
                          {/* <TableHead className="last:rounded-tr-xl">
                            Installation Date
                          </TableHead> */}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.length > 0 ? (
                          filteredRows.map((row) => {
                            const rowHealth = rowHealthById[row.id];

                            return (
                              <RowStatusHoverCard
                                key={row.id}
                                row={row}
                                rowHealth={rowHealth}
                              >
                                <TableRow
                                  className={getTableRowClasses(
                                    rowHealth.status,
                                  )}
                                  onClick={() =>
                                    router.push(`/dashboard/user/${row.id}`)
                                  }
                                >
                                  <TableCell className="font-medium">
                                    {row.alias}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span>{row.clientName}</span>
                                      <span className="text-sm">
                                        ({row.location})
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>{row.inverterCount}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">
                                      {row.systemTypeLabel}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center align-middle">
                                    {rowHealth.isLoading ? (
                                      <LoadingStatusSignal />
                                    ) : (
                                      <StatusEmoji status={rowHealth.status} />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1.5">
                                      {rowHealth.isLoading ? (
                                        <LoadingStatusBadge />
                                      ) : (
                                        getStatusBadge(rowHealth.status)
                                      )}
                                      {rowHealth.detail ? (
                                        <p className="max-w-xs font-semibold text-xs leading-5 text-black dark:text-muted-foreground">
                                          {rowHealth.detail}
                                        </p>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    <InverterHealthChips
                                      inverters={rowHealth.inverters}
                                    />
                                  </TableCell>
                                  {/* <TableCell className="text-muted-foreground">
                                    {row.installDate}
                                  </TableCell> */}
                                </TableRow>
                              </RowStatusHoverCard>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="py-10 text-center text-muted-foreground"
                            >
                              {hasActiveFilters
                                ? "No clients match the current filters."
                                : "No inverters found. Add your first client inverter to begin."}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* <Card className="rounded-xl border border-border bg-card/80">
              <CardHeader>
                <CardTitle>Alemdar Lab Solar</CardTitle>
                <CardDescription>
                  Validate real-time socket connectivity to the default
                  endpoint.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <Button onClick={handlePushToWebSocketDashboard}>
                  {isTestingWebSocket ? "Testing..." : "Test WebSocket"}
                </Button>
              </CardContent>
            </Card> */}
          </>
        )}
      </main>
    </div>
  );
}

export default function SystemListPageWithAuth() {
  return (
    // <AuthGuard>
    <SystemListPage />
    // </AuthGuard>
  );
}

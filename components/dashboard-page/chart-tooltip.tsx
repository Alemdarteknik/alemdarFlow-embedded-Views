"use client";

import { cn } from "@/lib/utils";

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface CustomChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  unit?: string;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: string) => string;
  className?: string;
}

const defaultValueFormatter = (value: number): string => {
  return value.toFixed(2);
};

const defaultLabelFormatter = (label: string): string => {
  return label;
};

export function CustomChartTooltip({
  active,
  payload,
  label,
  unit = "kW",
  valueFormatter = defaultValueFormatter,
  labelFormatter = defaultLabelFormatter,
  className,
}: CustomChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl",
        "dark:bg-slate-900/95 dark:border-slate-700",
        className
      )}
    >
      {/* Header with time/label */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-foreground">
          {labelFormatter(label || "")}
        </span>
      </div>

      {/* Data items */}
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div
            key={`tooltip-item-${index}`}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">
                {entry.name}
              </span>
            </div>
            <span className="text-xs font-medium tabular-nums text-foreground">
              {valueFormatter(entry.value)} {unit}
            </span>
          </div>
        ))}
      </div>

      {/* Total if multiple items */}
      {payload.length > 1 && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Total
          </span>
          <span className="text-xs font-bold tabular-nums text-foreground">
            {valueFormatter(
              payload.reduce((sum, entry) => sum + entry.value, 0)
            )}{" "}
            {unit}
          </span>
        </div>
      )}
    </div>
  );
}

// Simplified tooltip for single value display
interface SimpleTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  unit?: string;
  color?: string;
}

export function SimpleChartTooltip({
  active,
  payload,
  label,
  unit = "kW",
  color,
}: SimpleTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const value = payload[0]?.value ?? 0;
  const displayColor = color || payload[0]?.color || "hsl(var(--primary))";

  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl dark:bg-slate-900/95 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: displayColor }}
        />
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <span className="text-sm font-bold tabular-nums">
            {value.toFixed(2)} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

// Power-specific tooltip with icons
interface PowerTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const powerColors: Record<string, { color: string; label: string }> = {
  pv: { color: "hsl(142 76% 36%)", label: "PV Power" },
  consumed: { color: "hsl(221 83% 53%)", label: "Load Power" },
  gridUsage: { color: "hsl(0 72% 51%)", label: "Grid Power" },
  batteryDischarge: { color: "hsl(56 100% 50%)", label: "Battery Power" },
};

export function PowerChartTooltip({
  active,
  payload,
  label,
}: PowerTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-background/95 backdrop-blur-sm p-4 shadow-2xl dark:bg-slate-900/95 dark:border-slate-700 min-w-50">
      {/* Time header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Power
        </span>
      </div>

      {/* Power values */}
      <div className="space-y-2">
        {payload.map((entry, index) => {
          const config = powerColors[entry.dataKey] || {
            color: entry.color,
            label: entry.name,
          };
          return (
            <div
              key={`power-tooltip-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full shadow-sm"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {config.label}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {entry.value.toFixed(2)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  kW
                </span>
              </span>
            </div>
          );
        })}
      </div>

     
    </div>
  );
}

export default CustomChartTooltip;

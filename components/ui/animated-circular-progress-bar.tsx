import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProgressValue {
  value: number;
  color: string;
  label?: string;
}

interface AnimatedCircularProgressBarProps {
  max?: number;
  min?: number;
  values: ProgressValue[];
  gaugeSecondaryColor?: string;
  className?: string;
  showTotal?: boolean;
  showLabels?: boolean;
  radius?: number;
  centerContent?: React.ReactNode;
}

export function AnimatedCircularProgressBar({
  max = 100,
  values = [],
  className,
  showLabels = false,
  radius = 45,
  centerContent,
}: AnimatedCircularProgressBarProps) {
  const circumference = 2 * Math.PI * radius;
  const percentPx = circumference / 100;
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => {
      setIsAnimated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Calculate total value and percentages
  const totalValue = values.reduce((sum, item) => sum + item.value, 0);

  // Calculate individual percentages based on their proportion of the total
  const gapPercent = 5; // Gap between segments in percentage
  const totalGaps = values.length * gapPercent;
  const availablePercent = 100 - totalGaps;

  const valueSegments = values.map((item) => ({
    ...item,
    percent: totalValue > 0 ? (item.value / totalValue) * availablePercent : 0,
  }));

  // Calculate cumulative angles for positioning with gaps
  let cumulativePercent = 0;
  const segments = valueSegments.map((segment) => {
    const startPercent = cumulativePercent;
    const segmentPercent = segment.percent;
    cumulativePercent += segmentPercent + gapPercent;

    // Calculate actual pixel values for stroke
    const segmentLength = (segmentPercent / 100) * circumference;
    const startOffset = -((startPercent / 100) * circumference);

    return {
      ...segment,
      percent: segmentPercent,
      startPercent,
      segmentLength,
      strokeDashoffset: startOffset,
    };
  });

  const labelMap: Record<number, string> = {
    0: "PV Power",
    1: "Grid Power",
    2: "Load Power",
  };

  const colorMap: Record<number, string> = {
    0: "#22c55e", // Green
    1: "#ef4444", // Red
    2: "#3b82f6", // Blue
  };

  return (
    <TooltipProvider>
      <div
        className={cn("relative size-40 text-2xl font-semibold", className)}
        style={
          {
            "--circle-size": "100px",
            "--circumference": circumference,
            "--percent-to-px": `${percentPx}px`,
            "--gap-percent": gapPercent,
            "--transition-length": "1s",
            "--delay": "0s",
            "--percent-to-deg": "3.6deg",
            transform: "translateZ(0)",
          } as React.CSSProperties
        }
      >
        <svg
          fill="none"
          className="size-full"
          strokeWidth="2"
          viewBox="0 0 100 100"
        >
          {/* Background circle - removed since we're filling the whole circle */}

          {/* Individual value segments */}
          {segments.map((segment, index) => {
            // Calculate the middle angle of the segment for tooltip positioning
            const midAngle =
              (segment.startPercent + segment.percent / 2) * 3.6 - 90;
            const radians = (midAngle * Math.PI) / 180;
            const tooltipX = 50 + 45 * Math.cos(radians);
            const tooltipY = 50 + 45 * Math.sin(radians);

            return (
              <g key={index}>
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  strokeWidth="10"
                  fill="none"
                  stroke={colorMap[index] || segment.color}
                  strokeDasharray={`${isAnimated ? segment.segmentLength : 0} ${
                    circumference - (isAnimated ? segment.segmentLength : 0)
                  }`}
                  strokeDashoffset={segment.strokeDashoffset}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-100 cursor-pointer hover:opacity-80 transition-opacity"
                  style={
                    {
                      transition:
                        "stroke-dasharray 1s ease var(--delay), opacity 0.2s ease",
                      transform: `rotate(-90deg)`,
                      transformOrigin: "50% 50%",
                      transitionDelay: `${index * 150}ms`,
                      pointerEvents: "stroke",
                    } as React.CSSProperties
                  }
                />
                {/* Invisible overlay for tooltip trigger */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <circle
                      cx={tooltipX}
                      cy={tooltipY}
                      r="8"
                      fill="transparent"
                      className="cursor-pointer"
                      style={{ pointerEvents: "all" }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <p className="font-semibold">
                        {labelMap[index] ||
                          segment.label ||
                          `Value ${index + 1}`}
                      </p>
                      <p className="text-muted-foreground">
                        {segment.value.toFixed(1)} kWh (
                        {segment.percent.toFixed(1)}%)
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </g>
            );
          })}
        </svg>

        {/* Center display */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center justify-center pointer-events-auto">
            {centerContent ? (
              <div className="pointer-events-auto">{centerContent}</div>
            ) : (
              <>
                {true && (
                  <div className="text-center shadow-xl bg-gray-100 dark:bg-muted-foreground/15 z-40 p-2 aspect-square rounded-full flex items-center justify-center">
                    <div className="border-2 border-muted-foreground border-dashed rounded-full p-5 aspect-square flex flex-col items-center justify-center ">
                      <div className="md:text-4xl font-normal text-black dark:text-white ">
                        {Math.min((totalValue / max) * 100, 100).toFixed(1)}%
                      </div>
                      <div className="text-xs font-normal text-black/70 dark:text-white/70">
                        <span className="max-md:hidden">
                          Inverter Power Used <br /> Today
                        </span>
                        <span className="md:hidden">kWh/day</span>
                      </div>
                    </div>
                  </div>
                )}
                {showLabels && (
                  <div className="text-xs space-y-1 mt-2 text-center">
                    {values.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 justify-center"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: colorMap[index] || item.color,
                          }}
                        />
                        <span className="text-foreground">
                          {labelMap[index] ||
                            item.label ||
                            `Value ${index + 1}`}
                          : {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

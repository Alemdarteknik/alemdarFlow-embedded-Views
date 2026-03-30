"use client";

import { useMemo, useRef, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import { Download, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useInverterEnergySummary,
  useInvertersEnergySummary,
  type EnergySummaryBucket,
} from "@/hooks/use-inverter-data";
import type { TotalsTabProps } from "./types";

type ChartRow = {
  period: string;
  label: string;
  loadKwh: number;
  solarPvKwh: number;
  gridUsedKwh: number;
};

type ReportSummaryItem = {
  label: string;
  value: string;
};

const SERIES_COLORS = {
  load: "hsl(216 92% 54%)",
  solar: "hsl(142 72% 38%)",
  grid: "hsl(0 78% 52%)",
} as const;

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "2-digit",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const kwhFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const OFFLINE_TOTALS_COPY = {
  title: "Inverter offline",
  description:
    "Historical totals are still available. Live telemetry updates are paused until the inverter reconnects.",
  descriptionTr:
    "Inverter cevrimdisi. Gecmis toplam veriler kullanilabilir; inverter yeniden baglanana kadar canli telemetri guncellemeleri duraklatildi.",
} as const;

const AGGREGATE_TOTALS_NOTICE_TITLE = "Live telemetry unavailable";

function parseDayKey(period: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = period.split("-");
  const year = Number.parseInt(yearRaw || "", 10);
  const month = Number.parseInt(monthRaw || "", 10);
  const day = Number.parseInt(dayRaw || "", 10);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function parseMonthKey(period: string): Date | null {
  const [yearRaw, monthRaw] = period.split("-");
  const year = Number.parseInt(yearRaw || "", 10);
  const month = Number.parseInt(monthRaw || "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function toDayLabel(period: string): string {
  const date = parseDayKey(period);
  return date ? dayFormatter.format(date) : period;
}

function toMonthLabel(period: string): string {
  const date = parseMonthKey(period);
  return date ? monthFormatter.format(date) : period;
}

function buildChartRows(
  rows: EnergySummaryBucket[],
  labelFormatter: (period: string) => string,
): ChartRow[] {
  return rows.map((row) => ({
    period: row.period,
    label: labelFormatter(row.period),
    loadKwh: row.loadKwh,
    solarPvKwh: row.solarPvKwh,
    gridUsedKwh: row.gridUsedKwh,
  }));
}

function sortSummaryRows(rows: EnergySummaryBucket[]) {
  return [...rows].sort((a, b) => b.period.localeCompare(a.period));
}

function formatKwhValue(value: number): string {
  return `${kwhFormatter.format(value)} kWh`;
}

function sumMetric(
  rows: EnergySummaryBucket[],
  selector: (row: EnergySummaryBucket) => number,
): number {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function buildSummaryItems(
  label: string,
  rows: EnergySummaryBucket[],
): ReportSummaryItem[] {
  return [
    {
      label: `${label} Load Consumption`,
      value: formatKwhValue(sumMetric(rows, (row) => row.loadKwh)),
    },
    {
      label: `${label} Solar PV Production`,
      value: formatKwhValue(sumMetric(rows, (row) => row.solarPvKwh)),
    },
    {
      label: `${label} Grid Used`,
      value: formatKwhValue(sumMetric(rows, (row) => row.gridUsedKwh)),
    },
    {
      label: `${label} Battery Charged`,
      value: formatKwhValue(sumMetric(rows, (row) => row.batteryChargedKwh)),
    },
    {
      label: `${label} Battery Discharged`,
      value: formatKwhValue(sumMetric(rows, (row) => row.batteryDischargedKwh)),
    },
  ];
}

function buildTableBody(
  rows: EnergySummaryBucket[],
  labelFormatter: (period: string) => string,
): string[][] {
  return sortSummaryRows(rows).map((row) => [
    labelFormatter(row.period),
    formatKwhValue(row.loadKwh),
    formatKwhValue(row.solarPvKwh),
    formatKwhValue(row.gridUsedKwh),
    formatKwhValue(row.batteryChargedKwh),
    formatKwhValue(row.batteryDischargedKwh),
  ]);
}

function createFilename(serialNumber: string) {
  const safeSerial = serialNumber
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const isoDate = new Date().toISOString().slice(0, 10);

  return `alemdar-teknik-totals-${safeSerial || "report"}-${isoDate}.pdf`;
}

async function loadImageAsset(
  src: string,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const response = await fetch(src, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load image asset: ${src}`);
  }

  const blob = await response.blob();

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Unable to read image asset: ${src}`));
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Unable to read image asset: ${src}`));
    reader.readAsDataURL(blob);
  });

  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        resolve({
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
        });
      image.onerror = () =>
        reject(new Error(`Unable to measure image asset: ${src}`));
      image.src = dataUrl;
    },
  );

  return {
    dataUrl,
    width: dimensions.width,
    height: dimensions.height,
  };
}

export default function TotalsTab(props: TotalsTabProps) {
  console.log("TotalsTab props", props);
  const isAggregate = props.mode === "aggregate";
  const isEnabled = props.enabled ?? true;
  const singleInverterId = props.mode === "aggregate" ? "" : props.inverterId;
  const aggregateInverterIds =
    props.mode === "aggregate" ? props.inverterIds : [];
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const dailyChartCardRef = useRef<HTMLDivElement | null>(null);
  const monthlyChartCardRef = useRef<HTMLDivElement | null>(null);

  const singleSummary = useInverterEnergySummary({
    serialNumber: singleInverterId,
    pollingInterval: 300000,
    enabled: isEnabled && !isAggregate && Boolean(singleInverterId),
  });
  const aggregateSummary = useInvertersEnergySummary({
    serialNumbers: aggregateInverterIds,
    pollingInterval: 300000,
    enabled: isEnabled && isAggregate && aggregateInverterIds.length > 0,
  });
  const surfaceCard =
    "border border-border/70 bg-card/95 shadow-[0_1px_0_hsl(var(--background))_inset,0_12px_30px_-24px_hsl(var(--foreground)/0.45)]";

  const summaryResult = isAggregate ? aggregateSummary : singleSummary;
  const { data, loading, error } = summaryResult;
  const warning: string | null = isAggregate ? aggregateSummary.warning : null;

  if (isAggregate && aggregateInverterIds.length === 0) {
    return (
      <Card className={surfaceCard}>
        <CardContent className="py-10 text-sm text-muted-foreground">
          No inverter totals are available right now.
        </CardContent>
      </Card>
    );
  }

  const dailyRows = data?.daily30d ?? [];
  const monthlyRows = data?.monthly12m ?? [];

  const dailyChartRows = useMemo(
    () => buildChartRows(dailyRows, toDayLabel),
    [dailyRows],
  );
  const monthlyChartRows = useMemo(
    () => buildChartRows(monthlyRows, toMonthLabel),
    [monthlyRows],
  );
  const showPdfExport =
    !isAggregate &&
    Boolean(props.allowPdfExport) &&
    Boolean(props.reportContext);
  console.log(
    "showPdfExport",
    showPdfExport,
    props.allowPdfExport,
    props.reportContext,
  );
  const canExportPdf =
    showPdfExport &&
    Boolean(props.reportContext) &&
    !loading &&
    !error &&
    (dailyRows.length > 0 || monthlyRows.length > 0);
  const statusNotice = props.statusNotice?.trim() || null;
  const showOfflineBanner =
    !isAggregate &&
    "inverterStatus" in props &&
    props.inverterStatus === "offline";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className={surfaceCard}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full rounded-xl" />
            </CardContent>
          </Card>
          <Card className={surfaceCard}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full rounded-xl" />
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className={surfaceCard}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-68" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full rounded-xl" />
            </CardContent>
          </Card>
          <Card className={surfaceCard}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-68" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full rounded-xl" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={surfaceCard}>
        <CardContent className="py-10 text-sm text-destructive">
          Unable to load energy summary.
        </CardContent>
      </Card>
    );
  }

  const renderTable = (
    rows: EnergySummaryBucket[],
    dateFormatter: (period: string) => string,
  ) => {
    const sortedRows = sortSummaryRows(rows);

    return (
      <div className="h-96 w-full overflow-auto">
        <div className="min-w-230">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Load</TableHead>
                <TableHead>Solar PV</TableHead>
                <TableHead>Grid Used</TableHead>
                <TableHead>Battery Charged</TableHead>
                <TableHead>Battery Discharged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={row.period}>
                  <TableCell className="font-medium">
                    {dateFormatter(row.period)}
                  </TableCell>
                  <TableCell>{formatKwhValue(row.loadKwh)}</TableCell>
                  <TableCell>{formatKwhValue(row.solarPvKwh)}</TableCell>
                  <TableCell>{formatKwhValue(row.gridUsedKwh)}</TableCell>
                  <TableCell>{formatKwhValue(row.batteryChargedKwh)}</TableCell>
                  <TableCell>
                    {formatKwhValue(row.batteryDischargedKwh)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderChart = (rows: ChartRow[]) => (
    <ChartContainer
      className="h-96 w-full"
      config={{
        load: {
          label: "Load",
          color: SERIES_COLORS.load,
        },
        solar: {
          label: "Solar PV",
          color: SERIES_COLORS.solar,
        },
        grid: {
          label: "Grid Used",
          color: SERIES_COLORS.grid,
        },
      }}
    >
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" />
        <Legend
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          wrapperStyle={{ paddingTop: 32 }}
        />
        <XAxis
          dataKey="label"
          minTickGap={0}
          interval={0}
          height={62}
          angle={-45}
          textAnchor="end"
          tickMargin={12}
          tick={{ fill: "currentColor", fontSize: 11 }}
        />
        <YAxis
          tick={{ fill: "currentColor", fontSize: 11 }}
          width={64}
          tickFormatter={(value) => kwhFormatter.format(Number(value))}
          label={{
            value: "kWh",
            angle: -90,
            position: "insideLeft",
            style: { fill: "currentColor" },
          }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span>{name}</span>
                  <span className="font-medium">
                    {formatKwhValue(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="loadKwh"
          name="Load"
          stroke={SERIES_COLORS.load}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="solarPvKwh"
          name="Solar PV"
          stroke={SERIES_COLORS.solar}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="gridUsedKwh"
          name="Grid Used"
          stroke={SERIES_COLORS.grid}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );

  const handleExportPdf = async () => {
    const letterhead = "/letterhead.png";
    if (!canExportPdf || !props.reportContext) return;

    const dailyChartNode = dailyChartCardRef.current;
    const monthlyChartNode = monthlyChartCardRef.current;

    if (!dailyChartNode || !monthlyChartNode) {
      toast.error("Unable to prepare the totals report.");
      return;
    }

    setIsExportingPdf(true);

    try {
      const [{ jsPDF }, { default: autoTable }, htmlToImage] =
        await Promise.all([
          import("jspdf"),
          import("jspdf-autotable"),
          import("html-to-image"),
        ]);

      const chartBackgroundColor =
        getComputedStyle(dailyChartNode).backgroundColor || "#ffffff";
      const chartOptions = {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: chartBackgroundColor,
      };

      const [dailyChartImage, monthlyChartImage, letterheadImage] =
        await Promise.all([
        htmlToImage.toPng(dailyChartNode, chartOptions),
        htmlToImage.toPng(monthlyChartNode, chartOptions),
        loadImageAsset(letterhead),
      ]);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      const letterheadHeight = Math.min(
        (pageWidth * letterheadImage.height) / letterheadImage.width,
        150,
      );
      const topContentStart = letterheadHeight + 24;
      let cursorY = topContentStart;

      const applyLetterhead = () => {
        pdf.addImage(
          letterheadImage.dataUrl,
          "PNG",
          0,
          0,
          pageWidth,
          letterheadHeight,
        );
      };

      applyLetterhead();

      const ensureSpace = (height: number) => {
        if (cursorY + height <= pageHeight - margin) return;
        pdf.addPage();
        applyLetterhead();
        cursorY = topContentStart;
      };

      const startNewPage = () => {
        pdf.addPage();
        applyLetterhead();
        cursorY = topContentStart;
      };

      const addLabelValueRow = (label: string, value: string) => {
        pdf.setFont("helvetica", "bold");
        pdf.text(label, margin, cursorY);
        pdf.setFont("helvetica", "normal");
        const wrappedValue = pdf.splitTextToSize(value, contentWidth - 120);
        pdf.text(wrappedValue, margin + 120, cursorY);
        cursorY += Math.max(18, wrappedValue.length * 14);
      };

      const addChartImage = (
        title: string,
        imageData: string,
        sourceWidth: number,
        sourceHeight: number,
      ) => {
        ensureSpace(36);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(title, margin, cursorY);
        cursorY += 16;

        const aspectRatio = sourceHeight / sourceWidth;
        const imageWidth = contentWidth;
        const imageHeight = imageWidth * aspectRatio;

        ensureSpace(imageHeight + 12);
        pdf.addImage(
          imageData,
          "PNG",
          margin,
          cursorY,
          imageWidth,
          imageHeight,
        );
        cursorY += imageHeight + 18;
      };

      const renderSummarySection = (
        title: string,
        items: ReportSummaryItem[],
      ) => {
        ensureSpace(36);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(title, margin, cursorY);
        cursorY += 20;

        items.forEach((item, index) => {
          if (index % 2 === 0) {
            ensureSpace(summaryBoxHeight + 12);
          }

          const column = index % 2;
          const row = Math.floor(index / 2);
          const boxX = margin + column * (summaryBoxWidth + 12);
          const baseY = cursorY + row * (summaryBoxHeight + 12);

          pdf.setFillColor(248, 250, 252);
          pdf.roundedRect(
            boxX,
            baseY,
            summaryBoxWidth,
            summaryBoxHeight,
            8,
            8,
            "F",
          );
          pdf.setTextColor(71, 85, 105);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text(item.label, boxX + 12, baseY + 16);
          pdf.setTextColor(15, 23, 42);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(12);
          pdf.text(item.value, boxX + 12, baseY + 32);
        });

        cursorY += Math.ceil(items.length / 2) * (summaryBoxHeight + 12) + 12;
      };

      const reportGeneratedAt = timestampFormatter.format(new Date());
      const dailySummaryItems = buildSummaryItems("Last 30 Days", dailyRows);
      const monthlySummaryItems = buildSummaryItems(
        "Last 12 Months",
        monthlyRows,
      );
      const reportContext = props.reportContext;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(14);
      pdf.text("Solar Energy Report", margin, cursorY);
      cursorY += 28;

      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 22;

      pdf.setFontSize(11);
      addLabelValueRow("Client", reportContext.customerName);
      addLabelValueRow("Details", reportContext.description);
      addLabelValueRow("Serial Number", reportContext.serialNumber);
      if (reportContext.location) {
        addLabelValueRow("Location", reportContext.location);
      }
      addLabelValueRow("Generated", reportGeneratedAt);
      cursorY += 10;

      const summaryBoxWidth = (contentWidth - 12) / 2;
      const summaryBoxHeight = 44;

      renderSummarySection("Last 30 Days Summary", dailySummaryItems);

      addChartImage(
        "Last 30 Days Chart",
        dailyChartImage,
        dailyChartNode.offsetWidth,
        dailyChartNode.offsetHeight,
      );

      startNewPage();

      autoTable(pdf, {
        startY: cursorY,
        margin: { left: margin, right: margin, top: topContentStart },
        head: [
          [
            "Date",
            "Load",
            "Solar PV",
            "Grid Used",
            "Battery Charged",
            "Battery Discharged",
          ],
        ],
        body: buildTableBody(dailyRows, toDayLabel),
        theme: "grid",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
        },
        styles: {
          fontSize: 9,
          cellPadding: 6,
          overflow: "linebreak",
        },
        didDrawPage: (hookData) => {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          pdf.text(
            "Last 30 Days Table",
            margin,
            topContentStart - 12,
          );
        },
      });

      const pdfWithTables = pdf as typeof pdf & {
        lastAutoTable?: { finalY: number };
      };
      cursorY = pdfWithTables.lastAutoTable?.finalY
        ? pdfWithTables.lastAutoTable.finalY + 24
        : cursorY + 24;

      startNewPage();

      renderSummarySection("Last 12 Months Summary", monthlySummaryItems);

      addChartImage(
        "Last 12 Months Chart",
        monthlyChartImage,
        monthlyChartNode.offsetWidth,
        monthlyChartNode.offsetHeight,
      );

      startNewPage();

      autoTable(pdf, {
        startY: cursorY,
        margin: { left: margin, right: margin, top: topContentStart },
        head: [
          [
            "Date",
            "Load",
            "Solar PV",
            "Grid Used",
            "Battery Charged",
            "Battery Discharged",
          ],
        ],
        body: buildTableBody(monthlyRows, toMonthLabel),
        theme: "grid",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
        },
        styles: {
          fontSize: 9,
          cellPadding: 6,
          overflow: "linebreak",
        },
        didDrawPage: (hookData) => {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          pdf.text(
            "Last 12 Months Table",
            margin,
            topContentStart - 12,
          );
        },
      });

      pdf.save(createFilename(reportContext.serialNumber));
      toast.success("Totals PDF exported.");
    } catch (exportError) {
      console.error(exportError);
      toast.error("Failed to generate the totals PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      {showPdfExport ? (
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Preparing totals data for export."
              : error
                ? "Export unavailable while totals failed to load."
                : dailyRows.length === 0 && monthlyRows.length === 0
                  ? "Export becomes available once totals data is loaded."
                  : "Download a PDF report with charts, summary, and tables."}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportPdf}
            disabled={!canExportPdf || isExportingPdf}
          >
            <Download className="size-4" />
            {isExportingPdf ? "Exporting PDF..." : "Export PDF"}
          </Button>
        </div>
      ) : null}

      {showOfflineBanner ? (
        <Alert className="border-amber-300/70 bg-amber-50/80 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <WifiOff className="text-amber-700 dark:text-amber-300" />
          <AlertTitle>{OFFLINE_TOTALS_COPY.title}</AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
            <p>{OFFLINE_TOTALS_COPY.description}</p>
            <p>{OFFLINE_TOTALS_COPY.descriptionTr}</p>
          </AlertDescription>
        </Alert>
      ) : statusNotice ? (
        <Alert className="border-amber-300/70 bg-amber-50/80 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <WifiOff className="text-amber-700 dark:text-amber-300" />
          <AlertTitle>{AGGREGATE_TOTALS_NOTICE_TITLE}</AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
            <p>{statusNotice}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className={surfaceCard} ref={dailyChartCardRef}>
          <CardHeader>
            <CardTitle>Last 30 Days Chart</CardTitle>
            <CardDescription>
              {isAggregate
                ? "Combined totals across all inverters."
                : "Load, solar PV, and grid used daily totals."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {warning ? (
              <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
                {warning}
              </p>
            ) : null}
            {dailyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No daily totals available yet.
              </p>
            ) : (
              renderChart(dailyChartRows)
            )}
          </CardContent>
        </Card>

        <Card className={surfaceCard}>
          <CardHeader>
            <CardTitle>Last 30 Days Table</CardTitle>
            <CardDescription>
              {isAggregate
                ? "Combined totals across all inverters."
                : "Load, solar PV, and grid used daily totals."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dailyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No daily totals available yet.
              </p>
            ) : (
              renderTable(dailyRows, toDayLabel)
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className={surfaceCard} ref={monthlyChartCardRef}>
          <CardHeader>
            <CardTitle>Last 12 Months Chart</CardTitle>
            <CardDescription>
              {isAggregate
                ? "Combined totals across all inverters."
                : "Load, solar PV, and grid used monthly totals."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No monthly totals available yet.
              </p>
            ) : (
              renderChart(monthlyChartRows)
            )}
          </CardContent>
        </Card>

        <Card className={surfaceCard}>
          <CardHeader>
            <CardTitle>Last 12 Months Table</CardTitle>
            <CardDescription>
              {isAggregate
                ? "Combined totals across all inverters."
                : "Load, solar PV, and grid used monthly totals."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No monthly totals available yet.
              </p>
            ) : (
              renderTable(monthlyRows, toMonthLabel)
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

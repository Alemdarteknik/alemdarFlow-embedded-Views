import { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { useMediaQuery } from "@uidotdev/usehooks";

import InverterNode from "./InverterNode";
import GridNode from "./GridNode";
import SolarNode from "./SolarNode";
import HomeNode from "./HomeNode";
import BatteryNode from "./BatteryNode";
import GlowEdge from "./GlowEdge";
import type { InverterDisplayStatus } from "@/utils/inverter-display-status";
import type { InverterHealthState } from "@/utils/inverter-health";

const nodeTypes = {
  inverter: InverterNode,
  grid: GridNode,
  solar: SolarNode,
  home: HomeNode,
  battery: BatteryNode,
};

const edgeTypes = {
  glow: GlowEdge,
};

const nodeStyle = {
  background: "transparent",
  border: "none",
  borderRadius: "0",
  boxShadow: "none",
  padding: "0",
  color: "var(--card-foreground, #334155)",
};

const edgeStyle = { stroke: "#808080", strokeWidth: 2 };
type BranchFault = {
  active: boolean;
  reason?: string | null;
};

function buildMarkerEnd(color: string) {
  return { type: MarkerType.ArrowClosed, color };
}

export interface NodeSizeConfig {
  iconSize: number;
  padding: number;
  borderRadius: number;
  labelFontSize: number;
  valueFontSize: number;
  labelMarginTop: number;
  valueMarginTop: number;
}

interface ResponsiveConfig {
  positions: Record<string, { x: number; y: number }>;
  nodeSize: NodeSizeConfig;
  fitViewPadding: number;
}

const responsiveConfigs: Record<string, ResponsiveConfig> = {
  sm: {
    positions: {
      grid: { x: 0, y: 0 },
      solar: { x: 0, y: 130 },
      inverter: { x: 210, y: 65 },
      home: { x: 420, y: 0 },
      battery: { x: 420, y: 130 },
    },
    nodeSize: {
      iconSize: 40,
      padding: 8,
      borderRadius: 11,
      labelFontSize: 13,
      valueFontSize: 14,
      labelMarginTop: 3,
      valueMarginTop: 2,
    },
    fitViewPadding: 0.03,
  },
  md: {
    positions: {
      grid: { x: 0, y: 0 },
      solar: { x: 0, y: 120 },
      inverter: { x: 200, y: 60 },
      home: { x: 400, y: 0 },
      battery: { x: 400, y: 120 },
    },
    nodeSize: {
      iconSize: 36,
      padding: 7,
      borderRadius: 9,
      labelFontSize: 12,
      valueFontSize: 13,
      labelMarginTop: 2,
      valueMarginTop: 1,
    },
    fitViewPadding: 0.02,
  },
  lg: {
    positions: {
      grid: { x: 0, y: 0 },
      solar: { x: 0, y: 140 },
      inverter: { x: 220, y: 70 },
      home: { x: 440, y: 0 },
      battery: { x: 440, y: 140 },
    },
    nodeSize: {
      iconSize: 42,
      padding: 9,
      borderRadius: 11,
      labelFontSize: 14,
      valueFontSize: 15,
      labelMarginTop: 3,
      valueMarginTop: 2,
    },
    fitViewPadding: 0.03,
  },
  xl: {
    positions: {
      grid: { x: 0, y: 0 },
      solar: { x: 0, y: 210 },
      inverter: { x: 250, y: 105 },
      home: { x: 500, y: 0 },
      battery: { x: 500, y: 210 },
    },
    nodeSize: {
      iconSize: 50,
      padding: 11,
      borderRadius: 13,
      labelFontSize: 16,
      valueFontSize: 17,
      labelMarginTop: 5,
      valueMarginTop: 3,
    },
    fitViewPadding: 0.1,
  },
};

interface BuildNodesParams {
  healthState: InverterHealthState;
  displayStatus: InverterDisplayStatus;
  isGridActive: boolean;
  isSolarGenerating: boolean;
  isHomePowered: boolean;
  isBatteryCharging: boolean;
  isBatteryDischarging: boolean;
  isDarkMode: boolean;
  gridPower: number;
  solarPower: number;
  homePower: number;
  batteryPower: number;
  batteryPercentage: number;
  gridFault: BranchFault;
  solarFault: BranchFault;
  homeFault: BranchFault;
  batteryFault: BranchFault;
}

function buildNodes(
  {
    healthState,
    displayStatus,
    isGridActive,
    isSolarGenerating,
    isHomePowered,
    isBatteryCharging,
    isBatteryDischarging,
    isDarkMode,
    gridPower,
    solarPower,
    homePower,
    batteryPower,
    batteryPercentage,
    gridFault,
    solarFault,
    homeFault,
    batteryFault,
  }: BuildNodesParams,
  config: ResponsiveConfig,
): Node[] {
  const { positions, nodeSize } = config;
  return [
    {
      id: "grid",
      type: "grid",
      draggable: false,
      data: {
        isActive: isGridActive && !gridFault.active,
        isDarkMode,
        power: gridPower,
        isFaulted: gridFault.active,
        faultReason: gridFault.reason,
        nodeSize,
      },
      position: positions.grid,
      style: { ...nodeStyle },
    },
    {
      id: "solar",
      type: "solar",
      draggable: false,
      data: {
        isGenerating: isSolarGenerating,
        power: solarPower,
        isDarkMode,
        isFaulted: solarFault.active,
        faultReason: solarFault.reason,
        nodeSize,
      },
      position: positions.solar,
      style: { ...nodeStyle },
    },
    {
      id: "inverter",
      type: "inverter",
      draggable: false,
      data: { isDarkMode, nodeSize, healthState, displayStatus },
      position: positions.inverter,
      style: { ...nodeStyle },
    },
    {
      id: "home",
      type: "home",
      draggable: false,
      data: {
        isPowered: isHomePowered,
        power: homePower,
        isDarkMode,
        isFaulted: homeFault.active,
        faultReason: homeFault.reason,
        nodeSize,
      },
      position: positions.home,
      style: { ...nodeStyle },
    },
    {
      id: "battery",
      type: "battery",
      draggable: false,
      data: {
        isCharging: isBatteryCharging,
        isDischarging: isBatteryDischarging,
        power: batteryPower,
        percentage: batteryPercentage,
        isDarkMode,
        isFaulted: batteryFault.active,
        faultReason: batteryFault.reason,
        nodeSize,
      },
      position: positions.battery,
      style: { ...nodeStyle },
    },
  ];
}

interface BuildEdgesParams {
  isTelemetryUsable: boolean;
  isGridActive: boolean;
  isSolarGenerating: boolean;
  isHomePowered: boolean;
  isBatteryCharging: boolean;
  isBatteryDischarging: boolean;
  gridFault: BranchFault;
  solarFault: BranchFault;
  homeFault: BranchFault;
  batteryFault: BranchFault;
}

function buildEdge({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  animated,
  dashed = false,
}: {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated: boolean;
  dashed?: boolean;
}): Edge {
  const style = dashed ? { ...edgeStyle, strokeDasharray: "5,5" } : edgeStyle;

  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: "glow",
    animated,
    style,
    markerEnd: buildMarkerEnd(style.stroke),
  };
}

function buildEdges({
  isTelemetryUsable,
  isGridActive,
  isSolarGenerating,
  isHomePowered,
  isBatteryCharging,
  isBatteryDischarging,
  gridFault,
  solarFault,
  homeFault,
  batteryFault,
}: BuildEdgesParams): Edge[] {
  const edges: Edge[] = [];

  if (!gridFault.active) {
    edges.push(
      buildEdge({
        id: "grid-inverter",
        source: "grid",
        target: "inverter",
        targetHandle: "grid-input",
        animated: isTelemetryUsable && isGridActive,
      }),
    );
  }

  if (!solarFault.active) {
    edges.push(
      buildEdge({
        id: "solar-inverter",
        source: "solar",
        target: "inverter",
        targetHandle: "solar-input",
        animated: isTelemetryUsable && isSolarGenerating,
      }),
    );
  }

  if (!homeFault.active) {
    edges.push(
      buildEdge({
        id: "inverter-home",
        source: "inverter",
        sourceHandle: "home-output",
        target: "home",
        animated: isTelemetryUsable && isHomePowered,
      }),
    );
  }

  if (!batteryFault.active && isBatteryCharging && !isBatteryDischarging) {
    edges.push(
      buildEdge({
        id: "inverter-battery",
        source: "inverter",
        sourceHandle: "battery-output",
        target: "battery",
        targetHandle: "charge",
        animated: isTelemetryUsable,
      }),
    );
  }

  if (!batteryFault.active && isBatteryDischarging && !isBatteryCharging) {
    edges.push(
      buildEdge({
        id: "battery-inverter",
        source: "battery",
        sourceHandle: "discharge",
        target: "inverter",
        targetHandle: "battery-input",
        animated: isTelemetryUsable,
        dashed: true,
      }),
    );
  }

  return edges;
}

export interface InverterFlowDiagramProps {
  healthState?: InverterHealthState;
  displayStatus?: InverterDisplayStatus;
  isTelemetryUsable?: boolean;
  /** Animate grid → inverter edge & show grid GIF */
  isGridActive?: boolean;
  /** Animate solar → inverter edge & show solar GIF */
  isSolarGenerating?: boolean;
  /** Animate inverter → home edge & show home GIF */
  isHomePowered?: boolean;
  /** Animate inverter → battery edge & show battery charging GIF */
  isBatteryCharging?: boolean;
  /** Animate battery → inverter discharge edge & show battery discharge GIF */
  isBatteryDischarging?: boolean;
  /** Whether dark mode is active */
  isDarkMode?: boolean;
  /** kW value displayed under grid node */
  gridPower?: number;
  /** kW value displayed under solar node */
  solarPower?: number;
  /** kW value displayed under home node */
  homePower?: number;
  /** kW value displayed under battery node */
  batteryPower?: number;
  /** Percentage value displayed under battery node */
  batteryPercentage?: number;
  /** Highlight only the grid branch when grid telemetry indicates a branch fault */
  gridFaultActive?: boolean;
  gridFaultReason?: string | null;
  /** Highlight only the solar branch when solar telemetry indicates a branch fault */
  solarFaultActive?: boolean;
  solarFaultReason?: string | null;
  /** Future-ready load branch fault inputs */
  homeFaultActive?: boolean;
  homeFaultReason?: string | null;
  /** Pause only the battery branch when capacity is faulted */
  batteryFaultActive?: boolean;
  batteryFaultReason?: string | null;
  /** Optional style for the container div */
  style?: React.CSSProperties;
  /** Optional className for the container div */
  className?: string;
}

function InverterFlowDiagram({
  healthState = "healthy",
  displayStatus = "online",
  isTelemetryUsable = true,
  isGridActive = false,
  isSolarGenerating = false,
  isHomePowered = false,
  isBatteryCharging = false,
  isBatteryDischarging = false,
  isDarkMode = false,
  gridPower = 0,
  solarPower = 0,
  homePower = 0,
  batteryPower = 0,
  batteryPercentage = 0,
  gridFaultActive = false,
  gridFaultReason = null,
  solarFaultActive = false,
  solarFaultReason = null,
  homeFaultActive = false,
  homeFaultReason = null,
  batteryFaultActive = false,
  batteryFaultReason = null,
  style,
  className,
}: InverterFlowDiagramProps) {
  const isSmallDevice = useMediaQuery("only screen and (max-width : 768px)");
  const isMediumDevice = useMediaQuery(
    "only screen and (min-width : 769px) and (max-width : 992px)",
  );
  const isLargeDevice = useMediaQuery(
    "only screen and (min-width : 993px) and (max-width : 1200px)",
  );
  const isExtraLargeDevice = useMediaQuery(
    "only screen and (min-width : 1201px)",
  );

  const config = useMemo(() => {
    if (isExtraLargeDevice) return responsiveConfigs.xl;
    if (isLargeDevice) return responsiveConfigs.lg;
    if (isMediumDevice) return responsiveConfigs.md;
    return responsiveConfigs.sm;
  }, [isSmallDevice, isMediumDevice, isLargeDevice, isExtraLargeDevice]);

  const gridFault = useMemo(
    () => ({ active: gridFaultActive, reason: gridFaultReason }),
    [gridFaultActive, gridFaultReason],
  );
  const solarFault = useMemo(
    () => ({ active: solarFaultActive, reason: solarFaultReason }),
    [solarFaultActive, solarFaultReason],
  );
  const homeFault = useMemo(
    () => ({ active: homeFaultActive, reason: homeFaultReason }),
    [homeFaultActive, homeFaultReason],
  );
  const batteryFault = useMemo(
    () => ({ active: batteryFaultActive, reason: batteryFaultReason }),
    [batteryFaultActive, batteryFaultReason],
  );

  const nodes = useMemo(
    () =>
      buildNodes(
        {
          healthState,
          displayStatus,
          isGridActive,
          isSolarGenerating,
          isHomePowered,
          isBatteryCharging,
          isBatteryDischarging,
          isDarkMode,
          gridPower,
          solarPower,
          homePower,
          batteryPower,
          batteryPercentage,
          gridFault,
          solarFault,
          homeFault,
          batteryFault,
        },
        config,
      ),
    [
      isGridActive,
      isSolarGenerating,
      isHomePowered,
      isBatteryCharging,
      isBatteryDischarging,
      isDarkMode,
      gridPower,
      solarPower,
      homePower,
      batteryPower,
      batteryPercentage,
      gridFault,
      solarFault,
      homeFault,
      batteryFault,
      healthState,
      displayStatus,
      config,
    ],
  );

  const edges = useMemo(
    () =>
      buildEdges({
        isTelemetryUsable,
        isGridActive,
        isSolarGenerating,
        isHomePowered,
        isBatteryCharging,
        isBatteryDischarging,
        gridFault,
        solarFault,
        homeFault,
        batteryFault,
      }),
    [
      isTelemetryUsable,
      isGridActive,
      isSolarGenerating,
      isHomePowered,
      isBatteryCharging,
      isBatteryDischarging,
      gridFault,
      solarFault,
      homeFault,
      batteryFault,
    ],
  );

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    >
      <ReactFlowProvider>
        <FlowInner
          nodes={nodes}
          edges={edges}
          fitViewPadding={config.fitViewPadding}
        />
      </ReactFlowProvider>
    </div>
  );
}

function FlowInner({
  nodes,
  edges,
  fitViewPadding = 0.2,
}: {
  nodes: Node[];
  edges: Edge[];
  fitViewPadding?: number;
}) {
  const { fitView } = useReactFlow();

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: fitViewPadding }), 50);
  }, [fitView, fitViewPadding]);

  // Re-center whenever nodes or edges change
  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: fitViewPadding }), 50);
    return () => clearTimeout(timer);
  }, [nodes, edges, fitView, fitViewPadding]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      fitViewOptions={{ padding: fitViewPadding }}
      onInit={onInit}
      minZoom={0.1}
      maxZoom={2}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      proOptions={{ hideAttribution: true }}
    />
  );
}

export default InverterFlowDiagram;

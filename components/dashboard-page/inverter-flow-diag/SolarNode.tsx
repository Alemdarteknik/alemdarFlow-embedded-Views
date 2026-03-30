import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";

type SolarNodeData = Node<
  {
    isGenerating?: boolean;
    power?: number;
    isDarkMode?: boolean;
    isFaulted?: boolean;
    faultReason?: string | null;
    nodeSize?: {
      iconSize: number;
      padding: number;
      borderRadius: number;
      labelFontSize: number;
      valueFontSize: number;
      labelMarginTop: number;
      valueMarginTop: number;
    };
  },
  "solar"
>;

const handleStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  width: 12,
  height: 12,
  right: -6,
};

function SolarNode({ data }: NodeProps<SolarNodeData>) {
  const isGenerating = data.isGenerating || false;
  const isDarkMode = data.isDarkMode || false;
  const isFaulted = data.isFaulted || false;
  const ns = data.nodeSize || {
    iconSize: 60,
    padding: 14,
    borderRadius: 14,
    labelFontSize: 19,
    valueFontSize: 19,
    labelMarginTop: 6,
    valueMarginTop: 4,
  };

  return (
    <div
      title={isFaulted ? data.faultReason || "Solar fault detected" : undefined}
      className={isFaulted ? "animate-pulse" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: "var(--card, #ffffff)",
          border: isFaulted
            ? "1px solid rgba(245, 158, 11, 0.6)"
            : "1px solid var(--border, #e2e8f0)",
          borderRadius: ns.borderRadius,
          boxShadow: isFaulted
            ? "0 0 0 4px rgba(245, 158, 11, 0.15)"
            : "0 1px 2px rgba(0,0,0,0.08)",
          padding: ns.padding,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={
            isFaulted
              ? isDarkMode
                ? "/solar-panel-dark.png"
                : "/solar-panel.png"
              : isGenerating
              ? "/solar-panel.gif"
              : isDarkMode
                ? "/solar-panel-dark.png"
                : "/solar-panel.png"
          }
          alt="Solar Panels"
          style={{
            width: ns.iconSize,
            height: ns.iconSize,
            objectFit: "contain",
          }}
        />
      </div>
      <span
        style={{
          marginTop: ns.labelMarginTop,
          fontSize: ns.labelFontSize,
          fontWeight: 600,
          color: "var(--card-foreground, #334155)",
          lineHeight: 1.2,
        }}
      >
        Solar
      </span>
      {isFaulted ? (
        <span
          style={{
            marginTop: 4,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: Math.max(ns.valueFontSize - 6, 10),
            fontWeight: 700,
            color: "#92400e",
            background: "rgba(245, 158, 11, 0.18)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            lineHeight: 1.1,
          }}
        >
          Fault
        </span>
      ) : null}
      <span
        style={{
          marginTop: ns.valueMarginTop,
          fontSize: ns.valueFontSize,
          fontWeight: 800,
          color: "var(--card-foreground, #334155)",
          lineHeight: 1.2,
        }}
      >
        {(data.power)?.toFixed(2) || 0}{" "}
        <span
          style={{
            fontWeight: 400,
            fontSize: ns.valueFontSize - 2,
          }}
        >
          kW
        </span>
      </span>
      <Handle
        type="source"
        position={Position.Right}
        style={{ ...handleStyle, top: "40%" }}
      />
    </div>
  );
}

export default memo(SolarNode);

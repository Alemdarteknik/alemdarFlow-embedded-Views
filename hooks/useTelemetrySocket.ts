"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";

export type TelemetryMessage = {
  type: "telemetry" | "aggregate" | "heartbeat" | "info" | "error";
  ts: number;
  inverterId?: string;
  data?: Record<string, unknown>;
  message?: string;
};

type StreamMode = "aggregate" | "inverter";

type UseTelemetrySocketParams = {
  baseUrl: string; // e.g. "ws://localhost:3000"
  mode: StreamMode; // "aggregate" or "inverter"
  inverterId?: string; // required when mode="inverter"
  aggregatePath?: string; // default "/ws"
  inverterPathTemplate?: string; // default "/ws/:inverterId"
  autoConnect?: boolean; // default true
  reconnect?: boolean; // default true
  reconnectBaseDelayMs?: number; // default 500
  reconnectMaxDelayMs?: number; // default 15000
  maxHistory?: number; // default 200
  throttleMs?: number; // default 0 (no throttle)
};

function buildWsUrl(
  baseUrl: string,
  mode: StreamMode,
  inverterId: string | undefined,
  aggregatePath: string,
  inverterTemplate: string,
) {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  if (mode === "aggregate") return `${trimmedBase}${aggregatePath}`;

  if (!inverterId)
    throw new Error("inverterId is required when mode='inverter'");
  const path = inverterTemplate.replace(
    ":inverterId",
    encodeURIComponent(inverterId),
  );
  return `${trimmedBase}${path}`;
}

export function useTelemetrySocket(params: UseTelemetrySocketParams) {
  const {
    baseUrl,
    mode,
    inverterId,
    aggregatePath = "/ws",
    inverterPathTemplate = "/ws/:inverterId",
    autoConnect = true,
    reconnect = true,
    reconnectBaseDelayMs = 500,
    reconnectMaxDelayMs = 15000,
    maxHistory = 200,
    throttleMs = 0,
  } = params;

  const url = useMemo(() => {
    try {
      return buildWsUrl(
        baseUrl,
        mode,
        inverterId,
        aggregatePath,
        inverterPathTemplate,
      );
    } catch {
      return null;
    }
  }, [baseUrl, mode, inverterId, aggregatePath, inverterPathTemplate]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const sendQueueRef = useRef<string[]>([]);

  const [status, setStatus] = useState<WsStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<TelemetryMessage | null>(null);
  const [history, setHistory] = useState<TelemetryMessage[]>([]);

  const pendingRef = useRef<TelemetryMessage | null>(null);
  const throttleTimerRef = useRef<number | null>(null);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const clearThrottleTimer = () => {
    if (throttleTimerRef.current !== null) {
      window.clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  };

  const pushMessage = useCallback(
    (msg: TelemetryMessage) => {
      if (throttleMs > 0) {
        pendingRef.current = msg;
        if (throttleTimerRef.current === null) {
          throttleTimerRef.current = window.setTimeout(() => {
            throttleTimerRef.current = null;
            const m = pendingRef.current;
            pendingRef.current = null;
            if (!m) return;

            setLatest(m);
            setHistory((prev) => {
              const next = [...prev, m];
              return next.length > maxHistory
                ? next.slice(next.length - maxHistory)
                : next;
            });
          }, throttleMs);
        }
        return;
      }

      setLatest(msg);
      setHistory((prev) => {
        const next = [...prev, msg];
        return next.length > maxHistory
          ? next.slice(next.length - maxHistory)
          : next;
      });
    },
    [throttleMs, maxHistory],
  );

  const flushSendQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    while (sendQueueRef.current.length > 0) {
      const payload = sendQueueRef.current.shift();
      if (!payload) break;
      ws.send(payload);
    }
  }, []);

  const connect = useCallback(() => {
    if (!url) {
      setStatus("idle");
      setError(
        mode === "inverter"
          ? "Missing inverterId for inverter mode"
          : "Missing WebSocket URL",
      );
      return;
    }

    try {
      wsRef.current?.close();
    } catch {}

    clearReconnectTimer();
    clearThrottleTimer();

    setStatus("connecting");
    setError(null);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
      setStatus("open");
      flushSendQueue();
    };

    ws.onmessage = (evt) => {
      const raw = typeof evt.data === "string" ? evt.data : "";
      if (!raw) return;

      try {
        const msg = JSON.parse(raw) as TelemetryMessage;
        pushMessage(msg);
      } catch {
        setError("Received non-JSON message from server");
      }
    };

    ws.onerror = () => {
      setStatus("error");
      setError("WebSocket error");
    };

    ws.onclose = () => {
      setStatus("closed");

      if (!reconnect) return;

      attemptsRef.current += 1;
      const delay = Math.min(
        reconnectBaseDelayMs * 2 ** (attemptsRef.current - 1),
        reconnectMaxDelayMs,
      );
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };
  }, [
    url,
    mode,
    reconnect,
    reconnectBaseDelayMs,
    reconnectMaxDelayMs,
    flushSendQueue,
    pushMessage,
  ]);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    clearThrottleTimer();
    attemptsRef.current = 0;

    const ws = wsRef.current;
    wsRef.current = null;

    try {
      ws?.close();
    } catch {}

    setStatus("closed");
  }, []);

  const send = useCallback((data: unknown) => {
    const payload = typeof data === "string" ? data : JSON.stringify(data);

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      sendQueueRef.current.push(payload);
      return false;
    }

    ws.send(payload);
    return true;
  }, []);

  const resetHistory = useCallback(() => setHistory([]), []);

  useEffect(() => {
    if (!autoConnect) return;
    connect();
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    url,
    status,
    error,
    latest,
    history,
    connect,
    disconnect,
    send,
    resetHistory,
  };
}

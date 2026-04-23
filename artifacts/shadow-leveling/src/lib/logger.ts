import { customFetch } from "@workspace/api-client-react";

export type ClientLogLevel = "info" | "warn" | "error";

interface LogPayload {
  level: ClientLogLevel;
  message: string;
  context?: Record<string, unknown> | null;
}

let installed = false;

async function send(payload: LogPayload): Promise<void> {
  try {
    await customFetch("/api/logs", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
  } catch {
    // Swallow — logging failures must never crash the app.
  }
}

export const Logger = {
  info(message: string, context?: Record<string, unknown>) {
    void send({ level: "info", message, context });
  },
  warn(message: string, context?: Record<string, unknown>) {
    void send({ level: "warn", message, context });
  },
  error(message: string, context?: Record<string, unknown>) {
    void send({ level: "error", message, context });
  },
};

/**
 * Wires window-level error and unhandledrejection handlers so that any
 * uncaught client-side crash is forwarded to /api/logs. Idempotent.
 */
export function installGlobalErrorLogging(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event: ErrorEvent) => {
    void send({
      level: "error",
      message: event.message || "window.onerror",
      context: {
        source: "window.onerror",
        filename: event.filename ?? null,
        lineno: event.lineno ?? null,
        colno: event.colno ?? null,
        stack: event.error?.stack ?? null,
        url: window.location.href,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason as unknown;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    void send({
      level: "error",
      message,
      context: {
        source: "unhandledrejection",
        stack: reason instanceof Error ? reason.stack ?? null : null,
        url: window.location.href,
      },
    });
  });
}

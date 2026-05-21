import type { Response } from "express";

export interface LogEntry {
  time: string;
  text: string;
  level: "info" | "pass" | "fail" | "warn";
}

// Maps runId to active SSE client connections
export const activeStreams = new Map<string, Response[]>();

// Store logs in memory for each active run so clients get caught up on connection
export const runLogsBuffer = new Map<string, LogEntry[]>();

/**
 * Streams a log message to all connected SSE clients for a specific run,
 * and buffers the log line in memory.
 */
export function streamLog(
  runId: string,
  text: string,
  level: "info" | "pass" | "fail" | "warn" = "info"
) {
  const time = new Date().toLocaleTimeString("en-US", { hour12: false });
  const entry: LogEntry = { time, text, level };

  // Buffer the log
  if (!runLogsBuffer.has(runId)) {
    runLogsBuffer.set(runId, []);
  }
  const buffer = runLogsBuffer.get(runId)!;
  buffer.push(entry);
  if (buffer.length > 200) {
    buffer.shift(); // keep it clean
  }

  // Stream to active connections
  const clients = activeStreams.get(runId);
  if (clients && clients.length > 0) {
    const data = JSON.stringify(entry);
    for (const res of clients) {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (err) {
        console.error("Failed to write to SSE client:", err);
      }
    }
  }
}

/**
 * Helper to clear logs for a finished run
 */
export function clearRunLogs(runId: string) {
  runLogsBuffer.delete(runId);
}

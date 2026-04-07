import type { Request } from "express";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const MAX_DATE_DELTA_MS = 24 * 60 * 60 * 1000;

export function validateDateHeader(dateStr: string): { valid: boolean; error?: string } {
  if (!DATE_REGEX.test(dateStr)) {
    return { valid: false, error: `x-local-date '${dateStr}' is not a valid YYYY-MM-DD date.` };
  }
  const clientMs = new Date(dateStr + "T00:00:00.000Z").getTime();
  const serverDateStr = new Date().toISOString().split("T")[0];
  const serverMs = new Date(serverDateStr + "T00:00:00.000Z").getTime();
  const deltaMs = Math.abs(clientMs - serverMs);
  if (deltaMs > MAX_DATE_DELTA_MS) {
    return {
      valid: false,
      error: `x-local-date '${dateStr}' is out of acceptable range (±1 day from server date ${serverDateStr}).`,
    };
  }
  return { valid: true };
}

export function getSystemDate(localDateOverride?: string): string {
  if (localDateOverride && DATE_REGEX.test(localDateOverride)) {
    return localDateOverride;
  }
  return new Date().toISOString().split("T")[0];
}

export function getSystemDateFromReq(req: Request): string {
  const header = req.headers["x-local-date"];
  const headerVal = Array.isArray(header) ? header[0] : header;
  if (headerVal) return getSystemDate(headerVal);
  const queryVal = typeof req.query.localDate === "string" ? req.query.localDate : undefined;
  return getSystemDate(queryVal);
}

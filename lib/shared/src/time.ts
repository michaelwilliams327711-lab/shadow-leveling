import type { Request } from "express";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

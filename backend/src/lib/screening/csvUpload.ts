const ALLOWED_CSV_MIMES = new Set([
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
]);

export function isAllowedCsvMime(mimetype: string): boolean {
  return ALLOWED_CSV_MIMES.has(mimetype.toLowerCase());
}

/** Reject binary uploads masquerading as CSV. */
export function looksLikeCsvText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32 && byte !== 27)) return false;
  }
  const text = sample.toString("utf-8");
  return text.includes(",") || text.includes("\n") || text.includes(";");
}

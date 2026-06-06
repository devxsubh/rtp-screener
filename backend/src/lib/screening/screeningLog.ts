const PREFIX = "[screening]";

function enabled(): boolean {
  return process.env.SCREENING_LOG !== "0";
}

export function screeningLog(
  message: string,
  detail?: Record<string, unknown>,
): void {
  if (!enabled()) return;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`${PREFIX} ${message}`, detail);
  } else {
    console.log(`${PREFIX} ${message}`);
  }
}

export function screeningWarn(
  message: string,
  detail?: Record<string, unknown>,
): void {
  if (!enabled()) return;
  if (detail && Object.keys(detail).length > 0) {
    console.warn(`${PREFIX} ${message}`, detail);
  } else {
    console.warn(`${PREFIX} ${message}`);
  }
}

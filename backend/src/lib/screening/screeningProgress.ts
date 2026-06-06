export type ScreeningStage =
  | "parse"
  | "graph"
  | "screen"
  | "exposure"
  | "explain";

export type ScreeningProgressEvent = {
  stage: ScreeningStage;
  status: "start" | "done" | "warn";
  detail?: string;
  current?: number;
  total?: number;
};

export type ScreeningProgressFn = (event: ScreeningProgressEvent) => void;

export const SCREENING_STAGE_LABELS: Record<ScreeningStage, string> = {
  parse: "Parsing CSV",
  graph: "Building ownership graph",
  screen: "Screening sanctions lists",
  exposure: "Computing ownership exposure",
  explain: "Writing analyst notes",
};

function emit(
  onProgress: ScreeningProgressFn | undefined,
  event: ScreeningProgressEvent,
): void {
  onProgress?.(event);
}

export function progressStage(
  onProgress: ScreeningProgressFn | undefined,
  stage: ScreeningStage,
  status: ScreeningProgressEvent["status"],
  detail?: string,
  counts?: { current?: number; total?: number },
): void {
  emit(onProgress, { stage, status, detail, ...counts });
}

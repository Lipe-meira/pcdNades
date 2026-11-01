import type { Clip } from "./clip";
import { validateClip } from "./clip";

export type ImportLimits = {
  maxSourceDurationSeconds: number;
  maxSourceBytes?: number;
  maxDurationSeconds: number;
  maxBytes: number;
  minDurationSeconds: number;
  timePrecisionSeconds: number;
};
export type ImportInspection = {
  sourceId: string;
  provider: "tiktok";
  sourceUrl: string;
  videoId: string;
  title: string;
  author: string | null;
  durationSeconds: number;
  expiresAt: string;
  preview: null;
  previewReasonCode: "PREVIEW_UNAVAILABLE";
  limits: ImportLimits;
};
export function importSelectionError(inspection: ImportInspection | undefined, clip?: Clip): string | null {
  if (!inspection) return "Consulte os dados do vídeo antes de selecionar e importar um trecho.";
  if (!clip) return "Selecione o início e o fim do trecho a importar.";
  return validateClip(clip, { ...inspection.limits, sourceDurationSeconds: inspection.durationSeconds });
}

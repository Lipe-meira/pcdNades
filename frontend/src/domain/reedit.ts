import type { Clip } from "./clip";
import type { ImportInspection } from "./imports";
import { importSelectionError } from "./imports";
import type { MediaDraft, Video } from "./types";
import { recognizeVideoSource } from "./videoSource";

type Link = Extract<MediaDraft, { kind: "link" }>;
export type ImportedSource =
  | { available: true; platform: "tiktok" | "instagram"; sourceUrl: string; clip?: Clip }
  | { available: false; reason: "missing-url" };

/**
 * Vídeos importados por link ficam registrados com sourceType tiktok/instagram.
 * Upload MP4, vídeos antigos e demais origens retornam null: nada muda para eles.
 */
export function importedSource(video: Pick<Video, "sourceType" | "sourceUrl" | "clip">): ImportedSource | null {
  if (video.sourceType !== "tiktok" && video.sourceType !== "instagram") return null;
  const recognized = video.sourceUrl ? recognizeVideoSource(video.sourceUrl) : null;
  if (!recognized || recognized.platform !== video.sourceType) return { available: false, reason: "missing-url" };
  return { available: true, platform: video.sourceType, sourceUrl: recognized.sourceUrl, ...(video.clip ? { clip: video.clip } : {}) };
}

export function reeditDraft(source: Extract<ImportedSource, { available: true }>): Link {
  return { kind: "link", sourceUrl: source.sourceUrl, reedit: { previousClip: source.clip } };
}

/** Intervalo inicial após consultar de novo: o corte anterior, se ainda cabe na fonte e nos limites. */
export function initialClipFor(inspection: ImportInspection, previous?: Clip): { clip: Clip; reused: boolean } {
  if (previous && importSelectionError(inspection, previous) === null) return { clip: { ...previous }, reused: true };
  return { clip: { startSeconds: 0, endSeconds: Math.min(inspection.durationSeconds, inspection.limits.maxDurationSeconds) }, reused: false };
}

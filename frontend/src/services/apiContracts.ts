import type { GameMap, Lineup, VideoStatus } from "../domain/types";
import { isTarget } from "../domain/lineups";
import { ApiError } from "./apiClient";
import { safeHttpUrl } from "./runtimeConfig";
import type { Clip } from "../domain/clip";

export type RemoteMediaStatus =
  "awaiting_upload" | "queued" | "processing" | "ready" | "failed";
export type MediaRecord = {
  id: string;
  status: RemoteMediaStatus;
  sourceType: string;
  sourceUrl: string | null;
  stage: string | null;
  error: { code: string; message: string } | null;
  metadata: Record<string, unknown> | null;
  clip?: Clip | null;
};
export type ApiMap = {
  id: string;
  name: string;
  radar: {
    imageUrl: string;
    width: number;
    height: number;
    coordinateVersion: string;
  };
};
export type ApiGrenade = Omit<Lineup, "video"> & { video: MediaRecord | null };
export type MediaCapabilities = {
  upload: {
    enabled: boolean;
    maxBytes: number;
    maxDurationSeconds: number;
    processingMode?: "inline-original" | "worker-transcode";
  };
  importers: {
    youtube: ImporterCapability;
    tiktok: ImporterCapability;
    instagram?: ImporterCapability;
  };
  trimming?: TrimmingCapability;
};
export type ImporterCapability = {
  enabled: boolean;
  reasonCode?: string;
  message?: string;
};
export type TrimmingCapability = {
  enabled: boolean;
  reasonCode?: string;
  maxSourceDurationSeconds: number;
  maxSourceBytes: number;
  maxDurationSeconds: number;
  minDurationSeconds: number;
  timePrecisionSeconds: number;
};
export function clipLimits(capabilities: MediaCapabilities) {
  return {
    maxDurationSeconds: Math.min(
      capabilities.upload.maxDurationSeconds,
      capabilities.trimming?.maxDurationSeconds ?? 90,
    ),
    maxSourceDurationSeconds:
      capabilities.trimming?.maxSourceDurationSeconds ??
      capabilities.upload.maxDurationSeconds,
    minDurationSeconds: capabilities.trimming?.minDurationSeconds ?? 0.1,
    timePrecisionSeconds: capabilities.trimming?.timePrecisionSeconds ?? 0.001,
  };
}
export type UploadSession = {
  mediaId: string;
  upload: {
    protocol: "supabase-signed";
    url: string;
    path: string;
    token: string;
  };
  limits: { maxBytes: number; maxDurationSeconds: number };
};
export type Playback = { url: string; expiresAt?: string; mimeType: string };
export type Progress = {
  status: VideoStatus | "publishing" | "confirming";
  mediaId?: string;
  stage?: string | null;
};
export type SaveOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
  mediaId?: string;
};

export function contractError(): never {
  throw new ApiError(
    "INVALID_RESPONSE",
    0,
    undefined,
    "A resposta da API não corresponde ao contrato esperado. Nenhum dado demonstrativo foi usado.",
  );
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
export function mapApiMap(map: ApiMap): GameMap {
  if (
    !map ||
    !text(map.id) ||
    !text(map.name) ||
    !text(map.radar?.imageUrl) ||
    !text(map.radar.coordinateVersion) ||
    !Number.isFinite(map.radar.width) ||
    map.radar.width <= 0 ||
    !Number.isFinite(map.radar.height) ||
    map.radar.height <= 0
  )
    contractError();
  if (
    !map.radar.imageUrl.startsWith("/") ||
    map.radar.imageUrl.startsWith("//")
  ) {
    try {
      safeHttpUrl(map.radar.imageUrl);
    } catch {
      contractError();
    }
  }
  const licensedSetpos = /^setpos-(mirage|inferno|ancient)-ba5f793$/.test(
    map.radar.coordinateVersion,
  );
  return {
    id: map.id,
    name: map.name,
    radarUrl: map.radar.imageUrl,
    width: map.radar.width,
    height: map.radar.height,
    radarVersion: map.radar.coordinateVersion,
    illustrative: false,
    ...(licensedSetpos
      ? {
          credit: { label: "Minimaps by setpos.gg", url: "https://setpos.gg" },
          note: "Planta vetorial simplificada · snapshot 23/10/2026. Confira mudanças recentes do jogo.",
        }
      : {}),
  };
}
export function checkMedia(media: MediaRecord): MediaRecord {
  if (
    !media ||
    !text(media.id) ||
    !["awaiting_upload", "queued", "processing", "ready", "failed"].includes(
      media.status,
    )
  )
    contractError();
  return media;
}
export function mapApiGrenade(item: ApiGrenade): Lineup {
  if (
    !item ||
    !text(item.id) ||
    !text(item.title) ||
    !text(item.mapId) ||
    !["smoke", "flashbang", "molotov"].includes(item.type) ||
    !["T", "CT"].includes(item.side) ||
    typeof item.instructions !== "string" ||
    !item.target ||
    !isTarget(item.target)
  )
    contractError();
  const media = item.video && checkMedia(item.video);
  return {
    ...item,
    video: media
      ? {
          id: media.id,
          status: media.status,
          sourceUrl: media.sourceUrl ?? undefined,
          error: media.error?.message,
        }
      : { id: "", status: "missing" },
  };
}
export function checkCapabilities(value: MediaCapabilities): MediaCapabilities {
  if (
    value?.upload?.processingMode !== undefined &&
    !["inline-original", "worker-transcode"].includes(
      value.upload.processingMode,
    )
  )
    contractError();
  if (
    !value ||
    typeof value.upload?.enabled !== "boolean" ||
    !Number.isSafeInteger(value.upload.maxBytes) ||
    value.upload.maxBytes <= 0 ||
    !Number.isSafeInteger(value.upload.maxDurationSeconds) ||
    value.upload.maxDurationSeconds <= 0 ||
    typeof value.importers?.youtube?.enabled !== "boolean" ||
    typeof value.importers?.tiktok?.enabled !== "boolean"
  )
    contractError();
  if (
    value.importers.instagram !== undefined &&
    typeof value.importers.instagram.enabled !== "boolean"
  )
    contractError();
  const trim = value.trimming;
  if (
    trim &&
    (typeof trim.enabled !== "boolean" ||
      [
        trim.maxSourceDurationSeconds,
        trim.maxSourceBytes,
        trim.maxDurationSeconds,
        trim.minDurationSeconds,
        trim.timePrecisionSeconds,
      ].some((number) => !Number.isFinite(number) || number <= 0) ||
      trim.minDurationSeconds > trim.maxDurationSeconds)
  )
    contractError();
  // The final video is capped at90s; a selected source can be up to180s.
  return {
    ...value,
    upload: {
      ...value.upload,
      maxDurationSeconds: Math.min(90, value.upload.maxDurationSeconds),
      maxBytes: Math.min(50_000_000, value.upload.maxBytes),
    },
    ...(trim
      ? {
          trimming: {
            ...trim,
            maxSourceDurationSeconds: Math.min(
              180,
              trim.maxSourceDurationSeconds,
            ),
            maxSourceBytes: Math.min(50_000_000, trim.maxSourceBytes),
            maxDurationSeconds: Math.min(
              90,
              trim.maxDurationSeconds,
              value.upload.maxDurationSeconds,
            ),
            minDurationSeconds: Math.max(0.1, trim.minDurationSeconds),
            timePrecisionSeconds: Math.max(0.001, trim.timePrecisionSeconds),
          },
        }
      : {}),
  };
}

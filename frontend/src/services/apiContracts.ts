import type { GameMap, Lineup, VideoStatus } from "../domain/types";
import { isTarget } from "../domain/lineups";
import { ApiError } from "./apiClient";
import { safeHttpUrl } from "./runtimeConfig";

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
  importers: { youtube: { enabled: boolean }; tiktok: { enabled: boolean } };
};
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
  // User's 20-second hard ceiling is never relaxed by a misconfigured server.
  return {
    ...value,
    upload: {
      ...value.upload,
      maxDurationSeconds: Math.min(20, value.upload.maxDurationSeconds),
    },
  };
}

import type { Clip } from "./clip";
export type GrenadeType = "smoke" | "flashbang" | "molotov";
export type Side = "T" | "CT";
export type Target = { x: number; y: number };
export type VideoStatus =
  | "missing"
  | "awaiting_upload"
  | "uploading"
  | "queued"
  | "processing"
  | "ready"
  | "failed";
export type Video = {
  id: string;
  status: VideoStatus;
  playbackUrl?: string;
  sourceUrl?: string;
  error?: string;
};
export type Lineup = {
  id: string;
  title: string;
  mapId: string;
  type: GrenadeType;
  side: Side;
  instructions: string;
  video: Video;
  target: Target;
  origin?: Target | null;
  createdAt: string;
  updatedAt: string;
};
export type GameMap = {
  id: string;
  name: string;
  radarUrl: string;
  radarVersion: string;
  width: number;
  height: number;
  illustrative: boolean;
  credit?: { label: string; url: string };
  note?: string;
};
export type Filters = {
  mapId: string;
  type: GrenadeType | "all";
  side: Side | "all";
};
export type MediaDraft =
  | { kind: "keep" }
  | { kind: "file"; file: File | null; durationSeconds?: number; clip?: Clip }
  | { kind: "link"; sourceUrl: string; clip?: Clip };
export type LineupDraft = Omit<
  Lineup,
  "id" | "video" | "target" | "createdAt" | "updatedAt"
> & { target: Target | null; media: MediaDraft };
export const typeLabels: Record<GrenadeType, string> = {
  smoke: "Smoke",
  flashbang: "Flashbang",
  molotov: "Molotov",
};
export const videoLabels: Record<VideoStatus, string> = {
  missing: "Sem vídeo",
  awaiting_upload: "Aguardando envio",
  uploading: "Enviando arquivo",
  queued: "Na fila",
  processing: "Processando vídeo",
  ready: "Vídeo pronto",
  failed: "Falha na importação",
};

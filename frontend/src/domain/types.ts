import type { Clip } from "./clip";
import type { ImportInspection } from "./imports";
import type { MapLevelId } from "./mapLevels";
export const singleGrenadeTypes = ["smoke", "flashbang", "molotov", "he"] as const;
export const grenadeTypes = [...singleGrenadeTypes, "solo_exec"] as const;
export type SingleGrenadeType = (typeof singleGrenadeTypes)[number];
export type GrenadeType = (typeof grenadeTypes)[number];
export const isSingleGrenadeType = (value: unknown): value is SingleGrenadeType => (singleGrenadeTypes as readonly unknown[]).includes(value);
export const isGrenadeType = (value: unknown): value is GrenadeType => (grenadeTypes as readonly unknown[]).includes(value);
export type SoloDestination = Target & { type: SingleGrenadeType; level?: MapLevelId | null };
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
  /** Origem registrada pelo servidor (upload, tiktok, instagram…). */
  sourceType?: string;
  /** Intervalo da fonte usado no corte publicado, quando o servidor o registrou. */
  clip?: Clip;
  error?: string;
};
export type Lineup = {
  id: string;
  revision?: number;
  title: string;
  mapId: string;
  type: GrenadeType;
  side: Side;
  instructions: string;
  video: Video;
  target: Target;
  destinations?: SoloDestination[] | null;
  origin?: Target | null;
  /** Só em mapas com andares (Nuke). null/ausente = andar padrão do mapa. */
  originLevel?: MapLevelId | null;
  targetLevel?: MapLevelId | null;
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
  | { kind: "link"; sourceUrl: string; clip?: Clip; inspection?: ImportInspection; inspectedUrl?: string;
      /** Presente ao reeditar o corte de um vídeo já publicado: guarda o intervalo anterior. */
      reedit?: { previousClip?: Clip } };
export type LineupDraft = Omit<
  Lineup,
  "id" | "revision" | "video" | "target" | "createdAt" | "updatedAt"
> & { target: Target | null; media: MediaDraft };
export const typeLabels: Record<GrenadeType, string> = {
  smoke: "Smoke",
  flashbang: "Flashbang",
  molotov: "Molotov",
  he: "HE Grenade",
  solo_exec: "Solo Exec",
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

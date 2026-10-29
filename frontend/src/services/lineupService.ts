import type { GameMap, Lineup, LineupDraft, Video } from "../domain/types";
import { demoMaps, demoLineups } from "./demoData";
import { validateDraft, validateMp4 } from "../domain/validation";
import type { MediaCapabilities, Playback, SaveOptions } from "./apiContracts";

/** Integration boundary. No URLs, authentication scheme or API envelopes assumed. */
export interface LineupService {
  readonly mode: "demo" | "api";
  capabilities(signal?: AbortSignal): Promise<MediaCapabilities>;
  playback(video: Video, signal?: AbortSignal): Promise<Playback>;
  listMaps(signal?: AbortSignal): Promise<GameMap[]>;
  listLineups(signal?: AbortSignal): Promise<Lineup[]>;
  createLineup(draft: LineupDraft, options?: SaveOptions): Promise<Lineup>;
  updateLineup(
    id: string,
    draft: LineupDraft,
    options?: SaveOptions,
  ): Promise<Lineup>;
  deleteLineup(id: string): Promise<void>;
  dispose(): void;
}

export function createDemoService(): LineupService {
  let items = structuredClone(demoLineups);
  const localUrls = new Set<string>();
  function release(url?: string) {
    if (url && localUrls.delete(url)) URL.revokeObjectURL(url);
  }
  async function save(draft: LineupDraft, existing?: Lineup): Promise<Lineup> {
    const errors = validateDraft(
      draft,
      demoMaps.map((map) => map.id),
      !!existing,
    );
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    let video: Video;
    if (draft.media.kind === "keep") video = structuredClone(existing!.video);
    else if (draft.media.kind === "file" && draft.media.file) {
      const error = await validateMp4(draft.media.file);
      if (error) throw new Error(error);
      const playbackUrl = URL.createObjectURL(draft.media.file);
      localUrls.add(playbackUrl);
      video = { id: crypto.randomUUID(), status: "ready", playbackUrl };
    } else if (draft.media.kind === "link") {
      throw new Error(
        "Importação não iniciada (PLATFORM_UNSUPPORTED): Shorts e TikTok estão indisponíveis nesta prévia. Escolha Enviar MP4. Nenhum cadastro ou vídeo anterior foi alterado.",
      );
    } else throw new Error("Selecione um vídeo.");
    const now = new Date().toISOString();
    const item: Lineup = {
      id: existing?.id ?? crypto.randomUUID(),
      title: draft.title.trim(),
      mapId: draft.mapId,
      type: draft.type,
      side: draft.side,
      instructions: draft.instructions.trim(),
      target: { ...draft.target! },
      video,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) {
      items = items.map((current) =>
        current.id === existing.id ? item : current,
      );
      if (draft.media.kind !== "keep") release(existing.video.playbackUrl);
    } else items = [...items, item];
    return structuredClone(item);
  }
  return {
    mode: "demo",
    async capabilities(signal) {
      signal?.throwIfAborted();
      return {
        upload: { enabled: true, maxBytes: 50_000_000, maxDurationSeconds: 20 },
        importers: { youtube: { enabled: false }, tiktok: { enabled: false } },
      };
    },
    async playback(video, signal) {
      signal?.throwIfAborted();
      if (!video.playbackUrl)
        throw new Error("Vídeo não disponível nesta sessão.");
      return { url: video.playbackUrl, mimeType: "video/mp4" };
    },
    async listMaps(signal) {
      signal?.throwIfAborted();
      return structuredClone(demoMaps);
    },
    async listLineups(signal) {
      signal?.throwIfAborted();
      return structuredClone(items);
    },
    async createLineup(draft) {
      return save(draft);
    },
    async updateLineup(id, draft) {
      const existing = items.find((item) => item.id === id);
      if (!existing)
        throw new Error("A granada não foi encontrada. Atualize a lista.");
      return save(draft, existing);
    },
    async deleteLineup(id) {
      const item = items.find((current) => current.id === id);
      if (!item)
        throw new Error("A granada não foi encontrada. Atualize a lista.");
      release(item.video.playbackUrl);
      items = items.filter((current) => current.id !== id);
    },
    dispose() {
      localUrls.forEach((url) => URL.revokeObjectURL(url));
      localUrls.clear();
    },
  };
}

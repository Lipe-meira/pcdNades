import type { LineupDraft, Video } from "../domain/types";
import {
  validateDraft,
  validateDuration,
  validateMp4,
  validateSourceUrl,
} from "../domain/validation";
import { ApiClient, ApiError } from "./apiClient";
import {
  checkCapabilities,
  checkMedia,
  contractError,
  mapApiGrenade,
  mapApiMap,
  clipLimits,
  checkImportInspection,
  checkImportLimits,
} from "./apiContracts";
import type {
  ApiGrenade,
  ApiMap,
  MediaCapabilities,
  MediaRecord,
  Playback,
  SaveOptions,
  UploadSession,
} from "./apiContracts";
import type { LineupService } from "./lineupService";
import { safeHttpUrl } from "./runtimeConfig";
import { recognizeVideoSource } from "../domain/videoSource";
import { sameClip, selectionDurationError, validateClip } from "../domain/clip";
import type { Clip } from "../domain/clip";
import { importSelectionError } from "../domain/imports";
import type { ImportInspection, ImportLimits } from "../domain/imports";

export type SignedUploader = (
  session: UploadSession,
  file: File,
) => Promise<void>;
type Envelope<T> = { data: T };
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const done = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Cancelado", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export function createApiService(
  client: ApiClient,
  upload: SignedUploader,
  settings: {
    wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
    maxPolls?: number;
  } = {},
): LineupService {
  async function capabilities(signal?: AbortSignal) {
    return checkCapabilities(
      (
        await client.request<Envelope<MediaCapabilities>>(
          "/media/capabilities",
          { signal },
        )
      ).data,
    );
  }
  async function poll(
    media: MediaRecord,
    options: SaveOptions,
    expectedClip?: Clip,
  ): Promise<string> {
    const expectedSourceId = media.sourceId;
    const expectedSourceUrl = media.sourceUrl;
    for (let index = 0; index < (settings.maxPolls ?? 300); index++) {
      options.signal?.throwIfAborted();
      checkMedia(media);
      if (media.sourceType === "tiktok" && (media.sourceId !== expectedSourceId || media.sourceUrl !== expectedSourceUrl))
        throw new ApiError("MEDIA_SELECTION_CHANGED");
      if (!sameClip(media.clip, expectedClip))
        throw new ApiError("MEDIA_SELECTION_CHANGED");
      options.onProgress?.({
        status: media.status,
        mediaId: media.id,
        stage: media.stage,
      });
      if (media.status === "ready") return media.id;
      if (media.status === "failed")
        throw new ApiError(
          media.error?.code ?? "PROCESSING_FAILED",
          0,
          undefined,
          media.error?.message ??
            "Não foi possível processar o vídeo. Escolha outro MP4.",
        );
      if (media.status === "awaiting_upload")
        throw new ApiError(
          "UPLOAD_INCOMPLETE",
          0,
          undefined,
          "O envio não foi concluído. Selecione o arquivo novamente para iniciar outro envio.",
        );
      await (settings.wait ?? wait)(3000, options.signal);
      media = (
        await client.request<Envelope<MediaRecord>>(
          `/media/${encodeURIComponent(media.id)}`,
          { authenticated: true, signal: options.signal },
        )
      ).data;
      if (media.sourceType === "tiktok" && ["queued", "processing"].includes(media.status))
        media = await completeRecord(media.id, options, true);
    }
    throw new ApiError(
      "PROCESSING_PENDING",
      0,
      undefined,
      "O processamento ainda não terminou. Seu cadastro anterior foi preservado. Use Salvar novamente para retomar o acompanhamento.",
    );
  }
  async function resolveMedia(
    draft: LineupDraft,
    options: SaveOptions,
  ): Promise<string> {
    const clip = draft.media.kind === "keep" ? undefined : draft.media.clip;
    if (options.mediaId) {
      const media = await client.request<Envelope<MediaRecord>>(
        `/media/${encodeURIComponent(options.mediaId)}`,
        { authenticated: true, signal: options.signal },
      );
      if (!sameClip(media.data.clip, clip))
        throw new ApiError("MEDIA_SELECTION_CHANGED");
      if (draft.media.kind === "link") {
        const inspection = draft.media.inspection;
        if (!inspection || draft.media.inspectedUrl !== draft.media.sourceUrl.trim() ||
          media.data.sourceId !== inspection.sourceId || media.data.sourceUrl !== inspection.sourceUrl)
          throw new ApiError("MEDIA_SELECTION_CHANGED");
        if (["queued", "processing", "awaiting_upload"].includes(checkMedia(media.data).status))
          return confirmMedia(options.mediaId, options, clip, true);
      }
      if (checkMedia(media.data).status === "awaiting_upload")
        return confirmMedia(options.mediaId, options, clip);
      return poll(media.data, options, clip);
    }
    const caps = await capabilities(options.signal);
    if (draft.media.kind === "link") {
      const error = validateSourceUrl(draft.media.sourceUrl);
      if (error) throw new Error(error);
      const source = recognizeVideoSource(draft.media.sourceUrl);
      if (!source || source.platform !== "tiktok" || !caps.importers.tiktok.enabled || !caps.importers.tiktok.inspection)
        throw new ApiError("PLATFORM_UNSUPPORTED", 422);
      const inspection = draft.media.inspection && checkImportInspection(draft.media.inspection);
      const issue = importSelectionError(inspection, clip);
      if (issue) throw new Error(issue);
      if (draft.media.inspectedUrl !== draft.media.sourceUrl.trim()) throw new ApiError("SOURCE_CHANGED");
      if (Date.parse(inspection!.expiresAt) <= Date.now()) throw new ApiError("SOURCE_EXPIRED");
      const limits = checkImportLimits(caps.importers.tiktok as ImportLimits);
      if (inspection!.durationSeconds > limits.maxSourceDurationSeconds) throw new ApiError("SOURCE_TOO_LONG");
      const changedLimits = validateClip(clip!, { ...inspection!.limits,
        maxDurationSeconds: Math.min(limits.maxDurationSeconds, inspection!.limits.maxDurationSeconds),
        sourceDurationSeconds: inspection!.durationSeconds });
      if (changedLimits) throw new Error(changedLimits);
      const result = await client.request<Envelope<MediaRecord & { mediaId: string }>>(
        "/media/imports",
        {
          method: "POST",
          authenticated: true,
          body: {
            sourceId: inspection!.sourceId,
            clip,
          },
          signal: options.signal,
        },
      );
      if (checkMedia(result.data).id !== result.data.mediaId || result.data.sourceId !== inspection!.sourceId ||
        result.data.sourceUrl !== inspection!.sourceUrl || !sameClip(result.data.clip, clip)) contractError();
      return confirmMedia(result.data.id, options, clip, true);
    }
    if (draft.media.kind !== "file" || !draft.media.file)
      throw new Error("Selecione um MP4 para publicar a granada.");
    if (!caps.upload.enabled)
      throw new ApiError(
        "UPLOAD_UNAVAILABLE",
        503,
        undefined,
        "O envio de arquivos está indisponível no servidor.",
      );
    if (clip && !caps.trimming?.enabled) throw new ApiError("CLIP_UNSUPPORTED");
    const error = await validateMp4(
      draft.media.file,
      clip
        ? Math.min(caps.upload.maxBytes, caps.trimming!.maxSourceBytes)
        : caps.upload.maxBytes,
    );
    if (error) throw new Error(error);
    const durationError = selectionDurationError(
      draft.media.durationSeconds ?? NaN,
      clip,
      clipLimits(caps),
    );
    if (durationError) throw new Error(durationError);
    const session = (
      await client.request<Envelope<UploadSession>>("/media/uploads", {
        method: "POST",
        authenticated: true,
        signal: options.signal,
        ...(clip ? { body: { clip } } : {}),
      })
    ).data;
    if (
      !session?.mediaId ||
      session.upload?.protocol !== "supabase-signed" ||
      !session.upload.path ||
      !session.upload.token ||
      !session.upload.url ||
      !session.limits
    )
      contractError();
    if (
      !Number.isSafeInteger(session.limits.maxBytes) ||
      session.limits.maxBytes <= 0 ||
      !Number.isFinite(session.limits.maxDurationSeconds) ||
      session.limits.maxDurationSeconds <= 0
    )
      contractError();
    if (
      draft.media.file.size > session.limits.maxBytes ||
      !validateDuration(
        clip
          ? clip.endSeconds - clip.startSeconds
          : (draft.media.durationSeconds ?? NaN),
        Math.min(90, session.limits.maxDurationSeconds),
      )
    )
      throw new Error(
        "Os limites do servidor mudaram. Atualize a página e selecione um vídeo compatível.",
      );
    options.onProgress?.({ status: "uploading", mediaId: session.mediaId });
    options.signal?.throwIfAborted();
    await upload(session, draft.media.file);
    options.signal?.throwIfAborted();
    return confirmMedia(session.mediaId, options, clip);
  }
  async function confirmMedia(
    mediaId: string,
    options: SaveOptions,
    expectedClip?: Clip,
    importing = false,
  ): Promise<string> {
    return poll(await completeRecord(mediaId, options, importing), options, expectedClip);
  }
  async function completeRecord(mediaId: string, options: SaveOptions, importing = false): Promise<MediaRecord> {
    options.signal?.throwIfAborted();
    options.onProgress?.({ status: "confirming", mediaId });
    let media: MediaRecord;
    const monitor = new AbortController();
    let checking = false;
    const timer = importing ? setInterval(async () => {
      if (checking || monitor.signal.aborted || options.signal?.aborted) return;
      checking = true;
      try {
        const result = await client.request<Envelope<MediaRecord>>(`/media/${encodeURIComponent(mediaId)}`, {
          authenticated: true, signal: options.signal ? AbortSignal.any([monitor.signal, options.signal]) : monitor.signal,
        });
        if (!monitor.signal.aborted && !options.signal?.aborted && checkMedia(result.data).id === mediaId)
          options.onProgress?.({ status: result.data.status, mediaId, stage: result.data.stage });
      } catch { /* The complete request remains authoritative; monitoring is optional. */ }
      finally { checking = false; }
    }, 3500) : undefined;
    try {
      try {
      media = (
        await client.request<Envelope<MediaRecord>>(
          `/media/${encodeURIComponent(mediaId)}/complete`,
          {
            method: "POST",
            authenticated: true,
            signal: options.signal,
            timeoutMs: 150_000,
            ...(importing ? { body: {} } : {}),
          },
        )
      ).data;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error;
      media = (
        await client.request<Envelope<MediaRecord>>(
          `/media/${encodeURIComponent(mediaId)}`,
          { authenticated: true, signal: options.signal },
        )
      ).data;
      if (checkMedia(media).status === "awaiting_upload") throw error;
      }
      if (checkMedia(media).id !== mediaId) contractError();
      return media;
    } finally {
      if (timer) clearInterval(timer);
      monitor.abort();
    }
  }
  async function save(
    draft: LineupDraft,
    id?: string,
    options: SaveOptions = {},
  ) {
    const errors = validateDraft(draft, [draft.mapId], !!id);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const { media: _media, target, ...editable } = draft;
    const body: Record<string, unknown> = {
      ...editable,
      target,
      title: draft.title.trim(),
      instructions: draft.instructions.trim(),
    };
    if (draft.media.kind !== "keep")
      body.videoId = await resolveMedia(draft, options);
    options.onProgress?.({
      status: "publishing",
      mediaId: body.videoId as string | undefined,
    });
    const result = await client.request<Envelope<ApiGrenade>>(
      id ? `/grenades/${encodeURIComponent(id)}` : "/grenades",
      {
        method: id ? "PATCH" : "POST",
        authenticated: true,
        body,
        signal: options.signal,
      },
    );
    return mapApiGrenade(result.data);
  }
  return {
    mode: "api",
    capabilities,
    async inspectImport(sourceUrl, signal) {
      if (recognizeVideoSource(sourceUrl)?.platform !== "tiktok") throw new ApiError("PLATFORM_UNSUPPORTED");
      const caps = await capabilities(signal);
      if (!caps.importers.tiktok.enabled || !caps.importers.tiktok.inspection) throw new ApiError("IMPORT_UNAVAILABLE");
      const result = await client.request<Envelope<ImportInspection>>("/media/imports/inspect", {
        method: "POST", authenticated: true, body: { sourceUrl: sourceUrl.trim() }, signal, timeoutMs: 40_000,
      });
      return checkImportInspection(result.data);
    },
    async listMaps(signal) {
      const result = await client.request<Envelope<ApiMap[]>>("/maps", {
        signal,
      });
      if (!Array.isArray(result?.data)) contractError();
      return result.data.map(mapApiMap);
    },
    async listLineups(signal) {
      const items = new Map<string, ReturnType<typeof mapApiGrenade>>();
      for (let offset = 0; offset < 100_000; offset += 100) {
        const page = await client.request<
          Envelope<ApiGrenade[]> & {
            pagination: { limit: number; offset: number; total: number };
          }
        >("/grenades", { query: { limit: 100, offset }, signal });
        if (
          !Array.isArray(page?.data) ||
          !page.pagination ||
          !Number.isSafeInteger(page.pagination.total) ||
          page.pagination.total < 0 ||
          page.pagination.offset !== offset ||
          page.pagination.limit !== 100
        )
          contractError();
        page.data
          .map(mapApiGrenade)
          .forEach((item) => items.set(item.id, item));
        if (offset + 100 >= page.pagination.total) return [...items.values()];
        if (!page.data.length) contractError();
      }
      throw new ApiError(
        "LIBRARY_LIMIT",
        0,
        undefined,
        "A biblioteca é grande demais para carregar de uma vez. É necessário consultar com paginação na interface.",
      );
    },
    createLineup: (draft, options) => save(draft, undefined, options),
    updateLineup: (id, draft, options) => save(draft, id, options),
    async deleteLineup(id) {
      await client.request(`/grenades/${encodeURIComponent(id)}`, {
        method: "DELETE",
        authenticated: true,
      });
    },
    async playback(video: Video, signal): Promise<Playback> {
      const data = (
        await client.request<Envelope<Playback>>(
          `/media/${encodeURIComponent(video.id)}/playback`,
          { signal },
        )
      ).data;
      if (
        !data?.url ||
        data.mimeType !== "video/mp4" ||
        !data.expiresAt ||
        !Number.isFinite(Date.parse(data.expiresAt))
      )
        contractError();
      try {
        safeHttpUrl(data.url);
      } catch {
        contractError();
      }
      return data;
    },
    dispose() {
      /* The API owns persistence; there are no local media objects. */
    },
  };
}

import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/services/apiClient";
import { createApiService } from "../src/services/apiService";
import { checkImportInspection, checkCapabilities } from "../src/services/apiContracts";
import type { ImportInspection } from "../src/domain/imports";
import type { LineupDraft } from "../src/domain/types";

const limits = { maxSourceDurationSeconds: 7200, maxDurationSeconds: 30, maxBytes: 50_000_000, minDurationSeconds: .1, timePrecisionSeconds: .001 };
const input = "https://vt.tiktok.com/ZSgqvRtpM/";
function inspected(): ImportInspection { return { sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", provider: "tiktok", sourceUrl: "https://www.tiktok.com/@qa/video/1234567890", videoId: "1234567890", title: "Vídeo controlado longo", author: null, durationSeconds: 7200, expiresAt: new Date(Date.now() + 900_000).toISOString(), preview: null, previewReasonCode: "PREVIEW_UNAVAILABLE", limits }; }
const caps = { upload: { enabled: true, maxBytes: 50_000_000, maxDurationSeconds: 90 },
  importers: { youtube: { enabled: false }, instagram: { enabled: false }, tiktok: { enabled: true, inspection: true, ...limits } },
  trimming: { enabled: true, maxSourceDurationSeconds: 180, maxSourceBytes: 50_000_000, maxDurationSeconds: 90, minDurationSeconds: .1, timePrecisionSeconds: .001 } };
function harness() {
  const inspection = inspected();
  const clip = { startSeconds: 7170, endSeconds: 7200 };
  const media = { id: "media-id", sourceId: inspection.sourceId, sourceType: "tiktok", sourceUrl: inspection.sourceUrl, clip, status: "queued", stage: "resolving", error: null, metadata: { sourceDurationSeconds: 7200 } };
  const state = { creates: 0, completes: 0, publishes: 0, busy: false, network: false, failed: false, mismatch: false };
  const requests: { path: string; body: unknown }[] = [];
  const client = new ApiClient("/api/v1", async () => "qa", async (url, init) => {
    const path = String(url); const body = init?.body ? JSON.parse(init.body as string) : undefined;
    requests.push({ path, body });
    if (path.endsWith("/capabilities")) return Response.json({ data: caps });
    if (path.endsWith("/inspect")) { expect(body).toEqual({ sourceUrl: input }); return Response.json({ data: inspection }); }
    if (path.endsWith("/imports")) { state.creates++; expect(body).toEqual({ sourceId: inspection.sourceId, clip }); return Response.json({ data: { ...media, mediaId: media.id } }, { status: 201 }); }
    if (path.endsWith("/complete")) {
      state.completes++; expect(body).toEqual({});
      if (state.network) { state.network = false; throw new TypeError("network"); }
      if (state.busy) { state.busy = false; return Response.json({ error: { code: "PROCESSOR_BUSY" } }, { status: 503 }); }
      return Response.json({ data: { ...media, status: state.failed ? "failed" : "ready", stage: null,
        error: state.failed ? { code: "IMPORT_NETWORK_LIMIT", message: "Limite de obtenção" } : null } });
    }
    if (path.endsWith("/media/media-id")) return Response.json({ data: { ...media, sourceId: state.mismatch ? "another-source" : media.sourceId } });
    if (path.endsWith("/grenades")) { state.publishes++; return Response.json({ data: { ...body, id: "grenade-id", video: { ...media, status: "ready" } } }); }
    throw new Error(`Unexpected ${path}`);
  });
  const service = createApiService(client, async () => { throw new Error("Importação não faz upload no navegador"); });
  const draft: LineupDraft = { title: "Trecho QA", mapId: "mirage", type: "smoke", side: "T", instructions: "Teste controlado", target: { x: .5, y: .5 }, origin: { x: 0, y: 1 },
    media: { kind: "link", sourceUrl: input, inspectedUrl: input, inspection, clip } };
  return { state, service, requests, draft, inspection };
}

describe("TikTok: consulta vinculada e importação somente do trecho", () => {
  it("consulta metadados sem expor prévia/CDN e mantém limites separados do upload", async () => {
    const h = harness();
    expect(await h.service.inspectImport!(input)).toMatchObject({ durationSeconds: 7200, preview: null, previewReasonCode: "PREVIEW_UNAVAILABLE" });
    expect(checkCapabilities(caps).trimming!.maxSourceDurationSeconds).toBe(180);
    const saved = await h.service.createLineup(h.draft);
    expect(saved.video.id).toBe("media-id");
    expect(h.state).toMatchObject({ creates: 1, completes: 1, publishes: 1 });
  });
  it("rejeita duração desconhecida/live, acima do teto e resposta com prévia não contratada", () => {
    for (const durationSeconds of [0, NaN, Infinity, 7201]) expect(() => checkImportInspection({ ...inspected(), durationSeconds })).toThrow();
    expect(() => checkImportInspection({ ...inspected(), preview: "https://cdn.invalid/fake" } as unknown as ImportInspection)).toThrow();
  });
  it("capabilities usa limites diretos e rejeita inspection sem limites válidos", () => {
    expect(checkCapabilities(caps).importers.tiktok).toMatchObject({ inspection: true, maxSourceDurationSeconds: 7200, maxDurationSeconds: 30 });
    for (const tiktok of [
      { enabled: true, inspection: true },
      { enabled: true, inspection: true, limits },
      { enabled: true, inspection: true, ...limits, maxBytes: NaN },
      { enabled: true, inspection: true, ...limits, maxSourceDurationSeconds: 0 },
    ]) expect(() => checkCapabilities({ ...caps, importers: { ...caps.importers, tiktok } })).toThrow();
  });
  it("não cria importação com consulta expirada, link alterado, sem trecho ou intervalo longo", async () => {
    const h = harness();
    if (h.draft.media.kind !== "link") throw new Error();
    await expect(h.service.createLineup({ ...h.draft, media: { ...h.draft.media, inspection: { ...h.inspection, expiresAt: new Date(0).toISOString() } } })).rejects.toMatchObject({ code: "SOURCE_EXPIRED" });
    await expect(h.service.createLineup({ ...h.draft, media: { ...h.draft.media, inspectedUrl: "old-url" } })).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
    await expect(h.service.createLineup({ ...h.draft, media: { ...h.draft.media, clip: undefined } })).rejects.toThrow("início e o fim");
    await expect(h.service.createLineup({ ...h.draft, media: { ...h.draft.media, clip: { startSeconds: 0, endSeconds: 30.001 } } })).rejects.toThrow("30");
    expect(h.state.creates).toBe(0);
  });
  it("PROCESSOR_BUSY retoma o mesmo mediaId com sourceId/clip após expirar a consulta", async () => {
    const h = harness(); h.state.busy = true;
    await expect(h.service.createLineup(h.draft)).rejects.toMatchObject({ code: "PROCESSOR_BUSY" });
    h.inspection.expiresAt = new Date(0).toISOString();
    await h.service.createLineup(h.draft, { mediaId: "media-id" });
    expect(h.state).toMatchObject({ creates: 1, completes: 2, publishes: 1 });
  });
  it("perda do complete não causa novo POSTimports ao retomar", async () => {
    const h = harness(); h.state.network = true;
    const progress: string[] = [];
    await expect(h.service.createLineup(h.draft, { onProgress: item => { if (item.mediaId) progress.push(item.mediaId); } })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(progress).toContain("media-id");
    await h.service.createLineup(h.draft, { mediaId: "media-id" });
    expect(h.state).toMatchObject({ creates: 1, completes: 2, publishes: 1 });
  });
  it("retomada recusa outra sourceId mesmo com clip igual e não publica failed", async () => {
    const h = harness(); h.state.mismatch = true;
    await expect(h.service.createLineup(h.draft, { mediaId: "media-id" })).rejects.toMatchObject({ code: "MEDIA_SELECTION_CHANGED" });
    h.state.mismatch = false; h.state.failed = true;
    await expect(h.service.createLineup(h.draft)).rejects.toMatchObject({ code: "IMPORT_NETWORK_LIMIT" });
    expect(h.state.publishes).toBe(0);
  });
  it("consulta usa deadline40s e distingue timeout sem criar mídia", async () => {
    const expired = new AbortController(); expired.abort(new DOMException("timeout", "TimeoutError"));
    const active = new AbortController(); let count = 0;
    const timeouts: number[] = [];
    const timer = vi.spyOn(AbortSignal, "timeout").mockImplementation(milliseconds => {
      timeouts.push(milliseconds); return ++count === 2 ? expired.signal : active.signal;
    });
    try {
      const client = new ApiClient("/api/v1", async () => "qa", async (url, options) => {
        if (String(url).endsWith("/capabilities")) return Response.json({ data: caps });
        expect(String(url)).toContain("/imports/inspect"); options!.signal!.throwIfAborted();
        throw new Error("Inspection should have timed out");
      });
      await expect(createApiService(client, async () => {}).inspectImport!(input)).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
      expect(timeouts).toEqual([30_000, 40_000]);
    } finally { timer.mockRestore(); }
  });
});

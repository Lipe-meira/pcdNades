import { describe, expect, it } from "vitest";
import { ApiClient } from "../src/services/apiClient";
import { createApiService } from "../src/services/apiService";
import { mapApiGrenade } from "../src/services/apiContracts";
import type { ApiGrenade } from "../src/services/apiContracts";
import type { ImportInspection } from "../src/domain/imports";
import type { LineupDraft } from "../src/domain/types";
import { importedSource, initialClipFor, reeditDraft } from "../src/domain/reedit";

const limits = { maxSourceDurationSeconds: 7200, maxDurationSeconds: 30, maxBytes: 50_000_000, minDurationSeconds: .1, timePrecisionSeconds: .001 };
const url = "https://www.tiktok.com/@qa/video/1234567890";
const oldClip = { startSeconds: 10, endSeconds: 20 };
const newClip = { startSeconds: 12.5, endSeconds: 25 };
const base: ApiGrenade = {
  id: "grenade-id", revision: 4, title: "Smoke", mapId: "mirage", type: "smoke", side: "T", instructions: "x",
  target: { x: .4, y: .6 }, origin: { x: .1, y: .1 }, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
  video: { id: "old-media", status: "ready", sourceType: "tiktok", sourceUrl: url, sourceId: "src-1", clip: oldClip, stage: null, error: null, metadata: null },
};
const inspection = (duration = 7200): ImportInspection => ({ sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", provider: "tiktok", sourceUrl: url, videoId: "1234567890",
  title: "Fonte", author: null, durationSeconds: duration, expiresAt: new Date(Date.now() + 900_000).toISOString(), preview: null, previewReasonCode: "PREVIEW_UNAVAILABLE", limits });

describe("recuperação da URL original e do corte anterior", () => {
  it("mapeia sourceType, sourceUrl e clip do vídeo publicado", () => {
    const video = mapApiGrenade(base).video;
    expect(video).toMatchObject({ id: "old-media", sourceType: "tiktok", sourceUrl: url, clip: oldClip });
    expect(importedSource(video)).toEqual({ available: true, platform: "tiktok", sourceUrl: url, clip: oldClip });
  });
  it("descarta clip malformado sem quebrar a listagem", () => {
    for (const clip of [{ startSeconds: 5, endSeconds: 5 }, { startSeconds: -1, endSeconds: 2 }, { startSeconds: "1", endSeconds: 2 }, null] as never[])
      expect(mapApiGrenade({ ...base, video: { ...base.video!, clip } }).video.clip).toBeUndefined();
  });
  it("vídeo importado sem URL válida é sinalizado como indisponível", () => {
    for (const sourceUrl of [null, "", "http://www.tiktok.com/@qa/video/1", "https://evil.example/@qa/video/1", "javascript:alert(1)"])
      expect(importedSource(mapApiGrenade({ ...base, video: { ...base.video!, sourceUrl } }).video)).toEqual({ available: false, reason: "missing-url" });
  });
  it("upload MP4 e vídeos antigos não têm reedição", () => {
    expect(importedSource(mapApiGrenade({ ...base, video: { ...base.video!, sourceType: "upload", sourceUrl: null, clip: null } }).video)).toBeNull();
    expect(importedSource({ ...mapApiGrenade(base).video, sourceType: undefined })).toBeNull();
    expect(importedSource({ ...mapApiGrenade(base).video, sourceType: "tiktok-do-outro-tipo" })).toBeNull();
  });
  it("Reeditar corte monta o rascunho de link com a URL e o intervalo anterior, sem inspeção", () => {
    const source = importedSource(mapApiGrenade(base).video)!;
    expect(source.available && reeditDraft(source)).toEqual({ kind: "link", sourceUrl: url, reedit: { previousClip: oldClip } });
  });
});

describe("intervalo inicial após nova consulta", () => {
  it("reaproveita o corte anterior quando cabe na fonte e nos limites", () => {
    expect(initialClipFor(inspection(), oldClip)).toEqual({ clip: oldClip, reused: true });
  });
  it("volta ao padrão quando o corte não cabe (fonte menor, acima do limite ou sem registro)", () => {
    expect(initialClipFor(inspection(15), oldClip)).toEqual({ clip: { startSeconds: 0, endSeconds: 15 }, reused: false });
    expect(initialClipFor(inspection(), { startSeconds: 0, endSeconds: 60 })).toEqual({ clip: { startSeconds: 0, endSeconds: 30 }, reused: false });
    expect(initialClipFor(inspection()).reused).toBe(false);
  });
});

const caps = { upload: { enabled: true, maxBytes: 50_000_000, maxDurationSeconds: 90 },
  importers: { youtube: { enabled: false }, instagram: { enabled: false }, tiktok: { enabled: true, inspection: true, ...limits } },
  trimming: { enabled: true, maxSourceDurationSeconds: 180, maxSourceBytes: 50_000_000, maxDurationSeconds: 90, minDurationSeconds: .1, timePrecisionSeconds: .001 } };
function harness(outcome: "ready" | "failed" | "revision-conflict") {
  const calls: { method: string; path: string; body?: any }[] = [];
  const media = { id: "new-media", mediaId: "new-media", sourceId: inspection().sourceId, sourceType: "tiktok", sourceUrl: url, clip: newClip, stage: null, error: null, metadata: null };
  const client = new ApiClient("/api/v1", async () => "qa", async (input, init) => {
    const path = String(input); const method = init?.method ?? "GET";
    calls.push({ method, path, body: init?.body ? JSON.parse(init.body as string) : undefined });
    if (path.endsWith("/capabilities")) return Response.json({ data: caps });
    if (path.endsWith("/media/imports")) return Response.json({ data: { ...media, status: "queued" } }, { status: 201 });
    if (path.endsWith("/complete")) return Response.json({ data: outcome === "failed"
      ? { ...media, status: "failed", error: { code: "IMPORT_ACCESS_DENIED", message: "recusado" } } : { ...media, status: "ready" } });
    if (path.endsWith("/grenades/grenade-id") && method === "PATCH") {
      if (outcome === "revision-conflict") return Response.json({ error: { code: "GRENADE_VERSION_CONFLICT" } }, { status: 409 });
      return Response.json({ data: { ...base, revision: 5, video: { ...media, status: "ready" } } });
    }
    throw new Error(`Inesperado ${method} ${path}`);
  });
  const service = createApiService(client, async () => { throw new Error("sem upload"); });
  const draft: LineupDraft = { title: "Smoke", mapId: "mirage", type: "smoke", side: "T", instructions: "x", target: { x: .4, y: .6 }, origin: { x: .1, y: .1 },
    media: { kind: "link", sourceUrl: url, inspectedUrl: url, inspection: inspection(), clip: newClip, reedit: { previousClip: oldClip } } };
  return { calls, service, draft };
}

describe("publicação do novo intervalo", () => {
  it("importa o novo trecho e só então faz PATCH com o novo videoId e a revisão aberta", async () => {
    const { calls, service, draft } = harness("ready");
    const saved = await service.updateLineup("grenade-id", draft, { expectedRevision: 4 });
    expect(saved.video).toMatchObject({ id: "new-media", clip: newClip });
    const patch = calls.findIndex(call => call.method === "PATCH");
    expect(calls.findIndex(call => call.path.endsWith("/complete"))).toBeLessThan(patch);
    expect(calls[patch].body).toMatchObject({ videoId: "new-media", expectedRevision: 4 });
    expect(calls.some(call => call.method === "DELETE")).toBe(false);
  });
  it("falha de importação não publica nem toca no vídeo anterior", async () => {
    const { calls, service, draft } = harness("failed");
    await expect(service.updateLineup("grenade-id", draft, { expectedRevision: 4 })).rejects.toBeTruthy();
    expect(calls.some(call => call.method === "PATCH" || call.method === "DELETE")).toBe(false);
  });
  it("atualização concorrente: 409 propaga o conflito e não repete o PATCH", async () => {
    const { calls, service, draft } = harness("revision-conflict");
    await expect(service.updateLineup("grenade-id", draft, { expectedRevision: 4 })).rejects.toMatchObject({ code: "GRENADE_VERSION_CONFLICT", status: 409 });
    expect(calls.filter(call => call.method === "PATCH")).toHaveLength(1);
    expect(calls.some(call => call.method === "DELETE")).toBe(false);
  });
});

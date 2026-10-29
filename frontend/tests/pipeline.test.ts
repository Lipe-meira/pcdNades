import { describe, expect, it } from "vitest";
import { ApiClient } from "../src/services/apiClient";
import { createApiService } from "../src/services/apiService";
import type { LineupDraft } from "../src/domain/types";

const file = new File(
  [new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109])],
  "test.mp4",
  { type: "video/mp4" },
);
const draft: LineupDraft = {
  title: "Teste API",
  mapId: "mirage",
  type: "smoke",
  side: "T",
  instructions: "Teste controlado.",
  target: { x: 0.2, y: 0.8 },
  media: { kind: "file", file, durationSeconds: 2 },
};
const caps = {
  upload: { enabled: true, maxBytes: 50_000_000, maxDurationSeconds: 20 },
  importers: { youtube: { enabled: false }, tiktok: { enabled: false } },
};
const remoteVideo = {
  id: "media-id",
  status: "ready",
  sourceType: "upload",
  sourceUrl: null,
  stage: null,
  error: null,
  metadata: {},
};
const remote = {
  id: "grenade-id",
  ...draft,
  media: undefined,
  video: remoteVideo,
  createdAt: "2026-10-29T00:00:00Z",
  updatedAt: "2026-10-29T00:00:00Z",
};

describe("pipeline remoto com respostas controladas (não é E2E real)", () => {
  it("publica somente depois do upload, complete e status ready", async () => {
    const steps: string[] = [];
    let poll = 0;
    const client = new ApiClient(
      "https://api.example.com/api/v1",
      async () => "test-token",
      async (url, init) => {
        const path = new URL(String(url)).pathname.replace("/api/v1", "");
        steps.push(`${init?.method} ${path}`);
        if (path === "/media/capabilities")
          return Response.json({ data: caps });
        if (path === "/media/uploads")
          return Response.json({
            data: {
              mediaId: "media-id",
              upload: {
                protocol: "supabase-signed",
                url: "https://project.supabase.co/storage/signed",
                path: "media-id/source.mp4",
                token: "test-signed-token",
              },
              limits: caps.upload,
            },
          });
        if (path === "/media/media-id/complete")
          return Response.json({ data: { ...remoteVideo, status: "queued" } });
        if (path === "/media/media-id")
          return Response.json({
            data: {
              ...remoteVideo,
              status: ++poll === 1 ? "processing" : "ready",
            },
          });
        if (path === "/grenades" && init?.method === "POST") {
          expect(JSON.parse(init.body as string).videoId).toBe("media-id");
          return Response.json({ data: remote });
        }
        throw new Error(`Unexpected ${path}`);
      },
    );
    const service = createApiService(
      client,
      async () => {
        steps.push("SIGNED UPLOAD");
      },
      { wait: async () => {} },
    );
    const result = await service.createLineup(draft);
    expect(result.video.status).toBe("ready");
    expect(steps.indexOf("SIGNED UPLOAD")).toBeLessThan(
      steps.indexOf("POST /media/media-id/complete"),
    );
    expect(steps.at(-1)).toBe("POST /grenades");
    expect(poll).toBe(2);
    expect(result.video.playbackUrl).toBeUndefined();
  });
  it("não publica em falha e permite retomar tarefa pronta sem reupload", async () => {
    let published = 0,
      uploaded = 0;
    const client = new ApiClient(
      "/api/v1",
      async () => "test-token",
      async (url, init) => {
        if (String(url).endsWith("/media/media-id"))
          return Response.json({ data: remoteVideo });
        if (String(url).endsWith("/grenades") && init?.method === "POST") {
          published++;
          return Response.json({ data: remote });
        }
        if (String(url).endsWith("/media/capabilities"))
          return Response.json({ data: caps });
        throw new Error("Unexpected");
      },
    );
    const service = createApiService(client, async () => {
      uploaded++;
    });
    await service.createLineup(draft, { mediaId: "media-id" });
    expect(published).toBe(1);
    expect(uploaded).toBe(0);
    const before = published;
    await expect(
      service.createLineup({
        ...draft,
        media: {
          kind: "link",
          sourceUrl: "https://www.youtube.com/shorts/abcdefghijk",
        },
      }),
    ).rejects.toMatchObject({ code: "PLATFORM_UNSUPPORTED" });
    expect(published).toBe(before);
  });
  it("propaga falha de processamento sem PATCH e preserva o registro anterior", async () => {
    let patched = false;
    const client = new ApiClient(
      "/api/v1",
      async () => "test-token",
      async (url, init) => {
        if (init?.method === "PATCH") {
          patched = true;
          return Response.json({ data: remote });
        }
        if (String(url).endsWith("/media/media-id"))
          return Response.json({
            data: {
              ...remoteVideo,
              status: "failed",
              error: {
                code: "PROCESSING_FAILED",
                message: "Arquivo inválido.",
              },
            },
          });
        throw new Error("Unexpected");
      },
    );
    await expect(
      createApiService(client, async () => {}).updateLineup(
        "grenade-id",
        draft,
        { mediaId: "media-id" },
      ),
    ).rejects.toThrow("Arquivo inválido");
    expect(patched).toBe(false);
  });
  it("segue paginação e não usa fixtures quando a API retorna vazio", async () => {
    const client = new ApiClient(
      "https://api.example/api/v1",
      async () => null,
      async (url) => {
        const offset = Number(new URL(String(url)).searchParams.get("offset"));
        return Response.json({
          data: offset === 0 ? [remote] : [],
          pagination: { limit: 100, offset, total: offset === 0 ? 101 : 1 },
        });
      },
    );
    expect(
      await createApiService(client, async () => {}).listLineups(),
    ).toHaveLength(1);
    const empty = new ApiClient(
      "/api/v1",
      async () => null,
      async () =>
        Response.json({
          data: [],
          pagination: { limit: 100, offset: 0, total: 0 },
        }),
    );
    expect(await createApiService(empty, async () => {}).listLineups()).toEqual(
      [],
    );
  });
});

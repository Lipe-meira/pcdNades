import { describe, expect, it } from "vitest";
import { createApiService } from "../src/services/apiService";
import { ApiClient } from "../src/services/apiClient";
import { recognizeVideoSource } from "../src/domain/videoSource";
import type { LineupDraft } from "../src/domain/types";

const clip = { startSeconds: 1, endSeconds: 91 };
const file = new File(
  [new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109])],
  "source.mp4",
  { type: "video/mp4" },
);
const draft: LineupDraft = {
  title: "Trecho QA",
  mapId: "mirage",
  type: "smoke",
  side: "T",
  instructions: "Teste controlado.",
  target: { x: 0.4, y: 0.6 },
  media: { kind: "file", file, durationSeconds: 100, clip },
};
const caps = {
  upload: { enabled: true, maxBytes: 50_000_000, maxDurationSeconds: 90 },
  importers: {
    youtube: { enabled: false },
    tiktok: { enabled: false },
    instagram: { enabled: false },
  },
  trimming: {
    enabled: true,
    maxSourceDurationSeconds: 180,
    maxSourceBytes: 50_000_000,
    maxDurationSeconds: 90,
    minDurationSeconds: 0.1,
    timePrecisionSeconds: 0.001,
  },
};
const ready = {
  id: "media-id",
  status: "ready",
  sourceType: "upload",
  sourceUrl: null,
  error: null,
  stage: null,
  metadata: { durationSeconds: 90 },
  clip,
};

describe("contrato de seleção imutável", () => {
  it('só envia clip de link quando plataforma e recorte estão explicitamente habilitados', async () => {
    const sourceUrl = 'https://www.instagram.com/reel/ABC_123/';
    const client = new ApiClient('/api/v1', async()=> 'qa-token', async(url, init)=>{
      if(String(url).endsWith('/capabilities')) return Response.json({data:{...caps,importers:{...caps.importers,instagram:{enabled:true}}}});
      if(String(url).endsWith('/imports')) { expect(JSON.parse(init!.body as string)).toEqual({sourceUrl,clip}); return Response.json({data:{...ready,sourceType:'instagram',sourceUrl}}) }
      if(String(url).endsWith('/grenades'))return Response.json({data:{...draft,id:'id',video:{...ready,sourceType:'instagram',sourceUrl},createdAt:'2026-10-29',updatedAt:'2026-10-29'}});
      throw new Error('Unexpected');
    });
    await createApiService(client,async()=>{throw new Error('Não fazer upload de link no navegador')}).createLineup({...draft,media:{kind:'link',sourceUrl,clip}});
  });
  it("envia clip só na sessão, não no complete, e aceita origem maior que a saída", async () => {
    let uploads = 0;
    const client = new ApiClient(
      "/api/v1",
      async () => "qa-token",
      async (url, init) => {
        if (String(url).endsWith("/capabilities"))
          return Response.json({ data: caps });
        if (String(url).endsWith("/uploads")) {
          expect(JSON.parse(init!.body as string)).toEqual({ clip });
          return Response.json({
            data: {
              mediaId: "media-id",
              upload: {
                protocol: "supabase-signed",
                url: "https://project.supabase.co/upload",
                path: "media-id/source.mp4",
                token: "qa",
              },
              limits: caps.upload,
            },
          });
        }
        if (String(url).endsWith("/complete")) {
          expect(init?.body).toBeUndefined();
          return Response.json({ data: ready });
        }
        if (String(url).endsWith("/grenades"))
          return Response.json({
            data: {
              ...draft,
              id: "id",
              video: ready,
              createdAt: "2026-10-29",
              updatedAt: "2026-10-29",
            },
          });
        throw new Error("Unexpected");
      },
    );
    await createApiService(client, async () => {
      uploads++;
    }).createLineup(draft);
    expect(uploads).toBe(1);
  });
  it("recorte desabilitado não é ignorado nem cria sessão", async () => {
    const client = new ApiClient(
      "/api/v1",
      async () => null,
      async (url) => {
        expect(String(url)).toContain("/capabilities");
        return Response.json({
          data: { ...caps, trimming: { ...caps.trimming, enabled: false } },
        });
      },
    );
    await expect(
      createApiService(client, async () => {}).createLineup(draft),
    ).rejects.toMatchObject({ code: "CLIP_UNSUPPORTED" });
  });
  it("retomada recusa mídia de outro intervalo antes de publicar", async () => {
    const client = new ApiClient(
      "/api/v1",
      async () => "qa-token",
      async (url) => {
        expect(String(url)).toContain("/media/media-id");
        return Response.json({
          data: { ...ready, clip: { startSeconds: 0, endSeconds: 2 } },
        });
      },
    );
    await expect(
      createApiService(client, async () => {}).createLineup(draft, {
        mediaId: "media-id",
      }),
    ).rejects.toMatchObject({ code: "MEDIA_SELECTION_CHANGED" });
  });
  it("Instagram reconhecido não promete importação quando indisponível", async () => {
    expect(
      recognizeVideoSource("https://www.instagram.com/reel/ABC_123/"),
    ).toMatchObject({ platform: "instagram" });
    for (const url of [
      "https://instagram.com.evil.test/reel/ABC/",
      "https://youtube.com.evil.test/shorts/abcdefghijk",
      "https://www.instagram.com/reel/ABC/#x",
      "https://www.instagram.com/reel/%41BC/",
    ])
      expect(recognizeVideoSource(url)).toBeNull();
    const client = new ApiClient(
      "/api/v1",
      async () => null,
      async (url) => {
        expect(String(url)).toContain("/capabilities");
        return Response.json({ data: caps });
      },
    );
    await expect(
      createApiService(client, async () => {}).createLineup({
        ...draft,
        media: {
          kind: "link",
          sourceUrl: "https://www.instagram.com/reel/ABC_123/",
        },
      }),
    ).rejects.toMatchObject({ code: "PLATFORM_UNSUPPORTED" });
  });
});

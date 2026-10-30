import { describe, expect, it } from "vitest";
import { mapApiGrenade } from "../src/services/apiContracts";
import { createApiService } from "../src/services/apiService";
import { createDemoService } from "../src/services/lineupService";
import { ApiClient } from "../src/services/apiClient";
import { validateDraft } from "../src/domain/validation";
import type { LineupDraft } from "../src/domain/types";

const draft: LineupDraft = { title: "Origem QA", mapId: "mirage", type: "smoke", side: "T",
  instructions: "Execução controlada.", target: { x: .4, y: .6 }, media: { kind: "keep" } };
const record = { ...draft, target: { x: .4, y: .6 }, id: "qa", video: null, createdAt: "2026-10-30", updatedAt: "2026-10-30" };

describe("origem nullable e coordenadas da imagem", () => {
  it("normaliza API antiga/nullable sem fabricar ponto e mantém zeros", () => {
    expect(mapApiGrenade(record).origin).toBeNull();
    expect(mapApiGrenade({ ...record, origin: null }).origin).toBeNull();
    expect(mapApiGrenade({ ...record, origin: { x: 0, y: 1 } }).origin).toEqual({ x: 0, y: 1 });
    for (const origin of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: -.01, y: 0 }, { x: 1.01, y: 0 }])
      expect(() => mapApiGrenade({ ...record, origin })).toThrow();
  });
  it("valida origem informada e permite compatibilidade nullable no transporte", () => {
    for (const origin of [undefined, null, { x: 0, y: 0 }, { x: 1, y: 1 }])
      expect(validateDraft({ ...draft, origin }, ["mirage"], true)).toEqual({});
    expect(validateDraft({ ...draft, origin: { x: Infinity, y: 0 } }, ["mirage"], true).origin).toBeTruthy();
  });
  it("PATCH omite para preservar, envia null para limpar e mantém objeto em zero", async () => {
    const bodies: Record<string, unknown>[] = [];
    const client = new ApiClient("/api/v1", async () => "qa", async (_url, options) => {
      const body = JSON.parse(options!.body as string);
      bodies.push(body);
      return Response.json({ data: { ...record, ...body } });
    });
    const service = createApiService(client, async () => { throw new Error("Não enviar mídia em edição keep"); });
    await service.updateLineup("qa", draft);
    await service.updateLineup("qa", { ...draft, origin: null });
    await service.updateLineup("qa", { ...draft, origin: { x: 0, y: 1 } });
    expect(Object.hasOwn(bodies[0], "origin")).toBe(false);
    expect(bodies[1].origin).toBeNull();
    expect(bodies[2].origin).toEqual({ x: 0, y: 1 });
  });
  it("demo preserva origem omitida e remove apenas com null explícito", async () => {
    const service = createDemoService();
    const file = new File([new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109])], "qa.mp4", { type: "video/mp4" });
    const item = await service.createLineup({ ...draft, origin: { x: 0, y: 1 }, media: { kind: "file", file } });
    expect(item.origin).toEqual({ x: 0, y: 1 });
    expect((await service.updateLineup(item.id, draft)).origin).toEqual({ x: 0, y: 1 });
    expect((await service.updateLineup(item.id, { ...draft, origin: null })).origin).toBeNull();
    service.dispose();
  });
});

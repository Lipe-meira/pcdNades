import { describe, expect, it } from "vitest";
import { hasLevels, levelFor, levelInfo, levelText, levelsOf, mapLevelCatalog, pointInViewport, primaryLevel } from "../src/domain/mapLevels";
import type { Lineup, LineupDraft } from "../src/domain/types";
import { validateDraft } from "../src/domain/validation";
import { mapApiGrenade } from "../src/services/apiContracts";
import { makeLocalDraft, parseLocalDraft } from "../src/features/admin/localDraft";
import { filterLineups } from "../src/domain/lineups";

const link = { kind: "link", sourceUrl: "https://www.youtube.com/shorts/abcdefghijk" } as const;
const nuke: LineupDraft = { title: "Smoke entre andares", mapId: "nuke", type: "smoke", side: "T", instructions: "Passos",
  origin: { x: 0.6, y: 0.45 }, originLevel: "upper", target: { x: 0.58, y: 0.5 }, targetLevel: "lower", media: link };
const record = { ...nuke, target: { x: 0.58, y: 0.5 }, id: "n1", video: null, createdAt: "2026-11-11", revision: 1, updatedAt: "2026-11-11" };

describe("catálogo de andares", () => {
  it("só a Nuke tem andares, com 1 = superior e 2 = inferior no mesmo sistema de coordenadas", () => {
    expect(hasLevels("nuke")).toBe(true);
    for (const id of ["mirage", "inferno", "ancient", "cache", "dust2", "anubis"]) {
      expect(hasLevels(id)).toBe(false);
      expect(levelFor(id, "upper")).toBeUndefined();
    }
    const config = levelsOf("nuke")!;
    expect(config.levels.map((item) => [item.label, item.id, item.radarUrl])).toEqual([
      ["1", "upper", "/maps/valve/nuke.png"], ["2", "lower", "/maps/valve/nuke_lower.png"],
    ]);
    expect(config.defaultLevel).toBe("upper");
  });
  it("registro sem andar usa o padrão e ids desconhecidos não quebram", () => {
    expect(levelFor("nuke", null)).toBe("upper");
    expect(levelFor("nuke", undefined)).toBe("upper");
    expect(levelFor("nuke", "lower")).toBe("lower");
    expect(levelFor("nuke", "basement" as never)).toBe("upper");
    expect(levelText("nuke", "lower")).toBe("andar 2 (inferior)");
    expect(levelInfo("nuke", "upper")?.areas).toContain("Bomb A");
    expect(levelInfo("nuke", "lower")?.areas).toContain("Bomb B");
  });
  it("o recorte exibido cobre todo o conteúdo desenhado sem alterar as coordenadas gravadas", () => {
    const { viewport } = mapLevelCatalog.nuke;
    // Conteúdo medido nos PNGs 1024×1024: superior px 63–998 × 280–769; inferior px 494–729 × 280–764.
    for (const [x, y] of [[63, 280], [998, 769], [494, 280], [729, 764]]) {
      const inside = pointInViewport({ x: x / 1024, y: y / 1024 }, viewport);
      expect(inside.x).toBeGreaterThan(0); expect(inside.x).toBeLessThan(1);
      expect(inside.y).toBeGreaterThan(0); expect(inside.y).toBeLessThan(1);
    }
    expect(viewport.width / viewport.height).toBeGreaterThan(1.5);
    // Posição no recorte é afim e invertível: x_recorte * largura + x0 devolve a coordenada gravada.
    const p = { x: 0.571, y: 0.508 };
    const view = pointInViewport(p, viewport);
    expect(view.x * viewport.width + viewport.x).toBeCloseTo(p.x, 10);
    expect(view.y * viewport.height + viewport.y).toBeCloseTo(p.y, 10);
  });
  it("andar principal de uma granada simples e de um Solo Exec", () => {
    const base = { ...record, video: { id: "", status: "missing" } } as unknown as Lineup;
    expect(primaryLevel(base)).toBe("lower");
    const solo = { ...base, type: "solo_exec", destinations: [{ x: 0.1, y: 0.1, type: "smoke", level: "upper" }, { x: 0.2, y: 0.2, type: "he", level: "lower" }], targetLevel: "upper" } as Lineup;
    expect(primaryLevel(solo)).toBe("upper");
    expect(primaryLevel({ ...base, mapId: "mirage" } as Lineup)).toBeUndefined();
    expect(primaryLevel({ ...base, targetLevel: null } as Lineup)).toBe("upper"); // legado
  });
});

describe("validação com andares", () => {
  it("exige andar de origem e destino na Nuke e aceita origem e destino em andares diferentes", () => {
    expect(validateDraft(nuke, ["nuke"])).toEqual({});
    expect(validateDraft({ ...nuke, targetLevel: null }, ["nuke"])).toHaveProperty("targetLevel");
    expect(validateDraft({ ...nuke, originLevel: null }, ["nuke"])).toHaveProperty("originLevel");
    expect(validateDraft({ ...nuke, targetLevel: "basement" as never }, ["nuke"])).toHaveProperty("targetLevel");
    expect(validateDraft({ ...nuke, origin: null, originLevel: null }, ["nuke"])).toEqual({});
  });
  it("Solo Exec exige o andar de cada destino e preserva os tipos", () => {
    const solo: LineupDraft = { ...nuke, type: "solo_exec", targetLevel: "upper",
      destinations: [{ x: 0.58, y: 0.5, type: "smoke", level: "upper" }, { x: 0.6, y: 0.6, type: "he", level: "lower" }] };
    expect(validateDraft(solo, ["nuke"])).toEqual({});
    const semAndar = { ...solo, destinations: [solo.destinations![0], { ...solo.destinations![1], level: null }] };
    expect(validateDraft(semAndar, ["nuke"])).toHaveProperty("destinations");
  });
  it("outros mapas seguem sem campos de andar", () => {
    const mirage: LineupDraft = { ...nuke, mapId: "mirage", originLevel: undefined, targetLevel: undefined };
    expect(validateDraft(mirage, ["mirage"])).toEqual({});
    expect(validateDraft({ ...mirage, targetLevel: "upper" }, ["mirage"])).toHaveProperty("targetLevel");
    expect(validateDraft({ ...mirage, originLevel: null, targetLevel: null }, ["mirage"])).toEqual({});
  });
});

describe("contrato e rascunho", () => {
  it("lê andares da API, trata registros anteriores como nulos e recusa ids inválidos", () => {
    const item = mapApiGrenade(record as never);
    expect([item.originLevel, item.targetLevel]).toEqual(["upper", "lower"]);
    const legado = mapApiGrenade({ ...record, mapId: "mirage", originLevel: undefined, targetLevel: undefined } as never);
    expect([legado.originLevel, legado.targetLevel]).toEqual([null, null]);
    expect(() => mapApiGrenade({ ...record, targetLevel: "basement" } as never)).toThrow();
    const solo = { ...record, type: "solo_exec", destinations: [{ x: 0.58, y: 0.5, type: "he", level: "lower" }] };
    expect(mapApiGrenade(solo as never).destinations?.[0]).toMatchObject({ type: "he", level: "lower" });
    expect(() => mapApiGrenade({ ...solo, destinations: [{ x: 0.58, y: 0.5, type: "he", level: "x" }] } as never)).toThrow();
  });
  it("rascunho local guarda e recupera os andares e os tipos do Solo Exec", () => {
    const solo: LineupDraft = { ...nuke, type: "solo_exec", targetLevel: "upper",
      destinations: [{ x: 0.58, y: 0.5, type: "smoke", level: "upper" }, { x: 0.6, y: 0.6, type: "he", level: "lower" }] };
    const back = parseLocalDraft(JSON.stringify(makeLocalDraft(solo, 1, null, true, false)), ["nuke"])!;
    expect(back.fields.originLevel).toBe("upper");
    expect(back.fields.targetLevel).toBe("upper");
    expect(back.fields.destinations).toEqual(solo.destinations);
    const corrupto = JSON.parse(JSON.stringify(makeLocalDraft(nuke, 0, null, true, false)));
    corrupto.fields.originLevel = "basement";
    expect(parseLocalDraft(JSON.stringify(corrupto), ["nuke"])).toBeNull();
  });
  it("filtros da biblioteca continuam independentes do andar", () => {
    const items = [{ id: "a", mapId: "nuke", type: "smoke", side: "T", targetLevel: "upper" }, { id: "b", mapId: "nuke", type: "he", side: "T", targetLevel: "lower" }] as const;
    expect(filterLineups(items, { mapId: "nuke", type: "all", side: "all" })).toHaveLength(2);
    expect(filterLineups(items, { mapId: "nuke", type: "he", side: "all" }).map((x) => x.id)).toEqual(["b"]);
  });
});

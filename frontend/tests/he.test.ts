import { describe, expect, it } from "vitest";
import { filterLineups } from "../src/domain/lineups";
import { isGrenadeType, isSingleGrenadeType, typeLabels } from "../src/domain/types";
import type { LineupDraft } from "../src/domain/types";
import { validateDraft } from "../src/domain/validation";
import { mapApiGrenade } from "../src/services/apiContracts";
import { makeLocalDraft, parseLocalDraft } from "../src/features/admin/localDraft";
import { captureAudio, initialAudio, restoreAudio } from "../src/domain/playback";

const base: LineupDraft = { title: "HE no meio", mapId: "mirage", type: "he", side: "T",
  instructions: "Mire no ponto e arremesse.", target: { x: .4, y: .6 }, media: { kind: "link", sourceUrl: "https://www.youtube.com/shorts/abcdefghijk" } };
const record = { ...base, target: { x: .4, y: .6 }, id: "he-1", video: null, createdAt: "2026-11-10", revision: 1, updatedAt: "2026-11-10" };

describe("granada HE", () => {
  it("é um tipo individual válido com rótulo HE Grenade", () => {
    expect(typeLabels.he).toBe("HE Grenade");
    expect(isSingleGrenadeType("he")).toBe(true);
    expect(isGrenadeType("he")).toBe(true);
    expect(isGrenadeType("frag")).toBe(false);
    expect(isSingleGrenadeType("solo_exec")).toBe(false);
  });
  it("valida cadastro como HE e como destino do Solo Exec", () => {
    expect(validateDraft(base, ["mirage"])).toEqual({});
    const solo: LineupDraft = { ...base, type: "solo_exec", origin: { x: .1, y: .1 }, destinations: [{ x: .4, y: .6, type: "he" }] };
    expect(validateDraft(solo, ["mirage"])).toEqual({});
    const invalid = { ...solo, destinations: [{ x: .4, y: .6, type: "frag" as never }] };
    expect(validateDraft(invalid, ["mirage"])).toHaveProperty("destinations");
    expect(validateDraft({ ...base, type: "frag" as never }, ["mirage"])).toHaveProperty("type");
  });
  it("filtra HE sem misturar com outros tipos", () => {
    const items = [{ id: "a", mapId: "mirage", type: "he", side: "T" }, { id: "b", mapId: "mirage", type: "smoke", side: "T" }] as const;
    expect(filterLineups(items, { mapId: "mirage", type: "he", side: "all" }).map(x => x.id)).toEqual(["a"]);
    expect(filterLineups(items, { mapId: "mirage", type: "all", side: "all" })).toHaveLength(2);
  });
  it("aceita HE no contrato da API, inclusive em destinos, e recusa tipo desconhecido", () => {
    expect(mapApiGrenade(record).type).toBe("he");
    const solo = { ...record, type: "solo_exec" as const, origin: { x: .1, y: .1 }, destinations: [{ x: .4, y: .6, type: "he" as const }] };
    expect(mapApiGrenade(solo).destinations?.[0].type).toBe("he");
    expect(() => mapApiGrenade({ ...record, type: "frag" as never })).toThrow();
    expect(() => mapApiGrenade({ ...solo, destinations: [{ x: .4, y: .6, type: "frag" as never }] })).toThrow();
  });
  it("recupera rascunho local com HE", () => {
    const solo: LineupDraft = { ...base, type: "solo_exec", origin: { x: .1, y: .1 }, destinations: [{ x: .4, y: .6, type: "he" }] };
    expect(parseLocalDraft(JSON.stringify(makeLocalDraft(solo, 1, null, true, false)), ["mirage"])?.fields.destinations).toEqual(solo.destinations);
    expect(parseLocalDraft(JSON.stringify(makeLocalDraft(base, 1, null, true, false)), ["mirage"])?.fields.type).toBe("he");
  });
});

describe("áudio dos players", () => {
  it("todo vídeo novo começa mutado e a escolha do usuário é restaurada sem alterações", () => {
    expect(initialAudio).toEqual({ muted: true, volume: 1 });
    const antigo = { muted: false, volume: 0.4 };
    const novo = { muted: true, volume: 1 };
    restoreAudio(novo, captureAudio(antigo));
    expect(novo).toEqual({ muted: false, volume: 0.4 });
    expect(captureAudio({ muted: true, volume: 1, extra: 1 } as never)).toEqual({ muted: true, volume: 1 });
  });
});

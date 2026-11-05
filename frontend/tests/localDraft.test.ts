import { describe, expect, it } from "vitest";
import { localDraftKey, makeLocalDraft, parseLocalDraft } from "../src/features/admin/localDraft";
import type { LineupDraft } from "../src/domain/types";

const draft: LineupDraft = { title: "Teste", mapId: "map", type: "solo_exec", side: "T", instructions: "Passos", origin: {x: .1, y: .2}, target: {x: .3, y: .4}, destinations: [{x: .3, y: .4, type: "smoke"}], media: { kind: "link", sourceUrl: "https://example.test/?token=secret" } };
describe("rascunho local", () => {
  it("serializa apenas campos permitidos e recupera pontos", () => {
    const raw = JSON.stringify(makeLocalDraft(draft, 1, null, true, false));
    expect(raw).not.toContain("secret");
    expect(raw).not.toContain("media");
    expect(parseLocalDraft(raw, ["map"])?.fields.destinations).toEqual(draft.destinations);
  });
  it("isola conta e edição e rejeita dados inválidos", () => {
    expect(localDraftKey("a", "x")).not.toBe(localDraftKey("b", "x"));
    expect(localDraftKey("a", "x")).not.toBe(localDraftKey("a", "y"));
    expect(parseLocalDraft("{", ["map"])).toBeNull();
    expect(parseLocalDraft(JSON.stringify({...makeLocalDraft(draft, 1, null, true, false), version: 2}), ["map"])).toBeNull();
    expect(parseLocalDraft(JSON.stringify(makeLocalDraft(draft, 1, null, true, false)), ["outro"])).toBeNull();
  });
});
